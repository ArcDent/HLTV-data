// Package hltvfetch provides a pure-local HLTV HTML fetcher that bypasses
// Cloudflare's TLS-fingerprint block via uTLS, with no external service,
// proxy, or headless browser.
//
// Usage:
//
//	f := hltvfetch.New(hltvfetch.WithTimeout(15*time.Second))
//	body, err := f.Fetch(context.Background(), "/matches")
//
// Design notes are in hltv-utls-fetch/README.md.
package hltvfetch

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	tlsutls "github.com/refraction-networking/utls"
	"golang.org/x/net/http2"
)

const baseURL = "https://www.hltv.org"

// iOS Safari UA matching HelloIOS_Auto. UA and TLS fingerprint must agree,
// or Cloudflare's cross-check returns 403.
const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
	"AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/605.1.15"

// Fetcher fetches raw HLTV HTML. The zero value is not usable; use New.
type Fetcher struct {
	client     *http.Client
	maxRetries int
	profile    tlsutls.ClientHelloID
}

// Option configures a Fetcher.
type Option func(*Fetcher)

// WithTimeout sets per-request timeout (default 20s).
func WithTimeout(d time.Duration) Option {
	return func(f *Fetcher) {
		f.client.Timeout = d
		// rebuild transport with matching dial timeout
		f.client.Transport = newTransport(f.profile, d)
	}
}

// WithRetries sets the number of retries on 5xx/network errors (default 2).
func WithRetries(n int) Option {
	return func(f *Fetcher) { f.maxRetries = n }
}

// WithProfile overrides the uTLS ClientHello profile (default HelloIOS_Auto).
// Only change this if HLTV starts blocking iOS — see README for tested profiles.
func WithProfile(p tlsutls.ClientHelloID) Option {
	return func(f *Fetcher) {
		f.profile = p
		f.client.Transport = newTransport(p, f.client.Timeout)
	}
}

// New returns a Fetcher ready to call Fetch.
func New(opts ...Option) *Fetcher {
	f := &Fetcher{
		maxRetries: 2,
		profile:    tlsutls.HelloIOS_Auto,
		client:     &http.Client{Timeout: 20 * time.Second},
	}
	f.client.Transport = newTransport(f.profile, f.client.Timeout)
	for _, o := range opts {
		o(f)
	}
	return f
}

// Fetch returns the raw HTML for a HLTV path (e.g. "/matches", "/results").
// It retries on transient errors and returns a typed *FetchError on failure.
func (f *Fetcher) Fetch(ctx context.Context, path string) ([]byte, error) {
	url := baseURL + path
	var lastErr error
	for attempt := 0; attempt <= f.maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-time.After(time.Duration(attempt) * 400 * time.Millisecond):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		body, _, retryable, err := f.doOnce(ctx, url)
		if err == nil {
			return body, nil
		}
		lastErr = err
		if !retryable {
			return nil, err
		}
	}
	return nil, &FetchError{Code: "UNAVAILABLE", Retryable: true,
		Message: fmt.Sprintf("failed after %d attempts: %v", f.maxRetries+1, lastErr)}
}

func (f *Fetcher) doOnce(ctx context.Context, url string) (body []byte, status int, retryable bool, err error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, 0, false, err
	}
	req.Header.Set("User-Agent", iosUA)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, 0, true, &FetchError{Code: "NETWORK", Retryable: true, Message: err.Error()}
	}
	defer resp.Body.Close()
	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, true, &FetchError{Code: "READ", Retryable: true, Message: err.Error()}
	}
	if isCloudflareBlock(body) {
		return nil, resp.StatusCode, true, &FetchError{Code: "CHALLENGE", Retryable: true,
			Message: "Cloudflare challenge page"}
	}
	if resp.StatusCode == 403 || resp.StatusCode == 404 {
		return nil, resp.StatusCode, false, &FetchError{Code: "NOT_FOUND", Retryable: false,
			Message: fmt.Sprintf("HTTP %d for %s", resp.StatusCode, url)}
	}
	if resp.StatusCode >= 500 {
		return nil, resp.StatusCode, true, &FetchError{Code: "SERVER", Retryable: true,
			Message: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}
	return body, resp.StatusCode, false, nil
}

// newTransport builds the uTLS+HTTP/2 transport. HLTV negotiates h2 only,
// so http2.Transport is used directly (not net/http + ConfigureTransports).
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

func isCloudflareBlock(body []byte) bool {
	s := string(body)
	return strings.Contains(s, "Just a moment") ||
		strings.Contains(s, "cf-browser-verify") ||
		strings.Contains(s, "Attention Required") ||
		strings.Contains(s, "Enable JavaScript and cookies to continue")
}

// FetchError is returned by Fetch on terminal failure.
type FetchError struct {
	Code      string // NETWORK, READ, CHALLENGE, NOT_FOUND, SERVER, UNAVAILABLE
	Retryable bool
	Message   string
}

func (e *FetchError) Error() string { return e.Code + ": " + e.Message }
