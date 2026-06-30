package normalizer

import (
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/arcdent/hltv-mcp/internal/types"
)

// NormalizeTeamProfile extracts team profile data from HLTV team page HTML
func NormalizeTeamProfile(doc *goquery.Document, fallback types.ResolvedTeam) types.TeamProfile {
	p := types.TeamProfile{
		ID:      fallback.ID,
		Name:    fallback.Name,
		Slug:    fallback.Slug,
		Country: fallback.Country,
		Rank:    fallback.Rank,
	}
	if name := strings.TrimSpace(doc.Find(".team-name, .profile-team-name, h1").First().Text()); name != "" {
		p.Name = name
	}
	return p
}

// NormalizeTeamDetail extracts full team detail from the team page HTML
func NormalizeTeamDetail(doc *goquery.Document) types.TeamDetail {
	td := types.TeamDetail{}

	// Profile: name from h1, country from profile container
	td.Profile.Name = cleanText(doc.Find("h1.profile-team-name, h1").First().Text())
	profileText := cleanText(doc.Find(".profile-team-container, .profile-team-info").First().Text())
	if profileText != "" {
		parts := strings.Fields(profileText)
		if len(parts) >= 1 {
			td.Profile.Country = parts[0]
		}
	}

	// Logo: the team page header exposes a single img.teamlogo (no day/night
	// variants for the main container). Skip HLTV's placeholder SVG so the
	// frontend falls back to the first-letter avatar for logo-less teams.
	if src, ok := doc.Find(".profile-team-logo-container img.teamlogo").First().Attr("src"); ok {
		src = decodeLogoSrc(src)
		if !isPlaceholderLogo(src) {
			td.Profile.Logo = src
		}
	}

	// Ranking: use .value.h-rank for HLTV world rank
	rankText := cleanText(doc.Find(".value.h-rank").First().Text())
	if rankText != "" {
		td.Ranking.WorldRank, _ = strconv.Atoi(strings.TrimPrefix(rankText, "#"))
	}
	// Also try .profile-team-stat for "World ranking#N"
	if td.Ranking.WorldRank == 0 {
		doc.Find(".profile-team-stat").Each(func(_ int, s *goquery.Selection) {
			t := cleanText(s.Text())
			if strings.HasPrefix(strings.ToLower(t), "world ranking") {
				td.Ranking.WorldRank, _ = strconv.Atoi(strings.TrimPrefix(strings.TrimPrefix(t, "World ranking"), "#"))
			}
		})
	}

	// Achievements: parse trophy links from .trophySection
	seenAchievements := make(map[string]bool)
	doc.Find(".trophySection .trophyDescription, .trophySection .trophy").Each(func(_ int, s *goquery.Selection) {
		label := cleanText(s.AttrOr("title", ""))
		if label == "" {
			label = cleanText(s.Text())
		}
		if label == "" || seenAchievements[label] {
			return
		}
		seenAchievements[label] = true

		tier := "a"
		lower := strings.ToLower(label)
		if strings.Contains(lower, "major") {
			tier = "major"
		} else if strings.Contains(lower, "iem") || strings.Contains(lower, "esl") || strings.Contains(lower, "blast") || strings.Contains(lower, "intel") {
			tier = "s"
		}
		if strings.Contains(lower, "win streak") || strings.Contains(lower, "连胜") || strings.Contains(lower, "streak") {
			tier = "streak"
		}
		td.Achievements = append(td.Achievements, types.TeamAchievement{
			Label: label, Count: 1, Tier: tier,
		})
	})

	// Highlights: win rate, win streak, last 5 matches from team page
	hl := normalizeTeamHighlights(doc)
	td.Highlights = &hl

	// Roster: extract only from the current lineup grid (.bodyshot-team)
	seenIDs := make(map[int]bool)
	doc.Find(".bodyshot-team a[href*='/player/']").Each(func(_ int, s *goquery.Selection) {
		href := s.AttrOr("href", "")
		if href == "" {
			return
		}
		parts := strings.Split(strings.Trim(href, "/"), "/")
		var pID int
		var pSlug string
		for i, part := range parts {
			if part == "player" && i+1 < len(parts) {
				pID, _ = strconv.Atoi(parts[i+1])
			}
			if i+2 < len(parts) && part == "player" {
				pSlug = parts[i+2]
			}
		}
		if pID == 0 || seenIDs[pID] {
			return
		}
		seenIDs[pID] = true

		p := types.TeamRosterPlayer{
			ID:   pID,
			Name: cleanText(s.Text()),
			Slug: pSlug,
		}
		td.Roster = append(td.Roster, p)
	})

	return td
}

