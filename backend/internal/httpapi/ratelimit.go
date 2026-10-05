package httpapi

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type rateBucket struct {
	tokens float64
	last   time.Time
}

type rateLimiter struct {
	mu        sync.Mutex
	buckets   map[string]rateBucket
	lastPrune time.Time
}

func newRateLimiter() *rateLimiter { return &rateLimiter{buckets: make(map[string]rateBucket)} }

func (l *rateLimiter) allow(key string, capacity int, interval time.Duration) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	// A bucket idle for a full interval has refilled, so dropping it is lossless.
	// Pruning at most once per interval keeps the scan off the hot path.
	if now.Sub(l.lastPrune) > interval {
		for k, bucket := range l.buckets {
			if now.Sub(bucket.last) > interval {
				delete(l.buckets, k)
			}
		}
		l.lastPrune = now
	}
	bucket, exists := l.buckets[key]
	if !exists {
		bucket.tokens = float64(capacity)
	} else {
		bucket.tokens += now.Sub(bucket.last).Seconds() * float64(capacity) / interval.Seconds()
		if bucket.tokens > float64(capacity) {
			bucket.tokens = float64(capacity)
		}
	}
	bucket.last = now
	if bucket.tokens < 1 {
		l.buckets[key] = bucket
		return false, 1
	}
	bucket.tokens--
	l.buckets[key] = bucket
	return true, 0
}

// clientKey returns the caller's address. Behind trusted proxies it reads the
// X-Forwarded-For entry appended by the outermost trusted hop (entries further
// left are client-controlled). IPv6 clients are grouped by /64 so rotating
// addresses inside one allocation shares a bucket.
func clientKey(r *http.Request, trustedHops int) string {
	address, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		address = r.RemoteAddr
	}
	if trustedHops > 0 {
		var hops []string
		for _, header := range r.Header.Values("X-Forwarded-For") {
			for _, part := range strings.Split(header, ",") {
				if part = strings.TrimSpace(part); part != "" {
					hops = append(hops, part)
				}
			}
		}
		if len(hops) >= trustedHops {
			address = hops[len(hops)-trustedHops]
		}
	}
	ip := net.ParseIP(address)
	if ip == nil {
		return address
	}
	if ip.To4() == nil {
		return ip.Mask(net.CIDRMask(64, 128)).String() + "/64"
	}
	return ip.String()
}

func (a *API) rateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		peer := clientKey(r, a.cfg.TrustedProxyHops)
		capacity := 120
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			capacity = 30
		}
		if r.URL.Path == "/v1/public/layoffs" {
			capacity = 60
		}
		if allowed, wait := a.limiter.allow(peer+":"+strconv.Itoa(capacity), capacity, time.Minute); !allowed {
			w.Header().Set("Retry-After", strconv.Itoa(wait))
			failure(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again shortly.", requestID(r))
			return
		}
		next.ServeHTTP(w, r)
	})
}
