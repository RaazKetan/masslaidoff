import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../app/auth-context";
import { AppLink, ShieldIcon, StatePanel } from "../../components/core";
import { APIError, api, type CandidateReview } from "../../lib/api";
import { isSupabaseConfigured } from "../../lib/supabase";
import { isLinkedInProfileURL } from "../../lib/utils";

const schema = z.object({
  managerName: z.string().trim().min(2, "Enter the manager’s name."),
  managerLinkedinUrl: z.string().url("Enter a valid LinkedIn URL.").refine(isLinkedInProfileURL, "Use an HTTPS LinkedIn profile URL."),
  company: z.string().trim().min(2, "Enter the company name."),
  relationship: z.string().trim().min(5, "Describe your reporting relationship."),
  leadershipRating: z.coerce.number<number>().min(1, "Choose a rating.").max(5),
  communicationRating: z.coerce.number<number>().min(1, "Choose a rating.").max(5),
  fairnessRating: z.coerce.number<number>().min(1, "Choose a rating.").max(5),
  careerGrowthRating: z.coerce.number<number>().min(1, "Choose a rating.").max(5),
  reviewTitle: z.string().trim().min(5, "Write a title of at least 5 characters.").max(120, "Keep the title under 120 characters."),
  reviewBody: z.string().trim().min(80, "Write at least 80 characters.").max(1200, "Keep the review under 1,200 characters."),
  consent: z.literal(true),
});
type Values = z.infer<typeof schema>;
const emptyReviewValues: Values = {
  managerName: "",
  managerLinkedinUrl: "",
  company: "",
  relationship: "",
  leadershipRating: undefined as unknown as number,
  communicationRating: undefined as unknown as number,
  fairnessRating: undefined as unknown as number,
  careerGrowthRating: undefined as unknown as number,
  reviewTitle: "",
  reviewBody: "",
  consent: false as true,
};

