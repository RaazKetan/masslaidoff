import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AppLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={className}
      onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
    >
      {children}
    </Link>
  );
}

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <AppLink to="/" className={`brand ${inverse ? "brand-inverse" : ""}`}>
      <img
        className="brand-mark brand-mark-image"
        src="/masslaidoff-mark-v2.svg"
        alt=""
      />
      <span>masslaidoff</span>
    </AppLink>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m5 8 7 5 7-5" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.54l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}

export function LinkedInProfilePreview({
  url,
  name,
  headline,
}: {
  url: string;
  name: string;
  headline: string;
}) {
  let profileUrl = "";
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.toLowerCase().replace(/^www\./, "") === "linkedin.com" &&
      /^\/in\/[^/]+/.test(parsed.pathname)
    )
      profileUrl = parsed.href;
  } catch {
    return null;
  }
  if (!profileUrl) return null;
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "IN";
  return (
    <a
      className="linkedin-preview"
      href={profileUrl}
      target="_blank"
      rel="noreferrer"
    >
      <span className="linkedin-preview-avatar">{initials}</span>
      <span className="linkedin-preview-copy">
        <strong>{name || "LinkedIn profile"}</strong>
        <small>{headline || "LinkedIn profile"}</small>
      </span>
      <span className="linkedin-preview-mark">in</span>
      <span className="linkedin-preview-action">View profile ↗</span>
    </a>
  );
}

export function StatePanel({
  kind,
  title,
  message,
  action,
}: {
  kind: "loading" | "empty" | "error" | "locked" | "success";
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`state-panel state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span className="state-panel-icon">
        {kind === "loading" ? <i /> : <ShieldIcon />}
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}

export type SetupStep = {
  label: string;
  detail: string;
  done: boolean;
  action?: { to: string; label: string };
};

/** Ordered onboarding steps; the first unfinished step is highlighted. */
export function SetupChecklist({ title, steps }: { title: string; steps: SetupStep[] }) {
  if (steps.every((step) => step.done)) return null;
  const next = steps.findIndex((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;
  return (
    <section className="setup-checklist" aria-label={title}>
      <div className="setup-checklist-head">
        <div>
          <p className="eyebrow">GETTING STARTED</p>
          <h2>{title}</h2>
        </div>
        <span>
          {doneCount} of {steps.length} done
        </span>
      </div>
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={step.done ? "is-done" : index === next ? "is-next" : ""}
          >
            <span className="setup-dot" aria-hidden="true">
              {step.done ? "✓" : index + 1}
            </span>
            <div>
              <strong>
                {step.label}
                {step.done && <span className="visually-hidden"> (done)</span>}
              </strong>
              <p>{step.detail}</p>
            </div>
            {!step.done && step.action && (
              <AppLink
                to={step.action.to}
                className={`button ${index === next ? "button-primary" : "button-secondary"} button-small-plain`}
              >
                {step.action.label}
              </AppLink>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
