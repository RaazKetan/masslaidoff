package httpapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/mail"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"masslaidoff/backend/internal/auth"
	"masslaidoff/backend/internal/config"
	"masslaidoff/backend/internal/store"
)

type actorKey struct{}
type identityKey struct{}
type API struct {
	cfg      config.Config
	store    *store.Store
	verifier *auth.Verifier
	limiter  *rateLimiter
}

func New(cfg config.Config, st *store.Store, verifier *auth.Verifier) *http.Server {
	api := &API{cfg: cfg, store: st, verifier: verifier, limiter: newRateLimiter()}
	r := chi.NewRouter()
	r.Use(middleware.Recoverer, api.requestID, api.securityHeaders, api.cors, api.rateLimit, api.log)
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		write(w, http.StatusOK, map[string]any{"status": "ok"}, "")
	})
	r.Get("/v1/public/layoffs", api.publicLayoffs)
	r.Route("/v1", func(r chi.Router) {
		r.Use(api.verifyIdentity)
		r.Post("/onboarding", api.onboard)
		r.Group(func(r chi.Router) {
			r.Use(api.loadActor)
			r.Get("/me", api.me)
			r.Get("/reviews", api.reviews)
			r.Post("/me/company-email/challenge", api.requestCompanyEmailChallenge)
			r.Post("/me/company-email/confirm", api.confirmCompanyEmail)
			r.Delete("/me", api.deleteAccount)
			r.Group(func(r chi.Router) {
				r.Use(api.requireRole("candidate"))
				r.Get("/candidate/me", api.getCandidate)
				r.Get("/candidate/me/review-eligibility", api.reviewEligibility)
				r.Put("/candidate/me", api.putCandidate)
				r.Post("/candidate/me/reviews", api.submitReview)
				r.Get("/candidate/me/reviews", api.getCandidateReviews)
				r.Put("/candidate/me/reviews/{id}", api.updateCandidateReview)
				r.Delete("/candidate/me/reviews/{id}", api.deleteCandidateReview)
				r.Post("/candidate/me/documents", api.uploadDocument)
				r.Get("/candidate/me/documents", api.getDocuments)
				r.Delete("/candidate/me/documents/{id}", api.deleteDocument)
				r.Get("/candidate/me/resume", api.getResume)
				r.Get("/candidate/me/access-requests", api.getAccessRequests)
				r.Post("/candidate/me/access-requests/{id}/decision", api.decideAccessRequest)
			})
			r.Group(func(r chi.Router) {
				r.Use(api.requireRole("recruiter"))
				r.Get("/recruiter/me", api.getRecruiter)
				r.Put("/recruiter/me", api.putRecruiter)
				r.Get("/recruiter/candidates", api.searchCandidates)
				r.Get("/recruiter/candidates/{id}", api.getRecruiterCandidate)
				r.Get("/recruiter/candidates/{id}/resume", api.getRecruiterResume)
				r.Post("/recruiter/candidates/{id}/access-requests", api.requestCandidateAccess)
				r.Get("/recruiter/me/access-requests", api.getRecruiterAccessRequests)
			})
		})
	})
	return &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 90 * time.Second, WriteTimeout: 90 * time.Second, IdleTimeout: 60 * time.Second}
}

func (a *API) publicLayoffs(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.PublicLayoffStats(r.Context())
	if err == nil {
		w.Header().Set("Cache-Control", "public, max-age=60, s-maxage=300")
	}
	a.respond(w, r, data, err)
}

func (a *API) deleteAccount(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Confirmation string `json:"confirmation"`
	}
	if !decode(w, r, &input) {
		return
	}
	current := actor(r)
	if !strings.EqualFold(strings.TrimSpace(input.Confirmation), current.Email) {
		failure(w, 422, "confirmation_mismatch", "Type your account email exactly to delete the account.", requestID(r))
		return
	}
	if a.cfg.SupabaseServiceRoleKey == "" {
		failure(w, 503, "account_deletion_unavailable", "Account deletion is not configured.", requestID(r))
		return
	}
	for _, bucket := range []string{"resumes", "employment-evidence", "profile-avatars"} {
		if err := a.deleteStoragePrefix(r.Context(), bucket, current.ID); err != nil {
			slog.Error("account storage cleanup failed", "request_id", requestID(r), "bucket", bucket, "error", err)
			failure(w, 502, "storage_delete_failed", "Your account was not deleted because private-file cleanup failed.", requestID(r))
			return
		}
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodDelete, fmt.Sprintf("%s/auth/v1/admin/users/%s", a.cfg.SupabaseURL, current.ID), nil)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	a.serviceAuth(req)
	resp, err := supabaseClient.Do(req)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		failure(w, 502, "account_delete_failed", "The account could not be deleted. Try again shortly.", requestID(r))
		return
	}
	write(w, http.StatusOK, map[string]any{"deleted": true}, requestID(r))
}

