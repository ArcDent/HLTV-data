# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the HLTV MCP frontend from a developer-tool MVP into a CS-esports data platform: esports-dark visual identity, top-bar + sub-nav layout, a user-first homepage, centralized design-system CSS, reusable components, mobile responsiveness, and two new backend endpoints (`/api/rankings`, `/api/teams/compare`).

**Architecture:** A new `src/styles/` directory holds CSS custom-property tokens and reusable classes (Tailwind is removed). A `TopBar` + `SubNav` layout replaces the 180px sidebar. Pages are migrated incrementally (Homepage replaces Dashboard; Settings drawer absorbs Cache). Detail modals (`PlayerDetail`, `TeamDetail`, `TeamComparison`) gain radar charts, form strips, and side-by-side comparison. Two new Go handlers + scrapers back the rankings widget and team-comparison modal.

**Tech Stack:** React 19, React Router 7, Vite 8, TypeScript 6, Chart.js (radar) — on the frontend; Go 1.26 + chi + goquery + uTLS transport (from the uTLS refactor plan) on the backend.

**Source spec:** `docs/superpowers/specs/2026-06-29-frontend-redesign.md`

**Mockup HTML (visual source of truth — READ these before implementing each UI task):**
- `.superpowers/brainstorm/1868-1782672231/content/visual-style.html` — palette, type, card examples
- `.superpowers/brainstorm/1868-1782672231/content/layout.html` — top bar + sub-nav structure
- `.superpowers/brainstorm/1180-1782714264/content/homepage.html` — homepage layout
- `.superpowers/brainstorm/1180-1782714264/content/player-detail.html` — player modal + radar chart
- `.superpowers/brainstorm/1180-1782714264/content/team-detail-compare.html` — team modal + comparison modal
- `.superpowers/brainstorm/1180-1782714264/content/player-compare.html` — player comparison (radar overlay)

**Font resolution:** The spec body (§4.1) names Oswald/Noto Sans SC, but the approved mockup tokens (§8) and the mockup HTML use **Rajdhani** (display) / **Inter** (body) / **JetBrains Mono** (data). The mockups are the visual source of truth → use Rajdhani/Inter/JetBrains Mono via Google Fonts CDN.

---

## File Structure

### Backend (new endpoints)

| File | Action | Responsibility |
|------|--------|----------------|
| `internal/scraper/rankings.go` | Create | Scrape HLTV `/ranking/teams` → `[]types.TeamRanking` |
| `internal/types/types.go` | Modify | Add `TeamRanking` + `TeamComparison` structs |
| `internal/facade/facade.go` | Modify | Add `GetRankings(ctx)` + `CompareTeams(ctx, aID, bID)` methods |
| `internal/http/handlers/rankings.go` | Create | `GET /api/rankings` handler |
| `internal/http/handlers/teams.go` | Create | `GET /api/teams/compare?a=&b=` handler |
| `internal/http/router.go` (or wherever chi routes live) | Modify | Register the 2 new routes |

