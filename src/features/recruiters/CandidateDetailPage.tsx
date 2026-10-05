import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { AppLink, ArrowIcon, LinkedInProfilePreview, StatePanel } from "../../components/core";

export function CandidateDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [attempted, setAttempted] = useState(false);
  const tooShort = message.trim().length < 20;
  const candidate = useQuery({ queryKey: ["recruiter-candidate", id], queryFn: () => api.getRecruiterCandidate(id), enabled: Boolean(id) });
  // ponytail: refetch before the 5-minute signed URL expires
  const resume = useQuery({ queryKey: ["recruiter-resume", id], queryFn: () => api.getRecruiterResume(id), enabled: Boolean(candidate.data?.has_resume && candidate.data?.resume_access), retry: false, staleTime: 4 * 60_000, refetchInterval: 4 * 60_000 });
  const request = useMutation({ mutationFn: () => api.requestCandidateAccess(id, message), onSuccess: () => { setMessage(""); setAttempted(false); void queryClient.invalidateQueries({ queryKey: ["recruiter-candidate", id] }); void queryClient.invalidateQueries({ queryKey: ["my-outreach"] }); } });
  if (candidate.isLoading) return <main className="workspace-page"><StatePanel kind="loading" title="Loading profile" message="Checking your verified recruiter access." /></main>;
  if (candidate.isError || !candidate.data) return <main className="workspace-page"><StatePanel kind="error" title="Profile unavailable" message={candidate.error?.message || "This profile could not be found."} action={<AppLink to="/app/discover" className="button">Back to talent</AppLink>} /></main>;
  const person = candidate.data;
  const canRequest = person.contact_visibility === "request_access" || person.resume_visibility === "request_access";
  const pending = person.request_status === "pending";
  const resumeOpen = person.has_resume && person.resume_access;
  return <main className="workspace-page candidate-detail-page">
    <AppLink to="/app/discover" className="detail-back">← Back to talent</AppLink>
    <div className="workspace-heading compact detail-heading"><div><p className="eyebrow">VERIFIED RECRUITER VIEW</p><h1>{person.full_name}</h1><p>{person.headline} · {person.location}</p></div></div>
    <div className="detail-columns">
      <section className="detail-panel"><h2>Professional record</h2><p className="detail-summary">{person.summary}</p><dl><div><dt>Experience</dt><dd>{person.years_experience} years</dd></div><div><dt>Availability</dt><dd>{person.available_now ? "Available now" : person.available_from ? `From ${new Date(`${person.available_from.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "Not listed"}</dd></div><div><dt>Latest company</dt><dd>{person.company || "Not listed"}</dd></div><div><dt>Role</dt><dd>{person.role_title || person.headline}</dd></div></dl>{person.linkedin_url && <div className="detail-linkedin"><LinkedInProfilePreview url={person.linkedin_url} name={person.full_name} headline={[person.role_title || person.headline, person.company].filter(Boolean).join(" at ")} /></div>}</section>
      <section className="detail-panel"><h2>Contact and résumé</h2><p>These details follow the candidate’s saved visibility choices.</p>
        {person.contact_email || person.contact_phone ? <div className="detail-actions">{person.contact_email && <a href={`mailto:${person.contact_email}`} className="button button-primary">Email candidate <ArrowIcon /></a>}{person.contact_phone && <a href={`tel:${person.contact_phone}`} className="button button-secondary">Call candidate</a>}</div> : <p className="visibility-note">{person.contact_visibility === "hidden" ? "Contact details are hidden." : "Contact details require the candidate’s approval."}</p>}
        {resumeOpen ? <div className="detail-actions">{resume.data ? <a href={resume.data.signed_url} target="_blank" rel="noreferrer" className="button button-primary">Open résumé in new tab <ArrowIcon /></a> : <span className="visibility-note">{resume.isError ? resume.error.message : "Preparing résumé…"}</span>}</div> : <p className="visibility-note">{!person.has_resume ? "No résumé uploaded." : person.resume_visibility === "hidden" ? "Résumé is hidden." : "Résumé requires the candidate’s approval."}</p>}
        {canRequest && !pending && !(person.contact_email && (!person.has_resume || person.resume_access)) && <form className="access-request-form" onSubmit={(event) => { event.preventDefault(); setAttempted(true); if (!tooShort) request.mutate(); }}><label htmlFor="access-message">Ask for access</label><p>Introduce yourself and explain the opportunity. The candidate can accept or decline.</p><textarea id="access-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={20} maxLength={2000} required rows={4} placeholder="Hi, I’m hiring for a role that matches your experience…" /><small className={`field-help${tooShort && attempted ? " field-error" : ""}`} aria-live="polite">{message.trim().length < 20 ? `At least 20 characters (${message.trim().length}/20)` : `${message.trim().length}/2000`}</small><button type="submit" className="button button-primary" disabled={request.isPending}>{request.isPending ? "Sending…" : "Send request"}</button></form>}
        {pending && <p className="visibility-note">Your request is waiting for the candidate’s decision.</p>}
        {request.isError && <p className="field-error">{request.error.message}</p>}
      </section>
    </div>
    {resumeOpen && resume.data && <section className="detail-panel detail-resume"><h2>Résumé</h2>{resume.data.mime_type === "application/pdf" ? <iframe loading="lazy" tabIndex={-1} className="resume-preview" src={`${resume.data.signed_url}#view=FitH`} title={`Résumé: ${resume.data.original_filename}`} /> : <img className="resume-preview" src={resume.data.signed_url} alt={`Résumé: ${resume.data.original_filename}`} />}</section>}
  </main>;
}
