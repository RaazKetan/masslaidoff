package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterSeparatesClients(t *testing.T) {
	limiter := newRateLimiter()
	for i := 0; i < 2; i++ {
		if ok, _ := limiter.allow("client-a", 2, time.Minute); !ok {
			t.Fatal("request within capacity was rejected")
		}
	}
	if ok, _ := limiter.allow("client-a", 2, time.Minute); ok {
		t.Fatal("request over capacity was allowed")
	}
	if ok, _ := limiter.allow("client-b", 2, time.Minute); !ok {
		t.Fatal("another client was incorrectly limited")
	}
}

func TestRateLimitMiddlewareReturns429(t *testing.T) {
	api := &API{limiter: newRateLimiter()}
	handler := api.rateLimit(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	for i := 0; i < 31; i++ {
		request := httptest.NewRequest(http.MethodPost, "/v1/onboarding", nil)
		request.RemoteAddr = "192.0.2.1:9000"
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if i < 30 && response.Code != http.StatusNoContent {
			t.Fatalf("request %d: got %d", i, response.Code)
		}
		if i == 30 && (response.Code != http.StatusTooManyRequests || response.Header().Get("Retry-After") == "") {
			t.Fatalf("expected 429 with Retry-After, got %d", response.Code)
		}
	}
}

func TestClientKey(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.RemoteAddr = "10.0.0.1:443"
	request.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.7")
	if got := clientKey(request, 0); got != "10.0.0.1" {
		t.Fatalf("no trusted hops: got %q", got)
	}
	if got := clientKey(request, 1); got != "203.0.113.7" {
		t.Fatalf("spoofed left entry must be ignored: got %q", got)
	}
	request.Header.Set("X-Forwarded-For", "2001:db8:1:2:aaaa::1")
	other := httptest.NewRequest(http.MethodGet, "/", nil)
	other.Header.Set("X-Forwarded-For", "2001:db8:1:2:bbbb::9")
	if clientKey(request, 1) != clientKey(other, 1) {
		t.Fatal("IPv6 addresses in one /64 must share a key")
	}
}