### Frontend

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/styles/tokens.css` | Create | CSS custom properties (colors, spacing, type, shadows) |
| `frontend/src/styles/base.css` | Create | Global resets, body, scrollbar, font imports |
| `frontend/src/styles/components.css` | Create | Reusable `.card`, `.button`, `.input`, `.badge`, `.stat-card`, `.form-strip` classes |
| `frontend/src/styles/animations.css` | Create | `fadeIn`, `slideUp`, stagger utilities |
| `frontend/src/index.css` | Modify | Keep only `@import` lines for the 4 style files; remove Tailwind + old vars |
| `frontend/src/components/Card.tsx` | Create | Card wrapper with optional `hover` prop |
| `frontend/src/components/Badge.tsx` | Create | Small colored label (LIVE, BO3, W/L) |
| `frontend/src/components/StatCard.tsx` | Create | number + label pair |
| `frontend/src/components/EmptyState.tsx` | Create | "No data" placeholder |
| `frontend/src/components/LoadingSpinner.tsx` | Create | Replaces "Loading..." text |
| `frontend/src/components/Drawer.tsx` | Create | Slide-out settings panel |
| `frontend/src/components/Hamburger.tsx` | Create | Mobile menu button |
| `frontend/src/components/TopBar.tsx` | Create | Brand + search + LIVE + avatar |
| `frontend/src/components/SubNav.tsx` | Create | Horizontal tab links |
| `frontend/src/components/Modal.tsx` | Modify | Add `fullscreen` prop for mobile |
| `frontend/src/components/PlayerDetail.tsx` | Modify | Radar chart (Chart.js), role badge, top-20 indicator |
| `frontend/src/components/TeamDetail.tsx` | Modify | Compare button, form strip, comparison toggle |
| `frontend/src/components/TeamComparison.tsx` | Create | Side-by-side comparison modal |
| `frontend/src/components/SearchableList.tsx` | Modify | Add region filter props |
| `frontend/src/pages/Homepage.tsx` | Create | Today's highlights, hot news, ranking movers, quick stats |
| `frontend/src/pages/Matches.tsx` | Modify | Improved event card design |
| `frontend/src/pages/Teams.tsx` | Create | (was SearchPage for teams) search + detail modal |
| `frontend/src/pages/Players.tsx` | Create | (was SearchPage for players) search + filters |
| `frontend/src/pages/News.tsx` | Modify | Improved article cards; move translation config to drawer |
| `frontend/src/pages/Settings.tsx` | Create | Drawer content: cache + theme + translation + status |
| `frontend/src/pages/Dashboard.tsx` | Delete | Replaced by Homepage |
| `frontend/src/pages/Cache.tsx` | Delete | Merged into Settings |
| `frontend/src/api/client.ts` | Modify | Add `getRankings()`, `compareTeams(a, b)` |
| `frontend/src/App.tsx` | Modify | New routes, layout wrapper, drawer state |
| `frontend/vite.config.ts` | Modify | Remove `@tailwindcss/vite` |
| `frontend/package.json` | Modify | Remove tailwind deps; add `chart.js` |

**Execution order:** Phase 0 (backend endpoints) → Phase 1 (styles) → Phase 2 (layout) → Phase 3 (pages + detail modals) → Phase 4 (component extraction) → Phase 5 (responsive). Phase 4 can interleave with Phase 3 (extract a component when 2+ pages repeat the pattern). Phases 1+2 must precede 3. **Depends on the uTLS refactor plan being merged first** (the new endpoints scrape HLTV via the uTLS transport).

---

## Phase 0: Backend prerequisites (new endpoints)

### Task F0.1: Add `/api/rankings` endpoint

**Files:**
- Modify: `internal/types/types.go` (add `TeamRanking` struct)
- Create: `internal/scraper/rankings.go`
- Modify: `internal/facade/facade.go` (add `GetRankings`)
- Create: `internal/http/handlers/rankings.go`
- Modify: the chi router file (register route)

- [ ] **Step 1: Add the `TeamRanking` type**

In `internal/types/types.go`:
```go
// TeamRanking is a single row of HLTV's /ranking/teams table.
type TeamRanking struct {
	Rank      int    `json:"rank"`
	TeamID    int    `json:"teamId"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	Points    string `json:"points"`    // HLTV shows points as a string like "837"
}
```

- [ ] **Step 2: Create the rankings scraper**

Create `internal/scraper/rankings.go`. Follow the existing scraper pattern in `internal/scraper/scrapers.go` (a `RankingsScraper` with a `cli *client.HltvClient` field, a `Get(ctx)` method that calls `cli.FetchHTML(ctx, "/ranking/teams", "rankings")`, parses with goquery). HLTV ranking selectors: `div.ranking` > `div.team` (each row); within a row: `.team-rank-num` (rank), `a.teambox` or `.name` (team name + `/team/{id}/{slug}` href for ID), `.team-country` (country), `.points` (points). **Verify selectors against a live fetch** — HLTV markup changes; if a selector misses, inspect the fetched HTML and adjust. Extract team ID from the `/team/(\d+)/` regex on the href.

- [ ] **Step 3: Add `GetRankings` to the facade**

In `internal/facade/facade.go`, add a `GetRankings(ctx context.Context) ([]types.TeamRanking, error)` method. Use the existing `withCacheOrStore` Type-B pattern (cache → SQLite → scrape) if a `rankings` store table exists; otherwise cache-only is acceptable for v1 (the design says "no backend history needed initially"). Return the slice; wrap errors via the existing `errorResponse` helper.

- [ ] **Step 4: Create the handler + route**

Create `internal/http/handlers/rankings.go`:
```go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/arcdent/hltv-mcp/internal/facade"
)

func GetRankings(f *facade.Facade) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rankings, err := f.GetRankings(r.Context())
		if err != nil {
			writeJSONError(w, http.StatusBadGateway, "UNAVAILABLE", err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rankings)
	}
}
```
(Use the existing error-writing helper in the handlers package — match the pattern in `search.go`/`news.go` rather than inventing `writeJSONError` if a different helper already exists.)

Register `r.Get("/api/rankings", handlers.GetRankings(f))` in the chi router (find where `/api/teams`, `/api/players` are registered and add alongside).

- [ ] **Step 5: Build + smoke test**

Run: `go build ./...`
Then run the server and `curl -s http://localhost:8082/api/rankings | head`. Expected: JSON array of ranking rows. (If behind Cloudflare, the uTLS transport from the refactor plan must be in place.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): add GET /api/rankings endpoint with HLTV /ranking/teams scraper"
```

---

### Task F0.2: Add `/api/teams/compare` endpoint

**Files:**
- Modify: `internal/types/types.go` (add `TeamComparison` struct)
- Modify: `internal/facade/facade.go` (add `CompareTeams`)
- Create: `internal/http/handlers/teams.go`
- Modify: chi router (register route)

- [ ] **Step 1: Add the `TeamComparison` type**

In `internal/types/types.go`:
```go
// TeamComparison holds side-by-side data for two teams.
type TeamComparison struct {
	TeamA TeamProfile `json:"teamA"`
	TeamB TeamProfile `json:"teamB"`
	// HeadToHead is empty if no shared match history is found.
	HeadToHead *HeadToHead `json:"headToHead,omitempty"`
}

type TeamProfile struct {
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	Country     string   `json:"country"`
	Rank        string   `json:"rank"`        // "#3" or ""
	WinRate     string   `json:"winRate"`
	WinStreak   int      `json:"winStreak"`
	RosterSize  int      `json:"rosterSize"`
	Achievements []string `json:"achievements"`
}

type HeadToHead struct {
	TotalMatches int `json:"totalMatches"`
	WinsA        int `json:"winsA"`
	WinsB        int `json:"winsB"`
	// RecentResults: true = team A won that encounter.
	RecentResults []bool `json:"recentResults"`
}
```
(Align field names with whatever the existing `TeamDetail`/`TeamData` types already use — reuse existing types where possible to avoid duplication. If `TeamData` already has Rank/WinRate/etc., embed it instead of redefining `TeamProfile`.)

- [ ] **Step 2: Add `CompareTeams` to the facade**

In `internal/facade/facade.go`:
```go
func (f *Facade) CompareTeams(ctx context.Context, aID, bID int) (*types.TeamComparison, error) {
	a, err := f.GetTeamDetailCached(ctx, aID)
	if err != nil { return nil, err }
	b, err := f.GetTeamDetailCached(ctx, bID)
	if err != nil { return nil, err }
	cmp := buildComparison(a, b) // see Step 3
	return cmp, nil
}
```
Reuse the existing `GetTeamDetailCached` (the Type-A three-tier method). Wrap errors with `errorResponse`.

- [ ] **Step 3: Implement `buildComparison`**

Add a helper (in `facade.go` or a new `facade/compare.go`) that maps the two `TeamData`/detail structs into `TeamComparison`. For `HeadToHead`: intersect the two teams' recent-match opponent lists (from `RecentMatches` if the detail type carries it); if no overlap, leave `HeadToHead` nil (the frontend shows "No matches found between these teams" per design §4.7). Do NOT fabricate H2H data.

- [ ] **Step 4: Create the handler + route**

Create `internal/http/handlers/teams.go`:
```go
package handlers

import (
	"net/http"
	"strconv"
)

func CompareTeams(f *facade.Facade) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, _ := strconv.Atoi(r.URL.Query().Get("a"))
		b, _ := strconv.Atoi(r.URL.Query().Get("b"))
		if a == 0 || b == 0 {
			writeJSONError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "a and b query params required")
			return
		}
		cmp, err := f.CompareTeams(r.Context(), a, b)
		if err != nil {
			writeJSONError(w, http.StatusBadGateway, "UNAVAILABLE", err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cmp)
	}
}
```
Register `r.Get("/api/teams/compare", handlers.CompareTeams(f))` in the chi router (alongside the existing `/api/teams/{id}` route).

- [ ] **Step 5: Build + smoke test**

Run: `go build ./...` then `curl -s "http://localhost:8082/api/teams/compare?a=5378&b=4608" | head`. Expected: JSON with both team profiles.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): add GET /api/teams/compare endpoint with side-by-side team data"
```

