package facade

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/arcdent/hltv-mcp/internal/cache"
	"github.com/arcdent/hltv-mcp/internal/client"
	"github.com/arcdent/hltv-mcp/internal/config"
	"github.com/arcdent/hltv-mcp/internal/normalizer"
	"github.com/arcdent/hltv-mcp/internal/scraper"
	"github.com/arcdent/hltv-mcp/internal/storage"
	"github.com/arcdent/hltv-mcp/internal/translator"
	"github.com/arcdent/hltv-mcp/internal/types"
)

// HltvFacade orchestrates data fetching with caching, normalization, and filtering
type HltvFacade struct {
	cfg    *config.Config
	cache  *cache.Cache
	store         *storage.Store
	notify        func(entity string, id int, name string)
	translateCfgFn func() (translator.TranslateConfig, error)
	ts     *scraper.TeamScraper
	ps     *scraper.PlayerScraper
	rs     *scraper.ResultsScraper
	ms     *scraper.MatchesScraper
	ns     *scraper.NewsScraper
	rns    *scraper.RealtimeNewsScraper
	nas    *scraper.NewsArticleScraper
	rks    *scraper.RankingsScraper
}

// New creates a new HltvFacade
func New(cfg *config.Config, c *cache.Cache, cli *client.HltvClient, store *storage.Store, notify func(string, int, string), translateCfgFn func() (translator.TranslateConfig, error)) *HltvFacade {
	return &HltvFacade{
		cfg:    cfg,
		cache:  c,
		store:  store,
		notify:         notify,
		translateCfgFn: translateCfgFn,
		ts:             scraper.NewTeamScraper(cli),
		ps:     scraper.NewPlayerScraper(cli),
		rs:     scraper.NewResultsScraper(cli),
		ms:     scraper.NewMatchesScraper(cli),
		ns:     scraper.NewNewsScraper(cli),
		rns:    scraper.NewRealtimeNewsScraper(cli),
		nas:    scraper.NewNewsArticleScraper(cli),
		rks:    scraper.NewRankingsScraper(cli),
	}
}

func (f *HltvFacade) createMeta(ttlSec int) types.ToolMeta {
	return types.ToolMeta{
		Source:        "hltv-mcp",
		FetchedAt:     time.Now().UTC().Format(time.RFC3339),
		Timezone:      "Asia/Shanghai",
		TTLSec:        ttlSec,
	}
}

func (f *HltvFacade) broadcast(entity string, id int, name string) {
	if f.notify != nil {
		f.notify(entity, id, name)
	}
}

// GetPlayerDetailCached implements Type A three-tier fallback (Cache -> SQLite -> HLTV)
func (f *HltvFacade) GetPlayerDetailCached(ctx context.Context, id int, slug string) (types.PlayerDetail, error) {
	if slug == "" {
		slug = fmt.Sprintf("player-%d", id)
	}
	key := fmt.Sprintf("player_detail:%d", id)

	if cached, ok := f.cache.Get(key); ok {
		return cached.(types.PlayerDetail), nil
	}

	if f.store != nil {
		if pd, ok, _ := f.store.GetPlayer(id); ok {
			f.cache.Set(key, pd, 10)
			go f.refreshPlayer(id, slug, key)
			return pd, nil
		}
	}

	pd, err := f.scrapePlayer(ctx, id, slug)
	if err != nil {
		return types.PlayerDetail{}, err
	}
	f.cache.Set(key, pd, f.cfg.CacheTTLPlayerDetail)
	return pd, nil
}

func (f *HltvFacade) scrapePlayer(ctx context.Context, id int, slug string) (types.PlayerDetail, error) {
	doc, err := f.ps.GetPlayer(ctx, id, slug)
	if err != nil {
		return types.PlayerDetail{}, err
	}
	pd := normalizer.NormalizePlayerDetail(doc)
	pd.Profile.ID = id
	if f.store != nil {
		if err := f.store.UpsertPlayer(pd); err != nil {
			log.Printf("facade: upsert player %d: %v", id, err)
		}
	}
	return pd, nil
}

func (f *HltvFacade) refreshPlayer(id int, slug, key string) {
	pd, err := f.scrapePlayer(context.Background(), id, slug)
	if err != nil {
		log.Printf("facade: refresh player %d: %v", id, err)
		return
	}
	f.cache.Set(key, pd, f.cfg.CacheTTLPlayerDetail)
	f.broadcast("player", pd.Profile.ID, pd.Profile.Name)
}

