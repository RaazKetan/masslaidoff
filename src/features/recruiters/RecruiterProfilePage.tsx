import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../app/auth-context";
import {
  LinkedInProfilePreview,
  SetupChecklist,
  ShieldIcon,
  StatePanel,
} from "../../components/core";
import { api } from "../../lib/api";
import { isSupabaseConfigured } from "../../lib/supabase";
import { isLinkedInProfileURL } from "../../lib/utils";

const schema = z.object({
  fullName: z.string().min(2),
  company: z.string().min(2),
  jobTitle: z.string().min(2),
  workEmail: z.string().trim().email("Enter a valid work email address."),
  linkedinUrl: z
    .string()
    .refine(isLinkedInProfileURL, "Use an HTTPS LinkedIn profile URL."),
});
type Values = z.infer<typeof schema>;

export function RecruiterProfilePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [verificationURL, setVerificationURL] = useState("");
  const profile = useQuery({
    queryKey: ["recruiter-profile"],
    queryFn: api.getRecruiterProfile,
    enabled: isSupabaseConfigured,
    retry: false,
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: auth.accountName,
      company: "",
      jobTitle: "",
      workEmail: auth.companyEmail || auth.email,
      linkedinUrl: auth.account?.linkedin_url || "",
    },
  });
  useEffect(() => {
    if (profile.data)
      reset({
        fullName: auth.accountName,
        company: profile.data.company,
        jobTitle: profile.data.title || "",
        workEmail: profile.data.work_email,
        linkedinUrl: profile.data.linkedin_url || "",
      });
  }, [auth.accountName, profile.data, reset]);
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      return api.saveRecruiterProfile({
        full_name: values.fullName,
        linkedin_url: values.linkedinUrl,
        company: values.company,
        job_title: values.jobTitle,
        work_email: values.workEmail,
      });
    },
    onSuccess: async () => {
      setStatus("Hiring profile saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recruiter-profile"] }),
        auth.refresh(),
      ]);
    },
    onError: (error) =>
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to save hiring profile.",
      ),
  });
  const fullName = watch("fullName");
  const company = watch("company");
  const jobTitle = watch("jobTitle");
  const linkedinUrl = watch("linkedinUrl");
  const workEmail = watch("workEmail");
  const verification = useMutation({
    mutationFn: () => api.requestCompanyEmailVerification(workEmail),
    onSuccess: (data) => {
      setStatus("Verification email sent. The link expires in 10 minutes.");
      setVerificationURL(data.development_verification_url || "");
    },
    onError: (error) =>
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to send the verification email.",
      ),
  });
  if (!isSupabaseConfigured)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="locked"
          title="Connect Supabase to save the hiring profile"
          message="Production hiring access requires a verified company account."
        />
      </main>
    );
  if (profile.isLoading)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="loading"
          title="Loading your hiring profile"
          message="Checking your company record."
        />
      </main>
    );
  return (
    <main className="workspace-page">
      <div className="workspace-heading compact">
        <p className="eyebrow">HIRING TEAM PROFILE</p>
        <h1>Tell candidates who is reaching out.</h1>
        <p>
          This profile establishes a real company identity before candidate
          access is granted.
        </p>
      </div>
      <SetupChecklist
        title="Get access to verified talent"
        steps={[
          { label: "Save your hiring profile", detail: "Company, title and LinkedIn so candidates know who is asking.", done: Boolean(profile.data) },
          { label: "Verify your work email", detail: "Use the send button below; the link expires in 10 minutes.", done: auth.companyEmailVerified },
          { label: "Discover talent", detail: "Search verified professionals and request introductions.", done: false, action: { to: "/app/discover", label: "Open Discover" } },
        ]}
      />
      <form
        className="profile-form recruiter-profile-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <section>
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2>Your professional details</h2>
              <p>
                No layoff history or employment documents are requested from
                hiring teams.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Full name" error={errors.fullName?.message}>
              <input {...register("fullName")} />
            </Field>
            <Field label="Current company" error={errors.company?.message}>
              <input {...register("company")} />
            </Field>
            <Field label="Role or job title" error={errors.jobTitle?.message}>
              <input {...register("jobTitle")} />
            </Field>
            <Field label="Work email" error={errors.workEmail?.message}>
              <input type="email" {...register("workEmail")} />
              {auth.companyEmailVerified ? (
                <small className="field-success">Company email verified</small>
              ) : (
                <button
                  className="text-button"
                  type="button"
                  disabled={verification.isPending || !workEmail}
                  onClick={() => verification.mutate()}
                >
                  {verification.isPending
                    ? "Sending verification email..."
                    : "Verify company email"}
                </button>
              )}
              {verificationURL && (
                <a className="text-button" href={verificationURL}>
                  Open local verification link
                </a>
              )}
            </Field>
            <div className="profile-field">
              <Field label="LinkedIn URL" error={errors.linkedinUrl?.message}>
                <input type="url" {...register("linkedinUrl")} />
              </Field>
              <LinkedInProfilePreview
                url={linkedinUrl}
                name={fullName}
                headline={[jobTitle, company].filter(Boolean).join(" at ")}
              />
            </div>
          </div>
        </section>
        <section className="recruiter-verification-note">
          <div className="form-section-heading">
            <span>
              <ShieldIcon />
            </span>
            <div>
              <h2>Company verification</h2>
              <p>
                Talent search, manager reviews, and contact details remain
                restricted until the company email is verified.
              </p>
            </div>
          </div>
        </section>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save hiring profile"}
          </button>
        </div>
        {status && (
          <div className={mutation.isError ? "form-error" : "form-success"}>
            {status}
          </div>
        )}
      </form>
    </main>
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
