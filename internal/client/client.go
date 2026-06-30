package client

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	tlsutls "github.com/refraction-networking/utls"

	"github.com/arcdent/hltv-mcp/internal/config"
	"github.com/arcdent/hltv-mcp/internal/types"
)

const baseURL = "https://www.hltv.org"

// HltvClient fetches HLTV HTML over a uTLS (iOS Safari) transport that
// bypasses Cloudflare's JA3/JA4 fingerprint check.
//
// statsCli is a separate client using a desktop Chrome fingerprint for /stats/*
// paths, which are behind stricter Cloudflare path-level protection that
// rejects the iOS Safari fingerprint with HTTP 403. Other paths keep using the
// iOS Safari fingerprint (httpCli) and are unaffected.
type HltvClient struct {
	cfg     *config.Config
	httpCli *http.Client
	statsCli *http.Client
}

// NewHltvClient builds a client whose Transport impersonates iOS Safari.
// A second client (statsCli) impersonates desktop Chrome for /stats/* paths.
func NewHltvClient(cfg *config.Config) *HltvClient {
	timeout := time.Duration(cfg.HTTPTimeoutMs) * time.Millisecond
	cli := &http.Client{Timeout: timeout}
	cli.Transport = newTransport(tlsutls.HelloIOS_Auto, timeout)

	statsCli := &http.Client{Timeout: timeout}
	statsCli.Transport = newStatsTransport(timeout)

	return &HltvClient{cfg: cfg, httpCli: cli, statsCli: statsCli}
}

// FetchHTML fetches a path on hltv.org with retry on transient errors.
// endpointKey is preserved for log/observability but does not change behavior.
// Paths prefixed with /stats/ use the desktop Chrome transport; all others use
// the default iOS Safari transport.
func (c *HltvClient) FetchHTML(ctx context.Context, path, endpointKey string) ([]byte, error) {
	url := baseURL + path
	httpCli := c.httpCli
	if strings.HasPrefix(path, "/stats/") {
		httpCli = c.statsCli
	}
	var lastErr error
	for attempt := 0; attempt <= c.cfg.RetryCount; attempt++ {
		if attempt > 0 {
			select {
			case <-time.After(time.Duration(attempt) * 600 * time.Millisecond):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		body, _, retryable, err := c.doOnce(ctx, url, path, httpCli)
		if err == nil {
			return body, nil
		}
		lastErr = err
		if !retryable {
			return nil, err
		}
	}
	return nil, &types.ToolError{
		Code:      types.ErrUnavailable,
		Message:   fmt.Sprintf("failed after %d attempts: %v", c.cfg.RetryCount+1, lastErr),
		Retryable: true,
	}
}

// doOnce performs a single fetch and classifies the result.
func (c *HltvClient) doOnce(ctx context.Context, url, path string, httpCli *http.Client) (body []byte, status int, retryable bool, err error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, 0, false, err
	}
	// Select UA + headers by path: /stats/* uses desktop Chrome fingerprint +
	// full Sec-Fetch-* header set to satisfy Cloudflare path-level protection.
	if strings.HasPrefix(path, "/stats/") {
		req.Header.Set("User-Agent", desktopChromeUA)
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,application/signed-exchange;v=b3;q=0.7,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
		req.Header.Set("Sec-Fetch-Site", "none")
		req.Header.Set("Sec-Fetch-Mode", "navigate")
		req.Header.Set("Sec-Fetch-Dest", "document")
		req.Header.Set("Referer", "https://www.hltv.org/")
		req.Header.Set("Upgrade-Insecure-Requests", "1")
	} else {
		req.Header.Set("User-Agent", iosUA)
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	}

	resp, err := httpCli.Do(req)
	if err != nil {
		return nil, 0, true, &types.ToolError{Code: types.ErrNetwork, Retryable: true, Message: err.Error()}
	}
	defer resp.Body.Close()
	body, err = io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, true, &types.ToolError{Code: types.ErrRead, Retryable: true, Message: err.Error()}
	}
	if isCloudflareBlock(body) {
		return nil, resp.StatusCode, true, &types.ToolError{Code: types.ErrChallenge, Retryable: true, Message: "Cloudflare challenge page"}
	}
	if resp.StatusCode == 403 || resp.StatusCode == 404 {
		// /stats/* is behind Cloudflare path-level protection: a 403 there is a
		// challenge/blocked response, not a true NotFound. Mark it retryable so
		// FetchHTML retries once for transient CF jitter, and on persistent 403
		// return ErrChallenge so the handler degrades to partial:true instead
		// of treating it as a definitive "not found".
		if resp.StatusCode == 403 && strings.HasPrefix(path, "/stats/") {
			return nil, resp.StatusCode, true, &types.ToolError{Code: types.ErrChallenge, Retryable: true, Message: fmt.Sprintf("HTTP 403 (Cloudflare path block) for %s", url)}
		}
		return nil, resp.StatusCode, false, &types.ToolError{Code: types.ErrNotFound, Retryable: false, Message: fmt.Sprintf("HTTP %d for %s", resp.StatusCode, url)}
	}
	if resp.StatusCode >= 500 {
		return nil, resp.StatusCode, true, &types.ToolError{Code: types.ErrServer, Retryable: true, Message: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}
	return body, resp.StatusCode, false, nil
}

var cfSignatures = []string{
	"Just a moment",
	"cf-browser-verify",
	"Attention Required",
	"Enable JavaScript and cookies to continue",
}

func isCloudflareBlock(body []byte) bool {
	s := string(body)
	for _, sig := range cfSignatures {
		if strings.Contains(s, sig) {
			return true
		}
	}
	return false
}
