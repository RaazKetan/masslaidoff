package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) VerifiedRecruiter(ctx context.Context, actor Actor) error {
	if actor.AccountType != "recruiter" {
		return ErrForbidden
	}
	var verified bool
	err := s.db.QueryRow(ctx, `select rp.verified_at is not null and pc.company_email_verified_at is not null
		from public.recruiter_profiles rp join public.private_contacts pc on pc.user_id=rp.user_id
		where rp.user_id=$1`, actor.ID).Scan(&verified)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrRecruiterUnverified
		}
		return err
	}
	if !verified {
		return ErrRecruiterUnverified
	}
	return nil
}

func (s *Store) RecruiterCandidate(ctx context.Context, actor Actor, candidateID string) (map[string]any, error) {
	if err := s.VerifiedRecruiter(ctx, actor); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `select cp.id::text as id,ua.full_name,ua.linkedin_url,cp.headline,cp.summary,cp.location,
		cp.years_experience,cp.available_from::text as available_from,(cp.available_from is null or cp.available_from<=current_date) as available_now,
		e.company,e.role_title,e.org_name,e.team_name,e.started_on::text as started_on,e.ended_on::text as ended_on,
		cp.contact_visibility::text,cp.resume_visibility::text,
		exists(select 1 from public.candidate_documents d where d.candidate_id=cp.id and d.document_type='resume' and d.deleted_at is null) as has_resume,
		case when cp.contact_visibility='verified_recruiters' or (cp.contact_visibility='request_access' and g.id is not null) then pc.personal_email::text end as contact_email,
		case when cp.contact_visibility='verified_recruiters' or (cp.contact_visibility='request_access' and g.id is not null) then pc.phone_number end as contact_phone,
		(cp.resume_visibility='verified_recruiters' or (cp.resume_visibility='request_access' and g.id is not null)) as resume_access,
		cr.status::text as request_status
		from public.candidate_profiles cp
		join public.user_accounts ua on ua.id=cp.user_id
		left join public.private_contacts pc on pc.user_id=cp.user_id
		left join lateral (select * from public.employments where candidate_id=cp.id and is_latest=true limit 1) e on true
		left join lateral (select id from public.contact_grants where candidate_id=cp.id and recruiter_id=$2 and revoked_at is null and (expires_at is null or expires_at>now()) order by created_at desc limit 1) g on true
		left join lateral (select status from public.contact_requests where candidate_id=cp.id and recruiter_id=$2 order by created_at desc limit 1) cr on true
		where cp.id=$1 and cp.visibility='published'`, candidateID, actor.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	data, err := pgx.CollectOneRow(rows, pgx.RowToMap)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return data, err
}

func (s *Store) RecruiterResume(ctx context.Context, actor Actor, candidateID string) (DocumentRecord, error) {
	profile, err := s.RecruiterCandidate(ctx, actor, candidateID)
	if err != nil {
		return DocumentRecord{}, err
	}
	if profile["resume_access"] != true {
		return DocumentRecord{}, ErrForbidden
	}
	var doc DocumentRecord
	err = s.db.QueryRow(ctx, `select id,storage_path,original_filename,mime_type,file_size_bytes,uploaded_at
		from public.candidate_documents where candidate_id=$1 and document_type='resume' and deleted_at is null
		order by uploaded_at desc limit 1`, candidateID).Scan(&doc.ID, &doc.StoragePath, &doc.OriginalFilename, &doc.MimeType, &doc.FileSizeBytes, &doc.UploadedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return DocumentRecord{}, ErrNotFound
	}
	return doc, err
}

func (s *Store) RequestCandidateAccess(ctx context.Context, actor Actor, candidateID, message string) (map[string]any, error) {
	profile, err := s.RecruiterCandidate(ctx, actor, candidateID)
	if err != nil {
		return nil, err
	}
	if profile["contact_visibility"] != "request_access" && profile["resume_visibility"] != "request_access" {
		return nil, ErrForbidden
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `update public.contact_requests set status='expired',updated_at=now() where recruiter_id=$1 and candidate_id=$2 and status='pending' and expires_at<=now()`, actor.ID, candidateID); err != nil {
		return nil, err
	}
	var recentlyDeclined bool
	if err := tx.QueryRow(ctx, `select exists(select 1 from public.contact_requests where recruiter_id=$1 and candidate_id=$2
		and status='declined' and coalesce(responded_at,updated_at)>now()-interval '30 days')`, actor.ID, candidateID).Scan(&recentlyDeclined); err != nil {
		return nil, err
	}
	if recentlyDeclined {
		return nil, ErrRateLimited
	}
	var id string
	err = tx.QueryRow(ctx, `insert into public.contact_requests(recruiter_id,candidate_id,message,expires_at)
		values($1,$2,$3,now()+interval '30 days')
		on conflict do nothing returning id`, actor.ID, candidateID, message).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRateLimited
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "status": "pending"}, nil
}