func (a *API) deleteStoragePrefix(ctx context.Context, bucket, prefix string) error {
	body, _ := json.Marshal(map[string]any{"prefix": prefix, "limit": 1000, "offset": 0})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/storage/v1/object/list/%s", a.cfg.SupabaseURL, bucket), bytes.NewReader(body))
	if err != nil {
		return err
	}
	a.serviceAuth(req)
	req.Header.Set("Content-Type", "application/json")
	resp, err := supabaseClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("storage list returned status %d", resp.StatusCode)
	}
	var objects []struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&objects); err != nil {
		return err
	}
	for _, object := range objects {
		if err := a.deleteStoragePath(ctx, bucket+"/"+prefix+"/"+object.Name); err != nil {
			return err
		}
	}
	return nil
}

var (
	supabaseClient = &http.Client{Timeout: 15 * time.Second}
	uploadClient   = &http.Client{Timeout: 60 * time.Second}
)

// serviceAuth authenticates server-side Supabase calls. New sb_secret_ keys are
// not JWTs and are rejected in the Authorization header; legacy service_role
// JWTs are sent in both places.
func (a *API) serviceAuth(req *http.Request) {
	req.Header.Set("apikey", a.cfg.SupabaseServiceRoleKey)
	if strings.HasPrefix(a.cfg.SupabaseServiceRoleKey, "eyJ") {
		req.Header.Set("Authorization", "Bearer "+a.cfg.SupabaseServiceRoleKey)
	}
}

func (a *API) requireRole(required string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if actor(r).AccountType != required {
				failure(w, http.StatusForbidden, "forbidden", "Your account does not have access to this operation.", requestID(r))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (a *API) verifyIdentity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, err := a.verifier.Verify(r.Context(), r.Header.Get("Authorization"))
		if err != nil {
			w.Header().Set("WWW-Authenticate", `Bearer realm="masslaidoff-api"`)
			failure(w, http.StatusUnauthorized, "unauthenticated", "Sign in to continue.", requestID(r))
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), identityKey{}, identity)))
	})
}

func (a *API) loadActor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity := r.Context().Value(identityKey{}).(auth.Identity)
		actor, err := a.store.Actor(r.Context(), identity.ID, identity.Email)
		if errors.Is(err, store.ErrNotFound) {
			failure(w, http.StatusForbidden, "account_unavailable", "Complete account onboarding before continuing.", requestID(r))
			return
		}
		if err != nil {
			slog.Error("actor lookup failed", "request_id", requestID(r), "error", err)
			failure(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.", requestID(r))
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), actorKey{}, actor)))
	})
}

func actor(r *http.Request) store.Actor { return r.Context().Value(actorKey{}).(store.Actor) }

func (a *API) onboard(w http.ResponseWriter, r *http.Request) {
	var input struct {
		AccountType string `json:"account_type"`
		FullName    string `json:"full_name"`
	}
	if !decode(w, r, &input) {
		return
	}
	if !textLength(input.FullName, 2, 120) || !oneOf(input.AccountType, "candidate", "recruiter") {
		failure(w, 422, "invalid_onboarding", "Choose an account type and provide your full name.", requestID(r))
		return
	}
	identity := r.Context().Value(identityKey{}).(auth.Identity)
	data, err := a.store.Onboard(r.Context(), identity.ID, identity.Email, input.AccountType, strings.TrimSpace(input.FullName))
	a.respond(w, r, data, err)
}

func (a *API) me(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.Me(r.Context(), actor(r))
	a.respond(w, r, data, err)
}
func (a *API) getCandidate(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.CandidateProfile(r.Context(), actor(r))
	a.respond(w, r, data, err)
}
func (a *API) getRecruiter(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.RecruiterProfile(r.Context(), actor(r))
	a.respond(w, r, data, err)
}

func (a *API) reviewEligibility(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.ReviewEligibility(r.Context(), actor(r))
	a.respond(w, r, data, err)
}