export function SubmitReviewPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [companyEmail, setCompanyEmail] = useState(auth.companyEmail);
  const [verificationURL, setVerificationURL] = useState("");
  const eligibility = useQuery({
    queryKey: ["review-eligibility"],
    queryFn: api.getReviewEligibility,
    enabled: isSupabaseConfigured,
    retry: false,
  });
  const myReviews = useQuery({ queryKey: ["my-reviews"], queryFn: api.listMyReviews, enabled: Boolean(eligibility.data?.eligible), retry: false });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: emptyReviewValues,
  });
  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const payload = {
        manager_name: values.managerName,
        manager_linkedin_url: values.managerLinkedinUrl,
        company: values.company,
        relationship: values.relationship,
        leadership_rating: values.leadershipRating,
        communication_rating: values.communicationRating,
        fairness_rating: values.fairnessRating,
        career_growth_rating: values.careerGrowthRating,
        review_title: values.reviewTitle,
        review_body: values.reviewBody,
      };
      return editingReview ? api.updateMyReview(editingReview, payload) : api.submitReview(payload);
    },
    onSuccess: async () => {
      setStatusError(false);
      setStatus(
        editingReview ? "Review updated and returned to moderation." : "Review submitted for moderation. Your identity will not appear publicly.",
      );
      setEditingReview(null);
      reset(emptyReviewValues);
      await queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
    },
    onError: (error) => {
      if (error instanceof APIError && error.code === "employment_mismatch") {
        setError("company", { message: error.message });
        return;
      }
      setStatusError(true);
      setStatus(
        error instanceof Error ? error.message : "Unable to submit review.",
      );
    },
  });
  const verification = useMutation({
    mutationFn: () => api.requestCompanyEmailVerification(companyEmail),
    onSuccess: (data) => {
      setStatusError(false);
      setStatus("Verification email sent. The link expires in 10 minutes.");
      setVerificationURL(data.development_verification_url || "");
    },
    onError: (error) => {
      setEmailError(
        error instanceof Error
          ? error.message
          : "Unable to send the verification email.",
      );
    },
  });
  const removeReview = useMutation({ mutationFn: api.deleteMyReview, onSuccess: async () => { setEditingReview(null); reset(emptyReviewValues); await queryClient.invalidateQueries({ queryKey: ["my-reviews"] }); }, onError: (error) => { setStatusError(true); setStatus(error instanceof Error ? error.message : "Unable to delete the review."); } });
  function editReview(review: CandidateReview) { setStatus(""); setEditingReview(review.id); reset({ managerName:review.manager_name,managerLinkedinUrl:review.manager_linkedin_url,company:review.company,relationship:review.relationship,leadershipRating:review.leadership_rating,communicationRating:review.communication_rating,fairnessRating:review.fairness_rating,careerGrowthRating:review.career_growth_rating,reviewTitle:review.review_title,reviewBody:review.review_body,consent:true }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (!isSupabaseConfigured)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="locked"
          title="Connect Supabase to submit reviews"
          message="Reviews require an authenticated account and protected database record."
        />
      </main>
    );
  if (eligibility.isLoading)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="loading"
          title="Checking review access"
          message="Confirming your profile, company email, and employment evidence."
        />
      </main>
    );
  if (eligibility.isError)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="error"
          title="Review access could not be checked"
          message={
            eligibility.error instanceof Error
              ? eligibility.error.message
              : "Try again shortly."
          }
        />
      </main>
    );
  if (!eligibility.data?.profile_exists)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="locked"
          title="Build your profile first"
          message="Your latest company must be saved before MassLaidOff can validate a manager review."
          action={
            <AppLink to="/app/profile/edit" className="button button-primary">
              Build profile
            </AppLink>
          }
        />
      </main>
    );
  if (!eligibility.data.company_email_verified)
    return (
      <main className="workspace-page">
        <div className="workspace-heading compact">
          <p className="eyebrow">REVIEW VERIFICATION</p>
          <h1>Verify your former company email.</h1>
          <p>
            The email link confirms that you control the company inbox. Your
            address is never shown in the review.
          </p>
        </div>
        <form
          className="profile-form review-verification-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!z.string().trim().email().safeParse(companyEmail).success) { setEmailError("Enter a valid company email address."); return; }
            setEmailError("");
            verification.mutate();
          }}
        >
          <section>
            <div className="form-section-heading">
              <span>01</span>
              <div>
                <h2>Confirm inbox access</h2>
                <p>
                  Use the company address connected to the employment in your
                  profile.
                </p>
              </div>
            </div>
            <Field label="Former company email" required error={emailError}>
              <input
                type="email"
                autoComplete="email"
                value={companyEmail}
                onChange={(event) => setCompanyEmail(event.target.value)}
                required
              />
              <small className="field-help">
                We send a one-time link. Verification proves inbox control,
                while your uploaded employment document supports the work
                history claim.
              </small>
            </Field>
            <div className="form-actions">
              <button
                className="button button-primary"
                disabled={verification.isPending || !companyEmail.trim()}
              >
                {verification.isPending
                  ? "Sending verification email..."
                  : "Send verification link"}
              </button>
            </div>
            {verificationURL && (
              <a className="text-button" href={verificationURL}>
                Open local verification link
              </a>
            )}
            {status && (
              <div
                className={
                  verification.isError ? "form-error" : "form-success"
                }
                role="status"
              >
                {status}
              </div>
            )}
          </section>
        </form>
      </main>
    );
  if (!eligibility.data.evidence_uploaded)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="locked"
          title="Add employment evidence"
          message="Upload an exit or relieving letter, or a salary slip. It stays private and is used to support the employment claim before moderation."
          action={
            <AppLink to="/app/profile/edit" className="button button-primary">
              Upload evidence
            </AppLink>
          }
        />
      </main>
    );
  return (
    <main className="workspace-page">
      <div className="workspace-heading compact">
        <p className="eyebrow">SHARE FIRST-HAND CONTEXT</p>
        <h1>Review your former manager.</h1>
        <p>
          Your review is moderated and published without your name or candidate
          profile.
        </p>
      </div>
      <div className="review-policy-banner">
        <ShieldIcon />
        <div>
          <strong>Anonymous publicly. Accountable internally.</strong>
          <p>
            Your identity and manager LinkedIn URL are used for verification
            only. The company must match the latest employment saved in your
            profile.
          </p>
        </div>
        <AppLink to="/manager-reviews" className="button button-secondary">
          View manager reviews
        </AppLink>
      </div>
      <section className="my-reviews-section"><div className="section-heading-row"><div><p className="eyebrow">YOUR REVIEWS</p><h2>Submitted experiences</h2></div><span>{myReviews.data?.length || 0} total</span></div>{myReviews.isLoading ? <p>Loading your reviews…</p> : myReviews.data?.length ? <div className="my-review-list">{myReviews.data.map((review) => <article key={review.id} className="my-review-card"><div><span className={`review-status status-${review.status}`}>{review.status}</span><h3>{review.review_title}</h3><p>{review.manager_name} · {review.company}</p></div><div className="review-card-actions"><button type="button" className="text-button" onClick={() => editReview(review)}>Edit</button><button type="button" className="text-button danger-text" disabled={removeReview.isPending} onClick={() => { if (window.confirm("Delete this manager review permanently?")) removeReview.mutate(review.id); }}>Delete</button></div></article>)}</div> : <p>You have not submitted a review yet.</p>}</section>
      <form
        className="profile-form manager-review-form"
        onSubmit={handleSubmit((values) => {
          setStatus("");
          mutation.mutate(values);
        })}
        noValidate
      >
        <section>
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2>Identify the manager</h2>
              <p>
                This keeps reviews attached to the correct person and company.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Manager name" required error={errors.managerName?.message}>
              <input {...register("managerName")} />
            </Field>
            <Field label="Company" required error={errors.company?.message}>
              <input {...register("company")} />
            </Field>
            <Field
              label="Manager LinkedIn URL"
              required
              error={errors.managerLinkedinUrl?.message}
            >
              <input type="url" {...register("managerLinkedinUrl")} />
              <small className="field-help">Private verification detail.</small>
            </Field>
            <Field
              label="Reporting relationship"
              required
              error={errors.relationship?.message}
            >
              <input
                {...register("relationship")}
                placeholder="Direct report, January 2023 to March 2025"
              />
            </Field>
          </div>
        </section>
        <section>
          <div className="form-section-heading">
            <span>02</span>
            <div>
              <h2>Rate the working experience</h2>
              <p>
                Specific, balanced ratings are more useful than uniformly high
                or low scores.
              </p>
            </div>
          </div>
          <div className="review-rating-grid">
            {[
              ["Leadership", "leadershipRating"],
              ["Communication", "communicationRating"],
              ["Fairness", "fairnessRating"],
              ["Career growth", "careerGrowthRating"],
            ].map(([label, name]) => (
              <Field
                key={name}
                label={label}
                required
                error={
                  errors[name as keyof Values]?.message as string | undefined
                }
              >
                <select
                  {...register(name as "leadershipRating")}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select 1 to 5
                  </option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        </section>
        <section>
          <div className="form-section-heading">
            <span>03</span>
            <div>
              <h2>Write the review</h2>
              <p>Describe observable behavior and its effect on the team.</p>
            </div>
          </div>
          <Field label="Review title" required error={errors.reviewTitle?.message}>
            <input {...register("reviewTitle")} />
          </Field>
          <Field
            label="What should a future team member know?"
            required
            error={errors.reviewBody?.message}
          >
            <textarea rows={8} {...register("reviewBody")} />
          </Field>
          <label className="checkbox-label">
            <input type="checkbox" {...register("consent")} /> I confirm this
            reflects my own experience. <span className="required-mark" aria-hidden="true">*</span>
          </label>
          {errors.consent && (
            <p className="field-error">
              Confirm that this is your own experience.
            </p>
          )}
        </section>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : editingReview ? "Update and resubmit" : "Submit for moderation"}
          </button>
          {editingReview && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setEditingReview(null);
                reset(emptyReviewValues);
                setStatus("");
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
        {status && (
          <div className={statusError ? "form-error" : "form-success"}>
            {status}
          </div>
        )}
      </form>
    </main>
  );
}
function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="label-text">{label} {required && <span className="required-mark" aria-hidden="true">*</span>}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
