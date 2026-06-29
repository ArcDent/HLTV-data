# uTLS Transport Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace standard `net/http` with a uTLS (iOS Safari fingerprint) transport across all HLTV endpoints, remove the Firecrawl paid-API dependency, and unify the two divergent error-code systems into one fine-grained set.

**Architecture:** A new `internal/client/transport.go` builds an `http2.Transport` whose `DialTLSContext` performs a uTLS `UClient` handshake with `HelloIOS_Auto`. `FetchHTML` is rewritten to use this transport, an iOS Safari User-Agent, a retry loop that honors a per-error `Retryable` flag, and explicit per-iteration body closing (fixing the existing `defer` leak). Firecrawl code, config, env vars, and the `hltv-utls-fetch/` PoC directory are deleted; the PoC's `.md` docs are preserved under `docs/`.

**Tech Stack:** Go 1.26, `github.com/refraction-networking/utls` v1.8.2, `golang.org/x/net/http2`, mark3labs/mcp-go, chi.

**Source spec:** `docs/superpowers/specs/2026-06-29-utls-refactor-design.md`
**PoC source of truth:** `hltv-utls-fetch/hltvfetch/fetcher.go` (verbatim code excerpts below)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `internal/client/transport.go` | Create | uTLS transport builder + iOS Safari UA constant |
| `internal/client/client.go` | Modify | `NewHltvClient` uses uTLS transport; `FetchHTML` rewritten with retry + error classification; `isCloudflareBlock` signatures updated; defer leak fixed |
| `internal/client/client_test.go` | Modify | Tests for new error codes, updated CF signatures, retryable logic |
| `internal/types/types.go` | Modify | Add unified error-code constants |
| `internal/scraper/scrapers.go` | Modify | Remove Firecrawl fallback from `MatchesScraper.GetUpcoming` |
| `internal/config/config.go` | Modify | Remove `FirecrawlKey` field + `FIRECRAWL_API_KEY` env |
| `internal/facade/facade.go` | Modify | No code change expected (pass-through), but verify |
| `internal/http/handlers/search.go` | Modify | `UPSTREAM_UNAVAILABLE` → `UNAVAILABLE` |
| `internal/http/handlers/news.go` | Modify | `UPSTREAM_UNAVAILABLE` → `UNAVAILABLE` |
| `internal/client/firecrawl.go` | Delete | Firecrawl fully removed |
| `Dockerfile` | Modify | Remove `ENV FIRECRAWL_API_KEY=` |
| `docker-compose.yml` | Modify | Remove `FIRECRAWL_API_KEY` env line |
| `docs/utls-bypass-readme.md` | Create (move) | Moved from `hltv-utls-fetch/README.md` |
| `docs/utls-bypass-implementation.md` | Create (move) | Moved from `hltv-utls-fetch/IMPLEMENTATION.md` |
| `hltv-utls-fetch/` | Delete | Entire directory (docs already moved) |
| `go.mod` / `go.sum` | Modify | Add `refraction-networking/utls` v1.8.2 |

**Execution order note:** Tasks 1–7 are largely sequential because they touch overlapping files (`client.go`, `types.go`). Task 4 (delete Firecrawl) must come after Task 3 (FetchHTML no longer depends on it) and Task 5 (scrapers no longer call it). Task 6 (error-code migration) can run in parallel with Task 4 only if the agent is careful — recommended sequential.

---

### Task 1: Add uTLS dependency and create transport.go

**Files:**
- Create: `internal/client/transport.go`
- Modify: `go.mod`, `go.sum`

- [ ] **Step 1: Add the uTLS dependency**

Run from project root:
```bash
go get github.com/refraction-networking/utls@v1.8.2
go mod tidy
```
Expected: `go.mod` gains `github.com/refraction-networking/utls v1.8.2` as a direct require; `golang.org/x/net` is promoted to direct (it was indirect). `go.sum` updated.

- [ ] **Step 2: Create `internal/client/transport.go`**

```go
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
```

- [ ] **Step 3: Verify it compiles**

Run: `go build ./internal/client/`
Expected: no output (success). If `golang.org/x/net/http2` is missing, `go mod tidy` again.

- [ ] **Step 4: Commit**

```bash
git add go.mod go.sum internal/client/transport.go
git commit -m "feat(client): add uTLS transport builder with iOS Safari fingerprint"
```

---