func (a *API) putCandidate(w http.ResponseWriter, r *http.Request) {
	var input store.CandidateInput
	if !decode(w, r, &input) {
		return
	}
	if !textLength(input.FullName, 2, 120) || !textLength(input.Role, 2, 160) || !textLength(input.Location, 2, 160) || !textLength(input.Company, 2, 160) || !textLength(input.Intro, 30, 1200) || input.YearsExperience < 0 || input.YearsExperience > 60 || !validLinkedInURL(input.LinkedInURL) || !validPhone(input.Phone) {
		failure(w, 422, "invalid_candidate_profile", "Complete all required profile fields with valid values.", requestID(r))
		return
	}
	if !validDate(input.Availability, true) || !validDate(input.StartedOn, false) || !validDate(input.EndedOn, false) || !orderedDates(input.StartedOn, input.EndedOn) {
		failure(w, 422, "invalid_dates", "Use valid dates and make sure the last working date is not before the start date.", requestID(r))
		return
	}
	if !oneOf(input.ContactVisibility, "request_access", "verified_recruiters", "hidden") || !oneOf(input.ResumeVisibility, "request_access", "verified_recruiters", "hidden") {
		failure(w, 422, "invalid_visibility", "Choose a valid visibility option.", requestID(r))
		return
	}
	data, err := a.store.SaveCandidate(r.Context(), actor(r), input)
	a.respond(w, r, data, err)
}

func (a *API) putRecruiter(w http.ResponseWriter, r *http.Request) {
	var input store.RecruiterInput
	if !decode(w, r, &input) {
		return
	}
	if !textLength(input.FullName, 2, 120) || !textLength(input.Company, 2, 160) || !textLength(input.JobTitle, 2, 160) || !validLinkedInURL(input.LinkedInURL) {
		failure(w, 422, "invalid_recruiter_profile", "Complete the required hiring profile fields.", requestID(r))
		return
	}
	if _, ok := a.companyEmail(input.WorkEmail); !ok {
		failure(w, 422, "invalid_company_email", "Use a valid company email address, not a personal email provider.", requestID(r))
		return
	}
	data, err := a.store.SaveRecruiter(r.Context(), actor(r), input)
	a.respond(w, r, data, err)
}

