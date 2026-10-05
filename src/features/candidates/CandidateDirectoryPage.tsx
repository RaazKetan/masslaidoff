import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, APIError } from "../../lib/api";
import { isSupabaseConfigured } from "../../lib/supabase";
import { AppLink, StatePanel } from "../../components/core";
import { CandidateCard } from "../../components/CandidateCard";

export function CandidateDirectoryPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const candidates = useQuery({
    queryKey: ["candidates", search],
    queryFn: () => api.listCandidates(search, "All"),
    enabled: isSupabaseConfigured,
    placeholderData: keepPreviousData,
  });
  const filtered = candidates.data || [];
  return (
    <main className="workspace-page">
      <div className="workspace-heading">
        <p className="eyebrow">PUBLISHED TALENT RECORDS</p>
        <h1>
          Find people ready for
          <br />
          the right next role.
        </h1>
        <p>
          Search profiles published by professionals who control how and when
          hiring teams can contact them.
        </p>
      </div>
      {!isSupabaseConfigured ? (
        <StatePanel
          kind="locked"
          title="Connect Supabase to search talent"
          message="The production directory reads only published candidate records from the protected database view."
        />
      ) : candidates.error instanceof APIError &&
        candidates.error.status === 403 ? (
        // Recruiter routes are role-gated, so a 403 here means the recruiter is not verified yet.
        <StatePanel
          kind="locked"
          title="Verify your hiring profile to search talent"
          message="Complete your hiring profile and verify your company email before browsing candidates."
          action={
            <AppLink to="/app/profile" className="button button-primary">
              Verify hiring profile
            </AppLink>
          }
        />
      ) : (
        <>
          <div className="directory-toolbar">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, role, company or experience"
              aria-label="Search talent"
            />
          </div>
          {candidates.isLoading ? (
            <StatePanel
              kind="loading"
              title="Loading talent"
              message="Reading published candidate records."
            />
          ) : candidates.isError ? (
            <StatePanel
              kind="error"
              title="Talent could not be loaded"
              message={candidates.error.message}
              action={
                <button
                  className="button"
                  onClick={() => void candidates.refetch()}
                >
                  Try again
                </button>
              }
            />
          ) : (
            <>
              <div className="results-heading">
                <strong>{filtered.length} people</strong>
                <span>published for verified hiring conversations</span>
              </div>
              {filtered.length ? (
                <div className="candidate-grid">
                  {filtered.map((person) => (
                    <CandidateCard key={person.id} person={person} />
                  ))}
                </div>
              ) : (
                <StatePanel
                  kind="empty"
                  title="No matching profiles"
                  message="Try a broader search."
                />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
