# Frontend Redesign — Design Spec

**Date:** 2026-06-29
**Status:** Approved
**Scope:** Redesign HLTV MCP frontend with esports dark visual style, reorganized navigation, and new homepage

---

## 1. Problem Statement

The current frontend (`C:\Users\yanga\Projects\HLTV-data\frontend\`) is a functional MVP with:
- Mixed design language (gold accent doesn't match esports context)
- Sidebar navigation wastes horizontal space (180px fixed)
- Dashboard page shows server metrics (developer-focused), not user content
- Cache management as a top-level page (internal tool exposure)
- Minimal responsive design
- Hand-written inline styles scattered across components

The product needs to shift from "developer tool" to "CS esports data platform for enthusiasts" with stronger visual identity and better information architecture.

---

## 2. Goals

1. **Visual rebrand**: Esports dark aesthetic (deep bg + red/orange accents, GitHub Dark-inspired cards)
2. **Navigation optimization**: Top bar + sub-nav layout to maximize content width
3. **User-first content hierarchy**: New homepage with "today's highlights", merge/hide developer tools
4. **Consistent design system**: Centralized style tokens, reusable component patterns
5. **Responsive foundation**: Mobile-friendly breakpoints (current: none)

---

## 3. Non-Goals

- Breaking backend API changes (only new endpoints, no modifications to existing endpoints)
- Real-time features beyond existing SSE (no WebSocket upgrade)
- Internationalization (remains Chinese-primary)
- Accessibility audit (will follow semantic HTML but no WCAG validation)

---

## 4. Design Decisions

### 4.1 Visual Style — Esports Dark

**Palette:**
```css
/* Backgrounds */
--bg-primary: #0d1117;      /* Main canvas */
--bg-secondary: #161b22;    /* Cards */
--bg-tertiary: #21262d;     /* Input fields, hover states */

/* Borders */
--border-default: #30363d;
--border-accent: #ff4655;   /* Active/focus states */

/* Text */
--text-primary: #e6edf3;
--text-secondary: #8b949e;
--text-tertiary: #6e7681;

/* Accents */
--accent-red: #ff4655;      /* Primary actions, live indicators */
--accent-orange: #ff7b00;   /* Secondary highlights */
--accent-green: #3fb950;    /* Success states */
```

**Typography:**
- Display/headings: `Oswald` (condensed, uppercase, 500/600/700)
- Body: `Noto Sans SC` (Chinese-optimized)
- Monospace: `JetBrains Mono` (scores, IDs, timestamps)

**Card style:**
- Background: `--bg-secondary`
- Border: `1px solid --border-default`
- Border-radius: `8px`
- Box-shadow: `0 2px 8px rgba(0,0,0,0.3)` (subtle depth)
- Hover: border changes to `--border-accent`

**Animations:**
- Entrance: `fadeIn` (opacity) + `slideUp` (translateY 12px), 0.3s ease-out
- Stagger: `animation-delay: calc(i * 50ms)`
- Transitions: `background-color, border-color, box-shadow` @ 0.2s

### 4.2 Layout — Top Bar + Sub-Nav

```
┌─────────────────────────────────────────────────────┐
│ [Logo] HLTV DATA         [Search...] [● LIVE] [👤] │ ← Top bar (brand, search, status)
├─────────────────────────────────────────────────────┤
│ ══首页══  赛程  队伍  选手  新闻                    │ ← Sub-nav (pages)
├─────────────────────────────────────────────────────┤
│                                                     │
│                  Content Area                       │
│            (max-width: 1200px, centered)            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Top bar (56px height):**
- Logo + brand on left
- Search input (expandable, 200px → 400px on focus)
- Live indicator (red dot + "LIVE" badge when matches are ongoing)
- Settings/user avatar on right

**Sub-nav (40px height):**
- Horizontal tab links with bottom border indicator
- Active page: red underline (`border-bottom: 2px solid --accent-red`)
- Hover: text color changes to `--text-primary`

**Content area:**
- `max-width: 1200px` (up from current 1100px)
- `padding: 24px 32px`
- Scrollable, full viewport height minus nav

### 4.3 Page Reorganization

| Old | New | Changes |
|-----|-----|---------|
| Dashboard (总览) | **Homepage (首页)** | Replace server metrics with: today's match highlights (3 featured matches), hot news (3 latest), team ranking changes (top 5 movers from new `/api/rankings` endpoint, frontend compares with localStorage snapshots to show ↑↓), quick stats (total matches today, live now, news count) |
| Matches (赛程) | **Matches (赛程)** | Keep 3 tabs (today/upcoming/results), improve event card design (team logos, score prominence, BO format badge), add "watch live" link detection if available |
| Teams (队伍) | **Teams (队伍)** | Keep search + detail modal, add: team comparison tool (backend new endpoint `/api/teams/compare?a=xxx&b=xxx` returns structured comparison data including head-to-head records), recent form indicator (W/L streak badge) |
| Players (选手) | **Players (选手)** | Keep search + detail modal, add: country/region filter (HLTV provides Country field), top 20 HLTV ranking widget. Note: HLTV does not expose explicit role/position fields (AWPer, IGL, etc.) in HTML, so role filtering is not implemented. |
| News (新闻) | **News (新闻)** | Keep realtime + archive tabs, improve: article card design (thumbnail placeholder if no image, category badge, read time estimate), translation UI less intrusive (icon button instead of gear modal) |
| Cache (缓存) | **Settings drawer** | Merge into a slide-out drawer (icon in top bar), include: cache stats + clear button, theme toggle (keep dark as default), translation config, system status (condensed endpoint health) |

### 4.4 Component Refactor

**Current state:** Inline `style` objects scattered in every component (e.g., `cardStyle`, `inputStyle` at module scope).

**Target state:** Centralized design system in `src/styles/`:

```
src/styles/
  tokens.css       — CSS custom properties (colors, spacing, typography)
  base.css         — Global resets, body styles
  components.css   — Reusable .card, .button, .input, .badge classes
  animations.css   — Keyframes and utilities
```

**Migration approach:**
- Extract inline styles to CSS classes where pattern repeats >2 times
- Keep inline styles for one-off positioning/sizing
- Remove Tailwind (only 4 custom utilities used, not worth the bundle size)

**New reusable components to create:**
- `<Card>` — wraps content with standard card styling, optional `hover` prop for border effect
- `<Badge>` — small colored label (LIVE, BO3, Win/Loss, etc.)
- `<StatCard>` — number + label pair for homepage stats
- `<EmptyState>` — "No data" placeholder with icon + message
- `<LoadingSpinner>` — replaces ad-hoc "Loading..." text

### 4.5 Player Detail Page Design

**Data available from backend** (`/api/players/:id`):

| Section | Fields |
|---------|--------|
| **Profile** | Name (nickname), RealName, Team, Country, Age |
| **Rating** | Value (Rating 3.0), Maps (sample size, e.g. "47 maps") |
| **Abilities** (radar chart) | Firepower, Opening, Clutching, Sniping, Entrying, Trading, Utility (all 0-100 scores) |
| **Career Stats** | Total Matches, K/D Ratio, Win Rate, Headshot %, Win Streak |
| **Summary** | Teams played for, Days in current team, Days in all teams, Majors won/played, LANs won/played |
| **Highlights** | Achievements, MVP titles, tournament wins (text labels from HTML) |
| **Recent Matches** | Last 7 matches with Team, Opponent, Score, Event, Result (win/loss) |

**UI Layout (modal, responsive full-screen on mobile):**

```
┌─────────────────────────────────────────────────────┐
│ [X Close]                                    ZywOo │
│ ───────────────────────────────────────────────────│
│ 🇫🇷 Mathieu Herbaut  •  24 years old  •  Vitality │ ← Header
│                                                     │
│ ┌──────────────┐  ┌─────────────────────────────┐ │
│ │ Rating 3.0   │  │ Abilities Radar Chart       │ │
│ │   1.32       │  │                             │ │
│ │  (47 maps)   │  │       Firepower             │ │
│ └──────────────┘  │     Opening   Sniping       │ │
│                   │   Clutching     Entrying    │ │
│ ┌──────────────┐  │     Trading   Utility       │ │
│ │ Career Stats │  └─────────────────────────────┘ │
│ │ 1,234 Matches│                                  │
│ │ K/D: 1.25    │  ┌──────────────────────────────┐│
│ │ Win: 58.3%   │  │ Highlights                   ││
│ │ HS: 52.1%    │  │ 🏆 IEM Katowice 2024 MVP     ││
│ └──────────────┘  │ 🏆 BLAST Fall Final 2023 MVP ││
│                   └──────────────────────────────┘│
│ ┌─────────────────────────────────────────────────┐│
│ │ Recent Matches (Last 7)                         ││
│ │ ┌──────────────────────────────────────────────┐││
│ │ │ ✅ Vitality 2:1 Spirit  •  IEM Katowice 2025 │││
│ │ │ ❌ Vitality 0:2 FaZe    •  BLAST Spring      │││
│ │ └──────────────────────────────────────────────┘││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- Abilities radar chart uses Chart.js or similar (lightweight SVG/canvas)
- Badges for win/loss in recent matches (green ✅ / red ❌)
- Highlights section scrolls if >4 items
- All numeric stats use `JetBrains Mono` for alignment
- Empty states: "No recent highlights" if Highlights array is empty

### 4.6 Team Detail Page Design

**Data available from backend** (`/api/teams/:id`):

| Section | Fields |
|---------|--------|
| **Profile** | Name, Country |
| **Ranking** | World Rank (e.g. "#3") |
| **Roster** | Player list with ID, Name, Slug (5 players typically) |
| **Achievements** | Trophy labels with Tier (major/s-tier/a-tier), Count |
| **Highlights** | Win Rate (e.g. "76.2%"), Win Streak (e.g. "6"), Recent 5 Matches (Opponent, Result) |

**UI Layout (modal, responsive full-screen on mobile):**

```
┌─────────────────────────────────────────────────────┐
│ [X Close]                                 Vitality │
│ ───────────────────────────────────────────────────│
│ 🇫🇷 France  •  World Rank #3                       │ ← Header
│                                                     │
│ ┌──────────────┐  ┌─────────────────────────────┐ │
│ │ Win Rate     │  │ Win Streak                  │ │
│ │   76.2%      │  │      6                      │ │
│ │ (Last 3 mo.) │  │  🔥🔥🔥🔥🔥🔥                 │ │
│ └──────────────┘  └─────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ Roster                                          ││
│ │ ZywOo  •  apEX  •  flameZ  •  Spinx  •  Mezii  ││
│ │ (clickable links to player detail)              ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ Achievements                                    ││
│ │ 🏆 IEM Katowice 2024  🏆 BLAST Fall 2023       ││
│ │ 🏆 ESL Pro League S18  🥈 PGL Major 2024       ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ Last 5 Matches                                  ││
│ │ ✅ vs Spirit  ✅ vs FaZe  ❌ vs G2  ✅ vs Navi ││
│ │ ✅ vs Heroic                                    ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ [Compare with another team] ← Button               │
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- Win streak visualized with 🔥 emoji (1 per win, max 10)
- Roster shows 5 player names as clickable chips, opens player detail on click
- Achievements use trophy emoji, tier-based coloring (gold for major, silver for s-tier)
- Last 5 matches: compact horizontal row of result badges
- "Compare" button opens team comparison modal (side-by-side two teams, uses new `/api/teams/compare` endpoint)

### 4.7 Team Comparison Modal Design

**Triggered by:** "Compare" button in team detail page → user selects a 2nd team from dropdown

**Data from backend** (`/api/teams/compare?a=5378&b=4608`):

| Section | Data |
|---------|------|
| **Profiles** | Both teams' name, country, rank |
| **Stats** | Win rate, roster size, days active, recent form |
| **Head-to-Head** | Total matches between the two teams, wins/losses for each, last 5 encounters |
| **Achievements** | Side-by-side trophy count |

**UI Layout (modal, wide format ~900px):**

```
┌───────────────────────────────────────────────────────────────┐
│ [X Close]                                                     │
│ ───────────────────────────────────────────────────────────── │
│         Vitality          vs          Spirit                  │
│         🇫🇷 #3                        🇷🇺 #1                   │
│                                                               │
│ ┌───────────────────┬───────────────────────┐                │
│ │ Win Rate: 76.2%   │ Win Rate: 81.4%       │                │
│ │ Win Streak: 6     │ Win Streak: 8         │                │
│ │ Roster: 5 players │ Roster: 5 players     │                │
│ └───────────────────┴───────────────────────┘                │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Head-to-Head (Last 10 matches)                          │ │
│ │ Vitality 4 : 6 Spirit                                   │ │
│ │ ████████████                                            │ │
│ │ Last 5: ✅✅❌❌✅ (Vitality perspective)                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌───────────────────┬───────────────────────┐                │
│ │ Achievements      │ Achievements          │                │
│ │ 🏆 x3 Major wins  │ 🏆 x1 Major win       │                │
│ │ 🥇 x12 S-tier     │ 🥇 x8 S-tier          │                │
│ └───────────────────┴───────────────────────┘                │
└───────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Head-to-head bar chart visualization (percentage-based width)
- Recent encounters shown as timeline: ✅ (team A won) / ❌ (team A lost)
- Backend endpoint returns structured data, frontend renders side-by-side
- If no head-to-head data exists, show "No matches found between these teams"

---

### 4.6 Responsive Breakpoints

Current: None. Target:

```css
/* Desktop-first approach */
@media (max-width: 1024px) {
  /* Tablet: reduce content max-width, single-column grids */
}

@media (max-width: 768px) {
  /* Mobile: top bar collapses search, sub-nav becomes hamburger menu */
}
```

**Key changes at mobile:**
- Top bar: logo + hamburger menu button only
- Sub-nav: hidden, opens as full-screen overlay on hamburger click
- Match event cards: stack vertically
- Team/player detail modals: full-screen on mobile
- Homepage: 2-column grid becomes 1-column

---

## 5. File Structure Changes

### New files to create

```
src/
  styles/
    tokens.css
    base.css
    components.css
    animations.css
  components/
    Card.tsx
    Badge.tsx
    StatCard.tsx
    EmptyState.tsx
    LoadingSpinner.tsx
    Drawer.tsx              — Slide-out settings panel
    Hamburger.tsx           — Mobile menu button
  pages/
    Homepage.tsx            — New landing page
    Settings.tsx            — Moved from Cache.tsx, expanded
```

### Files to modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Update route paths, add settings drawer state |
| `src/index.css` | Keep only `@import` for style files, remove inline CSS |
| `src/components/Modal.tsx` | Add `fullscreen` prop for mobile |
| `src/components/SearchableList.tsx` | Add filter props (role, region) |
| `src/components/TeamDetail.tsx` | Add comparison mode toggle |
| `src/components/PlayerDetail.tsx` | Add role badge, top 20 indicator |
| `src/components/NewsDetail.tsx` | Add thumbnail placeholder, category badge |
| `src/pages/Matches.tsx` | Improve event card design, add watch-live detection |
| `src/pages/News.tsx` | Move translation config to settings drawer |
| `vite.config.ts` | Remove `@tailwindcss/vite` plugin |
| `package.json` | Remove Tailwind dependencies |

### Files to delete

- `src/pages/Cache.tsx` (merged into Settings)
- `src/pages/Dashboard.tsx` (replaced by Homepage)

---

## 6. API Integration (Backend Changes Required)

Frontend will consume existing REST + SSE endpoints, **plus new endpoints**:

### New Backend Endpoints Required

| Endpoint | Method | Purpose | Implementation Note |
|----------|--------|---------|---------------------|
| `/api/rankings` | GET | Team rankings list with change indicators | New scraper for HLTV `/ranking/teams`, store in SQLite with timestamps |
| `/api/teams/compare` | GET | Compare two teams side-by-side | Query params: `?a={teamId}&b={teamId}`. Returns structured comparison including head-to-head records |

Frontend ranking change detection uses localStorage to compare snapshots over time (no backend history needed initially).

---

## 7. Migration Path

**Phase 1: Style foundation** (lowest risk)
1. Create `src/styles/` directory with token system
2. Extract reusable CSS classes from inline styles
3. Update `index.css` to import style files
4. Remove Tailwind from config and dependencies

**Phase 2: Layout shell** (visual foundation)
1. Create new top bar + sub-nav components
2. Update `App.tsx` router with new layout wrapper
3. Test navigation and responsiveness

**Phase 3: Page migration** (incremental)
1. Create `Homepage.tsx` (fetch from existing endpoints, new UI)
2. Update `Matches.tsx` (improved card design)
3. Update `Teams.tsx` / `Players.tsx` (add filters/comparison)
4. Update `News.tsx` (improved article cards)
5. Create `Settings.tsx` drawer (merge Cache + add config)

**Phase 4: Component library** (DRY refactor)
1. Extract `<Card>`, `<Badge>`, `<StatCard>`, etc.
2. Replace inline patterns with components
3. Add `<EmptyState>` and `<LoadingSpinner>` everywhere

**Phase 5: Responsive polish**
1. Add mobile breakpoints
2. Test all pages on mobile viewport
3. Add hamburger menu for sub-nav

---

## 8. Design Assets

**Visual mockups preserved in:** `C:\Users\yanga\Projects\HLTV-data\.superpowers\brainstorm\1180-1782714264\content\`

| File | Preview Content |
|------|-----------------|
| `visual-style.html` | Color scheme (esports dark palette: #0d1117 bg, #ff4655 accent), typography system (Rajdhani/Inter/JetBrains Mono), card component examples with hover states |
| `layout.html` | Top bar + sub-nav layout structure, responsive navigation patterns |
| `player-detail.html` | Complete player detail modal: profile header, Rating 3.0 card, 7-dimension ability radar chart (火力/开局/残局/狙击/进点/补枪/道具), career stats grid (4 metrics), achievements badges, recent matches list (5 games with W/L indicators) |
| `team-detail-compare.html` | Team detail modal: header with rank, win rate & streak cards, 5-player roster grid, achievements grid (6 trophies), recent form strip. Also includes team comparison modal: side-by-side stats, head-to-head bar chart (40% vs 60%), recent encounters timeline, achievement counts |
| `player-compare.html` | Player comparison modal (ZywOo vs donk): **overlaid radar chart** (red vs green polygons, 7 abilities with semi-transparent fill), career stats comparison with winner highlighting, side-by-side ability bars, achievements comparison, summary analysis |

**Design system tokens (implemented in mockups):**

```css
/* Backgrounds */
--bg-primary: #0d1117;      /* Main canvas */
--bg-secondary: #161b22;    /* Cards, modals */
--bg-tertiary: #21262d;     /* Input fields, hover states */

/* Borders */
--border-default: #30363d;
--border-accent: #ff4655;

/* Text */
--text-primary: #e6edf3;
--text-secondary: #8b949e;
--text-tertiary: #6e7681;

/* Accents */
--accent-red: #ff4655;      /* Primary actions, player A in comparisons */
--accent-orange: #ff7b00;   /* Secondary highlights */
--accent-green: #3fb950;    /* Success states, player B in comparisons */

/* Typography */
--font-display: 'Rajdhani', sans-serif;      /* Headings, 600-700 weight */
--font-body: 'Inter', sans-serif;            /* Body text, 400-600 weight */
--font-mono: 'JetBrains Mono', monospace;    /* Stats, scores */
```

**Component patterns (extracted from mockups):**

- **Modal**: 900-1000px width, #161b22 background, 12px border-radius, `box-shadow: 0 8px 32px rgba(0,0,0,0.6)`
- **Stat Card**: Centered layout, label (11px uppercase #8b949e) → value (36px Rajdhani #ff4655) → sub-text (11px mono #6e7681)
- **Player/Team Card**: Hover effect (`border-color: #ff4655; transform: translateY(-2px)`), 8px border-radius
- **Badge**: 11px text, 6px vertical + 12px horizontal padding, 6px border-radius, opacity-based colored backgrounds
- **Radar Chart (Canvas-based)**: 7-point polygon, 150px max radius, 5 grid levels, overlaid semi-transparent fills (15% opacity), 4px circle data points, axis labels at 20px offset, bottom legend
- **Comparison Layout**: 3-column grid (left value | center label | right value), winner highlighting via `--accent-red` / `--accent-green`
- **Form Strip**: Horizontal flex row of 32px circle badges, W (green) / L (red) indicators

**Logo:** Keep current `public/favicon.svg` or replace with HLTV-themed icon.

**Fonts:** Google Fonts CDN (Rajdhani for display, Inter for body, JetBrains Mono for data).

---

## 9. Testing Strategy

1. **Visual regression:** Screenshot comparison of old vs new pages (manual)
2. **Responsive testing:** Chrome DevTools device emulation for mobile/tablet
3. **Browser testing:** Chrome, Firefox, Safari (macOS/Windows)
4. **SSE subscription:** Verify live updates still work after layout changes
5. **Translation flow:** Verify news translation caching still persists

---

## 10. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Design drift during implementation | Refer back to mockups in `.superpowers/brainstorm/`, keep color tokens immutable |
| Breaking SSE connections | Keep `useSSE` hook unchanged, test live updates after layout refactor |
| Mobile UX untested in design phase | Prototype hamburger menu early, test on real devices |
| CSS cascade conflicts | Use BEM naming or CSS modules if conflicts arise |
| Translation config moved → user confusion | Add migration banner: "Translation settings moved to gear icon" |

---

## 11. Success Metrics (Post-Launch)

- Visual consistency: All pages use design tokens, no inline color/spacing literals
- Responsive coverage: All pages functional on mobile (320px width minimum)
- Bundle size: <10% increase from current (after removing Tailwind offset)
- User feedback: Positive reception on CS community forums (if shared)