func (a *API) searchCandidates(w http.ResponseWriter, r *http.Request) {
	if len([]rune(strings.TrimSpace(r.URL.Query().Get("query")))) > 100 {
		failure(w, 422, "invalid_query", "Search terms must be 100 characters or shorter.", requestID(r))
		return
	}
	limit := bounded(r.URL.Query().Get("limit"), 20, 50)
	data, err := a.store.SearchCandidates(r.Context(), actor(r), r.URL.Query().Get("query"), r.URL.Query().Get("discipline"), limit)
	a.respond(w, r, data, err)
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func routeID(w http.ResponseWriter, r *http.Request) string {
	id := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(id) {
		failure(w, 422, "invalid_id", "The record ID is invalid.", requestID(r))
		return ""
	}
	return id
}

func (a *API) getRecruiterCandidate(w http.ResponseWriter, r *http.Request) {
	id := routeID(w, r)
	if id == "" {
		return
	}
	if err := a.store.RecordCandidateView(r.Context(), actor(r), id); err != nil {
		a.respond(w, r, nil, err)
		return
	}
	data, err := a.store.RecruiterCandidate(r.Context(), actor(r), id)
	a.respond(w, r, data, err)
}

func (a *API) requestCandidateAccess(w http.ResponseWriter, r *http.Request) {
	id := routeID(w, r)
	if id == "" {
		return
	}
	var input struct {
		Message string `json:"message"`
	}
	if !decode(w, r, &input) {
		return
	}
	if !textLength(input.Message, 20, 2000) {
		failure(w, 422, "invalid_message", "Write a short message between 20 and 2,000 characters.", requestID(r))
		return
	}
	data, err := a.store.RequestCandidateAccess(r.Context(), actor(r), id, strings.TrimSpace(input.Message))
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	write(w, http.StatusCreated, data, requestID(r))
}

func (a *API) getRecruiterAccessRequests(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.RecruiterAccessRequests(r.Context(), actor(r))
	a.respond(w, r, data, err)
}

func (a *API) getAccessRequests(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.CandidateAccessRequests(r.Context(), actor(r))
	a.respond(w, r, data, err)
}

func (a *API) decideAccessRequest(w http.ResponseWriter, r *http.Request) {
	id := routeID(w, r)
	if id == "" {
		return
	}
	var input struct {
		Decision string `json:"decision"`
	}
	if !decode(w, r, &input) {
		return
	}
	if !oneOf(input.Decision, "accepted", "declined") {
		failure(w, 422, "invalid_decision", "Accept or decline the request.", requestID(r))
		return
	}
	err := a.store.DecideAccessRequest(r.Context(), actor(r), id, input.Decision)
	a.respond(w, r, map[string]any{"status": input.Decision}, err)
}

func (a *API) reviews(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.Reviews(r.Context(), actor(r), r.URL.Query().Get("query"), bounded(r.URL.Query().Get("limit"), 20, 50))
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	out := make([]map[string]any, 0, len(data))
	for _, review := range data {
		average := float64(review.LeadershipRating+review.CommunicationRating+review.FairnessRating+review.CareerGrowthRating) / 4
		out = append(out, map[string]any{"id": review.ID, "manager_name": review.ManagerName, "company_name": review.CompanyName, "relationship": review.Relationship, "rating": review.Rating, "average_rating": average, "leadership_rating": review.LeadershipRating, "communication_rating": review.CommunicationRating, "fairness_rating": review.FairnessRating, "career_growth_rating": review.CareerGrowthRating, "review_title": review.ReviewTitle, "review_body": review.ReviewBody, "published_at": review.PublishedAt})
	}
	a.respond(w, r, out, nil)
}

func (a *API) submitReview(w http.ResponseWriter, r *http.Request) {
	if !actor(r).CompanyEmailVerified {
		failure(w, 403, "company_email_required", "Verify your company email before sharing a manager review.", requestID(r))
		return
	}
	var input store.ReviewInput
	if !decode(w, r, &input) {
		return
	}
	if !validReviewInput(input) {
		failure(w, 422, "invalid_review", "Provide the manager identity, four ratings, and a review between 80 and 1,200 characters.", requestID(r))
		return
	}
	data, err := a.store.SubmitReview(r.Context(), actor(r), input)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	write(w, http.StatusCreated, data, requestID(r))
}

func validReviewInput(input store.ReviewInput) bool {
	return textLength(input.ManagerName, 2, 120) && validLinkedInURL(input.ManagerLinkedInURL) && textLength(input.Company, 2, 160) && textLength(input.Relationship, 5, 240) && textLength(input.ReviewTitle, 5, 120) && textLength(input.ReviewBody, 80, 1200) && rating(input.LeadershipRating) && rating(input.CommunicationRating) && rating(input.FairnessRating) && rating(input.CareerGrowthRating)
}

func reviewPayload(review store.Review) map[string]any {
	return map[string]any{"id": review.ID, "manager_name": review.ManagerName, "manager_linkedin_url": review.ManagerLinkedInURL, "company": review.CompanyName, "relationship": review.Relationship, "rating": review.Rating, "leadership_rating": review.LeadershipRating, "communication_rating": review.CommunicationRating, "fairness_rating": review.FairnessRating, "career_growth_rating": review.CareerGrowthRating, "review_title": review.ReviewTitle, "review_body": review.ReviewBody, "status": review.Status, "published_at": review.PublishedAt, "created_at": review.CreatedAt}
}

func (a *API) getCandidateReviews(w http.ResponseWriter, r *http.Request) {
	reviews, err := a.store.CandidateReviews(r.Context(), actor(r))
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	out := make([]map[string]any, 0, len(reviews))
	for _, review := range reviews {
		out = append(out, reviewPayload(review))
	}
	a.respond(w, r, out, nil)
}

func (a *API) updateCandidateReview(w http.ResponseWriter, r *http.Request) {
	if !actor(r).CompanyEmailVerified {
		failure(w, 403, "company_email_required", "Verify your company email before editing a manager review.", requestID(r))
		return
	}
	id := routeID(w, r)
	if id == "" {
		return
	}
	var input store.ReviewInput
	if !decode(w, r, &input) {
		return
	}
	if !validReviewInput(input) {
		failure(w, 422, "invalid_review", "Provide the manager identity, title, four ratings, and a review between 80 and 1,200 characters.", requestID(r))
		return
	}
	data, err := a.store.UpdateCandidateReview(r.Context(), actor(r), id, input)
	a.respond(w, r, data, err)
}

func (a *API) deleteCandidateReview(w http.ResponseWriter, r *http.Request) {
	id := routeID(w, r)
	if id == "" {
		return
	}
	if err := a.store.DeleteCandidateReview(r.Context(), actor(r), id); err != nil {
		a.respond(w, r, nil, err)
		return
	}
	write(w, http.StatusOK, map[string]any{"deleted": true}, requestID(r))
}

func (a *API) requestCompanyEmailChallenge(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &input) {
		return
	}
	email, ok := a.companyEmail(input.Email)
	if !ok {
		failure(w, 422, "invalid_company_email", "Use a valid company email address, not a personal email provider.", requestID(r))
		return
	}
	development := a.cfg.Environment == "development"
	if a.cfg.ResendAPIKey == "" && !development {
		failure(w, 503, "email_unavailable", "Email verification is temporarily unavailable.", requestID(r))
		return
	}
	rawToken, err := secureToken()
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	expiresAt := time.Now().UTC().Add(10 * time.Minute)
	if err := a.store.CreateCompanyEmailChallenge(r.Context(), actor(r), email, hashToken(rawToken), expiresAt); err != nil {
		a.respond(w, r, nil, err)
		return
	}
	verificationURL := a.cfg.FrontendURL + "/verify-company-email?token=" + rawToken
	// Dev test addresses fall back to an on-screen link when delivery fails
	// (Resend test keys only deliver to the account owner's inbox).
	testAddress := development && a.cfg.TestCompanyEmails[email]
	showLink := development && a.cfg.ResendAPIKey == ""
	if a.cfg.ResendAPIKey != "" {
		if err := a.sendVerificationEmail(r.Context(), email, verificationURL); err != nil && testAddress {
			slog.Warn("test address email not delivered, returning link instead", "request_id", requestID(r), "error", err)
			showLink = true
		} else if err != nil {
			slog.Error("verification email failed", "request_id", requestID(r), "error", err)
			if discardErr := a.store.DiscardCompanyEmailChallenge(context.WithoutCancel(r.Context()), actor(r), hashToken(rawToken)); discardErr != nil {
				slog.Error("discard undelivered challenge failed", "request_id", requestID(r), "error", discardErr)
			}
			message := "The verification email could not be delivered. Try again shortly."
			if development {
				// Dev only: show the provider's reason (e.g. Resend test-mode recipient limits).
				message = "Email not delivered: " + err.Error()
			}
			failure(w, 502, "email_delivery_failed", message, requestID(r))
			return
		}
	}
	data := map[string]any{"sent": true, "expires_at": expiresAt}
	if showLink {
		data["development_verification_url"] = verificationURL
		slog.Info("development verification link (email not sent)", "email", email, "url", verificationURL)
	}
	write(w, http.StatusAccepted, data, requestID(r))
}

