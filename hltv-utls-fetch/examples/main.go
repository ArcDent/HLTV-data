// Command hltv-utls-demo demonstrates fetching HLTV's raw HTML pages using a
// pure-local uTLS transport that impersonates iOS Safari's TLS fingerprint.
//
// Why this exists:
// HLTV sits behind Cloudflare, which blocks Go's standard net/http and curl
// with HTTP 403 on /matches, /results, / and other endpoints. The block is
// decided at the TLS layer (JA3/JA4 fingerprint of the ClientHello), BEFORE
// any HTTP header is read, so spoofing User-Agent / Accept does nothing.
//
// The fix: replace Go's crypto/tls handshake with github.com/refraction-networking/utls,
// which reproduces a real browser's ClientHello. HelloIOS_Auto is the only
// profile empirically confirmed (2026-06) to pass every blocked endpoint,
// including /matches. No proxy, no headless browser, no third-party API.
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	tlsutls "github.com/refraction-networking/utls"
	"golang.org/x/net/http2"
)

// iOS Safari UA must match the TLS fingerprint (HelloIOS_Auto). Cloudflare
// cross-checks the UA against the JA3/JA4 hash; a desktop Chrome UA on an
// iOS TLS fingerprint fails the cross-check and gets 403.
const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
	"AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/605.1.15"

func main() {
	client := newImpersonatingClient(tlsutls.HelloIOS_Auto, 30*time.Second)

	endpoints := []string{
		"https://www.hltv.org/matches",
		"https://www.hltv.org/results",
		"https://www.hltv.org/",
		"https://www.hltv.org/player/11893/zywoo",
		"https://www.hltv.org/team/5378/vitality",
		"https://www.hltv.org/news/archive",
		"https://www.hltv.org/search?query=vitality",
	}

	save := len(os.Args) > 1 && os.Args[1] == "--save"

	for _, u := range endpoints {
		t0 := time.Now()
		body, status, err := fetch(client, u)
		dt := time.Since(t0)
		if err != nil {
			fmt.Printf("%-45s ERR  %6.2fs  %v\n", u, dt.Seconds(), err)
			continue
		}
		blocked := isCloudflareBlock(body)
		fmt.Printf("%-45s HTTP=%d  %6.2fs  size=%d  blocked=%v\n",
			u, status, dt.Seconds(), len(body), blocked)
		if save && !blocked {
			name := strings.TrimPrefix(u, "https://www.hltv.org/")
			if name == "" {
				name = "index"
			}
			name = strings.ReplaceAll(name, "/", "_")
			os.WriteFile("dump_"+name+".html", body, 0644)
		}
	}
}

func fetch(c *http.Client, url string) ([]byte, int, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", iosUA)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	resp, err := c.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return body, resp.StatusCode, err
}

// newImpersonatingClient builds an HTTP/2 client whose TLS handshake mimics
// the given browser profile. HLTV negotiates h2 exclusively, so we use
// http2.Transport directly; http.Transport + ConfigureTransports does NOT
// work because the ALPN-negotiated h2 stream never gets handed off.
func newImpersonatingClient(profile tlsutls.ClientHelloID, timeout time.Duration) *http.Client {
	dialer := &net.Dialer{Timeout: timeout}
	return &http.Client{
		Timeout: timeout,
		Transport: &http2.Transport{
			AllowHTTP: false,
			DialTLSContext: func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
				host, _, err := net.SplitHostPort(addr)
				if err != nil {
					return nil, err
				}
				tcpConn, err := dialer.DialContext(ctx, network, addr)
				if err != nil {
					return nil, err
				}
				uConn := tlsutls.UClient(tcpConn, &tlsutls.Config{ServerName: host}, profile)
				if err := uConn.HandshakeContext(ctx); err != nil {
					tcpConn.Close()
					return nil, err
				}
				return uConn, nil
			},
		},
	}
}

// isCloudflareBlock detects Cloudflare's interstitial/challenge pages so a
// 200 with a challenge body is not mistaken for success.
func isCloudflareBlock(body []byte) bool {
	s := string(body)
	return strings.Contains(s, "Just a moment") ||
		strings.Contains(s, "cf-browser-verify") ||
		strings.Contains(s, "Attention Required") ||
		strings.Contains(s, "Enable JavaScript and cookies to continue")
}