### Task 2: Add unified error-code constants to types.go

**Files:**
- Modify: `internal/types/types.go` (add constants after the existing `MatchOutcome` const block near line 44)
- Test: `internal/types/types_test.go` (create)

**Context:** `ToolError` already has `Code string`, `Message string`, `Retryable bool`, `Details map[string]any` (types.go:143-148) and an `Error()` method. No code constants exist yet — all codes are scattered string literals.

- [ ] **Step 1: Write the failing test**

Create `internal/types/types_test.go`:
```go
package types

import "testing"

func TestErrorCodes(t *testing.T) {
	cases := []struct{ code string; retryable bool }{
		{ErrNetwork, true},
		{ErrRead, true},
		{ErrChallenge, true},
		{ErrNotFound, false},
		{ErrServer, true},
		{ErrUnavailable, true},
	}
	for _, c := range cases {
		if c.code == "" {
			t.Fatalf("error code constant is empty")
		}
	}
	if ErrNetwork != "NETWORK" || ErrRead != "READ" || ErrChallenge != "CHALLENGE" ||
		ErrNotFound != "NOT_FOUND" || ErrServer != "SERVER" || ErrUnavailable != "UNAVAILABLE" {
		t.Fatalf("error code values do not match spec")
	}
}

func TestToolErrorRetryable(t *testing.T) {
	e := &ToolError{Code: ErrNetwork, Message: "dial fail", Retryable: true}
	if !e.Retryable || e.Error() != "dial fail" {
		t.Fatalf("unexpected ToolError state: %+v", e)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/types/ -run TestErrorCodes -v`
Expected: FAIL / compile error — `ErrNetwork` (and friends) undefined.

- [ ] **Step 3: Add the constants**

In `internal/types/types.go`, add after the existing const block (around line 44):
```go
// Unified error codes for upstream fetch failures. See
// docs/superpowers/specs/2026-06-29-utls-refactor-design.md §6.
const (
	ErrNetwork     = "NETWORK"     // TCP/TLS dial failure — retryable
	ErrRead        = "READ"        // Response body read failure — retryable
	ErrChallenge   = "CHALLENGE"   // Cloudflare challenge page — retryable
	ErrNotFound    = "NOT_FOUND"   // 403/404 — not retryable
	ErrServer      = "SERVER"      // 5xx — retryable
	ErrUnavailable = "UNAVAILABLE" // All retries exhausted — not retryable
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/types/ -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/types/types.go internal/types/types_test.go
git commit -m "feat(types): add unified upstream error code constants"
```

---

### Task 3: Rewrite FetchHTML with uTLS, retry, and error classification

**Files:**
- Modify: `internal/client/client.go` (rewrite `NewHltvClient`, `FetchHTML`, `isCloudflareBlock`)
- Modify: `internal/client/client_test.go` (update for new CF signatures + classification)

**Context — current state (client.go):**
- `HltvClient` struct (lines 18-21): `cfg *config.Config`, `httpCli *http.Client`
- `NewHltvClient` (lines 23-28): creates `&http.Client{Timeout: ...}` — no custom Transport
- `FetchHTML(ctx, path, endpointKey string) ([]byte, error)` (line 31): net/http, Windows UA (line 37), **defer leak at line 50** (`defer resp.Body.Close()` inside loop), returns `UPSTREAM_NOT_FOUND` (403/404) and `UPSTREAM_UNAVAILABLE` (CF / exhausted)
- `isCloudflareBlock` (lines 82-88): checks `"Just a moment"`, `"cf-browser-verify"`, `"Attention Required"`, `"Cloudflare"` — the bare `"Cloudflare"` substring is too broad and must be removed; add `"Enable JavaScript and cookies to continue"`.

**Adaptation from PoC `fetcher.go`:** backoff is increased from 400ms to 600ms per the design spec §8.

- [ ] **Step 1: Write the failing test for updated Cloudflare detection**