func (a *API) confirmCompanyEmail(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Token string `json:"token"`
	}
	if !decode(w, r, &input) {
		return
	}
	if len(input.Token) != 64 {
		failure(w, 422, "invalid_verification_token", "This verification link is invalid or expired.", requestID(r))
		return
	}
	email, err := a.store.ConfirmCompanyEmail(r.Context(), actor(r), hashToken(input.Token))
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	write(w, http.StatusOK, map[string]any{"verified": true, "company_email": email}, requestID(r))
}

func (a *API) sendVerificationEmail(ctx context.Context, recipient, verificationURL string) error {
	body, err := json.Marshal(map[string]any{
		"from":    a.cfg.EmailFrom,
		"to":      []string{recipient},
		"subject": "Verify your company email for MassLaidOff",
		"text":    "Verify your company email by opening this link. It expires in 10 minutes:\n\n" + verificationURL,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+a.cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var detail struct {
			Message string `json:"message"`
		}
		_ = json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&detail)
		return fmt.Errorf("resend returned status %d: %s", resp.StatusCode, detail.Message)
	}
	return nil
}

func (a *API) uploadDocument(w http.ResponseWriter, r *http.Request) {
	if actor(r).AccountType != "candidate" {
		failure(w, 403, "forbidden", "Only candidates can upload documents.", requestID(r))
		return
	}
	if a.cfg.SupabaseServiceRoleKey == "" {
		failure(w, 503, "storage_unavailable", "Document storage is not configured.", requestID(r))
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 11<<20)
	if err := r.ParseMultipartForm(11 << 20); err != nil {
		var sizeError *http.MaxBytesError
		if errors.As(err, &sizeError) {
			failure(w, 413, "file_too_large", "Documents must be smaller than 10 MB.", requestID(r))
			return
		}
		failure(w, 400, "invalid_multipart", "Send the document as multipart form data.", requestID(r))
		return
	}
	documentType := r.FormValue("document_type")
	bucket := map[string]string{"resume": "resumes", "exit_letter": "employment-evidence", "salary_slip": "employment-evidence", "other_employment_proof": "employment-evidence"}[documentType]
	if bucket == "" {
		failure(w, 422, "invalid_document_type", "Choose a valid document type.", requestID(r))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		failure(w, 400, "missing_file", "Attach a document.", requestID(r))
		return
	}
	defer file.Close()
	buffer := bytes.NewBuffer(nil)
	if _, err := buffer.ReadFrom(file); err != nil {
		failure(w, 400, "invalid_file", "The document could not be read.", requestID(r))
		return
	}
	if buffer.Len() > 10<<20 {
		failure(w, 413, "file_too_large", "Documents must be smaller than 10 MB.", requestID(r))
		return
	}
	mimeType := http.DetectContentType(buffer.Bytes())
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := (mimeType == "application/pdf" && ext == ".pdf") || (mimeType == "image/jpeg" && (ext == ".jpg" || ext == ".jpeg")) || (mimeType == "image/png" && ext == ".png")
	if !allowed {
		failure(w, 422, "invalid_file_type", "Only PDF, JPEG, and PNG documents are accepted.", requestID(r))
		return
	}
	if documentType == "resume" && mimeType != "application/pdf" {
		failure(w, 422, "invalid_file_type", "Upload your résumé as a PDF.", requestID(r))
		return
	}
	storagePath := fmt.Sprintf("%s/%s_%d%s", actor(r).ID, documentType, time.Now().UnixNano(), ext)
	storageURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", a.cfg.SupabaseURL, bucket, storagePath)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, storageURL, bytes.NewReader(buffer.Bytes()))
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	a.serviceAuth(req)
	req.Header.Set("Content-Type", mimeType)
	resp, err := uploadClient.Do(req)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		failure(w, 502, "storage_upload_failed", "The document could not be stored.", requestID(r))
		return
	}
	data, replacedPaths, err := a.store.RecordDocument(r.Context(), actor(r), documentType, bucket+"/"+storagePath, header.Filename, mimeType, int64(buffer.Len()))
	if err != nil {
		if cleanupErr := a.deleteStoragePath(context.WithoutCancel(r.Context()), bucket+"/"+storagePath); cleanupErr != nil {
			slog.Error("orphaned upload cleanup failed", "request_id", requestID(r), "error", cleanupErr)
		}
		a.respond(w, r, nil, err)
		return
	}
	for _, oldPath := range replacedPaths {
		if err := a.deleteStoragePath(r.Context(), oldPath); err != nil {
			slog.Error("replaced document cleanup failed", "request_id", requestID(r), "error", err)
		}
	}
	write(w, http.StatusCreated, data, requestID(r))
}

