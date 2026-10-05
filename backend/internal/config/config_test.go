package config

import "testing"

func TestNormalizeDatabaseURL(t *testing.T) {
	raw := "postgresql://postgres:p@ss:word@db.example.com:5432/postgres"
	want := "postgresql://postgres:p%40ss%3Aword@db.example.com:5432/postgres"
	if got := normalizeDatabaseURL(raw); got != want {
		t.Fatalf("normalizeDatabaseURL() = %q, want %q", got, want)
	}

	encoded := "postgresql://postgres:p%40ss@db.example.com:5432/postgres"
	if got := normalizeDatabaseURL(encoded); got != encoded {
		t.Fatalf("encoded URL changed: %q", got)
	}
}

func TestPoolerDatabaseURL(t *testing.T) {
	direct := "postgresql://postgres:p%40ss@db.projectref.supabase.co:5432/postgres?sslmode=require"
	want := "postgresql://postgres.projectref:p%40ss@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
	if got := poolerDatabaseURL(direct, "ap-south-1"); got != want {
		t.Fatalf("poolerDatabaseURL() = %q, want %q", got, want)
	}
	if got := poolerDatabaseURL(direct, ""); got != direct {
		t.Fatalf("empty region changed URL: %q", got)
	}
}
