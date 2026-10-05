package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVerifierRejectsMissingBearerToken(t *testing.T) {
	verifier := NewVerifier("http://example.invalid", "anon")
	if _, err := verifier.Verify(context.Background(), ""); err != ErrUnauthenticated {
		t.Fatalf("got %v, want unauthenticated", err)
	}
}

func TestVerifierRejectsMalformedBearerTokens(t *testing.T) {
	verifier := NewVerifier("http://example.invalid", "anon")
	for _, authorization := range []string{
		"Basic abcdefghijklmnopqrstuvwxyz",
		"Bearer short",
		"Bearer one two",
		"token-without-scheme",
	} {
		if _, err := verifier.Verify(context.Background(), authorization); err != ErrUnauthenticated {
			t.Fatalf("%q returned %v, want unauthenticated", authorization, err)
		}
	}
}

func TestVerifierLoadsSupabaseIdentity(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer token-with-enough-length" || r.Header.Get("apikey") != "anon" {
			t.Fatal("missing authentication headers")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"user-1","email":"member@example.com"}`))
	}))
	defer server.Close()
	identity, err := NewVerifier(server.URL, "anon").Verify(context.Background(), "Bearer token-with-enough-length")
	if err != nil {
		t.Fatal(err)
	}
	if identity.ID != "user-1" || identity.Email != "member@example.com" {
		t.Fatalf("unexpected identity: %#v", identity)
	}
}