func (a *API) getDocuments(w http.ResponseWriter, r *http.Request) {
	documents, err := a.store.CandidateDocuments(r.Context(), actor(r))
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	write(w, http.StatusOK, documents, requestID(r))
}

func (a *API) deleteDocument(w http.ResponseWriter, r *http.Request) {
	id := routeID(w, r)
	if id == "" {
		return
	}
	path, err := a.store.DeleteCandidateDocument(r.Context(), actor(r), id)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	if err := a.deleteStoragePath(r.Context(), path); err != nil {
		slog.Error("document cleanup failed", "request_id", requestID(r), "error", err)
		failure(w, 502, "storage_delete_failed", "The document record was removed, but storage cleanup needs attention.", requestID(r))
		return
	}
	write(w, http.StatusOK, map[string]any{"deleted": true}, requestID(r))
}

func (a *API) deleteStoragePath(ctx context.Context, storagePath string) error {
	parts := strings.SplitN(storagePath, "/", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid storage path")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, fmt.Sprintf("%s/storage/v1/object/%s/%s", a.cfg.SupabaseURL, parts[0], parts[1]), nil)
	if err != nil {
		return err
	}
	a.serviceAuth(req)
	resp, err := supabaseClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("storage returned status %d", resp.StatusCode)
	}
	return nil
}

