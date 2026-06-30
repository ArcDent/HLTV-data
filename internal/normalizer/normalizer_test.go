package normalizer

import (
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
	"github.com/arcdent/hltv-mcp/internal/types"
)

func TestNormalizeMatches(t *testing.T) {
	html := `<div class="results-sublist"><div class="standard-headline">Results for May 28th 2026</div><div class="result-con"><a class="a-reset" href="/matches/123/foo-vs-bar"><div class="result"><table><tbody><tr><td class="team-cell"><div class="line-align team1"><div class="team">Spirit</div></div></td><td class="result-score">2:1</td><td class="team-cell"><div class="line-align team2"><div class="team">Vitality</div></div></td></tr></tbody></table></div></a></div></div>`
	doc, _ := goquery.NewDocumentFromReader(strings.NewReader(html))
	matches := NormalizeMatches(doc, "")
	if len(matches) == 0 {
		t.Fatal("expected at least 1 match")
	}
	if matches[0].Team1 != "Spirit" {
		t.Errorf("team1: %s", matches[0].Team1)
	}
	if matches[0].Score != "2:1" {
		t.Errorf("score: %s", matches[0].Score)
	}
	if matches[0].Team2 != "Vitality" {
		t.Errorf("team2: %s", matches[0].Team2)
	}
}

func TestNormalizeNews(t *testing.T) {
	// Real HLTV archive structure: each news item is an <a class="newsline article">
	// wrapping its own .newstext; all items live in a shared container. The link
	// must come from the item's own <a>, not the first <a> in the shared container.
	html := `<div class="standard-box standard-list">` +
		`<a href="/news/45028/media-legacy-target-tomaszin" class="newsline article"><img class="newsflag"><div class="newstext">Media: Legacy target tomaszin </div><div class="newstc"><div class="newsrecent">2026-06-30</div></div></a>` +
		`<a href="/news/45027/sdy-hits-free-agency" class="newsline article"><img class="newsflag"><div class="newstext">sdy hits free agency </div><div class="newstc"><div class="newsrecent">2026-06-30</div></div></a>` +
		`</div>`
	doc, _ := goquery.NewDocumentFromReader(strings.NewReader(html))
	items := NormalizeNews(doc)
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if items[0].Title != "Media: Legacy target tomaszin" {
		t.Errorf("title[0]: %s", items[0].Title)
	}
	if items[0].Link != "/news/45028/media-legacy-target-tomaszin" {
		t.Errorf("link[0]: %s", items[0].Link)
	}
	if items[1].Link != "/news/45027/sdy-hits-free-agency" {
		t.Errorf("link[1]: %s (must be the item's own link, not the shared container's first)", items[1].Link)
	}
	if items[0].PublishedAt != "2026-06-30" {
		t.Errorf("date[0]: %s", items[0].PublishedAt)
	}
}

func TestPlaceholderTranslation(t *testing.T) {
	tests := []struct{ in, want string }{
		{"winner", "胜者"},
		{"Winner", "胜者"},
		{"Winner of Group A", "胜者"},
		{"WINNER", "胜者"},
		{"loser", "败者"},
		{"Loser of match 3", "败者"},
		{"tbd", "待定"},
		{"TBD", "待定"},
		{"  tbd  ", "待定"},
		{"Vitality", "Vitality"},
		{"FaZe Clan", "FaZe Clan"},
	}
	for _, tt := range tests {
		if got := translatePlaceholder(tt.in); got != tt.want {
			t.Errorf("translatePlaceholder(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestNormalizeBO1Score(t *testing.T) {
	tests := []struct{ in, want string }{
		{"2:0", "2:0"},
		{"2:1", "2:1"},
		{"0:2", "0:2"},
		{"13:5", "1:0"},
		{"5:13", "0:1"},
		{"16:14", "1:0"},
		{"14:16", "0:1"},
		{"16:16", "平局"},
		{"13:11", "1:0"},
		{"11:13", "0:1"},
		{"", ""},
		{"invalid", "invalid"},
		{"13 : 5", "1:0"},
		{"5 : 13", "0:1"},
		{"13:foo", "13:foo"},
	}
	for _, tt := range tests {
		if got := normalizeBO1Score(tt.in); got != tt.want {
			t.Errorf("normalizeBO1Score(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestSplitTeamMatches(t *testing.T) {
	matches := []types.NormalizedMatch{
		{Score: "2:1", PlayedAt: "2025-01-01"},
		{ScheduledAt: "2025-02-01"},
		{Score: "1:2", PlayedAt: "2025-01-02"},
	}
	recent, upcoming := SplitTeamMatches(matches)
	if len(recent) != 2 {
		t.Errorf("expected 2 recent, got %d", len(recent))
	}
	if len(upcoming) != 1 {
		t.Errorf("expected 1 upcoming, got %d", len(upcoming))
	}
}
