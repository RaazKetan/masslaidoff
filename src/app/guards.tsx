import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type Audience } from "./auth-context";
import { StatePanel } from "../components/core";

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading)
    return (
      <StatePanel
        kind="loading"
        title="Preparing your workspace"
        message="Checking your account and permissions."
      />
    );
  if (!auth.authenticated && auth.error)
    return (
      <StatePanel
        kind="error"
        title="We couldn't load your account"
        message={auth.error.message}
        action={
          <button
            type="button"
            className="button button-primary"
            onClick={() => void auth.refresh().catch(() => undefined)}
          >
            Try again
          </button>
        }
      />
    );
  if (!auth.authenticated) {
    const loginPath = location.pathname.startsWith("/app/discover")
      ? "/login/hiring"
      : "/login/job-seeker";
    return (
      <Navigate to={loginPath} replace state={{ from: location.pathname }} />
    );
  }
  return children;
}

export function RequireRole({
  role,
  children,
}: {
  role: Audience;
  children: ReactNode;
}) {
  const auth = useAuth();
  if (auth.loading)
    return (
      <StatePanel
        kind="loading"
        title="Checking access"
        message="Confirming your workspace role."
      />
    );
  if (auth.accountType !== role) return <Navigate to="/app/profile" replace />;
  return children;
}
