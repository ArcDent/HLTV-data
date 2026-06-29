package scraper

import (
	"bytes"
	"testing"

	"github.com/PuerkitoBio/goquery"
	"github.com/arcdent/hltv-mcp/internal/types"
)

// TestParseRankings verifies the HLTV /ranking/teams HTML parser extracts
// rank, team id, name, country and points from each row.
func TestParseRankings(t *testing.T) {
	html := `
	<div class="ranking">
	  <div class="team">
		<span class="team-rank-num">#1</span>
		<a class="teambox" href="/team/5378/vitaly">Vitality</a>
		<span class="team-country">France</span>
		<span class="points">837</span>
	  </div>
	  <div class="team">
		<span class="team-rank-num">#2</span>
		<a class="teambox" href="/team/4608/spirit">Spirit</a>
		<span class="team-country">Russia</span>
		<span class="points">712</span>
	  </div>
	</div>`
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader([]byte(html)))
	if err != nil {
		t.Fatalf("parse doc: %v", err)
	}
	got := parseRankings(doc)
	if len(got) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(got))
	}
	want := []types.TeamRankingRow{
		{Rank: 1, TeamID: 5378, Name: "Vitality", Country: "France", Points: "837"},
		{Rank: 2, TeamID: 4608, Name: "Spirit", Country: "Russia", Points: "712"},
	}
	for i, w := range want {
		if got[i] != w {
			t.Errorf("row %d: got %+v, want %+v", i, got[i], w)
		}
	}
}

// TestParseRankingsEmpty verifies the parser returns an empty slice (not nil)
// when no ranking rows are present.
func TestParseRankingsEmpty(t *testing.T) {
	html := `<html><body><div class="ranking"></div></body></html>`
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader([]byte(html)))
	if err != nil {
		t.Fatalf("parse doc: %v", err)
	}
	got := parseRankings(doc)
	if len(got) != 0 {
		t.Fatalf("expected 0 rows, got %d", len(got))
	}
}
