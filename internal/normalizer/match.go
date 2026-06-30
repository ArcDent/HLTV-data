package normalizer

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/arcdent/hltv-mcp/internal/types"
)

// asiaShanghai is the canonical timezone for "today" calculations across the
// application (normalizer, facade, storage). HLTV /matches titles are CET dates;
// using Asia/Shanghai (UTC+8) means a 6-7 hour window of date mismatch during
// Shanghai early morning when HLTV still shows the previous CET day. This is
// an accepted residual (see spec §5 Issue 6B).
var asiaShanghai = time.FixedZone("CST", 8*3600)

var monthMap = map[string]string{
	"January": "01", "February": "02", "March": "03", "April": "04",
	"May": "05", "June": "06", "July": "07", "August": "08",
	"September": "09", "October": "10", "November": "11", "December": "12",
}

// shortMonthMap maps 3-letter month abbreviations (Jan, Feb, ...) to month numbers.
var shortMonthMap = map[string]string{
	"Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
	"May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
	"Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
}

// AsiaShanghai returns the shared Asia/Shanghai timezone for cross-package use.
func AsiaShanghai() *time.Location { return asiaShanghai }

var resultsDateRe = regexp.MustCompile("Results for (\\w+) (\\d+)(?:st|nd|rd|th)? (\\d{4})")

// headlineDateRe extracts dates from HLTV /matches section headlines.
// Supports: "30 Jun 2026", "Jun 30 2026", "2026-06-30", "Today", "Tomorrow".
var headlineDateRe = regexp.MustCompile(
	`(?i)\b(\d{4})-(\d{2})-(\d{2})\b` + // ISO: 2026-06-30
		`|(?i)\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b` + // 30 Jun 2026
		`|(?i)\b([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})\b` + // Jun 30 2026
		`|(?i)\b(Today|Tomorrow)\b`) // relative words

// parseHeadlineDate extracts a date from a HLTV headline string and returns it
// in ISO YYYY-MM-DD format. Supports "30 Jun 2026", "Jun 30 2026", "2026-06-30",
// and relative words "Today"/"Tomorrow" (computed from base). On failure, falls
// back to base's ISO date.
func parseHeadlineDate(headline string, base time.Time) string {
	m := headlineDateRe.FindStringSubmatch(headline)
	if m == nil {
		return base.In(asiaShanghai).Format("2006-01-02")
	}

	// Group 1-3: ISO format YYYY-MM-DD
	if m[1] != "" {
		return m[1] + "-" + m[2] + "-" + m[3]
	}

	// Group 4-6: "30 Jun 2026" (day month year)
	if m[4] != "" {
		month := monthNameToNum(m[5])
		if month == "" {
			return base.In(asiaShanghai).Format("2006-01-02")
		}
		day := padDay(m[4])
		return m[6] + "-" + month + "-" + day
	}

	// Group 7-9: "Jun 30 2026" (month day year)
	if m[7] != "" {
		month := monthNameToNum(m[8])
		if month == "" {
			return base.In(asiaShanghai).Format("2006-01-02")
		}
		day := padDay(m[9])
		return m[10] + "-" + month + "-" + day
	}

	// Group 10: relative word
	word := strings.ToLower(m[10])
	switch word {
	case "today":
		return base.In(asiaShanghai).Format("2006-01-02")
	case "tomorrow":
		return base.In(asiaShanghai).AddDate(0, 0, 1).Format("2006-01-02")
	}

	return base.In(asiaShanghai).Format("2006-01-02")
}

// monthNameToNum converts a full or abbreviated month name to a 2-digit string.
func monthNameToNum(name string) string {
	// Try full name first
	if num, ok := monthMap[name]; ok {
		return num
	}
	// Try abbreviated (first letter uppercase, rest lowercase)
	if len(name) >= 3 {
		abbr := strings.ToUpper(name[:1]) + strings.ToLower(name[1:3])
		if num, ok := shortMonthMap[abbr]; ok {
			return num
		}
	}
	return ""
}

