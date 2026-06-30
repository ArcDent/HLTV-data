package scraper

import (
	"bytes"
	"fmt"
	"testing"

	"github.com/PuerkitoBio/goquery"
	"github.com/arcdent/hltv-mcp/internal/types"
)

// TestParseRankings verifies the HLTV /ranking/teams HTML parser extracts
// rank, team id, name and points from each row using the redesigned selectors
// (.ranked-team.standard-box / .position / .name / .points / a.moreLink).
// The ranking page no longer exposes a country column, so Country is empty.
func TestParseRankings(t *testing.T) {
	html := `
	<div class="ranking">
	  <div class="ranked-team standard-box">
		<span class="position">#1</span>
		<a class="moreLink" href="/team/5378/vitaly">Vitality</a>
		<span class="name">Vitality</span>
		<span class="points">(837 HLTV points)</span>
	  </div>
	  <div class="ranked-team standard-box">
		<span class="position">#2</span>
		<a class="moreLink" href="/team/4608/spirit">Spirit</a>
		<span class="name">Spirit</span>
		<span class="points">(712 HLTV points)</span>
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
		{Rank: 1, TeamID: 5378, Name: "Vitality", Country: "", Points: "837"},
		{Rank: 2, TeamID: 4608, Name: "Spirit", Country: "", Points: "712"},
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

// TestParseRankingsTop30Cap verifies the parser caps output at 30 rows even
// when the page lists sub-region rankings beyond #30.
func TestParseRankingsTop30Cap(t *testing.T) {
	var rowsHTML string
	for i := 1; i <= 35; i++ {
		rowsHTML += fmt.Sprintf(`<div class="ranked-team standard-box">
			<span class="position">#%d</span>
			<a class="moreLink" href="/team/%d/t%d">T%d</a>
			<span class="name">T%d</span>
			<span class="points">(%d HLTV points)</span>
			</div>`, i, i, i, i, i, i)
	}
	html := `<div class="ranking">` + rowsHTML + `</div>`
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader([]byte(html)))
	if err != nil {
		t.Fatalf("parse doc: %v", err)
	}
	got := parseRankings(doc)
	if len(got) != 30 {
		t.Fatalf("expected 30 rows (top-30 cap), got %d", len(got))
	}
	if got[29].Rank != 30 {
		t.Errorf("last row rank: got %d, want 30", got[29].Rank)
	}
}
