package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"masslaidoff/backend/internal/config"
)

func main() {
	migrationsDirectory := flag.String("dir", "../supabase/migrations", "directory containing SQL migrations")
	flag.Parse()
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		fail(err)
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fail(fmt.Errorf("connect to database: %w", err))
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		fail(fmt.Errorf("ping database: %w", err))
	}
	if _, err := db.Exec(ctx, `create table if not exists public.schema_migrations (
		filename text primary key,
		checksum text not null,
		applied_at timestamptz not null default now()
	)`); err != nil {
		fail(fmt.Errorf("create migration ledger: %w", err))
	}
	entries, err := os.ReadDir(*migrationsDirectory)
	if err != nil {
		fail(fmt.Errorf("read migrations: %w", err))
	}
	var filenames []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			filenames = append(filenames, entry.Name())
		}
	}
	sort.Strings(filenames)
	for _, filename := range filenames {
		if err := apply(ctx, db, *migrationsDirectory, filename); err != nil {
			fail(err)
		}
	}
	slog.Info("database migrations complete", "count", len(filenames))
}

// Some migrations carry their own begin/commit. Inside the runner's transaction
// that commit would end it early and record the ledger row non-atomically, so
// standalone begin;/commit; lines are stripped (the checksum uses the file as-is).
var transactionControl = regexp.MustCompile(`(?im)^\s*(begin|commit)\s*;\s*$`)

func apply(ctx context.Context, db *pgxpool.Pool, directory, filename string) error {
	contents, err := os.ReadFile(filepath.Join(directory, filename))
	if err != nil {
		return fmt.Errorf("read %s: %w", filename, err)
	}
	sum := sha256.Sum256(contents)
	checksum := hex.EncodeToString(sum[:])
	var appliedChecksum string
	err = db.QueryRow(ctx, `select checksum from public.schema_migrations where filename=$1`, filename).Scan(&appliedChecksum)
	if err == nil {
		if appliedChecksum != checksum {
			return fmt.Errorf("migration %s changed after it was applied", filename)
		}
		slog.Info("migration already applied", "filename", filename)
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("check %s: %w", filename, err)
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin %s: %w", filename, err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, transactionControl.ReplaceAllString(string(contents), "")); err != nil {
		return fmt.Errorf("apply %s: %w", filename, err)
	}
	if _, err := tx.Exec(ctx, `insert into public.schema_migrations(filename,checksum) values($1,$2)`, filename, checksum); err != nil {
		return fmt.Errorf("record %s: %w", filename, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit %s: %w", filename, err)
	}
	slog.Info("migration applied", "filename", filename)
	return nil
}

func fail(err error) {
	slog.Error("migration failed", "error", err)
	os.Exit(1)
}