// GetNewsArticleCached implements Type A three-tier fallback
func (f *HltvFacade) GetNewsArticleCached(ctx context.Context, url string) (types.NewsArticle, error) {
	hash := fmt.Sprintf("%x", md5.Sum([]byte(url)))
	key := fmt.Sprintf("news_article:%s", hash)

	if cached, ok := f.cache.Get(key); ok {
		return cached.(types.NewsArticle), nil
	}

	if f.store != nil {
		// body_text empty means only the list item was persisted (BatchUpsertNews);
		// treat as miss and fall through to synchronous scrape so the first open
		// shows a spinner -> full article instead of an empty body.
		if article, ok, _ := f.store.GetNewsArticle(url); ok && article.BodyText != "" {
			f.cache.Set(key, article, 10)
			go f.refreshNewsArticle(url, key)
			return article, nil
		}
	}

	article, err := f.scrapeNewsArticle(ctx, url)
	if err != nil {
		return types.NewsArticle{}, err
	}
	f.cache.Set(key, article, f.cfg.CacheTTLNewsArticle)
	return article, nil
}

func (f *HltvFacade) scrapeNewsArticle(ctx context.Context, url string) (types.NewsArticle, error) {
	doc, err := f.nas.GetArticle(ctx, url)
	if err != nil {
		return types.NewsArticle{}, err
	}
	article := normalizer.NormalizeNewsArticle(doc, url)
	if f.store != nil {
		if err := f.store.UpsertNewsArticle(article); err != nil {
			log.Printf("facade: upsert news article: %v", err)
		}
	}
	return article, nil
}

func (f *HltvFacade) refreshNewsArticle(url, key string) {
	article, err := f.scrapeNewsArticle(context.Background(), url)
	if err != nil {
		log.Printf("facade: refresh news article: %v", err)
		return
	}
	f.cache.Set(key, article, f.cfg.CacheTTLNewsArticle)
	f.broadcast("news", 0, article.Title)
}

// GetTeamDetailCached implements Type A three-tier fallback
func (f *HltvFacade) GetTeamDetailCached(ctx context.Context, id int, slug string) (types.TeamDetail, error) {
	if slug == "" {
		slug = fmt.Sprintf("team-%d", id)
	}
	key := fmt.Sprintf("team_detail:%d", id)

	if cached, ok := f.cache.Get(key); ok {
		return cached.(types.TeamDetail), nil
	}

	if f.store != nil {
		if td, ok, _ := f.store.GetTeam(id); ok {
			f.cache.Set(key, td, 10)
			go f.refreshTeam(id, slug, key)
			return td, nil
		}
	}

	td, err := f.scrapeTeam(ctx, id, slug)
	if err != nil {
		return types.TeamDetail{}, err
	}
	f.cache.Set(key, td, f.cfg.CacheTTLTeam)
	return td, nil
}

func (f *HltvFacade) scrapeTeam(ctx context.Context, id int, slug string) (types.TeamDetail, error) {
	doc, err := f.ts.GetTeam(ctx, id, slug)
	if err != nil {
		return types.TeamDetail{}, err
	}
	td := normalizer.NormalizeTeamDetail(doc)
	td.Profile.ID = id
	td.Profile.Slug = slug

	if td.Profile.Name != "" {
		name := td.Profile.Name
		if upcomingDoc, err := f.ms.GetUpcoming(ctx); err == nil {
			allUpcoming := normalizer.NormalizeUpcomingMatches(upcomingDoc, name)
			for _, m := range allUpcoming {
				if m.Team1 == name || m.Team2 == name || m.Opponent == name {
					td.RecentMatches = append(td.RecentMatches, m)
				}
			}
		}
	}
	if td.Highlights != nil {
		for _, m := range td.Highlights.RecentMatches {
			if m.Result == "won" {
				td.Stats.Wins++
			} else {
				td.Stats.Losses++
			}
		}
		total := td.Stats.Wins + td.Stats.Losses + td.Stats.Draws
		if total > 0 {
			td.Stats.WinRate = fmt.Sprintf("%.0f%%", float64(td.Stats.Wins)/float64(total)*100)
		}
	}

	if f.store != nil {
		if err := f.store.UpsertTeam(td); err != nil {
			log.Printf("facade: upsert team %d: %v", id, err)
		}
	}
	return td, nil
}

func (f *HltvFacade) refreshTeam(id int, slug, key string) {
	td, err := f.scrapeTeam(context.Background(), id, slug)
	if err != nil {
		log.Printf("facade: refresh team %d: %v", id, err)
		return
	}
	f.cache.Set(key, td, f.cfg.CacheTTLTeam)
	f.broadcast("team", td.Profile.ID, td.Profile.Name)
}

