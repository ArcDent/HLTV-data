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
type HltvClient struct {
	cfg     *config.Config
	httpCli *http.Client
}

// NewHltvClient builds a client whose Transport impersonates iOS Safari.
func NewHltvClient(cfg *config.Config) *HltvClient {
	timeout := time.Duration(cfg.HTTPTimeoutMs) * time.Millisecond
	cli := &http.Client{Timeout: timeout}
	cli.Transport = newTransport(tlsutls.HelloIOS_Auto, timeout)
	return &HltvClient{cfg: cfg, httpCli: cli}
}

// FetchHTML fetches a path on hltv.org with retry on transient errors.
// endpointKey is preserved for log/observability but does not change behavior.
func (c *HltvClient) FetchHTML(ctx context.Context, path, endpointKey string) ([]byte, error) {
	url := baseURL + path
	var lastErr error
	for attempt := 0; attempt <= c.cfg.RetryCount; attempt++ {
		if attempt > 0 {
			select {
			case <-time.After(time.Duration(attempt) * 600 * time.Millisecond):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		body, _, retryable, err := c.doOnce(ctx, url)
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
func (c *HltvClient) doOnce(ctx context.Context, url string) (body []byte, status int, retryable bool, err error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, 0, false, err
	}
	req.Header.Set("User-Agent", iosUA)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := c.httpCli.Do(req)
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
