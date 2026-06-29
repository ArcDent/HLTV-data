package handlers

import (
	"context"
	"net/http"
	"time"
)

// GetRankings handles GET /api/rankings — returns the HLTV team ranking table.
func (h *Handlers) GetRankings(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	rows, err := h.f.GetRankings(ctx)
	if err != nil {
		writeJSON(w, map[string]any{
			"error": map[string]any{"code": "UNAVAILABLE", "message": "排行数据暂时不可用"},
			"meta":  map[string]any{"partial": true},
		})
		return
	}
	writeJSON(w, map[string]any{"data": rows, "meta": map[string]any{"partial": false}})
}

// CompareTeams handles GET /api/teams/compare?a=&b= — returns side-by-side
// team detail plus head-to-head data.
func (h *Handlers) CompareTeams(w http.ResponseWriter, r *http.Request) {
	a := atoi(r.URL.Query().Get("a"))
	b := atoi(r.URL.Query().Get("b"))
	if a == 0 || b == 0 {
		writeError(w, http.StatusBadRequest, "a and b query params required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	cmp, err := h.f.CompareTeams(ctx, a, b)
	if err != nil {
		writeJSON(w, map[string]any{
			"error": map[string]any{"code": "UNAVAILABLE", "message": "对比数据暂时不可用"},
			"meta":  map[string]any{"partial": true},
		})
		return
	}
	writeJSON(w, map[string]any{"data": cmp, "meta": map[string]any{"partial": false}})
}