Replace `internal/client/client_test.go` contents:
```go
package client

import "testing"

func TestIsCloudflareBlock(t *testing.T) {
	cases := []struct{ body string; want bool }{
		{"<html>Just a moment...</html>", true},
		{"<div cf-browser-verify>", true},
		{"Attention Required", true},
		{"Enable JavaScript and cookies to continue", true},
		{"<html><body>HLTV matches</body></html>", false},
		{"Welcome to Cloudflare CDN", false}, // bare "Cloudflare" no longer matches
		{"plain page with no challenge", false},
	}
	for _, c := range cases {
		if got := isCloudflareBlock([]byte(c.body)); got != c.want {
			t.Errorf("isCloudflareBlock(%q) = %v, want %v", c.body, got, c.want)
		}
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/client/ -run TestIsCloudflareBlock -v`
Expected: FAIL — old `isCloudflareBlock` matches bare `"Cloudflare"` (case 6 wants false, gets true) and lacks the `"Enable JavaScript..."` signature.

- [ ] **Step 3: Rewrite `client.go`**

Replace the entire contents of `internal/client/client.go`:
```go
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
```

**Note on the defer leak fix:** `doOnce` is now a separate function, so `defer resp.Body.Close()` runs at the end of each `doOnce` call (each attempt), not accumulated until `FetchHTML` returns. This is the fix for the original client.go:50 leak.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/client/ -v`
Expected: PASS (TestIsCloudflareBlock with 7 cases).

- [ ] **Step 5: Verify the whole module still compiles**

Run: `go build ./...`
Expected: no output. (Firecrawl removal in Task 4 will fix any remaining `FetchViaFirecrawl` references — if the build fails ONLY on `firecrawl.go` being referenced by `scrapers.go`, defer that to Task 4/5 and continue. If it fails elsewhere, stop and fix.)

- [ ] **Step 6: Commit**

```bash
git add internal/client/client.go internal/client/client_test.go
git commit -m "feat(client): rewrite FetchHTML with uTLS transport, retry, unified error codes"
```

---

### Task 4: Remove Firecrawl (code, config, env, Docker)

**Files:**
- Delete: `internal/client/firecrawl.go`
- Modify: `internal/config/config.go` (remove `FirecrawlKey` field + env load)
- Modify: `Dockerfile` (remove `ENV FIRECRAWL_API_KEY=`)
- Modify: `docker-compose.yml` (remove `FIRECRAWL_API_KEY` env line)

**Context:**
- `firecrawl.go` (75 lines): `FetchViaFirecrawl(ctx, path)` — called only by `scrapers.go:78` (removed in Task 5).
- `config.go:15`: `FirecrawlKey` field; `config.go:47`: `FirecrawlKey: envStr("FIRECRAWL_API_KEY", "")`.
- `Dockerfile:25`: `ENV FIRECRAWL_API_KEY=`.
- `docker-compose.yml:14`: `- FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}`.

- [ ] **Step 1: Delete `firecrawl.go`**

```bash
git rm internal/client/firecrawl.go
```

- [ ] **Step 2: Remove `FirecrawlKey` from `config.go`**

In `internal/config/config.go`:
- Remove the `FirecrawlKey` field from the `Config` struct (line 15).
- Remove the `FirecrawlKey: envStr("FIRECRAWL_API_KEY", "")` line from the loader (line 47).

- [ ] **Step 3: Remove Firecrawl env from `Dockerfile`**

Delete the line `ENV FIRECRAWL_API_KEY=` from `Dockerfile` (line 25).

- [ ] **Step 4: Remove Firecrawl env from `docker-compose.yml`**

Delete the line `      - FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}` from `docker-compose.yml` (line 14).

- [ ] **Step 5: Verify config still compiles**

Run: `go build ./internal/config/`
Expected: no output. (If `main.go` or elsewhere references `cfg.FirecrawlKey`, that reference must also be removed — grep first: see Step 6.)

- [ ] **Step 6: Grep for any remaining Firecrawl references**

Run: `grep -rn -i firecrawl --include="*.go" .` (or use Grep tool with pattern `firecrawl`, type `go`)
Expected: **zero matches** after Task 5 lands. If matches found in `main.go` or other Go files, remove them. (Non-Go matches in `README.md`/`AGENTS.md` are fine — those are updated separately at task close.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove Firecrawl dependency (code, config, env, Docker)"
```

---

### Task 5: Remove Firecrawl fallback from scrapers.go

**Files:**
- Modify: `internal/scraper/scrapers.go:75-84` (the `MatchesScraper.GetUpcoming` fallback branch)

**Context — current code (scrapers.go:75-84):**
```go
body, err := s.cli.FetchHTML(ctx, "/matches", "matches_upcoming")
if err != nil {
    body, err = s.cli.FetchViaFirecrawl(ctx, "/matches")
    if err != nil {
        return nil, err
    }
}
doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
```

