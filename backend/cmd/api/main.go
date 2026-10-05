package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"masslaidoff/backend/internal/auth"
	"masslaidoff/backend/internal/config"
	"masslaidoff/backend/internal/httpapi"
	"masslaidoff/backend/internal/store"
)

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	server := httpapi.New(cfg, store.New(db), auth.NewVerifier(cfg.SupabaseURL, cfg.SupabaseAnonKey))
	go func() {
		if err := server.ListenAndServe(); err != nil && err.Error() != "http: Server closed" {
			slog.Error("api stopped", "error", err)
			cancel()
		}
	}()
	slog.Info("MassLaidOff API started", "address", server.Addr)
	<-ctx.Done()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
}
