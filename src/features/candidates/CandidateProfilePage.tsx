import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../app/auth-context";
import { CandidateCard } from "../../components/CandidateCard";
import {
  AppLink,
  StatePanel,
  LinkedInProfilePreview,
  SetupChecklist,
} from "../../components/core";
import { api, APIError } from "../../lib/api";
import { isSupabaseConfigured } from "../../lib/supabase";
import { isLinkedInProfileURL } from "../../lib/utils";
import type { DocumentType } from "../../lib/types";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  linkedinUrl: z.string().url("Enter a valid LinkedIn URL.").refine(isLinkedInProfileURL, "Use an HTTPS LinkedIn profile URL."),
  location: z.string().trim().min(2, "Enter your current location."),
  availability: z.string().min(1, "Choose your availability date."),
  yearsExperience: z.coerce.number<number>().int("Use a whole number.").min(0, "Experience cannot be negative.").max(60, "Enter 60 years or fewer."),
  intro: z.string().trim().min(30, "Write at least 30 characters.").max(1200, "Keep this under 1,200 characters."),
  company: z.string().trim().min(2, "Enter your former company."),
  role: z.string().trim().min(2, "Enter your role title."),
  orgName: z.string(),
  teamName: z.string(),
  startedOn: z.string(),
  endedOn: z.string(),
  phone: z.string().trim().refine((value) => { const digits = value.replace(/\D/g, "").length; return /^[0-9 +().-]+$/.test(value) && digits >= 7 && digits <= 15; }, "Enter a phone number with 7 to 15 digits."),
  contactVisibility: z.enum([
    "request_access",
    "verified_recruiters",
    "hidden",
  ]),
  resumeVisibility: z.enum(["request_access", "verified_recruiters", "hidden"]),
  publicStatsConsent: z.boolean(),
  consent: z.literal(true),
}).refine((values) => !values.startedOn || !values.endedOn || values.endedOn >= values.startedOn, { message: "Last working date cannot be before the start date.", path: ["endedOn"] });
type Values = z.infer<typeof schema>;

