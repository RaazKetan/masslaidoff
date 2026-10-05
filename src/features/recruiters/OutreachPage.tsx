import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { AppLink, ArrowIcon, StatePanel } from "../../components/core";

const statusLabel = { pending: "Waiting for reply", accepted: "Access granted", declined: "Declined", expired: "Expired" } as const;

export function OutreachPage() {
  const outreach = useQuery({ queryKey: ["my-outreach"], queryFn: api.listMyOutreach });
  return (
    <main className="workspace-page">
      <div className="workspace-heading compact">
        <p className="eyebrow">YOUR OUTREACH</p>
        <h1>Reached out.</h1>
        <p>Candidates you asked for access, and where each conversation stands.</p>
      </div>
      {outreach.isLoading ? (
        <StatePanel kind="loading" title="Loading outreach" message="Fetching your requests." />
      ) : outreach.isError ? (
        <StatePanel kind="error" title="Outreach unavailable" message={outreach.error.message} />
      ) : !outreach.data?.length ? (
        <StatePanel
          kind="empty"
          title="No outreach yet"
          message="Open a candidate profile in Discover and send an access request."
          action={<AppLink to="/app/discover" className="button button-primary">Discover talent</AppLink>}
        />
      ) : (
        <div className="outreach-list">
          {outreach.data.map((item) => (
            <AppLink key={item.id} to={`/app/discover/${item.candidate_id}`} className="outreach-row">
              <div>
                <strong>{item.candidate_name}</strong>
                <small>{item.headline}</small>
              </div>
              <span className={`outreach-status status-${item.status}`}>{statusLabel[item.status]}</span>
              <small className="outreach-date">
                {new Date(item.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </small>
              <ArrowIcon />
            </AppLink>
          ))}
        </div>
      )}
    </main>
  );
}
