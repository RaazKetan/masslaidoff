package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                   string
	Environment            string
	DatabaseURL            string
	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string
	FrontendOrigins        []string
	FrontendURL            string
	ResendAPIKey           string
	EmailFrom              string
	// TrustedProxyHops is how many proxies append to X-Forwarded-For in front of
	// the API (Cloud Run: 1). 0 means use the TCP peer address.
	TrustedProxyHops int
	// TestCompanyEmails are exact addresses accepted as company emails even on
	// personal domains. Honored only when ENVIRONMENT=development.
	TestCompanyEmails map[string]bool
}

func Load() (Config, error) {
	cfg := Config{
		Port:                   value("PORT", "8080"),
		Environment:            value("ENVIRONMENT", "production"),
		DatabaseURL:            poolerDatabaseURL(normalizeDatabaseURL(os.Getenv("DATABASE_URL")), os.Getenv("SUPABASE_DB_POOLER_REGION")),
		SupabaseURL:            strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabaseAnonKey:        os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: first(os.Getenv("SUPABASE_SECRET_KEY"), os.Getenv("SUPABASE_SERVICE_ROLE_KEY")),
		FrontendOrigins:        split(value("FRONTEND_ORIGINS", "http://127.0.0.1:4174,http://127.0.0.1:4175,http://localhost:4175")),
		FrontendURL:            strings.TrimRight(value("FRONTEND_URL", "http://127.0.0.1:4175"), "/"),
		ResendAPIKey:           os.Getenv("RESEND_API_KEY"),
		EmailFrom:              value("EMAIL_FROM", "MassLaidOff <verify@masslaidoff.com>"),
	}
	hops, err := strconv.Atoi(value("TRUSTED_PROXY_HOPS", "0"))
	if err != nil || hops < 0 {
		return Config{}, fmt.Errorf("TRUSTED_PROXY_HOPS must be a non-negative integer")
	}
	cfg.TrustedProxyHops = hops
	cfg.TestCompanyEmails = map[string]bool{}
	if cfg.Environment == "development" {
		for _, email := range split(os.Getenv("TEST_COMPANY_EMAILS")) {
			cfg.TestCompanyEmails[strings.ToLower(email)] = true
		}
	}
	if cfg.DatabaseURL == "" || cfg.SupabaseURL == "" || cfg.SupabaseAnonKey == "" {
		return Config{}, fmt.Errorf("DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY are required")
	}
	// Fail closed: only an explicit ENVIRONMENT=development may run without email
	// delivery (dev returns the verification link in the API response).
	if cfg.Environment != "development" && (cfg.ResendAPIKey == "" || os.Getenv("FRONTEND_URL") == "" || cfg.SupabaseServiceRoleKey == "") {
		return Config{}, fmt.Errorf("RESEND_API_KEY, FRONTEND_URL and SUPABASE_SECRET_KEY are required unless ENVIRONMENT=development")
	}
	return cfg, nil
}

func normalizeDatabaseURL(value string) string {
	if value == "" {
		return value
	}
	schemeEnd := strings.Index(value, "://")
	credentialEnd := strings.LastIndex(value, "@")
	if schemeEnd < 0 || credentialEnd <= schemeEnd+3 {
		return value
	}
	credentials := value[schemeEnd+3 : credentialEnd]
	separator := strings.Index(credentials, ":")
	if separator < 1 {
		return value
	}
	username := credentials[:separator]
	password := credentials[separator+1:]
	if decoded, err := url.PathUnescape(username); err == nil {
		username = decoded
	}
	if decoded, err := url.PathUnescape(password); err == nil {
		password = decoded
	}
	return value[:schemeEnd+3] + url.UserPassword(username, password).String() + "@" + value[credentialEnd+1:]
}

func poolerDatabaseURL(value, region string) string {
	if value == "" || region == "" {
		return value
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.User == nil {
		return value
	}
	hostname := parsed.Hostname()
	if !strings.HasPrefix(hostname, "db.") || !strings.HasSuffix(hostname, ".supabase.co") {
		return value
	}
	projectRef := strings.TrimSuffix(strings.TrimPrefix(hostname, "db."), ".supabase.co")
	if projectRef == "" {
		return value
	}
	password, _ := parsed.User.Password()
	parsed.User = url.UserPassword(parsed.User.Username()+"."+projectRef, password)
	parsed.Host = "aws-0-" + region + ".pooler.supabase.com:5432"
	return parsed.String()
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func first(values ...string) string {
	for _, candidate := range values {
		if candidate != "" {
			return candidate
		}
	}
	return ""
}
func split(value string) []string {
	var out []string
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}
