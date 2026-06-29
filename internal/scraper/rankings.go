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

var teamIDRe = regexp.MustCompile(`/team/(\d+)/`)

// parseRankings extracts ranking rows from the HLTV /ranking/teams document.
// Selectors (per AGENTS.md HLTV selector reference + plan F0.1):
//   - container: div.ranking
//   - each row:   div.team
//   - rank:       .team-rank-num
//   - team:       a.teambox (href holds /team/{id}/{slug})
//   - country:    .team-country
//   - points:     .points
func parseRankings(doc *goquery.Document) []types.TeamRankingRow {
	var rows []types.TeamRankingRow
	doc.Find(".ranking .team").Each(func(_ int, row *goquery.Selection) {
		rankStr := strings.TrimSpace(row.Find(".team-rank-num").Text())
		rankStr = strings.TrimPrefix(rankStr, "#")
		rank, _ := strconv.Atoi(rankStr)

		link := row.Find("a.teambox")
		if link.Length() == 0 {
			link = row.Find("a[href*='/team/']")
		}
		href, _ := link.Attr("href")
		teamID := 0
		if m := teamIDRe.FindStringSubmatch(href); len(m) > 1 {
			teamID, _ = strconv.Atoi(m[1])
		}
		name := strings.TrimSpace(link.Text())

		country := strings.TrimSpace(row.Find(".team-country").Text())
		points := strings.TrimSpace(row.Find(".points").Text())

		if teamID == 0 && name == "" {
			return
		}
		rows = append(rows, types.TeamRankingRow{
			Rank:    rank,
			TeamID:  teamID,
			Name:    name,
			Country: country,
			Points:  points,
		})
	})
	return rows
}