---

## Phase 1: Style foundation

### Task F1.1: Create the `src/styles/` token + base files

**Files:**
- Create: `frontend/src/styles/tokens.css`, `base.css`, `components.css`, `animations.css`

**Reference:** `.superpowers/brainstorm/1868-1782672231/content/visual-style.html` (palette + type). The tokens below are the immutable source of truth (design spec §8).

- [ ] **Step 1: Create `tokens.css`**

```css
:root {
  /* Backgrounds */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;

  /* Borders */
  --border-default: #30363d;
  --border-accent: #ff4655;

  /* Text */
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #6e7681;

  /* Accents */
  --accent-red: #ff4655;
  --accent-orange: #ff7b00;
  --accent-green: #3fb950;

  /* Typography */
  --font-display: 'Rajdhani', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing scale */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px;

  /* Radii */
  --radius-sm: 4px; --radius: 8px; --radius-lg: 12px;

  /* Shadows */
  --shadow-card: 0 2px 8px rgba(0,0,0,0.3);
  --shadow-modal: 0 8px 32px rgba(0,0,0,0.6);

  /* Layout */
  --topbar-h: 56px;
  --subnav-h: 40px;
  --content-max: 1200px;
}
```

- [ ] **Step 2: Create `base.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  font-family: var(--font-body);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4 { font-family: var(--font-display); text-transform: uppercase; font-weight: 600; }
a { color: var(--text-primary); text-decoration: none; }
a:hover { color: var(--accent-red); }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }
```

- [ ] **Step 3: Create `components.css`**

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: var(--space-4);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}
.card.hoverable:hover { border-color: var(--border-accent); transform: translateY(-2px); }

.button {
  font-family: var(--font-display); font-weight: 600; text-transform: uppercase;
  background: var(--bg-tertiary); color: var(--text-primary);
  border: 1px solid var(--border-default); border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3); cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.button:hover { border-color: var(--border-accent); }
.button.primary { background: var(--accent-red); border-color: var(--accent-red); color: #fff; }

.input {
  background: var(--bg-tertiary); color: var(--text-primary);
  border: 1px solid var(--border-default); border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3); font-family: var(--font-body);
  transition: border-color 0.2s;
}
.input:focus { outline: none; border-color: var(--border-accent); }

.badge {
  display: inline-block; font-family: var(--font-display); font-weight: 600;
  font-size: 11px; text-transform: uppercase; padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}
