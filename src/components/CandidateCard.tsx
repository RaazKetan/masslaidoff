import { ArrowIcon } from "./core";
import { MagicCard } from "./magicui/magic-card";
import type { ContactMode } from "../lib/types";
import { AppLink } from "./core";

export type RecruiterCandidateCardData = {
  name: string;
  role: string;
  company: string;
  location: string;
  years: number;
  immediate: boolean;
  summary: string;
  verified: boolean;
  hasResume: boolean;
  contactMode: ContactMode;
  resumeMode: ContactMode;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl?: string | null;
  profileUrl?: string;
};

export function CandidateCard({
  person,
  preview = false,
}: {
  person: RecruiterCandidateCardData;
  preview?: boolean;
}) {
  const initials =
    person.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "ML";
  const resumeLabel = !person.hasResume
    ? null
    : person.resumeMode === "verified_recruiters"
      ? "Résumé available"
      : person.resumeMode === "request_access"
        ? "Résumé by request"
        : null;

  return (
    <MagicCard
      className={`candidate-card${preview ? " candidate-card-preview" : ""}`}
      gradientColor="#f1e4cf"
      gradientOpacity={0.35}
      gradientSize={180}
    >
      <div className="candidate-top">
        <span className="candidate-avatar">{initials.toUpperCase()}</span>
        {person.verified && (
          <span className="verified-label">✓ Verified record</span>
        )}
      </div>
      <h2>{person.name}</h2>
      <p className="candidate-role">{person.role}</p>
      <div className="candidate-meta">
        <span>{person.location}</span>
        <span>{person.years} years</span>
        <span>{person.immediate ? "Available now" : "Availability listed"}</span>
        {resumeLabel && <span>{resumeLabel}</span>}
      </div>
      <p className="candidate-intro">{person.summary}</p>
      <div className="candidate-card-foot">
        <span>Previously at {person.company}</span>
        {person.linkedinUrl && !preview && (
          <a href={person.linkedinUrl} target="_blank" rel="noreferrer">
            LinkedIn ↗
          </a>
        )}
        {person.profileUrl && !preview && <AppLink to={person.profileUrl}>View profile <ArrowIcon /></AppLink>}
        {person.contactEmail ? (
          <a href={`mailto:${person.contactEmail}`}>
            Email candidate <ArrowIcon />
          </a>
        ) : person.contactPhone ? (
          <a href={`tel:${person.contactPhone}`}>
            Call candidate <ArrowIcon />
          </a>
        ) : person.contactMode === "request_access" ? (
          <span>Contact by request</span>
        ) : (
          <span>Contact details hidden</span>
        )}
      </div>
    </MagicCard>
  );
}
