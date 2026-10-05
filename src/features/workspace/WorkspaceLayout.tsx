import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth-context";
import { AppLink, Logo, StatePanel } from "../../components/core";
import { api } from "../../lib/api";

export function WorkspaceLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const recruiter = auth.accountType === "recruiter";
  const requests = useQuery({
    queryKey: ["access-requests"],
    queryFn: api.listAccessRequests,
    enabled: auth.accountType === "candidate" && !auth.demo,
    retry: false,
  });
  const pendingRequests = requests.data?.length || 0;
  const title = location.pathname.includes("profile/edit")
    ? "Edit profile"
    : location.pathname.includes("requests")
    ? "Access requests"
    : location.pathname.includes("outreach")
    ? "Reached out"
    : location.pathname.includes("discover")
    ? "Discover talent"
    : location.pathname.includes("reviews")
      ? "Write a manager review"
      : recruiter
        ? "Hiring profile"
        : "My profile";
  const initials =
    auth.accountName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "ML";
  useEffect(() => {
    document.title = `${title} · MassLaidOff`;
  }, [title]);
  // Start each workspace page at the top, after the new page has rendered.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  async function logout() {
    setSigningOut(true);
    await auth.signOut();
    navigate("/");
  }
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Logo />
        <div className="workspace-label">
          <span>ML</span>
          <div>
            <strong>MassLaidOff</strong>
            <small>{recruiter ? "Hiring workspace" : "Member workspace"}</small>
          </div>
        </div>
        <nav>
          {recruiter && <NavLink to="/app/discover">Discover talent</NavLink>}
          {recruiter && <NavLink to="/app/outreach">Reached out</NavLink>}
          <NavLink to="/app/profile">My profile</NavLink>
          <NavLink to="/manager-reviews">Manager reviews</NavLink>
          {!recruiter && <NavLink to="/app/reviews">Write a review</NavLink>}
          {!recruiter && (
            <NavLink to="/app/requests">
              Access requests
              {pendingRequests > 0 && (
                <span className="nav-count" aria-label={`${pendingRequests} pending`}>
                  {pendingRequests}
                </span>
              )}
            </NavLink>
          )}
        </nav>
        <div className="sidebar-foot">
          <p>
            {recruiter ? (
              <>
                Thoughtful hiring starts
                <br />
                with relevant context.
              </>
            ) : (
              <>
                A layoff changes a role.
                <br />
                It does not change a person’s value.
              </>
            )}
          </p>
          <AppLink to="/">Back to home</AppLink>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <span>
            Workspace / <strong>{title}</strong>
          </span>
          <div className="account-controls">
            <div className="account-identity">
              <span className="account-avatar">{initials}</span>
              <span className="account-name">
                <strong>{auth.accountName}</strong>
                <small>
                  {recruiter ? "Hiring account" : "Job seeker account"}
                </small>
              </span>
            </div>
            <button
              className="logout-button"
              type="button"
              onClick={() => void logout()}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </header>
        {/* Keeps the shell mounted while a lazy page loads, so navigation doesn't flash or jump */}
        <Suspense fallback={<main className="workspace-page"><StatePanel kind="loading" title="Loading" message="Opening this page." /></main>}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
