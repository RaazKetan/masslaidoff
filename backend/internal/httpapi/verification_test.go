package httpapi

import (
	"testing"

	"masslaidoff/backend/internal/config"
)

func TestCompanyEmail(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
		ok    bool
	}{
		{name: "company domain", input: "Person@Example.COM", want: "person@example.com", ok: true},
		{name: "gmail blocked", input: "person@gmail.com", ok: false},
		{name: "missing domain suffix", input: "person@localhost", ok: false},
		{name: "display name blocked", input: "Person <person@example.com>", ok: false},
		{name: "invalid", input: "not-an-email", ok: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, ok := companyEmail(test.input)
			if ok != test.ok || got != test.want {
				t.Fatalf("companyEmail(%q) = %q, %v; want %q, %v", test.input, got, ok, test.want, test.ok)
			}
		})
	}
}

func TestSecureTokenAndHash(t *testing.T) {
	first, err := secureToken()
	if err != nil {
		t.Fatal(err)
	}
	second, err := secureToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 64 || len(hashToken(first)) != 64 {
		t.Fatalf("unexpected token or hash length")
	}
	if first == second || hashToken(first) == hashToken(second) {
		t.Fatalf("tokens must be unique")
	}
}

func TestProfileValidationHelpers(t *testing.T) {
	if !validLinkedInURL("https://www.linkedin.com/in/example") {
		t.Fatal("expected LinkedIn profile URL to be valid")
	}
	if validLinkedInURL("https://example.com/in/example") || validLinkedInURL("http://linkedin.com/in/example") {
		t.Fatal("expected non-HTTPS or non-LinkedIn URL to be invalid")
	}
	if !orderedDates("2020-01-01", "2024-01-01") || orderedDates("2024-01-01", "2020-01-01") {
		t.Fatal("date ordering validation failed")
	}
	if !validPhone("+91 98765 43210") || validPhone("call-me") {
		t.Fatal("phone validation failed")
	}
}

func TestTestCompanyEmailAllowlist(t *testing.T) {
	api := &API{cfg: config.Config{TestCompanyEmails: map[string]bool{"tester@gmail.com": true}}}
	if got, ok := api.companyEmail(" Tester@Gmail.com "); !ok || got != "tester@gmail.com" {
		t.Fatalf("allowlisted address rejected: %q %v", got, ok)
	}
	if _, ok := api.companyEmail("other@gmail.com"); ok {
		t.Fatal("non-allowlisted personal address accepted")
	}
}