// normalizeTeamHighlights extracts win rate, win streak, and last 5 matches from team page
func normalizeTeamHighlights(doc *goquery.Document) types.TeamHighlights {
	h := types.TeamHighlights{}

	doc.Find(".highlighted-stat").Each(func(_ int, s *goquery.Selection) {
		text := cleanText(s.Text())
		lower := strings.ToLower(text)
		if strings.Contains(lower, "win rate") && strings.Contains(lower, "%") {
			// Text is like "76.2% Win rate Last 3 months"
			parts := strings.Fields(text)
			if len(parts) > 0 && strings.HasSuffix(parts[0], "%") {
				h.WinRate = parts[0]
			}
		}
		if strings.Contains(lower, "current win streak") || strings.Contains(lower, "win streak") {
			// Text is like "6 Current win streak"
			parts := strings.Fields(text)
			if len(parts) > 0 {
				if streak, err := strconv.Atoi(parts[0]); err == nil {
					h.WinStreak = streak
				}
			}
		}
	})

	// Last 5 matches: opponent links + match-status are siblings in .last-5-matches
	doc.Find(".last-5-matches").Each(func(_ int, box *goquery.Selection) {
		var lastOpponent string
		box.Find("*").Each(func(_ int, child *goquery.Selection) {
			class, _ := child.Attr("class")
			if strings.Contains(class, "highlighted-team-name") && strings.Contains(class, "text-ellipsis") {
				lastOpponent = cleanText(child.Text())
			}
			if lastOpponent != "" && strings.Contains(class, "highlighted-match-status") {
				result := "lost"
				if strings.Contains(class, "match-won") {
					result = "won"
				}
				h.RecentMatches = append(h.RecentMatches, types.TeamHighlightMatch{
					Opponent: lastOpponent,
					Result:   result,
				})
				lastOpponent = ""
			}
		})
	})

	return h
}

// decodeLogoSrc normalizes HTML entities in a logo src URL. goquery already
// decodes attributes, but this guards against double-encoded input cheaply.
func decodeLogoSrc(src string) string {
	return strings.ReplaceAll(src, "&amp;", "&")
}

// isPlaceholderLogo reports whether src is HLTV's placeholder SVG (the
// first-letter "logo" used when a team has no real team logo).
func isPlaceholderLogo(src string) bool {
	return strings.Contains(src, "teamplaceholder") || strings.Contains(src, "/dynamic-svg/")
}

// pickLogoURL selects the best logo URL from a set of img elements, preferring
// the night-only variant (dark-theme optimized) > day-only > base. Returns ""
// if all candidates are placeholders or absent.
func pickLogoURL(imgs *goquery.Selection) string {
	var night, day, base string
	imgs.Each(func(_ int, img *goquery.Selection) {
		src, ok := img.Attr("src")
		if !ok || src == "" || isPlaceholderLogo(src) {
			return
		}
		src = decodeLogoSrc(src)
		class, _ := img.Attr("class")
		switch {
		case strings.Contains(class, "night-only"):
			if night == "" {
				night = src
			}
		case strings.Contains(class, "day-only"):
			if day == "" {
				day = src
			}
		default:
			if base == "" {
				base = src
			}
		}
	})
	if night != "" {
		return night
	}
	if day != "" {
		return day
	}
	return base
}