export function CandidateProfilePage({ edit = false }: { edit?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<DocumentType, string>>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("");
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: api.getCandidateProfile,
    enabled: isSupabaseConfigured,
    retry: false,
  });
  const resume = useQuery({
    queryKey: ["my-resume"],
    queryFn: api.getMyResume,
    enabled: Boolean(!edit && profile.data?.has_resume),
    retry: false,
    // ponytail: refresh before the 5-minute signed URL expires so the preview and link stay valid
    staleTime: 4 * 60_000,
    refetchInterval: 4 * 60_000,
  });
  const documents = useQuery({ queryKey: ["my-documents"], queryFn: api.listMyDocuments, enabled: Boolean(profile.data), retry: false });
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
      linkedinUrl: auth.account?.linkedin_url || "",
      location: "",
      availability: "",
      yearsExperience: 0,
      intro: "",
      company: "",
      role: "",
      orgName: "",
      teamName: "",
      startedOn: "",
      endedOn: "",
      phone: "",
      contactVisibility: "request_access",
      resumeVisibility: "request_access",
      publicStatsConsent: false,
      consent: false as true,
    },
  });
  useEffect(() => {
    if (profile.data)
      reset((current) => ({
        ...current,
        fullName: auth.accountName,
        linkedinUrl: auth.account?.linkedin_url || "",
        location: profile.data.location || "",
        availability: profile.data.available_from || "",
        yearsExperience: profile.data.years_experience || 0,
        intro: profile.data.summary || "",
        company: profile.data.company || "",
        role: profile.data.role_title || profile.data.headline || "",
        orgName: profile.data.org_name || "",
        teamName: profile.data.team_name || "",
        startedOn: profile.data.started_on || "",
        endedOn: profile.data.ended_on || "",
        phone: profile.data.phone_number || "",
        contactVisibility: profile.data.contact_visibility,
        resumeVisibility: profile.data.resume_visibility,
        publicStatsConsent: profile.data.public_stats_consent,
      }));
  }, [
    auth.account?.linkedin_url,
    auth.accountName,
    profile.data,
    reset,
  ]);
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      setUploadProgress(0);
      setStatus("Saving your profile…");
      const saved = await api.saveCandidateProfile({
        full_name: values.fullName,
        linkedin_url: values.linkedinUrl,
        location: values.location,
        availability: values.availability,
        years_experience: values.yearsExperience,
        intro: values.intro,
        company: values.company,
        role: values.role,
        org_name: values.orgName,
        team_name: values.teamName,
        started_on: values.startedOn,
        ended_on: values.endedOn,
        phone: values.phone,
        contact_visibility: values.contactVisibility,
        resume_visibility: values.resumeVisibility,
        public_stats_consent: values.publicStatsConsent,
      });
      const uploads = Object.entries(files) as [DocumentType, File][];
      for (let index = 0; index < uploads.length; index += 1) {
        await api.uploadDocument(uploads[index][0], uploads[index][1]);
        setUploadProgress(Math.round(((index + 1) / uploads.length) * 100));
      }
      return saved;
    },
    onSuccess: async () => {
      setStatus("Profile saved securely.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["my-resume"] }),
        queryClient.invalidateQueries({ queryKey: ["my-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["review-eligibility"] }),
        auth.refresh(),
      ]);
      navigate("/app/profile");
    },
    onError: (error) =>
      setStatus(
        error instanceof Error ? error.message : "Unable to save profile.",
      ),
  });
  const deleteDocument = useMutation({ mutationFn: api.deleteMyDocument, onSettled: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["my-documents"] }),queryClient.invalidateQueries({ queryKey: ["my-profile"] }),queryClient.invalidateQueries({ queryKey: ["my-resume"] }),queryClient.invalidateQueries({ queryKey: ["review-eligibility"] })]); } });
  const deleteAccount = useMutation({ mutationFn: () => api.deleteAccount(deleteConfirmation), onSuccess: async () => { try { await auth.signOut(); } catch { /* The server already removed the identity. */ } navigate("/", { replace: true }); } });
  const linkedinUrl = watch("linkedinUrl");
  const fullName = watch("fullName");
  const role = watch("role");
  const company = watch("company");
  if (!isSupabaseConfigured)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="locked"
          title="Connect Supabase to save profiles"
          message="Local demo sessions do not write sensitive profile or document data."
        />
      </main>
    );
  if (profile.isLoading)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="loading"
          title="Loading your profile"
          message="Preparing your private professional record."
        />
      </main>
    );
  const profileMissing =
    profile.error instanceof APIError && profile.error.code === "not_found";
  const hasEvidence = Boolean(
    documents.data?.some((d) => d.document_type === "exit_letter" || d.document_type === "salary_slip"),
  );
  const checklist = (
    <SetupChecklist
      title="Finish setting up your record"
      steps={[
        { label: "Build your profile", detail: "Your role, experience and availability.", done: Boolean(profile.data), action: { to: "/app/profile/edit", label: "Build profile" } },
        { label: "Upload your résumé", detail: "Shared only according to your visibility choice.", done: Boolean(profile.data?.has_resume), action: { to: "/app/profile/edit", label: "Upload résumé" } },
        { label: "Verify your former company email", detail: "Proves the employment and unlocks manager reviews.", done: auth.companyEmailVerified, action: { to: "/app/reviews", label: "Verify email" } },
        { label: "Add employment evidence", detail: "An exit letter or salary slip. Never shown to recruiters.", done: hasEvidence, action: { to: "/app/profile/edit", label: "Upload evidence" } },
      ]}
    />
  );
  if (profile.isError && !profileMissing)
    return (
      <main className="workspace-page">
        <StatePanel
          kind="error"
          title="Your profile could not be loaded"
          message={profile.error.message}
          action={
            <button className="button" onClick={() => void profile.refetch()}>
              Try again
            </button>
          }
        />
      </main>
    );
  if (!edit && profileMissing)
    return (
      <main className="workspace-page">
        <div className="workspace-heading compact">
          <p className="eyebrow">WELCOME</p>
          <h1>Let’s build your record.</h1>
          <p>Four short steps. You control who sees what at every stage.</p>
        </div>
        {checklist}
      </main>
    );
  if (!edit && profile.data)
    return (
      <main className="workspace-page">
        <div className="workspace-heading compact profile-view-heading">
          <div>
            <p className="eyebrow">MY PROFILE</p>
            <h1>Your recruiter-facing profile.</h1>
            <p>
              This is the saved profile verified hiring teams see in talent
              search.
            </p>
          </div>
          <AppLink to="/app/profile/edit" className="button button-primary">
            Edit profile
          </AppLink>
        </div>
        {checklist}
        <section
          className="recruiter-profile-preview"
          aria-labelledby="recruiter-preview-title"
        >
          <div className="recruiter-preview-heading">
            <div>
              <p className="eyebrow">RECRUITER VIEW</p>
              <h2 id="recruiter-preview-title">
                This is how your saved profile appears.
              </h2>
              <p>
                Private documents never appear here. Contact and résumé access
                follow your saved visibility choices.
              </p>
            </div>
            <span className="preview-saved-label">Saved profile</span>
          </div>
          <div className="recruiter-preview-content">
            <CandidateCard
              preview
              person={{
                name: auth.accountName,
                role: profile.data.headline,
                company: profile.data.company || "Private company",
                location: profile.data.location,
                years: profile.data.years_experience,
                immediate: profile.data.available_now,
                summary: profile.data.summary,
                verified: profile.data.verification_status === "verified",
                hasResume: profile.data.has_resume,
                contactMode: profile.data.contact_visibility,
                resumeMode: profile.data.resume_visibility,
                contactEmail:
                  profile.data.contact_visibility === "verified_recruiters"
                    ? auth.email
                    : null,
                contactPhone:
                  profile.data.contact_visibility === "verified_recruiters"
                    ? profile.data.phone_number
                    : null,
              }}
            />
            <div className="recruiter-preview-notes">
              <div>
                <span>CONTACT</span>
                <strong>
                  {profile.data.contact_visibility === "verified_recruiters"
                    ? "Visible to verified recruiters"
                    : profile.data.contact_visibility === "request_access"
                      ? "Shared only after your approval"
                      : "Hidden"}
                </strong>
              </div>
              <div>
                <span>RÉSUMÉ ACCESS</span>
                <strong>
                  {!profile.data.has_resume
                    ? "No résumé uploaded"
                    : profile.data.resume_visibility ===
                        "verified_recruiters"
                      ? "Visible to verified recruiters"
                      : profile.data.resume_visibility === "request_access"
                        ? "Shared only after your approval"
                        : "Hidden"}
                </strong>
              </div>
            </div>
          </div>
        </section>
        <section className="owner-resume-card">
          <div className="owner-resume-head">
          <div>
            <p className="eyebrow">YOUR PRIVATE FILE</p>
            <h2>Résumé</h2>
            {!profile.data.has_resume ? (
              <p>No résumé has been uploaded yet.</p>
            ) : resume.isLoading ? (
              <p>Preparing your secure résumé link.</p>
            ) : resume.isError ? (
              <p>Your résumé is uploaded, but it could not be opened now.</p>
            ) : (
              <p>{resume.data?.original_filename}</p>
            )}
          </div>
          {resume.data ? (
            <a
              className="button button-secondary"
              href={resume.data.signed_url}
              target="_blank"
              rel="noreferrer"
            >
              View résumé
            </a>
          ) : profile.data.has_resume ? (
            <button
              className="button button-secondary"
              type="button"
              disabled={resume.isLoading}
              onClick={() => void resume.refetch()}
            >
              {resume.isLoading ? "Preparing résumé" : "Try again"}
            </button>
          ) : (
            <AppLink
              to="/app/profile/edit"
              className="button button-secondary"
            >
              Upload résumé
            </AppLink>
          )}
          </div>
          {resume.data &&
            (resume.data.mime_type === "application/pdf" ? (
              <iframe
                loading="lazy"
                tabIndex={-1}
                className="resume-preview"
                src={`${resume.data.signed_url}#view=FitH`}
                title={`Résumé: ${resume.data.original_filename}`}
              />
            ) : (
              <img
                className="resume-preview"
                src={resume.data.signed_url}
                alt={`Résumé: ${resume.data.original_filename}`}
              />
            ))}
        </section>
        <section className="owner-documents-card">
          <div><p className="eyebrow">PRIVATE DOCUMENTS</p><h2>Uploaded evidence</h2><p>Only you and authorized moderation systems can access these files.</p></div>
          {documents.isLoading ? <p>Loading documents…</p> : documents.data?.length ? <div className="document-list">{documents.data.map((document) => <div className="document-row" key={document.id}><div><strong>{document.original_filename}</strong><small>{document.document_type.replaceAll("_", " ")} · {Math.ceil(document.file_size_bytes / 1024)} KB</small></div><button type="button" className="text-button danger-text" disabled={deleteDocument.isPending} onClick={() => { if (window.confirm(`Delete ${document.original_filename}? This cannot be undone.`)) deleteDocument.mutate(document.id); }}>Delete</button></div>)}</div> : <p>No documents uploaded.</p>}
          {deleteDocument.isError && <p className="field-error">{deleteDocument.error.message}</p>}
        </section>
        <section className="danger-zone"><div><p className="eyebrow">DANGER ZONE</p><h2>Delete account</h2><p>This permanently deletes your profile, reviews, private contacts, and uploaded files.</p></div><label><span className="label-text">Type your email to confirm <span className="required-mark" aria-hidden="true">*</span></span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={auth.email} /></label><button type="button" className="button danger-button" disabled={deleteAccount.isPending || deleteConfirmation.trim().toLowerCase() !== auth.email.toLowerCase()} onClick={() => { if (window.confirm("Permanently delete your MassLaidOff account and all associated data?")) deleteAccount.mutate(); }}>{deleteAccount.isPending ? "Deleting account…" : "Delete account permanently"}</button>{deleteAccount.isError && <p className="field-error">{deleteAccount.error.message}</p>}</section>
      </main>
    );
  return (
    <main className="workspace-page">
      <div className="workspace-heading compact profile-view-heading">
        <div>
          <p className="eyebrow">EDIT PROFILE</p>
          <h1>
            {profile.data ? "Update your profile." : "Build your profile."}
          </h1>
          <p>
            Private details and verification evidence stay separate from your
            searchable profile.
          </p>
        </div>
        {profile.data && (
          <AppLink to="/app/profile" className="button button-secondary">
            Back to profile
          </AppLink>
        )}
      </div>
      <form
        className="profile-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <section>
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2>Profile essentials</h2>
              <p>Tell hiring teams who you are and when you are available.</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Full name" required error={errors.fullName?.message}>
              <input {...register("fullName")} />
            </Field>
            <div className="profile-field">
              <Field label="LinkedIn URL" required error={errors.linkedinUrl?.message}>
                <input type="url" {...register("linkedinUrl")} />
              </Field>
              <LinkedInProfilePreview
                url={linkedinUrl}
                name={fullName}
                headline={[role, company].filter(Boolean).join(" at ")}
              />
            </div>
            <Field label="Current location" required error={errors.location?.message}>
              <input {...register("location")} />
            </Field>
            <Field label="Availability" required error={errors.availability?.message}>
              <input type="date" {...register("availability")} />
            </Field>
            <Field
              label="Years of experience"
              required
              error={errors.yearsExperience?.message}
            >
              <input
                type="number"
                min="0"
                max="60"
                {...register("yearsExperience")}
              />
            </Field>
          </div>
          <Field label="Short introduction" required error={errors.intro?.message}>
            <textarea rows={4} {...register("intro")} />
          </Field>
        </section>
        <section>
          <div className="form-section-heading">
            <span>02</span>
            <div>
              <h2>Latest employment and layoff</h2>
              <p>
                Record the company, exact organization, and final working date.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Company" required error={errors.company?.message}>
              <input {...register("company")} />
            </Field>
            <Field label="Role title" required error={errors.role?.message}>
              <input {...register("role")} />
            </Field>
            <Field label="Organization">
              <input {...register("orgName")} />
            </Field>
            <Field label="Team">
              <input {...register("teamName")} />
            </Field>
            <Field label="Start date">
              <input type="date" {...register("startedOn")} />
            </Field>
            <Field label="Last working date" error={errors.endedOn?.message}>
              <input type="date" {...register("endedOn")} />
            </Field>
          </div>
        </section>
        <section>
          <div className="form-section-heading">
            <span>03</span>
            <div>
              <h2>Documents and contact</h2>
              <p>
                Documents stay private. Your phone is shared only according to
                your visibility choice.
              </p>
            </div>
          </div>
          <div className="form-grid verification-grid">
            <FileField label="Résumé" type="resume" setFiles={setFiles} setFileErrors={setFileErrors} error={fileErrors.resume} />
            <FileField
              label="Exit or relieving letter"
              type="exit_letter"
              setFiles={setFiles}
              setFileErrors={setFileErrors}
              error={fileErrors.exit_letter}
            />
            <FileField
              label="Last salary slip"
              type="salary_slip"
              setFiles={setFiles}
              setFileErrors={setFileErrors}
              error={fileErrors.salary_slip}
            />
            <Field label="Phone number" required error={errors.phone?.message}>
              <input type="tel" autoComplete="tel" {...register("phone")} />
              <small className="field-help">
                Used only for approved recruiter contact. Never displayed in
                public search or manager reviews.
              </small>
            </Field>
          </div>
          {mutation.isPending && (
            <div
              className="upload-progress"
              aria-label={`Upload progress ${uploadProgress}%`}
            >
              <i style={{ width: `${uploadProgress}%` }} />
              <span>
                {uploadProgress
                  ? `Documents ${uploadProgress}% uploaded`
                  : "Saving profile data"}
              </span>
            </div>
          )}
        </section>
        <section>
          <div className="form-section-heading">
            <span>04</span>
            <div>
              <h2>Visibility</h2>
              <p>Choose how verified hiring teams can reach you.</p>
            </div>
          </div>
          <VisibilityChoice title="Contact details" field="contactVisibility" register={register} />
          <VisibilityChoice title="Résumé" field="resumeVisibility" register={register} />
          <label className="checkbox-label">
            <input type="checkbox" {...register("publicStatsConsent")} /> Include my company in anonymous public counts once at least three people from that company opt in. My name and documents are never shown there.
          </label>
          <label className="checkbox-label">
            <input type="checkbox" {...register("consent")} /> I understand what
            verified recruiters will see. <span className="required-mark" aria-hidden="true">*</span>
          </label>
          {errors.consent && (
            <p className="field-error">Confirm the visibility statement.</p>
          )}
        </section>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save profile"}
          </button>
        </div>
        {status && (
          <div
            className={mutation.isError ? "form-error" : "form-success"}
            role="status"
          >
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
function FileField({
  label,
  type,
  setFiles,
  setFileErrors,
  error,
}: {
  label: string;
  type: DocumentType;
  setFiles: React.Dispatch<
    React.SetStateAction<Partial<Record<DocumentType, File>>>
  >;
  setFileErrors: React.Dispatch<React.SetStateAction<Partial<Record<DocumentType, string>>>>;
  error?: string;
}) {
  return (
    <label>
      {label}
      <input
        type="file"
        accept={type === "resume" ? "application/pdf" : "application/pdf,image/jpeg,image/png"}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const allowed = type === "resume" ? ["application/pdf"] : ["application/pdf", "image/jpeg", "image/png"];
          if (!allowed.includes(file.type)) { setFileErrors((current) => ({ ...current, [type]: type === "resume" ? "Upload your résumé as a PDF." : "Use a PDF, JPEG, or PNG file." })); event.target.value = ""; return; }
          if (file.size > 10 * 1024 * 1024) { setFileErrors((current) => ({ ...current, [type]: "The file must be smaller than 10 MB." })); event.target.value = ""; return; }
          setFileErrors((current) => ({ ...current, [type]: "" }));
          setFiles((current) => ({ ...current, [type]: file }));
        }}
      />
      <small className="field-help">
        {type === "resume" ? "PDF" : "PDF, JPEG, or PNG"} up to 10 MB. Stored privately.
      </small>
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function VisibilityChoice({ title, field, register }: { title: string; field: "contactVisibility" | "resumeVisibility"; register: UseFormRegister<Values> }) {
  const options = [
    ["request_access", "Share after approval", "A recruiter sends a request and you decide."],
    ["verified_recruiters", "Visible to verified recruiters", "Verified hiring accounts can access it immediately."],
    ["hidden", "Hidden", "No recruiter can access it."],
  ] as const;
  return <fieldset className="visibility-fieldset"><legend>{title} <span className="required-mark" aria-hidden="true">*</span></legend><div className="visibility-options">{options.map(([value,label,description]) => <label className="visibility-option" key={value}><input type="radio" value={value} {...register(field)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></fieldset>;
}
