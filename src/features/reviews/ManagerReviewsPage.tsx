import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth-context";
import {
  AppLink,
  ArrowIcon,
  Logo,
  ShieldIcon,
  StatePanel,
} from "../../components/core";
import { api } from "../../lib/api";
import { isSupabaseConfigured } from "../../lib/supabase";

export function ManagerReviewsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const canRead = auth.authenticated && auth.companyEmailVerified;
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const reviews = useQuery({
    queryKey: ["manager-reviews", search],
    queryFn: () => api.listReviews(search),
    enabled: canRead && isSupabaseConfigured,
    placeholderData: keepPreviousData,
  });
  const filtered = reviews.data || [];
  useEffect(() => {
    document.title = "Manager reviews · MassLaidOff";
  }, []);
  async function logout() {
    setSigningOut(true);
    await auth.signOut();
    navigate("/");
  }
  return (
    <div className="public-reviews-page">
      <header className="public-review-nav">
        <Logo />
        <nav>
          <AppLink to="/">Home</AppLink>
          <a href="#review-directory">Browse reviews</a>
        </nav>
        <div className="nav-actions">
          {auth.authenticated ? (
            <>
              <button
                className="nav-text-link public-logout-button"
                onClick={() => void logout()}
                disabled={signingOut}
              >
                Log out
              </button>
              <AppLink
                to={
                  canRead
                    ? auth.accountType === "candidate"
                      ? "/app/reviews"
                      : "/app/discover"
                    : auth.accountType === "candidate"
                      ? "/app/reviews"
                      : "/app/profile"
                }
                className="button button-small"
              >
                {canRead
                  ? auth.accountType === "candidate"
                    ? "Write review"
                    : "Hiring workspace"
                  : "Verify email"}
              </AppLink>
            </>
          ) : (
            <>
              <AppLink to="/login/job-seeker" className="nav-text-link">
                Sign in
              </AppLink>
              <AppLink
                to="/login/job-seeker?mode=signup"
                className="button button-small"
              >
                Write review
              </AppLink>
            </>
          )}
        </div>
      </header>
      <main>
        {!auth.authenticated && (
          <section className="public-review-hero">
            <div className="public-review-hero-copy">
              <p className="eyebrow">VERIFIED EXPERIENCE. ANONYMOUS VOICE.</p>
              <h1>
                Know how they lead
                <br />
                <em>before you join.</em>
              </h1>
              <p>
                Sign in and verify your company email before any manager review
                content is returned.
              </p>
              <div className="hero-actions">
                <AppLink
                  to="/login/job-seeker"
                  className="button button-primary"
                >
                  Sign in to view reviews <ArrowIcon />
                </AppLink>
              </div>
              <p className="public-review-note">
                <ShieldIcon /> Authors stay anonymous. Manager LinkedIn stays
                private.
              </p>
            </div>
            <aside className="review-trust-card review-access-preview">
              <div className="trust-card-top">
                <span>MEMBER ACCESS</span>
                <strong>Protected</strong>
              </div>
              <span className="review-preview-lock">
                <ShieldIcon />
              </span>
              <h2>Reviews stay behind verified access.</h2>
              <p>
                Your session and company email status are checked before the
                database returns review content.
              </p>
              <div className="review-access-steps">
                <span>
                  <b>01</b> Signed-in account
                </span>
                <span>
                  <b>02</b> Company email verified
                </span>
                <span>
                  <b>03</b> Directory unlocked
                </span>
              </div>
            </aside>
          </section>
        )}
        <section className="public-review-directory" id="review-directory">
          <div className="public-section-heading">
            <div>
              <p className="section-kicker">MANAGER REVIEW DIRECTORY</p>
              <h2>
                Find management context
                <br />
                before the interview.
              </h2>
            </div>
            <p>
              Review access is reserved for signed-in members whose company
              email has been verified.
            </p>
          </div>
          {auth.loading ? (
            <StatePanel
              kind="loading"
              title="Checking review access"
              message="Confirming your account and company email."
            />
          ) : !auth.authenticated ? (
            <StatePanel
              kind="locked"
              title="Sign in and verify your company email"
              message="No review content is returned to anonymous visitors."
              action={
                <AppLink
                  to="/login/job-seeker"
                  className="button button-primary"
                >
                  Sign in
                </AppLink>
              }
            />
          ) : !auth.companyEmailVerified ? (
            <StatePanel
              kind="locked"
              title="Verify your company email to continue"
              message="Add and verify a current or former company email from your profile."
              action={
                <AppLink
                  to={
                    auth.accountType === "candidate"
                      ? "/app/reviews"
                      : "/app/profile"
                  }
                  className="button button-primary"
                >
                  Verify company email
                </AppLink>
              }
            />
          ) : !isSupabaseConfigured ? (
            <StatePanel
              kind="locked"
              title="Connect Supabase to load reviews"
              message="The frontend is ready, but this deployment does not have database environment values."
            />
          ) : (
            <>
              <div className="public-review-toolbar">
                <label>
                  <span>Search reviews</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Manager, company, or review text"
                  />
                </label>
              </div>
              {reviews.isLoading ? (
                <StatePanel
                  kind="loading"
                  title="Loading manager reviews"
                  message="Reading reviews available to your verified account."
                />
              ) : reviews.isError ? (
                <StatePanel
                  kind="error"
                  title="Reviews could not be loaded"
                  message={reviews.error.message}
                  action={
                    <button
                      className="button"
                      onClick={() => void reviews.refetch()}
                    >
                      Try again
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="public-review-results">
                    <strong>{filtered.length} reviews</strong>
                    <span>Available to your verified account</span>
                  </div>
                  {filtered.length ? (
                    <div className="public-manager-grid">
                      {filtered.map((review) => (
                        <article
                          className="public-manager-card"
                          key={review.id}
                        >
                          <div className="manager-card-head">
                            <span className="manager-avatar">
                              {review.manager_name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")}
                            </span>
                            <div>
                              <h3>{review.manager_name}</h3>
                              <p>
                                {review.company_name || "Company not displayed"}
                              </p>
                            </div>
                            <span className="review-verified">✓ Verified</span>
                          </div>
                          <div className="manager-score-row">
                            <div>
                              <strong>
                                {review.average_rating.toFixed(1)}
                              </strong>
                              <span>average rating</span>
                            </div>
                            <div>
                              <strong>{review.rating}</strong>
                              <span>overall rating</span>
                            </div>
                            <div>
                              <strong>4</strong>
                              <span>review dimensions</span>
                            </div>
                          </div>
                          {review.review_title && (
                            <h4>{review.review_title}</h4>
                          )}
                          <blockquote>“{review.review_body}”</blockquote>
                          <div className="manager-dimension-list">
                            {[
                              ["Leadership", review.leadership_rating],
                              ["Communication", review.communication_rating],
                              ["Fairness", review.fairness_rating],
                              ["Growth", review.career_growth_rating],
                            ].map(([label, value]) => (
                              <span key={String(label)}>
                                {label}
                                <strong>{value || "N/A"}</strong>
                              </span>
                            ))}
                          </div>
                          <div className="manager-card-foot">
                            <span>Verified submission</span>
                            <span>Author identity hidden</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <StatePanel
                      kind="empty"
                      title="No matching reviews"
                      message="Try another manager or company."
                    />
                  )}
                </>
              )}
            </>
          )}
        </section>
        {canRead && (
          <section className="public-review-cta">
            <div>
              <p className="eyebrow">WORKED WITH A MANAGER?</p>
              <h2>Add context without adding your name.</h2>
            </div>
            <AppLink
              to={
                auth.accountType === "candidate"
                  ? "/app/reviews"
                  : "/app/discover"
              }
              className="button button-light"
            >
              {auth.accountType === "candidate"
                ? "Write an anonymous review"
                : "Back to hiring workspace"}{" "}
              <ArrowIcon />
            </AppLink>
          </section>
        )}
      </main>
      <footer className="landing-footer public-review-footer">
        <Logo />
        <p>Verified management context, shared responsibly.</p>
        <span>© 2026 MassLaidOff</span>
      </footer>
    </div>
  );
}
