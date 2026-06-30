package client

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"time"

	tlsutls "github.com/refraction-networking/utls"
	"golang.org/x/net/http2"
)

// iosUA matches the HelloIOS_Auto TLS fingerprint. UA and fingerprint must
// agree, or Cloudflare's cross-check returns 403.
const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
	"AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/605.1.15"

// desktopChromeUA matches the HelloChrome_Auto TLS fingerprint. Used for
// /stats/* paths where Cloudflare applies stricter path-level protection that
// rejects the iOS Safari fingerprint with HTTP 403.
const desktopChromeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
	"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

// newTransport builds the uTLS+HTTP/2 transport. HLTV negotiates h2 only, so
// http2.Transport is used directly (not net/http + ConfigureTransports, which
// fails with "malformed HTTP response" on a custom DialTLSContext connection).
func newTransport(profile tlsutls.ClientHelloID, timeout time.Duration) http.RoundTripper {
	dialer := &net.Dialer{Timeout: timeout}
	return &http2.Transport{
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
	}
}

// newStatsTransport builds a uTLS transport that impersonates desktop Chrome.
// /stats/* paths on HLTV are behind stricter Cloudflare path-level protection
// that rejects the iOS Safari fingerprint (HelloIOS_Auto) with HTTP 403; the
// desktop Chrome fingerprint (HelloChrome_Auto) is more likely to pass.
func newStatsTransport(timeout time.Duration) http.RoundTripper {
	return newTransport(tlsutls.HelloChrome_Auto, timeout)
}
