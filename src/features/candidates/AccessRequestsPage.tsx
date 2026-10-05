import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { StatePanel } from "../../components/core";

export function AccessRequestsPage() {
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ["access-requests"], queryFn: api.listAccessRequests });
  const [notice, setNotice] = useState("");
  const decision = useMutation({ mutationFn: ({ id, value }: { id: string; value: "accepted" | "declined"; name: string }) => api.decideAccessRequest(id, value), onSuccess: (_data, { value, name }) => { setNotice(value === "accepted" ? `Access shared with ${name} for 30 days.` : `Request from ${name} declined.`); void queryClient.invalidateQueries({ queryKey: ["access-requests"] }); } });
  return <main className="workspace-page"><div className="workspace-heading compact"><p className="eyebrow">YOUR CONTROL</p><h1>Access requests.</h1><p>Only verified hiring teams can ask. Accepting shares the contact details and résumé you marked “Share after approval” for 30 days.</p></div>
    {requests.isLoading ? <StatePanel kind="loading" title="Loading requests" message="Checking for new hiring conversations." /> : requests.isError ? <StatePanel kind="error" title="Requests unavailable" message={requests.error.message} /> : !requests.data?.length ? <StatePanel kind="empty" title="No requests yet" message="When a hiring team asks to reach you, their message will appear here." /> : <div className="request-list">{requests.data.map((item) => <article className="detail-panel" key={item.id}><p className="eyebrow">VERIFIED HIRING TEAM</p><h2>{item.recruiter_name}</h2><p>{item.recruiter_title} at {item.recruiter_company}</p><blockquote>{item.message}</blockquote><div className="detail-actions"><button className="button button-primary" type="button" disabled={decision.isPending} onClick={() => decision.mutate({ id: item.id, value: "accepted", name: item.recruiter_name })}>Approve access</button><button className="button button-secondary" type="button" disabled={decision.isPending} onClick={() => decision.mutate({ id: item.id, value: "declined", name: item.recruiter_name })}>Decline</button></div></article>)}</div>}
    {notice && <div className="form-success" role="status">{notice}</div>}
    {decision.isError && <p className="field-error">{decision.error.message}</p>}
  </main>;
}
