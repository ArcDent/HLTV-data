# uTLS Transport Refactor — Design Spec

**Date:** 2026-06-29
**Status:** Approved
**Scope:** Replace standard `net/http` with uTLS transport, remove Firecrawl, delete `hltv-utls-fetch/`

---

## 1. Problem Statement

The main project uses standard Go `net/http` with a Windows Chrome User-Agent to fetch HLTV pages. Cloudflare blocks this via JA3/JA4 TLS fingerprinting. Currently, only the `/matches` endpoint has a Firecrawl API fallback — all other endpoints (player, team, news, results) fail silently when Cloudflare intervenes.

A standalone PoC in `hltv-utls-fetch/` has proven that uTLS with an iOS Safari (`HelloIOS_Auto`) fingerprint passes all 7 tested HLTV endpoints. This code has not been integrated into the main project.

## 2. Goals

1. **Unified TLS bypass**: All endpoints use uTLS (iOS Safari fingerprint) — no per-endpoint special cases
2. **Remove Firecrawl**: Eliminate external paid API dependency entirely (code, config, env vars)
3. **Unified error codes**: Replace the two divergent error systems with one fine-grained set
4. **Fix known bugs**: `defer resp.Body.Close()` leak in retry loop
5. **Clean up**: Delete `hltv-utls-fetch/` directory, preserve `.md` docs in `docs/`

## 3. Non-Goals

- Fingerprint rotation or UA randomization (single iOS Safari profile is sufficient per testing)
- Proxy support
- Rate limiting (existing retry with backoff is adequate)

## 4. Architecture

### Before

```
FetchHTML (net/http, Chrome UA)
    ↓ fail
FetchViaFirecrawl (only /matches, paid API)
```

### After

```
FetchHTML (uTLS http2.Transport, iOS Safari fingerprint + matching UA)
    ↓ retries exhausted
Return fine-grained error code
```

All endpoints share the same transport. No fallback chain.

## 5. File Changes

### New Files

| File | Purpose |
|------|---------|
| `internal/client/transport.go` | uTLS transport builder: `newTransport(profile, timeout)`, iOS Safari UA constant, `http2.Transport` with custom `DialTLSContext` |

### Modified Files

| File | Changes |
|------|---------|
| `internal/client/client.go` | Initialize client with uTLS transport from `transport.go`; rewrite `FetchHTML` with hltvfetch-style retry/error classification; fix defer leak; use iOS Safari UA; unified Cloudflare detection |
| `internal/client/client_test.go` | Adapt tests to new error code system |
| `internal/scraper/scrapers.go` | Remove Firecrawl fallback branch from `MatchesScraper.GetUpcoming()` |
| `internal/config/config.go` | Remove `FirecrawlKey` field and `FIRECRAWL_API_KEY` env var |
| `internal/types/types.go` | Add unified error code constants; update `ToolError` to carry new codes |
| `internal/facade/*.go` | Update error code references: `UPSTREAM_NOT_FOUND` → `NOT_FOUND`, `UPSTREAM_UNAVAILABLE` → `UNAVAILABLE`, etc. |
| `internal/http/handlers/*.go` | Adapt to new error codes in HTTP response mapping |
| `internal/mcp/server.go` | Adapt to new error codes if referenced directly |
| `go.mod` / `go.sum` | Add `github.com/refraction-networking/utls`, ensure `golang.org/x/net` includes `http2` |

### Deleted Files

| File | Reason |
|------|--------|
| `internal/client/firecrawl.go` | Firecrawl fully removed |
| `hltv-utls-fetch/` (entire directory except `.md` files) | Code internalized into `internal/client/` |

### Moved Files

| From | To |
|------|-----|
| `hltv-utls-fetch/README.md` | `docs/utls-bypass-readme.md` |
| `hltv-utls-fetch/IMPLEMENTATION.md` | `docs/utls-bypass-implementation.md` |

## 6. Error Code System

Replace the two divergent systems with one unified set:

```go
const (
    ErrNetwork     = "NETWORK"      // TCP/TLS dial failure — retryable
    ErrRead        = "READ"         // Response body read failure — retryable
    ErrChallenge   = "CHALLENGE"    // Cloudflare challenge page — retryable
    ErrNotFound    = "NOT_FOUND"    // 403/404 — not retryable
    ErrServer      = "SERVER"       // 5xx — retryable
    ErrUnavailable = "UNAVAILABLE"  // All retries exhausted — not retryable
)
```

`ToolError` struct gains a `Retryable bool` field. The retry loop in `FetchHTML` checks `Retryable` to decide whether to continue. Upstream consumers (facade, handlers, MCP) use the error code for response mapping.

### Migration Mapping

| Old Code | New Code |
|----------|----------|
| `UPSTREAM_NOT_FOUND` | `NOT_FOUND` |
| `UPSTREAM_UNAVAILABLE` | `UNAVAILABLE` |
| (implicit Cloudflare block) | `CHALLENGE` |
| (implicit network error) | `NETWORK` |

## 7. Cloudflare Detection

Unified detection function with merged signature set:

```go
var cfSignatures = []string{
    "Just a moment",
    "cf-browser-verify",
    "Attention Required",
    "Enable JavaScript and cookies to continue",
}
```

The overly broad `"Cloudflare"` substring from the original `client.go` is removed to reduce false positives.

## 8. Transport Configuration

From `hltvfetch/fetcher.go`, adapted for `internal/client/transport.go`:

- **TLS Profile**: `utls.HelloIOS_Auto` (iOS Safari, proven against all HLTV endpoints)
- **Transport**: `http2.Transport` with custom `DialTLSContext` (HLTV only negotiates HTTP/2)
- **User-Agent**: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/605.1.15`
- **Timeout**: Configurable via `Config.HTTPTimeoutMs` (default 8000ms)
- **Retries**: Configurable via `Config.RetryCount` (default 2, so 3 total attempts)
- **Backoff**: `attempt * 600ms` (linear, increased from hltvfetch's 400ms for more tolerance)

## 9. Dependency Changes

### Added

| Package | Version | Purpose |
|---------|---------|---------|
| `github.com/refraction-networking/utls` | v1.8.2 | TLS fingerprint impersonation |
| `golang.org/x/net` | (existing, ensure `http2` subpackage) | Direct HTTP/2 transport |

### Removed

None (Firecrawl was an API call, not a Go dependency).

## 10. Testing Strategy

1. **Unit tests**: `isCloudflareBlock` with unified signature set, error code classification, `ToolError.Retryable` logic
2. **Integration smoke test**: Manual run against all 7 HLTV endpoints post-refactor (same as `examples/main.go` did)
3. **Regression**: Ensure facade/handler/MCP layers correctly map new error codes to user-facing responses

## 11. Risk Assessment

| Risk | Mitigation |
|------|------------|
| iOS Safari fingerprint gets blocked in future | Monitor; fingerprint is configurable via `WithProfile` option; git history preserves Firecrawl code |
| uTLS dependency breaks on Go upgrade | Pin version; utls is actively maintained |
| Error code migration misses a reference | Grep for old codes (`UPSTREAM_NOT_FOUND`, `UPSTREAM_UNAVAILABLE`) in CI |
