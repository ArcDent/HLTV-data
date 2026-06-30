package normalizer

import (
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/arcdent/hltv-mcp/internal/types"
)

// NormalizeNews parses archive news items from HLTV news page HTML.
// HLTV archive structure: each item is an <a class="newsline article"> that
// wraps its own .newstext (and .newstc > .newsrecent). All items share one
// container, so the link must come from the item's own <a> — not from Find("a")
// on the shared container, which would return the first item's link for every item.
func NormalizeNews(doc *goquery.Document) []types.NewsItem {
	var items []types.NewsItem
	doc.Find(".newstext").Each(func(_ int, s *goquery.Selection) {
		title := cleanText(s.Text())
		if title == "" {
			return
		}
		link, _ := s.Closest("a").Attr("href")
		date := cleanText(s.Parent().Find(".newsrecent").First().Text())
		items = append(items, types.NewsItem{
			Title:       title,
			Link:        link,
			PublishedAt: date,
		})
	})
	return items
}

// NormalizeRealtimeNews parses realtime news items from HLTV homepage HTML
func NormalizeRealtimeNews(doc *goquery.Document) []types.RealtimeNewsItem {
	var items []types.RealtimeNewsItem
	// HLTV homepage has news links in various containers
	doc.Find("a[href*='/news/']").Each(func(_ int, s *goquery.Selection) {
		title := cleanText(s.Text())
		title = strings.Join(strings.Fields(title), " ")
		if title == "" {
			return
		}
		link, _ := s.Attr("href")
		// Only include actual news links (not navigation)
		if !strings.HasPrefix(link, "/news/") {
			return
		}
		items = append(items, types.RealtimeNewsItem{
			Section: "latest",
			Title:   title,
			Link:    link,
		})
	})
	return items
}

// NormalizeNewsArticle extracts plain text from a news article page
func NormalizeNewsArticle(doc *goquery.Document, link string) types.NewsArticle {
	a := types.NewsArticle{Link: link}

	titleEl := doc.Find(".news-headline, .article-title, h1").First()
	a.Title = strings.TrimSpace(titleEl.Text())

	dateEl := doc.Find(".news-date, .article-date, .date").First()
	a.PublishedAt = strings.TrimSpace(dateEl.Text())

	authorEl := doc.Find(".news-author, .author-name").First()
	a.Author = strings.TrimSpace(authorEl.Text())

	var paragraphs []string
	doc.Find(".news-block p, .news-body p, article p, .body p").Each(func(_ int, s *goquery.Selection) {
		t := strings.TrimSpace(s.Text())
		if t != "" {
			paragraphs = append(paragraphs, t)
		}
	})
	if len(paragraphs) == 0 {
		doc.Find(".content p, .main-content p, .article-content p").Each(func(_ int, s *goquery.Selection) {
			t := strings.TrimSpace(s.Text())
			if t != "" {
				paragraphs = append(paragraphs, t)
			}
		})
	}
	a.BodyText = strings.Join(paragraphs, "\n\n")

	return a
}