.badge.live { background: rgba(255,70,85,0.15); color: var(--accent-red); }
.badge.win  { background: rgba(63,185,80,0.15); color: var(--accent-green); }
.badge.loss { background: rgba(255,70,85,0.15); color: var(--accent-red); }

.stat-card { text-align: center; padding: var(--space-3); }
.stat-card .label { font-size: 11px; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; }
.stat-card .value { font-family: var(--font-display); font-size: 36px; color: var(--accent-red); line-height: 1.1; }
.stat-card .sub   { font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); }

.form-strip { display: flex; gap: var(--space-1); }
.form-strip .dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-weight: 500; }
.form-strip .dot.w { background: rgba(63,185,80,0.15); color: var(--accent-green); }
.form-strip .dot.l { background: rgba(255,70,85,0.15); color: var(--accent-red); }
```

- [ ] **Step 4: Create `animations.css`**

```css
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.animate-in { animation: fadeIn 0.3s ease-out, slideUp 0.3s ease-out; }
.stagger > * { animation: fadeIn 0.3s ease-out, slideUp 0.3s ease-out; }
.stagger > *:nth-child(1) { animation-delay: 0ms; }
.stagger > *:nth-child(2) { animation-delay: 50ms; }
.stagger > *:nth-child(3) { animation-delay: 100ms; }
.stagger > *:nth-child(4) { animation-delay: 150ms; }
.stagger > *:nth-child(5) { animation-delay: 200ms; }
.stagger > *:nth-child(6) { animation-delay: 250ms; }
.stagger > *:nth-child(7) { animation-delay: 300ms; }
.stagger > *:nth-child(8) { animation-delay: 350ms; }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/
git commit -m "feat(frontend): add design-system CSS (tokens, base, components, animations)"
```

---

### Task F1.2: Rewire `index.css` and remove Tailwind

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Replace `index.css`**

Replace the entire contents of `frontend/src/index.css` with:
```css
@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/components.css";
@import "./styles/animations.css";
```
(Remove the old `:root`/`.dark` variable blocks, the `@import "tailwindcss";` line, the noise texture, and the `.bg-bg`/`.bg-card`/`.text-gold` Tailwind utilities. The dark theme is now the default — there is no light theme in the esports-dark redesign; the theme toggle in Settings toggles a `.light` class if a light variant is desired later, but v1 ships dark-only per spec §4.1.)

- [ ] **Step 2: Remove Tailwind from Vite config**

In `frontend/vite.config.ts`, remove the `tailwindcss()` plugin from the `plugins` array and its import. Result:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:8082' } },
})
```

- [ ] **Step 3: Remove Tailwind deps + add Chart.js**

In `frontend/package.json`:
- Remove `@tailwindcss/vite` and `tailwindcss` from `dependencies`.
- Add `"chart.js": "^4.4.0"` to `dependencies`.

Then run:
```bash
cd frontend && npm install && cd ..
```
Expected: `package-lock.json` updated; `node_modules` has `chart.js`, no `tailwindcss`.

- [ ] **Step 4: Verify the dev server builds**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` succeeds; `dist/` produced. (There will be TypeScript errors from the not-yet-migrated components referencing old CSS vars inline — defer fixing those to Phase 3. If `tsc -b` fails ONLY on inline-style var references like `var(--gold)`, that's expected and resolved as each component is migrated. To unblock the build now, you may temporarily keep the old `:root` vars in a `legacy.css` imported after `tokens.css` and delete it at the end of Phase 3. Prefer migrating components rather than the legacy shim.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/vite.config.ts frontend/package.json frontend/package-lock.json
git commit -m "refactor(frontend): remove Tailwind, wire design-system CSS imports"
```

---

## Phase 2: Layout shell

### Task F2.1: Create TopBar, SubNav, Hamburger components

**Files:**
- Create: `frontend/src/components/TopBar.tsx`, `SubNav.tsx`, `Hamburger.tsx`
- Reference: `.superpowers/brainstorm/1868-1782672231/content/layout.html`

- [ ] **Step 1: Create `TopBar.tsx`**

Props: `{ search: string; onSearch: (q: string) => void; liveCount: number; onOpenSettings: () => void; onToggleMobileNav: () => void; }`. Render a 56px fixed bar: left = Hamburger (mobile only) + logo + brand "HLTV DATA"; center/right = expandable search input (`.input`, 200px → 400px on `:focus` via a CSS class `search-expand`); a `.badge.live` "● LIVE" shown when `liveCount > 0`; a settings gear button calling `onOpenSettings`. Use the `.button` class for icon buttons. Keep styles in `components.css` (add `.topbar`, `.search-expand` classes there).

- [ ] **Step 2: Create `SubNav.tsx`**

Props: `{ items: { to: string; label: string }[]; }`. Render a 40px bar of `<NavLink>` items (React Router) with bottom-border active indicator (`border-bottom: 2px solid var(--accent-red)` on `.active`). Add a `.subnav` + `.subnav a.active` class to `components.css`.

- [ ] **Step 3: Create `Hamburger.tsx`**

Props: `{ onClick: () => void; open: boolean; }`. Render a button with three bars (CSS-drawn, rotate to X when `open`). Add `.hamburger` classes to `components.css`. Visible only on mobile (`@media (max-width: 768px)`).