- [ ] **Step 1: Simplify to direct fetch**

Replace the fallback branch so `GetUpcoming` uses `FetchHTML` directly (matching how `ResultsScraper`, `NewsScraper`, etc. already work):
```go
body, err := s.cli.FetchHTML(ctx, "/matches", "matches_upcoming")
if err != nil {
    return nil, err
}
doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
```

- [ ] **Step 2: Verify the scraper package compiles**

Run: `go build ./internal/scraper/`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add internal/scraper/scrapers.go
git commit -m "refactor(scraper): drop Firecrawl fallback from MatchesScraper"
```

---

### Task 6: Migrate error codes in HTTP handlers

**Files:**
- Modify: `internal/http/handlers/search.go:35,55` — `"UPSTREAM_UNAVAILABLE"` → `"UNAVAILABLE"`
- Modify: `internal/http/handlers/news.go:43` — `"UPSTREAM_UNAVAILABLE"` → `"UNAVAILABLE"`
- Verify: `internal/facade/*.go`, `internal/mcp/server.go`

**Context — current handler inline codes (hardcoded `map[string]any{"code": "..."}`):**
- `search.go:35` `GetTeam` — `"UPSTREAM_UNAVAILABLE"` on `GetTeamDetailCached` error
- `search.go:55` `GetPlayer` — `"UPSTREAM_UNAVAILABLE"` on `GetPlayerDetailCached` error
- `news.go:43` `GetNewsArticle` — `"UPSTREAM_UNAVAILABLE"` on `GetNewsArticleCached` error

**Codes that stay (NOT in the migration table, design spec §6):** `ENTITY_NOT_FOUND` (facade/resolve.go:27,56 — "search returned 0 results", a different concept from upstream 404), `INVALID_ARGUMENT` (resolve.go:73,141), `INTERNAL_ERROR` (facade.go:326), `TIMEOUT` (handlers.go:46).

- [ ] **Step 1: Replace the three handler codes**

In `internal/http/handlers/search.go` and `internal/http/handlers/news.go`, replace every `"UPSTREAM_UNAVAILABLE"` string literal with `"UNAVAILABLE"`. There are exactly 3 occurrences (search.go ×2, news.go ×1).

- [ ] **Step 2: Grep to confirm no `UPSTREAM_` codes remain anywhere**

Run Grep tool: pattern `UPSTREAM_`, type `go`.
Expected: **zero matches**. (`UPSTREAM_NOT_FOUND` in old client.go was already replaced by `ErrNotFound` in Task 3; `UPSTREAM_UNAVAILABLE` in client.go by `ErrUnavailable`.)

- [ ] **Step 3: Verify build + run handler tests**

Run: `go build ./... && go test ./internal/http/... ./internal/facade/... -v`
Expected: build succeeds; tests pass (if no handler tests exist, build-only is acceptable).

- [ ] **Step 4: Commit**

```bash
git add internal/http/handlers/search.go internal/http/handlers/news.go
git commit -m "refactor(http): migrate UPSTREAM_UNAVAILABLE to unified UNAVAILABLE code"
```

---

### Task 7: Move PoC docs and delete hltv-utls-fetch/

**Files:**
- Move: `hltv-utls-fetch/README.md` → `docs/utls-bypass-readme.md`
- Move: `hltv-utls-fetch/IMPLEMENTATION.md` → `docs/utls-bypass-implementation.md`
- Delete: `hltv-utls-fetch/` (entire remaining directory, including `dump_*.html` fixtures, `examples/`, `hltvfetch/`, `go.mod`, `go.sum`)

- [ ] **Step 1: Move the two docs**

```bash
git mv hltv-utls-fetch/README.md docs/utls-bypass-readme.md
git mv hltv-utls-fetch/IMPLEMENTATION.md docs/utls-bypass-implementation.md
```

- [ ] **Step 2: Delete the rest of the PoC directory**

```bash
git rm -rf hltv-utls-fetch
```
This removes `dump_*.html` (large test fixtures, ~8MB total), `examples/main.go`, `hltvfetch/fetcher.go`, `go.mod`, `go.sum`.

- [ ] **Step 3: Verify the main module still builds and tests pass**

Run: `go build ./... && go test ./...`
Expected: build succeeds; all tests pass. (The PoC was a nested module `github.com/arcdent/hltv-mcp/hltv-utls-fetch` — deleting it does not affect the main module's `go.mod`.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete hltv-utls-fetch PoC (internalized into internal/client); preserve docs"
```

---

### Task 8: Integration smoke test against all 7 HLTV endpoints

**Files:**
- No file changes. This is a manual verification task.

**Context:** The PoC `examples/main.go` tested 7 endpoints. After the refactor, the same 7 must return 200 via the main project's `FetchHTML`. This verifies the integration end-to-end (transport + UA + retry + CF detection) without Firecrawl.

**The 7 endpoints:**
1. `https://www.hltv.org/matches`
2. `https://www.hltv.org/results`
3. `https://www.hltv.org/` (homepage — use path `/`)
4. `https://www.hltv.org/player/11893/zywoo`
5. `https://www.hltv.org/team/5378/vitality`
6. `https://www.hltv.org/news/archive`
7. `https://www.hltv.org/search?query=vitality`

- [ ] **Step 1: Write a throwaway smoke test**

Create `internal/client/smoke_test.go` (delete before commit, or guard with a build tag — this task does NOT commit it):
```go
//go:build smoke

package client

import (
	"context"
	"testing"
	"time"

	"github.com/arcdent/hltv-mcp/internal/config"
)

func TestSmokeAllEndpoints(t *testing.T) {
	cfg := &config.Config{HTTPTimeoutMs: 15000, RetryCount: 2}
	c := NewHltvClient(cfg)
	paths := []string{
		"/matches", "/results", "/", "/player/11893/zywoo",
		"/team/5378/vitality", "/news/archive", "/search?query=vitality",
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	for _, p := range paths {
		body, err := c.FetchHTML(ctx, p, "smoke")
		if err != nil {
			t.Errorf("FetchHTML(%q) failed: %v", p, err)
			continue
		}
		if len(body) < 5000 {
			t.Errorf("FetchHTML(%q) body suspiciously small: %d bytes", p, len(body))
		}
		t.Logf("FetchHTML(%q) OK: %d bytes", p, len(body))
	}
}
```

- [ ] **Step 2: Run the smoke test**

Run: `go test ./internal/client/ -tags=smoke -run TestSmokeAllEndpoints -v -timeout=120s`
Expected: all 7 endpoints log `OK: N bytes` with no failures. Body sizes should be in the KB–MB range (e.g. `/matches` ~800KB, `/team/...` ~4MB).

**If a `CHALLENGE` or `NETWORK` error appears:** retry once (transient). If it persists, the iOS fingerprint may be blocked — report to the user; do NOT silently fall back to Firecrawl (it's deleted).

- [ ] **Step 3: Delete the smoke test (do not commit)**

```bash
rm internal/client/smoke_test.go
```

- [ ] **Step 4: Final full-build + test verification**

Run: `go build ./... && go test ./...`
Expected: build succeeds; all committed tests pass.

- [ ] **Step 5: Commit** (only if any cleanup was needed; otherwise skip)

If `go.mod`/`go.sum` changed during `go mod tidy` in this task:
```bash
git add go.mod go.sum
git commit -m "chore: tidy modules after uTLS refactor"
```

---

## Self-Review (completed by plan author)

**1. Spec coverage:** Spec §5 file changes — transport.go (T1), client.go (T3), client_test.go (T3), scrapers.go (T5), config.go (T4), types.go (T2), facade (T6 verify), handlers (T6), mcp/server.go (T6 verify — survey found no direct refs), go.mod (T1). Deleted files: firecrawl.go (T4), hltv-utls-fetch/ (T7). Moved files (T7). §6 error codes (T2 constants + T3 usage + T6 migration). §7 CF detection (T3). §8 transport config (T1+T3, 600ms backoff per spec). §10 testing (T3 unit + T8 smoke). ✓ All spec sections covered.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later". Every code step has verbatim code. Smoke test is real and runnable. ✓

**3. Type consistency:** `ErrNetwork/ErrRead/ErrChallenge/ErrNotFound/ErrServer/ErrUnavailable` defined in T2, used in T3's `doOnce` and `FetchHTML` with identical names. `newTransport(profile, timeout)` signature in T1 matches the call in T3's `NewHltvClient`. `iosUA` defined in T1, used in T3. `cfSignatures` + `isCloudflareBlock` in T3 match the test in T3-Step1. ✓
