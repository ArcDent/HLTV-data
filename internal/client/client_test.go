package client

import "testing"

func TestIsCloudflareBlock(t *testing.T) {
	cases := []struct{ body string; want bool }{
		{"<html>Just a moment...</html>", true},
		{"<div cf-browser-verify>", true},
		{"Attention Required", true},
		{"Enable JavaScript and cookies to continue", true},
		{"<html><body>HLTV matches</body></html>", false},
		{"Welcome to Cloudflare CDN", false}, // bare "Cloudflare" no longer matches
		{"plain page with no challenge", false},
	}
	for _, c := range cases {
		if got := isCloudflareBlock([]byte(c.body)); got != c.want {
			t.Errorf("isCloudflareBlock(%q) = %v, want %v", c.body, got, c.want)
		}
	}
}
