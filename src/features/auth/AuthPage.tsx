import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, type Audience } from "../../app/auth-context";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "../../lib/auth";
import {
  AppLink,
  ArrowIcon,
  GoogleIcon,
  Logo,
  MailIcon,
  ShieldIcon,
} from "../../components/core";

const authSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});
type AuthForm = z.infer<typeof authSchema>;

export function AuthPage({ audience }: { audience: Audience }) {
  const candidate = audience === "candidate";
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">(() =>
    new URLSearchParams(location.search).get("mode") === "signup"
      ? "signup"
      : "signin",
  );
  const [status, setStatus] = useState("");
  const localDemoEnabled =
    !isSupabaseConfigured &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    clearErrors,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  useEffect(() => {
    document.title = candidate
      ? "Job seeker login · MassLaidOff"
      : "Hiring team login · MassLaidOff";
  }, [candidate]);
  // Signed-in visitors go to their workspace home. Recruiters land on Discover
  // only once verified; until then their profile page holds the next step.
  const from = (location.state as { from?: string } | null)?.from;
  useEffect(() => {
    if (auth.loading || !auth.authenticated || !auth.accountType) return;
    const home =
      auth.accountType === "recruiter" && auth.companyEmailVerified
        ? "/app/discover"
        : "/app/profile";
    navigate(auth.accountType === audience && from ? from : home, {
      replace: true,
    });
  }, [audience, auth.accountType, auth.authenticated, auth.companyEmailVerified, auth.loading, from, navigate]);

  const submit = handleSubmit(
    async (values) => {
      setStatus("");
      if (
        mode === "signup" &&
        (!values.firstName.trim() || !values.lastName.trim())
      ) {
        if (!values.firstName.trim()) setError("firstName", { message: "Enter your first name." });
        if (!values.lastName.trim()) setError("lastName", { message: "Enter your last name." });
        return;
      }
      const redirectPath = "/app/profile";
      try {
      if (!isSupabaseConfigured) {
        if (!localDemoEnabled)
          throw new Error(
            "Authentication is not configured for this deployment yet.",
          );
        const expectedEmail = candidate
          ? "aarav.mehta@example.com"
          : "priya@acmehire.example";
        const expectedPassword = candidate
          ? "TestFlow!2026"
          : "HiringTest!2026";
        if (
          mode === "signin" &&
          (values.email !== expectedEmail ||
            values.password !== expectedPassword)
        )
          throw new Error(
            "Use the local demo account or create a local test account.",
          );
        auth.createDemoSession({
          accountType: audience,
          email: values.email,
          firstName: values.firstName || (candidate ? "Aarav" : "Priya"),
          lastName: values.lastName || (candidate ? "Mehta" : "Sharma"),
          companyEmailVerified: mode === "signin",
        });
        navigate(redirectPath, { replace: true });
        return;
      }
      if (mode === "signup") {
        const result = await signUpWithPassword({
          ...values,
          accountType: audience,
          redirectPath,
        });
        if (!result.session) {
          if (result.user?.identities?.length === 0) {
            setMode("signin");
            setStatus("This account is already registered. Sign in with your password.");
          } else {
            setStatus(`Check ${values.email} to confirm your new account.`);
          }
          return;
        }
      } else await signInWithPassword(values.email, values.password, audience);
      // The effect above redirects once the refreshed account is loaded.
      await auth.refresh();
      } catch (error) {
        if (
          mode === "signup" &&
          error instanceof Error &&
          /already registered/i.test(error.message)
        ) {
          setMode("signin");
          setStatus("This account is already registered. Sign in with your password.");
        } else {
          const message = error instanceof Error ? error.message : "Unable to continue.";
          setStatus(
            /email rate limit/i.test(message)
              ? "Too many confirmation emails were sent in the last hour. Wait a while and try again, or sign in if you already confirmed your account."
              : message,
          );
        }
      }
    },
    () => {
      if (mode !== "signup") return;
      const values = getValues();
      if (!values.firstName.trim())
        setError("firstName", { message: "Enter your first name." });
      if (!values.lastName.trim())
        setError("lastName", { message: "Enter your last name." });
    },
  );

  async function googleSignIn() {
    setStatus("");
    if (!isSupabaseConfigured) {
      setStatus("Connect Supabase before enabling Google sign-in.");
      return;
    }
    try {
      await signInWithGoogle(
        audience,
        candidate ? "/app/profile" : "/app/discover",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to continue with Google.",
      );
    }
  }

  async function forgotPassword() {
    const email = getValues("email").trim();
    if (!authSchema.shape.email.safeParse(email).success) {
      setError("email", { message: "Enter a valid email address first." });
      return;
    }
    clearErrors("email");
    if (!isSupabaseConfigured) {
      setStatus("Password reset requires a connected Supabase project.");
      return;
    }
    try {
      await requestPasswordReset(email);
      setStatus(`Password reset instructions were sent to ${email}.`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to send reset instructions.",
      );
    }
  }

  function fillDemo() {
    setMode("signin");
    setValue(
      "email",
      candidate ? "aarav.mehta@example.com" : "priya@acmehire.example",
    );
    setValue("password", candidate ? "TestFlow!2026" : "HiringTest!2026");
    setStatus("Demo account filled. Select Sign in.");
  }

  return (
    <div
      className={`login-page ${candidate ? "candidate-login" : "recruiter-login"}`}
    >
      <header className="login-nav">
        <Logo />
        <div className="login-nav-switch">
          <span>
            {candidate
              ? "Hiring for your team?"
              : "Looking for your next role?"}
          </span>
          <AppLink
            to={candidate ? "/login/hiring" : "/login/job-seeker"}
            className="switch-audience"
          >
            {candidate ? "Hiring team access" : "Job seeker access"}{" "}
            <ArrowIcon />
          </AppLink>
        </div>
      </header>
      <main className="login-layout">
        <section className="login-story">
          <div className="login-story-copy">
            <p className="eyebrow">
              {candidate
                ? "A BETTER WAY FORWARD"
                : "PURPOSEFUL HIRING STARTS HERE"}
            </p>
            <h1>
              {candidate ? (
                <>
                  Your work still
                  <br />
                  <em>speaks for you.</em>
                </>
              ) : (
                <>
                  Find experience
                  <br />
                  <em>ready to move.</em>
                </>
              )}
            </h1>
            <p>
              {candidate
                ? "Create one verified record and decide how hiring teams can reach you."
                : "Search a focused network of professionals ready for their next role."}
            </p>
          </div>
          <div className="login-preview">
            <div className="login-preview-head">
              <span>{candidate ? "Your profile" : "Talent network"}</span>
              <strong>
                <i /> {candidate ? "Private by default" : "Verified access"}
              </strong>
            </div>
            <div className="preview-profile-row">
              <span className="preview-avatar">{candidate ? "KR" : "24"}</span>
              <div>
                <b>
                  {candidate ? "Your professional record" : "Relevant people"}
                </b>
                <small>Protected, verified access</small>
              </div>
              <span className="preview-score">Live</span>
            </div>
          </div>
        </section>
        <section className="login-access">
          <div className="login-card">
            <div className="login-role-tabs">
              <AppLink
                to="/login/job-seeker"
                className={candidate ? "active" : ""}
              >
                Job seeker
              </AppLink>
              <AppLink
                to="/login/hiring"
                className={!candidate ? "active" : ""}
              >
                Hiring team
              </AppLink>
            </div>
            <div className="login-card-title-row">
              <p className="section-kicker">
                {candidate ? "JOB SEEKER ACCESS" : "HIRING TEAM ACCESS"}
              </p>
              <button
                type="button"
                className="auth-mode-link"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setStatus("");
                  clearErrors();
                  resetField("password");
                }}
              >
                {mode === "signup" ? "Sign in" : "Create account"}
              </button>
            </div>
            <h2>
              {mode === "signin"
                ? "Welcome back."
                : candidate
                  ? "Create your profile."
                  : "Create hiring access."}
            </h2>
            <p className="login-intro">
              {mode === "signin"
                ? "Sign in to continue to your workspace."
                : "Create a protected account with verified access."}
            </p>
            <button
              type="button"
              className="google-auth-button"
              onClick={() => void googleSignIn()}
              disabled={isSubmitting}
            >
              <GoogleIcon /> Continue with Google
            </button>
            <div className="auth-divider">
              <span>or continue with email</span>
            </div>
            {localDemoEnabled && (
              <div className="demo-auth-note">
                <div>
                  <strong>Local demo</strong>
                  <span>No backend required</span>
                </div>
                <button type="button" onClick={fillDemo}>
                  Fill demo account
                </button>
              </div>
            )}
            <form onSubmit={submit} noValidate>
              {mode === "signup" && (
                <div className="name-fields">
                  <div className="auth-field">
                    <label>
                      <span className="label-text">First name <span className="required-mark" aria-hidden="true">*</span></span>
                      <input
                        {...register("firstName")}
                        autoComplete="given-name"
                      />
                    </label>
                    {errors.firstName && <p className="field-error">{errors.firstName.message}</p>}
                  </div>
                  <div className="auth-field">
                    <label>
                      <span className="label-text">Last name <span className="required-mark" aria-hidden="true">*</span></span>
                      <input
                        {...register("lastName")}
                        autoComplete="family-name"
                      />
                    </label>
                    {errors.lastName && <p className="field-error">{errors.lastName.message}</p>}
                  </div>
                </div>
              )}
              <label htmlFor="auth-email"><span className="label-text">Email <span className="required-mark" aria-hidden="true">*</span></span></label>
              <div className="email-control">
                <MailIcon />
                <input
                  id="auth-email"
                  type="email"
                  {...register("email")}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="field-error">{errors.email.message}</p>
              )}
              <div className="password-heading">
                <label htmlFor="auth-password" className="password-label"><span className="label-text">Password <span className="required-mark" aria-hidden="true">*</span></span></label>
                {mode === "signin" && (
                  <button type="button" onClick={() => void forgotPassword()}>
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                {...register("password")}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
              {errors.password ? (
                <p className="field-error">{errors.password.message}</p>
              ) : (
                <p className="field-note">Minimum 8 characters.</p>
              )}
              <button
                className="button button-primary login-submit"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}{" "}
                <ArrowIcon />
              </button>
            </form>
            {status && (
              <div className="login-status" role="status">
                {status}
              </div>
            )}
            <div className="login-next">
              <span className="login-next-icon">
                <ShieldIcon />
              </span>
              <div>
                <strong>Your information stays private</strong>
                <p>Contact details are never displayed publicly.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
