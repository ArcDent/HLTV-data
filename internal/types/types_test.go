package types

import "testing"

func TestErrorCodes(t *testing.T) {
	cases := []struct{ code string; retryable bool }{
		{ErrNetwork, true},
		{ErrRead, true},
		{ErrChallenge, true},
		{ErrNotFound, false},
		{ErrServer, true},
		{ErrUnavailable, true},
	}
	for _, c := range cases {
		if c.code == "" {
			t.Fatalf("error code constant is empty")
		}
	}
	if ErrNetwork != "NETWORK" || ErrRead != "READ" || ErrChallenge != "CHALLENGE" ||
		ErrNotFound != "NOT_FOUND" || ErrServer != "SERVER" || ErrUnavailable != "UNAVAILABLE" {
		t.Fatalf("error code values do not match spec")
	}
}

func TestToolErrorRetryable(t *testing.T) {
	e := &ToolError{Code: ErrNetwork, Message: "dial fail", Retryable: true}
	if !e.Retryable || e.Error() != "dial fail" {
		t.Fatalf("unexpected ToolError state: %+v", e)
	}
}
