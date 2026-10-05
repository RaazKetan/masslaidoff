package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var ErrUnauthenticated = errors.New("unauthenticated")

type Identity struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}
type Verifier struct {
	url, anonKey string
	client       *http.Client
}

func NewVerifier(url, anonKey string) *Verifier {
	return &Verifier{url: url, anonKey: anonKey, client: &http.Client{Timeout: 5 * time.Second}}
}

func (v *Verifier) Verify(ctx context.Context, authorization string) (Identity, error) {
	parts := strings.Fields(authorization)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || len(parts[1]) < 20 {
		return Identity{}, ErrUnauthenticated
	}
	authorization = "Bearer " + parts[1]
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.url+"/auth/v1/user", nil)
	if err != nil {
		return Identity{}, err
	}
	req.Header.Set("Authorization", authorization)
	req.Header.Set("apikey", v.anonKey)
	resp, err := v.client.Do(req)
	if err != nil {
		return Identity{}, fmt.Errorf("verify token: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Identity{}, ErrUnauthenticated
	}
	var identity Identity
	if err := json.NewDecoder(resp.Body).Decode(&identity); err != nil || identity.ID == "" || identity.Email == "" {
		return Identity{}, ErrUnauthenticated
	}
	return identity, nil
}