- [ ] **Step 4: Add the layout CSS classes**

Append to `frontend/src/styles/components.css`:
```css
.topbar {
  height: var(--topbar-h); display: flex; align-items: center; gap: var(--space-4);
  padding: 0 var(--space-5); background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-default); position: sticky; top: 0; z-index: 20;
}
.topbar .brand { font-family: var(--font-display); font-weight: 700; font-size: 20px; letter-spacing: 1px; }
.search-expand { width: 200px; transition: width 0.2s; }
.search-expand:focus { width: 400px; }
.subnav { height: var(--subnav-h); display: flex; align-items: stretch; gap: var(--space-4); padding: 0 var(--space-5); background: var(--bg-secondary); border-bottom: 1px solid var(--border-default); }
.subnav a { display: flex; align-items: center; font-family: var(--font-display); font-weight: 600; text-transform: uppercase; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: color 0.2s, border-color 0.2s; }
.subnav a:hover { color: var(--text-primary); }
.subnav a.active { color: var(--text-primary); border-bottom-color: var(--accent-red); }
.content { max-width: var(--content-max); margin: 0 auto; padding: var(--space-5) var(--space-6); }
.hamburger { display: none; flex-direction: column; gap: 4px; background: none; border: none; cursor: pointer; padding: var(--space-2); }
.hamburger span { width: 24px; height: 2px; background: var(--text-primary); transition: transform 0.2s, opacity 0.2s; }
@media (max-width: 768px) { .hamburger { display: flex; } .search-expand { display: none; } }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TopBar.tsx frontend/src/components/SubNav.tsx frontend/src/components/Hamburger.tsx frontend/src/styles/components.css
git commit -m "feat(frontend): add TopBar, SubNav, Hamburger layout components"
```

---

### Task F2.2: Rewire `App.tsx` with new layout + routes + drawer state

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Define the new nav + routes**

In `App.tsx`, replace the sidebar layout with TopBar + SubNav + `<main className="content">`. New nav items (drop `/cache`, rename `/` to 首页):
```tsx
const nav = [
  { to: '/',          label: '首页' },
  { to: '/matches',   label: '赛程' },
  { to: '/teams',     label: '队伍' },
  { to: '/players',   label: '选手' },
  { to: '/news',      label: '新闻' },
]
```
Routes:
```tsx
<Routes>
  <Route path="/" element={<Homepage />} />
  <Route path="/matches" element={<Matches />} />
  <Route path="/teams" element={<Teams />} />
  <Route path="/players" element={<Players />} />
  <Route path="/news" element={<News />} />
</Routes>
```
(If `Teams`/`Players` pages aren't created yet, keep `<SearchPage type="team"/>` / `<SearchPage type="player"/>` as temporary placeholders until Phase 3 creates the real pages — but the route paths and labels must match the new nav.)

- [ ] **Step 2: Add settings drawer state**

Add `const [settingsOpen, setSettingsOpen] = useState(false)` and `const [mobileNavOpen, setMobileNavOpen] = useState(false)`. Render `<Drawer open={settingsOpen} onClose={() => setSettingsOpen(false)}><Settings /></Drawer>` and pass `onOpenSettings={() => setSettingsOpen(true)}` to TopBar. On mobile, SubNav is hidden and revealed via a full-screen overlay when `mobileNavOpen`.

- [ ] **Step 3: Verify dev server renders**

Run: `cd frontend && npm run dev` then load `http://localhost:5173`. Expected: top bar + sub-nav render, navigation works, no console errors about missing modules (Homepage/Settings/Drawer may not exist yet — create stubs that render `<EmptyState message="Coming soon" />` so the app boots; flesh them out in Phase 3).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): wire TopBar+SubNav layout, new routes, settings drawer state"
```

---

## Phase 3: Page migration + detail modals

> Each page task below: READ the corresponding mockup HTML first, then implement. Replace inline `style={{}}` objects with the new CSS classes (`card`, `button`, `badge`, `stat-card`, `form-strip`, `animate-in`, `stagger`) wherever the pattern repeats >2 times. Keep inline styles only for one-off positioning.

### Task F3.1: Create `Homepage.tsx`

**Files:**
- Create: `frontend/src/pages/Homepage.tsx`
- Reference: `.superpowers/brainstorm/1180-1782714264/content/homepage.html`

- [ ] **Step 1: Implement the homepage**

Fetch on mount: `api.getEvents('today')` (3 featured matches), `api.realtimeNews(3)` (hot news), `api.getRankings()` (top 5 movers), `api.status()` (for quick stats: total matches today, live now, news count). Layout: a hero row of 3 featured match cards (`.card.hoverable`), a 2-column section (hot news list left, ranking movers right), a quick-stats row of `<StatCard>` (matches today / live now / news count). Ranking movers: compare `api.getRankings()` result with a localStorage snapshot (`hltv:rankings:last`) — compute ↑/↓ by diffing rank positions; save the new snapshot after rendering. Use `<EmptyState>` when data is empty, `<LoadingSpinner>` while loading.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Homepage.tsx
git commit -m "feat(frontend): add Homepage with highlights, hot news, ranking movers, quick stats"
```

---

### Task F3.2: Update `Matches.tsx` event card design

