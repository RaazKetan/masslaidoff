// Command moderate reviews pending manager reviews.
//
//	go run ./cmd/moderate                     list pending reviews
//	go run ./cmd/moderate approve <id>        publish a review
//	go run ./cmd/moderate reject <id> <note>  reject a review with a private note
package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"masslaidoff/backend/internal/config"
)

// ponytail: CLI moderation; build an admin UI when more than one moderator needs it.
func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		fail(err)
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fail(err)
	}
	defer db.Close()
	args := os.Args[1:]
	switch {
	case len(args) == 0:
		list(ctx, db)
	case args[0] == "approve" && len(args) == 2:
		decide(ctx, db, args[1], "published", "")
	case args[0] == "reject" && len(args) >= 3:
		decide(ctx, db, args[1], "rejected", strings.Join(args[2:], " "))
	default:
		fail(fmt.Errorf("usage: moderate | moderate approve <id> | moderate reject <id> <note>"))
	}
}

func list(ctx context.Context, db *pgxpool.Pool) {
	rows, err := db.Query(ctx, `select id::text, created_at::date::text, company, manager_name, coalesce(review_title,''), left(review, 160)
		from public.manager_reviews where status='pending' order by created_at`)
	if err != nil {
		fail(err)
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var id, created, company, manager, title, body string
		if err := rows.Scan(&id, &created, &company, &manager, &title, &body); err != nil {
			fail(err)
		}
		count++
		fmt.Printf("%s  %s  %s · %s\n  %q\n  %s\n\n", id, created, manager, company, title, body)
	}
	fmt.Printf("%d pending review(s)\n", count)
}

func decide(ctx context.Context, db *pgxpool.Pool, id, status, note string) {
	tag, err := db.Exec(ctx, `update public.manager_reviews
		set status=$2::public.review_status,
		    published_at=case when $2='published' then now() end,
		    moderation_notes=nullif($3,'')
		where id::text=$1 and status='pending'`, id, status, note)
	if err != nil {
		fail(err)
	}
	if tag.RowsAffected() == 0 {
		fail(fmt.Errorf("no pending review with id %s", id))
	}
	fmt.Printf("review %s %s\n", id, status)
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
