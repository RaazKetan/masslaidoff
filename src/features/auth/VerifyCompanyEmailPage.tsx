import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/auth-context";
import { StatePanel } from "../../components/core";
import { api } from "../../lib/api";

export function VerifyCompanyEmailPage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const attempted = useRef(false);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (auth.loading || !auth.authenticated || !token || attempted.current)
      return;
    attempted.current = true;
    setState("working");
    void api
      .confirmCompanyEmail(token)
      .then(async ({ company_email: companyEmail }) => {
        await auth.refresh();
        setMessage(`${companyEmail} is now verified.`);
        setState("done");
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "This verification link could not be confirmed.",
        );
        setState("error");
      });
  }, [auth, token]);

  if (auth.loading || state === "working")
    return (
      <StatePanel
        kind="loading"
        title="Verifying company email"
        message="Checking the secure verification link."
      />
    );

  if (!token)
    return (
      <StatePanel
        kind="locked"
        title="Verification link missing"
        message="Request a new company email link from the manager review page."
      />
    );

  if (!auth.authenticated)
    return (
      <main className="workspace-page auth-required-page">
        <StatePanel
          kind="locked"
          title="Sign in to verify your email"
          message="Use the same MassLaidOff account that requested this link, then open the link again."
        />
        <div className="form-actions">
          <Link className="button button-primary" to="/login/job-seeker">
            Job seeker sign in
          </Link>
          <Link className="button button-secondary" to="/login/hiring">
            Hiring team sign in
          </Link>
        </div>
      </main>
    );

  if (state === "done")
    return (
      <main className="workspace-page auth-required-page">
        <StatePanel
          kind="success"
          title="Company email verified"
          message={message}
        />
        <div className="form-actions">
          <Link className="button button-primary" to="/app/reviews">
            Write a manager review
          </Link>
          <Link className="button button-secondary" to="/manager-reviews">
            Browse manager reviews
          </Link>
        </div>
      </main>
    );

  return (
    <main className="workspace-page auth-required-page">
      <StatePanel
        kind="error"
        title="Verification failed"
        message={message || "This verification link is invalid or expired."}
      />
      <div className="form-actions">
        <Link className="button button-primary" to="/app/reviews">
          Request another link
        </Link>
      </div>
    </main>
  );
}
