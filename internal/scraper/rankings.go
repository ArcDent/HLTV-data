package scraper

import (
	"bytes"
	"context"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/arcdent/hltv-mcp/internal/client"
	"github.com/arcdent/hltv-mcp/internal/types"
)

// RankingsScraper scrapes HLTV's /ranking/teams page.
type RankingsScraper struct{ cli *client.HltvClient }

func NewRankingsScraper(cli *client.HltvClient) *RankingsScraper {
	return &RankingsScraper{cli: cli}
}

// Get fetches the /ranking/teams page and returns parsed ranking rows.
func (s *RankingsScraper) Get(ctx context.Context) ([]types.TeamRankingRow, error) {
	body, err := s.cli.FetchHTML(ctx, "/ranking/teams", "rankings")
	if err != nil {
		return nil, err
	}
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	return parseRankings(doc), nil
}

var (
	teamIDRe   = regexp.MustCompile(`/team/(\d+)/`)
	pointsNumRe = regexp.MustCompile(`\((\d+)`)
)

// parseRankings extracts the top-30 ranking rows from the HLTV /ranking/teams document.
// New selectors (verified against live HTML, 2026-06-30 — HLTV redesigned the page and
// the legacy .ranking .team / .team-rank-num / a.teambox / .team-country selectors no
// longer match anything):
//   - container: .ranked-team.standard-box (top 30 are the main ranking, #1..#30)
//   - rank:      .position            text "#1" → parse int
//   - team name: .name                text "Falcons"
//   - points:    .points              text "(883 HLTV points)" → regex \((\d+) extracts 883
//   - team-id:   a.moreLink[href*="/team/"]  href "/team/11283/falcons" → regex /team/(\d+)/
//   - country:   (ranking page no longer has a country column) → left empty
// Only the first 30 rows are returned (the page lists sub-region rankings beyond #30).
func parseRankings(doc *goquery.Document) []types.TeamRankingRow {
	var rows []types.TeamRankingRow
	doc.Find(".ranked-team.standard-box").EachWithBreak(func(_ int, row *goquery.Selection) bool {
		rankStr := strings.TrimSpace(row.Find(".position").Text())
		rankStr = strings.TrimPrefix(rankStr, "#")
		rank, _ := strconv.Atoi(rankStr)

		// Stop once we pass the main top-30 board (sub-region rankings follow #30).
		if len(rows) >= 30 || rank > 30 {
			return false
		}

		link := row.Find("a.moreLink[href*='/team/']")
		if link.Length() == 0 {
			link = row.Find("a[href*='/team/']")
		}
		href, _ := link.Attr("href")
		teamID := 0
		if m := teamIDRe.FindStringSubmatch(href); len(m) > 1 {
			teamID, _ = strconv.Atoi(m[1])
		}
		name := strings.TrimSpace(row.Find(".name").Text())

		pointsRaw := strings.TrimSpace(row.Find(".points").Text())
		points := "0"
		if m := pointsNumRe.FindStringSubmatch(pointsRaw); len(m) > 1 {
			points = m[1]
		}

		if teamID == 0 && name == "" {
			return true
		}
		rows = append(rows, types.TeamRankingRow{
			Rank:    rank,
			TeamID:  teamID,
			Name:    name,
			Country: "", // ranking page no longer exposes a country column
			Points:  points,
		})
		return true
	})
	// Hard cap in case ranks are non-contiguous but we still only want top 30.
	if len(rows) > 30 {
		rows = rows[:30]
	}
	return rows
}