// padDay zero-pads a day string to 2 digits.
func padDay(day string) string {
	if len(day) == 1 {
		return "0" + day
	}
	return day
}

// NormalizeMatches parses HLTV "/results" page HTML into NormalizedMatch slices
func NormalizeMatches(doc *goquery.Document, perspective string) []types.NormalizedMatch {
	var matches []types.NormalizedMatch
	doc.Find(".results-sublist").Each(func(_ int, sublist *goquery.Selection) {
		date := parseDate(cleanText(sublist.Find(".standard-headline").First().Text()))
		sublist.Find(".result-con").Each(func(_ int, s *goquery.Selection) {
			m := types.NormalizedMatch{Result: types.OutcomeUnknown}

			// Team names: support both ".line-align.team1 .team" (legacy) and
			// ".team1 .team" (HLTV /results?team=X&team=Y variant) structures.
			m.Team1 = cleanText(s.Find(".line-align.team1 .team").First().Text())
			if m.Team1 == "" {
				m.Team1 = cleanText(s.Find(".team-cell .team1 .team").First().Text())
			}
			m.Team2 = cleanText(s.Find(".line-align.team2 .team").First().Text())
			if m.Team2 == "" {
				m.Team2 = cleanText(s.Find(".team-cell .team2 .team").First().Text())
			}

			if score := cleanText(s.Find(".result-score").First().Text()); score != "" {
				m.Score = score
			}

			// Determine win/loss from score-won / score-loss span classes.
			// HLTV marks the winner's score with .score-won and the loser's with
			// .score-loss. The first span belongs to team1, the second to team2.
			spans := s.Find(".result-score span")
			if spans.Length() >= 2 {
				firstClass, _ := spans.Eq(0).Attr("class")
				secondClass, _ := spans.Eq(1).Attr("class")
				team1Won := strings.Contains(firstClass, "score-won")
				team2Won := strings.Contains(secondClass, "score-won")
				if team1Won && !team2Won {
					m.Result = types.OutcomeWin
				} else if team2Won && !team1Won {
					m.Result = types.OutcomeLoss
				} else if strings.Contains(firstClass, "score-loss") && strings.Contains(secondClass, "score-loss") {
					m.Result = types.OutcomeDraw
				}
			}

			m.Event = cleanText(s.Find(".event-name, .map-text, .stars").First().Text())

			if href, ok := s.Find("a.a-reset").First().Attr("href"); ok && href != "" {
				if id := parseMatchID(href); id > 0 {
					m.MatchID = id
				}
			}

			m.PlayedAt = date

			if perspective != "" {
				if m.Team1 == perspective {
					m.Opponent = m.Team2
				} else if m.Team2 == perspective {
					m.Opponent = m.Team1
				}
			}

			if m.Team1 != "" || m.Team2 != "" {
				matches = append(matches, m)
			}
		})
	})
	return matches
}

func parseDate(headline string) string {
	m := resultsDateRe.FindStringSubmatch(headline)
	if len(m) != 4 {
		return ""
	}
	month, ok := monthMap[m[1]]
	if !ok {
		return ""
	}
	day := m[2]
	if len(day) == 1 {
		day = "0" + day
	}
	return m[3] + "-" + month + "-" + day
}

