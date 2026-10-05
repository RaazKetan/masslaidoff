import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updatePassword } from "../../lib/auth";
import { isSupabaseConfigured } from "../../lib/supabase";
import { AppLink, ArrowIcon, Logo } from "../../components/core";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirmation: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "The passwords do not match.",
    path: ["confirmation"],
  });
type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [status, setStatus] = useState("");
  const [complete, setComplete] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async ({ password }) => {
    if (!isSupabaseConfigured) {
      setStatus("Password reset requires Supabase.");
      return;
    }
    try {
      await updatePassword(password);
      setComplete(true);
      setStatus("Your password has been updated.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to update password.",
      );
    }
  });
  return (
    <div className="reset-page">
      <header className="login-nav">
        <Logo />
        <AppLink to="/" className="switch-audience">
          Back to home <ArrowIcon />
        </AppLink>
      </header>
      <main className="reset-layout">
        <section className="reset-card">
          <p className="section-kicker">ACCOUNT RECOVERY</p>
          <h1>Choose a new password.</h1>
          <p>Use at least eight characters.</p>
          {!complete ? (
            <form onSubmit={submit}>
              <label>
                <span className="label-text">New password <span className="required-mark" aria-hidden="true">*</span></span>
                <input type="password" {...register("password")} />
              </label>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
              <label>
                <span className="label-text">Confirm new password <span className="required-mark" aria-hidden="true">*</span></span>
                <input type="password" {...register("confirmation")} />
              </label>
              {errors.confirmation && (
                <p className="field-error">{errors.confirmation.message}</p>
              )}
              <button className="button button-primary" disabled={isSubmitting}>
                Update password <ArrowIcon />
              </button>
            </form>
          ) : (
            <AppLink to="/login/job-seeker" className="button button-primary">
              Continue to sign in
            </AppLink>
          )}
          {status && <div className="login-status">{status}</div>}
        </section>
      </main>
    </div>
  );
}