// RecruiterAccessRequests lists the candidates this recruiter has reached out
// to, newest first, with the current state of each request.
func (s *Store) RecruiterAccessRequests(ctx context.Context, actor Actor) ([]map[string]any, error) {
	if actor.AccountType != "recruiter" {
		return nil, ErrForbidden
	}
	rows, err := s.db.Query(ctx, `select cr.id::text as id, cp.id::text as candidate_id, ua.full_name as candidate_name,
		cp.headline, cr.message, cr.created_at, cr.responded_at,
		case when cr.status='pending' and cr.expires_at<=now() then 'expired' else cr.status::text end as status
		from public.contact_requests cr
		join public.candidate_profiles cp on cp.id=cr.candidate_id
		join public.user_accounts ua on ua.id=cp.user_id
		where cr.recruiter_id=$1
		order by cr.created_at desc limit 100`, actor.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, pgx.RowToMap)
}

func (s *Store) CandidateAccessRequests(ctx context.Context, actor Actor) ([]map[string]any, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	rows, err := s.db.Query(ctx, `select cr.id::text as id,cr.message,cr.created_at,cr.expires_at,cr.status::text,
		ua.full_name as recruiter_name,rp.company as recruiter_company,rp.title as recruiter_title
		from public.contact_requests cr
		join public.candidate_profiles cp on cp.id=cr.candidate_id
		join public.user_accounts ua on ua.id=cr.recruiter_id
		join public.recruiter_profiles rp on rp.user_id=cr.recruiter_id
		where cp.user_id=$1 and cr.status='pending' and cr.expires_at>now()
		order by cr.created_at desc limit 50`, actor.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, pgx.RowToMap)
}

func (s *Store) DecideAccessRequest(ctx context.Context, actor Actor, requestID, decision string) error {
	if actor.AccountType != "candidate" || (decision != "accepted" && decision != "declined") {
		return ErrForbidden
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var candidateID, recruiterID string
	err = tx.QueryRow(ctx, `update public.contact_requests cr set status=$3::public.contact_req_status,responded_at=now(),updated_at=now()
		from public.candidate_profiles cp
		where cr.id=$1 and cr.candidate_id=cp.id and cp.user_id=$2 and cr.status='pending' and cr.expires_at>now()
		returning cr.candidate_id,cr.recruiter_id`, requestID, actor.ID, decision).Scan(&candidateID, &recruiterID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if decision == "accepted" {
		if _, err = tx.Exec(ctx, `update public.contact_grants set revoked_at=now() where candidate_id=$1 and recruiter_id=$2 and revoked_at is null`, candidateID, recruiterID); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `insert into public.contact_grants(contact_request_id,candidate_id,recruiter_id,granted_fields,expires_at)
			values($1,$2,$3,array['contact','resume'],now()+interval '30 days')`, requestID, candidateID, recruiterID)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// DailyCandidateViewLimit caps how many distinct candidate profiles one
// recruiter can open per 24 hours, limiting bulk contact harvesting.
const DailyCandidateViewLimit = 100

// RecordCandidateView logs a recruiter opening a candidate profile and enforces
// the daily cap. Re-opening a profile already viewed in the window is free.
func (s *Store) RecordCandidateView(ctx context.Context, actor Actor, candidateID string) error {
	if err := s.VerifiedRecruiter(ctx, actor); err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Serialize per recruiter so concurrent requests cannot overshoot the cap.
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(hashtext('candidate_views:' || $1::text))`, actor.ID); err != nil {
		return err
	}
	var seen bool
	var distinct int
	if err := tx.QueryRow(ctx, `select coalesce(bool_or(candidate_id=$2),false), count(distinct candidate_id)::int
		from public.candidate_views where recruiter_id=$1 and viewed_at>now()-interval '24 hours'`, actor.ID, candidateID).Scan(&seen, &distinct); err != nil {
		return err
	}
	if !seen && distinct >= DailyCandidateViewLimit {
		return ErrViewLimit
	}
	if _, err := tx.Exec(ctx, `insert into public.candidate_views(candidate_id,recruiter_id,access_context)
		select id,$2,'profile' from public.candidate_profiles where id=$1 and visibility='published'`, candidateID, actor.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