func NormalizeUpcomingMatches(doc *goquery.Document, perspective string) []types.NormalizedMatch {
	var matches []types.NormalizedMatch
	// Default "today" uses Asia/Shanghai timezone (spec §5 Issue 6B).
	now := time.Now().In(asiaShanghai)
	currentDate := now.Format("2006-01-02")
	seen := make(map[int]bool)

	doc.Find(".matches-list-section").Each(func(_ int, section *goquery.Selection) {
		headlineText := cleanText(section.Find(".matches-list-headline").First().Text())
		if headlineText != "" {
			// Extract date from the full headline text (not relying on "- " split).
			parsed := parseHeadlineDate(headlineText, now)
			if parsed != "" {
				currentDate = parsed
			}
		}

		// Target .match-wrapper to avoid double-counting nested .match divs
		section.Find(".match-wrapper").Each(func(_ int, s *goquery.Selection) {
			m := types.NormalizedMatch{Result: types.OutcomeScheduled}

			// Match ID from data attribute (most reliable)
			if mid, ok := s.Attr("data-match-id"); ok {
				m.MatchID, _ = strconv.Atoi(mid)
			}
			if m.MatchID > 0 && seen[m.MatchID] {
				return
			}

			m.Event = cleanText(s.Find(".match-event").First().Text())

			infoText := cleanText(s.Find(".match-info").First().Text())
			if idx := strings.Index(infoText, " "); idx > 0 {
				m.ScheduledAt = currentDate + " " + infoText[:idx]
				m.BestOf = cleanText(infoText[idx:])
			} else {
				m.ScheduledAt = currentDate + " " + infoText
			}

			m.Team1 = cleanText(s.Find(".match-team.team1 .match-teamname").First().Text())
			m.Team2 = cleanText(s.Find(".match-team.team2 .match-teamname").First().Text())

			if m.Team1 == "" || m.Team2 == "" {
				teamsText := cleanText(s.Find(".match-teams").First().Text())
				teamsText = strings.ReplaceAll(teamsText, "\n", " ")
				teamsText = strings.ReplaceAll(teamsText, "  ", " ")
				if idx := strings.Index(teamsText, " vs "); idx > 0 {
					if m.Team1 == "" { m.Team1 = cleanText(teamsText[:idx]) }
					if m.Team2 == "" { m.Team2 = cleanText(teamsText[idx+4:]) }
				}
			}

			if m.MatchID == 0 {
				s.Find("a").Each(func(_ int, a *goquery.Selection) {
					if href, ok := a.Attr("href"); ok {
						if id := parseMatchID(href); id > 0 {
							m.MatchID = id
						}
					}
				})
			}

			if perspective != "" {
				if m.Team1 == perspective {
					m.Opponent = m.Team2
				} else if m.Team2 == perspective {
					m.Opponent = m.Team1
				}
			}
			m.Team1 = translatePlaceholder(m.Team1)
			m.Team2 = translatePlaceholder(m.Team2)
			m.Opponent = translatePlaceholder(m.Opponent)

			if m.Team1 != "" || m.Team2 != "" {
				if m.MatchID > 0 {
					seen[m.MatchID] = true
				}
				matches = append(matches, m)
			}
		})
	})
	return matches
}


func cleanText(s string) string {
	return strings.TrimSpace(s)
}

func parseMatchID(href string) int {
	re := regexp.MustCompile(`/matches/(\d+)/`)
	if m := re.FindStringSubmatch(href); len(m) > 1 {
		if id, err := strconv.Atoi(m[1]); err == nil {
			return id
		}
	}
	return 0
}

// SplitTeamMatches separates matches into recent (played) and upcoming (scheduled)
func SplitTeamMatches(matches []types.NormalizedMatch) (recent, upcoming []types.NormalizedMatch) {
	for _, m := range matches {
		if m.Score != "" || m.PlayedAt != "" {
			recent = append(recent, m)
		}
		if m.ScheduledAt != "" {
			upcoming = append(upcoming, m)
		}
	}
	return
}

// SortByPlayedAtDesc sorts matches in descending order by played_at
func SortByPlayedAtDesc(matches []types.NormalizedMatch) {
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].PlayedAt > matches[j].PlayedAt
	})
}

func translatePlaceholder(s string) string {
	lower := strings.ToLower(strings.TrimSpace(s))
	if lower == "" {
		return s
	}
	if strings.Contains(lower, "winner") {
		return "胜者"
	}
	if strings.Contains(lower, "loser") {
		return "败者"
	}
	if strings.Contains(lower, "tbd") {
		return "待定"
	}
	return s
}

// SortByScheduledAtAsc sorts matches in ascending order by scheduled_at
func SortByScheduledAtAsc(matches []types.NormalizedMatch) {
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].ScheduledAt < matches[j].ScheduledAt
	})
}