func (a *API) getResume(w http.ResponseWriter, r *http.Request) {
	if a.cfg.SupabaseServiceRoleKey == "" {
		failure(w, 503, "storage_unavailable", "Document storage is not configured.", requestID(r))
		return
	}
	document, err := a.store.LatestDocument(r.Context(), actor(r), "resume")
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	a.signedResume(w, r, document)
}

func (a *API) getRecruiterResume(w http.ResponseWriter, r *http.Request) {
	id := routeID(w, r)
	if id == "" {
		return
	}
	document, err := a.store.RecruiterResume(r.Context(), actor(r), id)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	a.signedResume(w, r, document)
}

func (a *API) signedResume(w http.ResponseWriter, r *http.Request, document store.DocumentRecord) {
	if a.cfg.SupabaseServiceRoleKey == "" {
		failure(w, 503, "storage_unavailable", "Document storage is not configured.", requestID(r))
		return
	}
	const bucketPrefix = "resumes/"
	if !strings.HasPrefix(document.StoragePath, bucketPrefix) {
		slog.Error("invalid resume storage path", "request_id", requestID(r), "document_id", document.ID)
		failure(w, 500, "internal_error", "The résumé could not be opened.", requestID(r))
		return
	}
	objectPath := strings.TrimPrefix(document.StoragePath, bucketPrefix)
	storageURL := fmt.Sprintf("%s/storage/v1/object/sign/resumes/%s", a.cfg.SupabaseURL, objectPath)
	body := bytes.NewBufferString(`{"expiresIn":300}`)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, storageURL, body)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	a.serviceAuth(req)
	req.Header.Set("Content-Type", "application/json")
	resp, err := supabaseClient.Do(req)
	if err != nil {
		a.respond(w, r, nil, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		failure(w, 502, "storage_sign_failed", "The résumé could not be opened.", requestID(r))
		return
	}
	var signed struct {
		URL string `json:"signedURL"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&signed); err != nil || signed.URL == "" {
		failure(w, 502, "storage_sign_failed", "The résumé could not be opened.", requestID(r))
		return
	}
	if strings.HasPrefix(signed.URL, "/") {
		signed.URL = a.cfg.SupabaseURL + "/storage/v1" + signed.URL
	}
	write(w, http.StatusOK, map[string]any{
		"id":                document.ID,
		"original_filename": document.OriginalFilename,
		"mime_type":         document.MimeType,
		"file_size_bytes":   document.FileSizeBytes,
		"uploaded_at":       document.UploadedAt,
		"signed_url":        signed.URL,
		"expires_in":        300,
	}, requestID(r))
}

func (a *API) respond(w http.ResponseWriter, r *http.Request, data any, err error) {
	if err == nil {
		write(w, http.StatusOK, data, requestID(r))
		return
	}
	switch {
	case errors.Is(err, store.ErrNotFound):
		failure(w, 404, "not_found", "The requested record does not exist.", requestID(r))
	case errors.Is(err, store.ErrForbidden):
		failure(w, 403, "forbidden", "Your account does not have access to this operation.", requestID(r))
	case errors.Is(err, store.ErrInvalidVerificationToken):
		failure(w, 422, "invalid_verification_token", "This verification link is invalid or expired.", requestID(r))
	case errors.Is(err, store.ErrProfileRequired):
		failure(w, 409, "profile_required", "Save your profile before requesting email verification.", requestID(r))
	case errors.Is(err, store.ErrRateLimited):
		failure(w, 429, "rate_limited", "A request is already pending or too many attempts were made. Try again later.", requestID(r))
	case errors.Is(err, store.ErrEmploymentEvidenceRequired):
		failure(w, 409, "employment_evidence_required", "Upload an exit letter or salary slip before submitting a manager review.", requestID(r))
	case errors.Is(err, store.ErrEmploymentMismatch):
		failure(w, 422, "employment_mismatch", "The review company must match the latest employment saved in your profile.", requestID(r))
	case errors.Is(err, store.ErrViewLimit):
		failure(w, 429, "view_limit_reached", "You have reached today's limit for opening candidate profiles. Try again tomorrow.", requestID(r))
	case errors.Is(err, store.ErrRecruiterUnverified):
		failure(w, 403, "recruiter_unverified", "Verify your company email to discover candidates.", requestID(r))
	case errors.Is(err, store.ErrEmailInUse):
		failure(w, 409, "company_email_in_use", "This company email is already verified for another account.", requestID(r))
	default:
		slog.Error("request failed", "request_id", requestID(r), "error", err)
		failure(w, 500, "internal_error", "The request could not be completed.", requestID(r))
	}
}

func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(target); err != nil {
		failure(w, 400, "invalid_json", "The request body is invalid.", requestID(r))
		return false
	}
	return true
}
func write(w http.ResponseWriter, status int, data any, id string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"data": data, "request_id": id})
}
func failure(w http.ResponseWriter, status int, code, message, id string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": code, "message": message}, "request_id": id})
}
func oneOf(value string, allowed ...string) bool {
	for _, item := range allowed {
		if value == item {
			return true
		}
	}
	return false
}
func rating(value int) bool { return value >= 1 && value <= 5 }

func textLength(value string, min, max int) bool {
	length := len([]rune(strings.TrimSpace(value)))
	return length >= min && length <= max
}

func validLinkedInURL(value string) bool {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(value))
	if err != nil || parsed.Scheme != "https" {
		return false
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	return host == "linkedin.com" && strings.HasPrefix(parsed.Path, "/in/") && len(strings.TrimPrefix(parsed.Path, "/in/")) > 1
}

func validDate(value string, required bool) bool {
	if value == "" {
		return !required
	}
	_, err := time.Parse(time.DateOnly, value)
	return err == nil
}

func orderedDates(start, end string) bool {
	if start == "" || end == "" {
		return true
	}
	startDate, startErr := time.Parse(time.DateOnly, start)
	endDate, endErr := time.Parse(time.DateOnly, end)
	return startErr == nil && endErr == nil && !endDate.Before(startDate)
}

func validPhone(value string) bool {
	digits := 0
	for _, char := range value {
		if char >= '0' && char <= '9' {
			digits++
			continue
		}
		if !strings.ContainsRune(" +()-.", char) {
			return false
		}
	}
	return digits >= 7 && digits <= 15
}

var personalEmailDomains = map[string]bool{
	"gmail.com": true, "googlemail.com": true, "yahoo.com": true, "yahoo.co.in": true,
	"outlook.com": true, "hotmail.com": true, "live.com": true, "icloud.com": true,
	"proton.me": true, "protonmail.com": true, "aol.com": true, "mail.com": true,
	"pm.me": true, "me.com": true, "mac.com": true, "msn.com": true, "ymail.com": true,
	"rocketmail.com": true, "yahoo.co.uk": true, "yahoo.in": true, "hotmail.co.uk": true,
	"outlook.in": true, "live.in": true, "gmx.com": true, "gmx.net": true, "web.de": true,
	"yandex.com": true, "yandex.ru": true, "mail.ru": true, "rediffmail.com": true,
	"zohomail.com": true, "zohomail.in": true, "tutanota.com": true, "tuta.io": true,
	"fastmail.com": true, "hey.com": true, "qq.com": true, "163.com": true, "126.com": true,
	"naver.com": true, "duck.com": true, "skiff.com": true,
}

// companyEmail validates a company address, also accepting configured test
// addresses (development only, see config.TestCompanyEmails).
func (a *API) companyEmail(raw string) (string, bool) {
	value := strings.ToLower(strings.TrimSpace(raw))
	if a.cfg.TestCompanyEmails[value] {
		if parsed, err := mail.ParseAddress(value); err == nil && parsed.Address == value {
			return value, true
		}
	}
	return companyEmail(raw)
}

func companyEmail(raw string) (string, bool) {
	value := strings.ToLower(strings.TrimSpace(raw))
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value {
		return "", false
	}
	parts := strings.Split(parsed.Address, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" || !strings.Contains(parts[1], ".") || personalEmailDomains[parts[1]] {
		return "", false
	}
	return parsed.Address, true
}

func secureToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func bounded(raw string, fallback, max int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	if value > max {
		return max
	}
	return value
}

func (a *API) requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b := make([]byte, 12)
		_, _ = rand.Read(b)
		id := "req_" + hex.EncodeToString(b)
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey{}, id)))
	})
}

func (a *API) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if strings.HasPrefix(r.URL.Path, "/v1/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(w, r)
	})
}

type requestIDKey struct{}

func requestID(r *http.Request) string {
	value, _ := r.Context().Value(requestIDKey{}).(string)
	return value
}
func (a *API) cors(next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, origin := range a.cfg.FrontendOrigins {
		allowed[origin] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func (a *API) log(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(start).Milliseconds(), "request_id", requestID(r))
	})
}