// withCacheOrStore provides two-tier (Cache + optional SQLite) fallback for all facade methods.
// storeHit queries SQLite; if it returns data, it's returned immediately
// and compute runs in background to refresh.
func (f *HltvFacade) withCacheOrStore(key string, ttlSec int, query map[string]any,
	storeHit func() (*types.ToolResponse, bool),
	compute func() (*types.ToolResponse, error)) *types.ToolResponse {

	// Tier 1: memory cache
	if cached, ok := f.cache.Get(key); ok {
		r := cloneResponse(cached.(*types.ToolResponse))
		r.Meta.CacheHit = true
		return r
	}
	if stale, sm, ok := f.cache.GetStale(key); ok {
		r := cloneResponse(stale.(*types.ToolResponse))
		r.Meta.CacheHit = true
		r.Meta.Stale = true
		r.Meta.StaleAgeSec = sm.StaleAgeSec
		return r
	}

	// Tier 2: SQLite
	if f.store != nil {
		if r, ok := storeHit(); ok {
			f.cache.Set(key, r, 10)
			go func() {
				val, err := f.cache.RunOnce("refresh:"+key, func() (any, error) {
					newR, computeErr := compute()
					if computeErr != nil {
						return nil, computeErr
					}
					f.cache.Set(key, newR, ttlSec)
					return newR, nil
				})
				if err != nil {
					log.Printf("facade: background refresh %s: %v", key, err)
					return
				}
				_ = val
				f.broadcast("matches", 0, "")
			}()
			return r
		}
	}

	// Tier 3: compute fresh
	val, err := f.cache.RunOnce(key, func() (any, error) {
		r, computeErr := compute()
		if computeErr != nil {
			return nil, computeErr
		}
		f.cache.Set(key, r, ttlSec)
		return r, nil
	})
	if err != nil {
		return f.errorResponse(query, err)
	}
	return val.(*types.ToolResponse)
}

func cloneResponse(r *types.ToolResponse) *types.ToolResponse {
	data, _ := json.Marshal(r)
	var c types.ToolResponse
	json.Unmarshal(data, &c)
	return &c
}

func (f *HltvFacade) errorResponse(query map[string]any, err error) *types.ToolResponse {
	meta := f.createMeta(60)
	if toolErr, ok := err.(*types.ToolError); ok {
		return &types.ToolResponse{Query: query, Meta: meta, Error: toolErr}
	}
	return &types.ToolResponse{
		Query: query, Meta: meta,
		Error: &types.ToolError{
			Code: "INTERNAL_ERROR", Message: err.Error(),
		},
	}
}

// GetRankings fetches the HLTV team ranking table. v1 uses cache-only (no
// SQLite store table); the design says "no backend history needed initially".
func (f *HltvFacade) GetRankings(ctx context.Context) ([]types.TeamRankingRow, error) {
	key := "rankings:teams"
	if cached, ok := f.cache.Get(key); ok {
		return cached.([]types.TeamRankingRow), nil
	}
	rows, err := f.rks.Get(ctx)
	if err != nil {
		return nil, err
	}
	f.cache.Set(key, rows, f.cfg.CacheTTLMatches)
	return rows, nil
}

// CompareTeams returns side-by-side detail for two teams plus head-to-head
// data. The H2H source is /results?team={aID}&team={bID} (HLTV OR filter),
// client-side filtered to direct A-vs-B encounters. When the /results fetch
// fails, HeadToHead is left nil and the frontend renders an empty H2H state.
func (f *HltvFacade) CompareTeams(ctx context.Context, aID, bID int) (*types.TeamComparison, error) {
	a, err := f.GetTeamDetailCached(ctx, aID, "")
	if err != nil {
		return nil, err
	}
	b, err := f.GetTeamDetailCached(ctx, bID, "")
	if err != nil {
		return nil, err
	}

	cmp := buildComparison(&a, &b)

	// Primary H2H source: /results?team=a&team=b (direct encounter history).
	aName, bName := a.Profile.Name, b.Profile.Name
	if aName != "" && bName != "" {
		if doc, err := f.rs.GetResultsByTeams(ctx, aID, bID); err == nil {
			all := normalizer.NormalizeMatches(doc, "")
			var direct []types.NormalizedMatch
			for _, m := range all {
				if isDirectH2H(m, aName, bName) {
					direct = append(direct, m)
				}
			}
			if h2h := buildHeadToHead(direct, aName, bName); h2h != nil {
				cmp.HeadToHead = h2h
			}
		} else {
			log.Printf("facade: CompareTeams GetResultsByTeams %d vs %d: %v", aID, bID, err)
		}
	}

	return cmp, nil
}

// isDirectH2H returns true when the match is between teamA and teamB
// (either order).
func isDirectH2H(m types.NormalizedMatch, aName, bName string) bool {
	return (m.Team1 == aName && m.Team2 == bName) ||
		(m.Team1 == bName && m.Team2 == aName)
}