**Files:**
- Modify: `frontend/src/pages/Matches.tsx`

- [ ] **Step 1: Improve event/match cards**

Keep the 3 tabs (today/upcoming/results) and `useSSE('matches', ...)` live refresh. Redesign the event card per mockup `team-detail-compare.html` card patterns: team logos (use HLTV's team logo URL if the event data carries it, else a placeholder initial chip), prominent score in `--font-mono`, a BO-format `.badge` ("BO3"), and a "watch live" link if the match is live and a stream URL is available. Use `.card.hoverable` + `.stagger`. Remove the old `cardStyle`/`tabBtn` inline objects; use `.button` for tabs (active state via `.button.primary` or an `.active` modifier).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Matches.tsx
git commit -m "feat(frontend): redesign Matches event cards with design-system classes"
```

---

### Task F3.3: Create `Teams.tsx` and `Players.tsx` pages

**Files:**
- Create: `frontend/src/pages/Teams.tsx`, `Players.tsx`
- Modify: `frontend/src/components/SearchableList.tsx` (add filter props)

- [ ] **Step 1: Create the Teams page**

Wrap `<SearchableList type="team" ... />` (the existing component) and render it inside the `.content` container. Pass through to SearchableList a `compareMode` toggle that, when active, lets the user pick two teams and opens `<TeamComparison>`.

- [ ] **Step 2: Create the Players page**

Wrap `<SearchableList type="player" ... />`. Add a country/region filter (HLTV `Country` field) — a `<select className="input">` of regions that filters the result list client-side. Add a "Top 20 HLTV ranking" widget at the top (fetch `api.getRankings()` is teams, not players — for players, if no player-ranking endpoint exists, fetch a curated list via `api.search` or omit and show `<EmptyState message="Top 20 暂未提供" />`). **Do not implement role filtering** — the spec (§4.3) notes HLTV does not expose role/position fields.

- [ ] **Step 3: Add filter props to `SearchableList`**

Extend `SearchableList` props with optional `extraFilters?: ReactNode` so pages can inject region selects without coupling. Keep the existing search + list + click-to-open-detail behavior.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Teams.tsx frontend/src/pages/Players.tsx frontend/src/components/SearchableList.tsx
git commit -m "feat(frontend): add Teams + Players pages with region filter and compare mode"
```

---

### Task F3.4: Update `News.tsx` (cards + move translation config to drawer)

**Files:**
- Modify: `frontend/src/pages/News.tsx`
- Modify: `frontend/src/pages/Settings.tsx` (translation config moves here — see F3.5)

- [ ] **Step 1: Redesign article cards**

Keep realtime/archive tabs + `useSSE('news', ...)`. Redesign article cards: thumbnail placeholder (a `.card` with a gradient block if no image), category `.badge`, read-time estimate (compute from body length: `Math.max(1, Math.round(words/200))` min). Replace the translation gear button + `TranslateModal` with a small icon button that opens the Settings drawer on the translation tab (call `onOpenSettings()` via a prop or a shared context). Keep the batch-translate + localStorage-cache logic intact.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/News.tsx
git commit -m "feat(frontend): redesign News cards; route translation config to Settings drawer"
```

---

### Task F3.5: Create `Settings.tsx` (drawer content; merge Cache)

**Files:**
- Create: `frontend/src/pages/Settings.tsx`
- Delete: `frontend/src/pages/Cache.tsx`

- [ ] **Step 1: Build the Settings drawer content**

Sections (stacked, each a `.card`):
1. **Cache** — reuse `Cache.tsx` logic: `api.cacheStats()` (entries/hits/misses as `<StatCard>`), clear button (`api.clearCache()`), refresh button.
2. **Theme** — a toggle (dark default; store preference in localStorage `hltv:theme`).
3. **Translation** — move the `TranslateModal` form (API URL, key, model, presets) here as an inline section using `useTranslateConfig()`.
4. **System status** — condensed `api.status()` endpoint health list.

- [ ] **Step 2: Delete `Cache.tsx`**

```bash
git rm frontend/src/pages/Cache.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(frontend): add Settings drawer (cache + theme + translation + status); remove Cache page"
```

---

### Task F3.6: Update `PlayerDetail.tsx` (radar chart, role badge)

**Files:**
- Modify: `frontend/src/components/PlayerDetail.tsx`
- Reference: `.superpowers/brainstorm/1180-1782714264/content/player-detail.html`

- [ ] **Step 1: Add the radar chart**

Replace the hand-drawn SVG radar (current lines 102-117) with a Chart.js radar rendering the 7 abilities (Firepower, Opening, Clutching, Sniping, Entrying, Trading, Utility — 0-100). Use `chart.js/auto`'s `RadialController` via a `<canvas>` ref + `useEffect` to instantiate/destroy the chart on mount/unmount. Style: red fill at 15% opacity, 4px data points, 5 grid levels. Match the mockup layout: header (flag + real name + age + team), Rating 3.0 `<StatCard>`, radar, career-stats grid of `<StatCard>`, highlights chips, recent-matches list with `.badge.win`/`.badge.loss`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PlayerDetail.tsx
git commit -m "feat(frontend): redesign PlayerDetail with Chart.js radar and design-system cards"
```

---

### Task F3.7: Update `TeamDetail.tsx` (compare button, form strip) + create `TeamComparison.tsx`

**Files:**
- Modify: `frontend/src/components/TeamDetail.tsx`
- Create: `frontend/src/components/TeamComparison.tsx`
- Reference: `.superpowers/brainstorm/1180-1782714264/content/team-detail-compare.html`

- [ ] **Step 1: Redesign TeamDetail**

Match mockup: header (flag + name + world rank), Win Rate + Win Streak `<StatCard>`s (streak visualized with 🔥 emoji, 1 per win, max 10), roster as clickable chips opening PlayerDetail, achievements grid (trophy emoji, tier-based color: gold major / silver s-tier), last-5-matches `.form-strip`. Add a "[Compare with another team]" `.button` that opens `<TeamComparison teamAId={id} />`.

- [ ] **Step 2: Create `TeamComparison.tsx`**

Props: `{ teamAId: number; onClose: () => void; }`. Render a wide (~900px) `<Modal>` (use the `fullscreen` prop on mobile). Internal state: a team-B `<select>` (populated from `api.search('', 'team')` or a cached team list) + a "Compare" button. On compare, fetch `api.compareTeams(teamAId, teamBId)` and render side-by-side: profiles (name/country/rank), stats grid (3-column: left value | center label | right value, winner highlighted via `--accent-red`/`--accent-green`), head-to-head bar chart (percentage-width flex divs), recent-encounters timeline (`.badge.win`/`.badge.loss`), achievement counts. If `headToHead` is null/empty, show `<EmptyState message="No matches found between these teams" />`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TeamDetail.tsx frontend/src/components/TeamComparison.tsx
git commit -m "feat(frontend): redesign TeamDetail + add TeamComparison modal"
```

---

### Task F3.8: Update `NewsDetail.tsx` + `Modal.tsx` (fullscreen prop)

**Files:**
- Modify: `frontend/src/components/Modal.tsx`
- Modify: `frontend/src/components/NewsDetail.tsx`

- [ ] **Step 1: Add `fullscreen` prop to Modal**

Props: `{ children; onClose; width?; maxHeight?; fullscreen?: boolean }`. When `fullscreen` is true (or on mobile via `@media (max-width: 768px)`), render at `100vw`/`100vh` with no border-radius. Otherwise keep current behavior (700px default, `85vh`).

- [ ] **Step 2: Redesign NewsDetail**

Thumbnail placeholder + category `.badge` + read-time estimate; translation toggle as an icon button (not a gear modal). Keep `api.getNewsArticle(url)` + `POST /api/translate` + localStorage cache.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Modal.tsx frontend/src/components/NewsDetail.tsx
git commit -m "feat(frontend): add Modal fullscreen prop; redesign NewsDetail"
```

---

### Task F3.9: Delete Dashboard, finalize route cleanup

**Files:**
- Delete: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Delete Dashboard**

```bash
git rm frontend/src/pages/Dashboard.tsx
```
Ensure `App.tsx` no longer imports it (Homepage replaced it in F2.2).

- [ ] **Step 2: Full build check**

Run: `cd frontend && npm run build`
Expected: `tsc -b` passes (no references to deleted pages, no old CSS var references). `dist/` produced.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(frontend): remove Dashboard page (replaced by Homepage)"
```

---

## Phase 4: Component library extraction

### Task F4.1: Extract `Card`, `Badge`, `StatCard`, `EmptyState`, `LoadingSpinner`, `Drawer`

**Files:**
- Create: `frontend/src/components/Card.tsx`, `Badge.tsx`, `StatCard.tsx`, `EmptyState.tsx`, `LoadingSpinner.tsx`, `Drawer.tsx`

- [ ] **Step 1: Create the components**

Each is a thin wrapper around the CSS classes from Phase 1:
- `Card({ children, hover, className })` → `<div className={cn('card', hover && 'hoverable', className)}>`
- `Badge({ children, variant })` → `<span className={cn('badge', variant)}>` (variant ∈ `live|win|loss|undefined`)
- `StatCard({ label, value, sub })` → `<div className="stat-card"><div className="label">{label}</div><div className="value">{value}</div>{sub && <div className="sub">{sub}</div>}</div>`
- `EmptyState({ message })` → centered icon + message
- `LoadingSpinner()` → CSS spinner (add `.spinner` to `components.css`)
- `Drawer({ open, onClose, children })` → slide-out panel from the right (add `.drawer` + `.drawer.open` to `components.css`)

Add a tiny `cn` helper (`frontend/src/utils/cn.ts`: join truthy class names) to avoid a `clsx` dependency.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Card.tsx frontend/src/components/Badge.tsx frontend/src/components/StatCard.tsx frontend/src/components/EmptyState.tsx frontend/src/components/LoadingSpinner.tsx frontend/src/components/Drawer.tsx frontend/src/utils/cn.ts frontend/src/styles/components.css
git commit -m "feat(frontend): extract Card/Badge/StatCard/EmptyState/LoadingSpinner/Drawer components"
```

---

### Task F4.2: Replace inline patterns across all pages/components

**Files:**
- Modify: all `frontend/src/pages/*.tsx` and `frontend/src/components/*.tsx`

- [ ] **Step 1: Replace inline style objects with components**

Where a page/component repeats `style={{ background: 'var(--bg-secondary)', border: ..., ... }}` (the card pattern), replace with `<Card>`. Replace `style={{ ... badge ... }}` with `<Badge>`. Replace stat number+label blocks with `<StatCard>`. Replace "Loading..." text with `<LoadingSpinner />`. Replace "暂无数据" placeholders with `<EmptyState>`. Keep inline styles ONLY for one-off positioning/sizing.

- [ ] **Step 2: Verify build + visual sanity**

Run: `cd frontend && npm run build`. Expected: succeeds. Then `npm run dev` and click through every page + open each detail modal — confirm no layout regressions.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(frontend): replace inline styles with design-system components"
```

---

## Phase 5: Responsive polish

### Task F5.1: Mobile breakpoints + hamburger menu wiring

**Files:**
- Modify: `frontend/src/styles/components.css` (add `@media` blocks), `frontend/src/App.tsx`

- [ ] **Step 1: Add mobile breakpoints**

Append to `components.css`:
```css
@media (max-width: 1024px) {
  .content { padding: var(--space-4) var(--space-4); }
  .homepage-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .subnav { display: none; }
  .subnav.mobile-open { display: flex; position: fixed; inset: var(--topbar-h) 0 auto 0; flex-direction: column; height: auto; background: var(--bg-secondary); z-index: 15; }
  .modal-fullscreen { width: 100vw !important; height: 100vh !important; max-height: 100vh !important; border-radius: 0 !important; }
  .match-grid { grid-template-columns: 1fr; }
}
```
Add a `.modal-fullscreen` class and apply it on Modal when `fullscreen` or mobile.

- [ ] **Step 2: Wire the mobile nav overlay**

In `App.tsx`, when `mobileNavOpen`, render `<SubNav className="mobile-open" ... />` as a full-screen overlay; Hamburger toggles it; clicking a link closes it.

- [ ] **Step 3: Test on mobile viewport**

Run dev server, use Chrome DevTools device emulation (iPhone 12, 390px). Click through all pages, open TeamDetail + PlayerDetail modals (should be fullscreen), test the hamburger menu.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/components.css frontend/src/App.tsx
git commit -m "feat(frontend): add mobile breakpoints and hamburger nav overlay"
```

---

## Phase 6: End-to-end build verification

### Task F6.1: Full project build (frontend + Go embed)

- [ ] **Step 1: Build frontend**

Run: `cd frontend && npm run build`
Expected: `dist/` produced at project root with `index.html` + `dist/assets/*`.

- [ ] **Step 2: Build Go binary with embedded frontend**

Run: `go build -o hltv-mcp ./...` (or `go build ./...`)
Expected: succeeds. The `//go:embed dist` in `main.go` picks up the new `dist/`.

- [ ] **Step 3: Run the binary and smoke-test the SPA + APIs**

Run: `./hltv-mcp` (set `HTTP_PORT=8082 HTTP_HOST=0.0.0.0`). Then `curl -s http://localhost:8082/ | head` (should serve `index.html`) and `curl -s http://localhost:8082/api/rankings | head` + `curl -s "http://localhost:8082/api/teams/compare?a=5378&b=4608" | head`.

- [ ] **Step 4: Commit if anything was tidied**

```bash
git add -A
git commit -m "chore: verify full frontend+Go embed build"
```

---

## Self-Review (completed by plan author)

**1. Spec coverage:** §2 goals — visual rebrand (F1.1 tokens), nav optimization (F2.1), user-first homepage (F3.1), design system (F1.1+F4.1), responsive (F5.1). §4.1 visual style (F1.1). §4.2 layout (F2.1+F2.2). §4.3 page reorg — Homepage (F3.1), Matches (F3.2), Teams (F3.3), Players (F3.3), News (F3.4), Cache→Settings drawer (F3.5). §4.4 component refactor (F1.1+F4.1+F4.2). §4.5 player detail (F3.6). §4.6 team detail (F3.7). §4.7 team comparison (F3.7). §4.8(=4.6 second) responsive (F5.1). §5 file structure (all tasks). §6 API — /api/rankings (F0.1), /api/teams/compare (F0.2). §7 migration path phases 1-5 ↔ Phases 1-5. ✓

**2. Placeholder scan:** No "TBD"/"implement later". Each UI task references a concrete mockup HTML file. CSS tokens and component contracts are verbatim. Backend endpoint tasks include real Go code. ✓ (Note: scraper selectors in F0.1 Step 2 are marked "verify against live fetch" — this is intentional, HLTV markup drifts and a hardcoded selector without verification is a known failure mode, not a placeholder.)

**3. Type consistency:** `TeamRanking` (F0.1) used by `GetRankings` facade + handler + `api.getRankings()` (F3.1). `TeamComparison`/`TeamProfile`/`HeadToHead` (F0.2) used by `CompareTeams` + handler + `TeamComparison.tsx` (F3.7). `cn` helper (F4.1) used by Card/Badge. `fullscreen` prop (F3.8) used by TeamComparison (F3.7) + responsive (F5.1). Font tokens Rajdhani/Inter/JetBrains Mono consistent across F1.1 + base.css. ✓