// buildHeadToHead computes head-to-head stats from a slice of direct A-vs-B
// matches. m.Result is interpreted from team1's perspective (team1 won →
// OutcomeWin), so we map winsA/winsB by checking which side team1 is. Dedups
// by MatchID (or a team/date/score tuple fallback). Returns nil if matches is
// empty.
func buildHeadToHead(matches []types.NormalizedMatch, aName, bName string) *types.HeadToHead {
	type dedupKey struct {
		team1, team2, date, score string
	}
	seenByMatchID := make(map[int]bool)
	seenByTuple := make(map[dedupKey]bool)

	var winsA, winsB int
	var recent []bool
	total := 0

	for _, m := range matches {
		// Deduplicate: prefer MatchID when non-zero; otherwise tuple fallback.
		if m.MatchID > 0 {
			if seenByMatchID[m.MatchID] {
				continue
			}
			seenByMatchID[m.MatchID] = true
		} else {
			date := m.ScheduledAt
			if date == "" {
				date = m.PlayedAt
			}
			t1, t2 := m.Team1, m.Team2
			if t1 > t2 {
				t1, t2 = t2, t1
			}
			key := dedupKey{team1: t1, team2: t2, date: date, score: m.Score}
			if seenByTuple[key] {
				continue
			}
			seenByTuple[key] = true
		}

		total++
		// m.Result is from team1's perspective. If team1 == aName, A won on
		// OutcomeWin; if team1 == bName, B won on OutcomeWin (A lost).
		aWon := (m.Team1 == aName && m.Result == types.OutcomeWin) ||
			(m.Team1 == bName && m.Result == types.OutcomeLoss)
		bWon := (m.Team1 == bName && m.Result == types.OutcomeWin) ||
			(m.Team1 == aName && m.Result == types.OutcomeLoss)
		if aWon {
			winsA++
		} else if bWon {
			winsB++
		}
		recent = append(recent, aWon)
	}

	if total == 0 {
		return nil
	}
	return &types.HeadToHead{
		TotalMatches:  total,
		WinsA:         winsA,
		WinsB:         winsB,
		RecentResults: recent,
	}
}

// buildComparison assembles two TeamDetail structs into a TeamComparison.
// HeadToHead is populated separately by CompareTeams via buildHeadToHead
// (the /results?team=a&team=b source). The teams' RecentMatches lists hold
// upcoming fixtures, not historical encounters, so they are not a usable H2H
// source and are not scanned here.
func buildComparison(a, b *types.TeamDetail) *types.TeamComparison {
	return &types.TeamComparison{TeamA: *a, TeamB: *b}
}

// CacheEntries returns the number of entries currently in the cache
func (f *HltvFacade) CacheEntries() int { return f.cache.Entries() }

// CacheHits returns the cumulative cache hit count
func (f *HltvFacade) CacheHits() int64 { return f.cache.Hits() }

// CacheMisses returns the cumulative cache miss count
func (f *HltvFacade) CacheMisses() int64 { return f.cache.Misses() }

// ClearCache clears all cached entries and resets counters
func (f *HltvFacade) ClearCache() { f.cache.Clear() }

// translateTitles translates titles for items lacking a stored zh
// translation, then pushes an SSE notification. Generic over item type so
// archive and realtime news lists share one implementation.
func translateTitles[T any](f *HltvFacade, items []T, extract func(T) (string, string), has func(string) (bool, error), update func(string, string) error) {
	if f.translateCfgFn == nil || f.store == nil {
		return
	}
	cfg, err := f.translateCfgFn()
	if err != nil {
		log.Printf("facade: translate config: %v", err)
		return
	}
	t := translator.New(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	translated := 0
	for _, item := range items {
		title, link := extract(item)
		if title == "" || link == "" {
			continue
		}
		if has, _ := has(link); has {
			continue
		}
		zh, err := t.TranslateTitle(ctx, title)
		if err != nil {
			log.Printf("facade: translate title %q: %v", title, err)
			continue
		}
		if err := update(link, zh); err != nil {
			log.Printf("facade: store title_zh: %v", err)
			continue
		}
		translated++
	}
	if translated > 0 {
		f.broadcast("news", 0, "")
	}
}

func (f *HltvFacade) translateNewTitles(items []types.NewsItem) {
	translateTitles(f, items, func(i types.NewsItem) (string, string) { return i.Title, i.Link }, f.store.HasNewsTitleZh, f.store.UpdateNewsTitleZh)
}

func (f *HltvFacade) translateNewRealtimeTitles(items []types.RealtimeNewsItem) {
	translateTitles(f, items, func(i types.RealtimeNewsItem) (string, string) { return i.Title, i.Link }, f.store.HasRealtimeTitleZh, f.store.UpdateRealtimeTitleZh)
}
