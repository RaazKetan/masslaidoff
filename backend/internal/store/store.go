package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")
var ErrInvalidVerificationToken = errors.New("invalid verification token")
var ErrProfileRequired = errors.New("profile required")
var ErrRateLimited = errors.New("rate limited")
var ErrEmploymentEvidenceRequired = errors.New("employment evidence required")
var ErrEmploymentMismatch = errors.New("employment mismatch")
var ErrEmailInUse = errors.New("email already verified by another account")
var ErrViewLimit = errors.New("daily candidate view limit reached")
var ErrRecruiterUnverified = errors.New("recruiter not verified")

type Store struct{ db *pgxpool.Pool }

func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 12
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}
func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

func (s *Store) Onboard(ctx context.Context, userID, email, accountType, fullName string) (Actor, error) {
	if accountType != "candidate" && accountType != "recruiter" {
		return Actor{}, ErrForbidden
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Actor{}, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `insert into public.user_accounts(id,account_type,full_name) values($1,$2::public.account_type,$3) on conflict(id) do nothing`, userID, accountType, fullName); err != nil {
		return Actor{}, err
	}
	if _, err = tx.Exec(ctx, `insert into public.private_contacts(user_id,personal_email,company_email) values($1,case when $2='candidate' then $3::citext end,case when $2='recruiter' then $3::citext end) on conflict(user_id) do nothing`, userID, accountType, email); err != nil {
		return Actor{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Actor{}, err
	}
	return s.Actor(ctx, userID, email)
}

func (s *Store) Actor(ctx context.Context, userID, email string) (Actor, error) {
	var actor Actor
	err := s.db.QueryRow(ctx, `select ua.id, $2, ua.account_type::text, ua.full_name,
    coalesce(pc.company_email_verified_at is not null, false)
    from public.user_accounts ua left join public.private_contacts pc on pc.user_id=ua.id where ua.id=$1`, userID, email).
		Scan(&actor.ID, &actor.Email, &actor.AccountType, &actor.FullName, &actor.CompanyEmailVerified)
	if errors.Is(err, pgx.ErrNoRows) {
		return Actor{}, ErrNotFound
	}
	return actor, err
}

func (s *Store) Me(ctx context.Context, actor Actor) (map[string]any, error) {
	var linkedin *string
	var companyEmail *string
	err := s.db.QueryRow(ctx, `select ua.linkedin_url, pc.company_email from public.user_accounts ua left join public.private_contacts pc on pc.user_id=ua.id where ua.id=$1`, actor.ID).Scan(&linkedin, &companyEmail)
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": actor.ID, "email": actor.Email, "account_type": actor.AccountType, "full_name": actor.FullName, "linkedin_url": linkedin, "company_email": companyEmail, "company_email_verified": actor.CompanyEmailVerified}, nil
}

func (s *Store) CandidateProfile(ctx context.Context, actor Actor) (map[string]any, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	rows, err := s.db.Query(ctx, `select cp.id::text as id, cp.headline, cp.location, cp.years_experience, cp.summary, cp.available_from::text as available_from,
	(cp.available_from is null or cp.available_from <= current_date) as available_now,
	cp.contact_visibility::text, cp.resume_visibility::text, e.company, e.role_title, e.org_name, e.team_name, e.started_on::text as started_on, e.ended_on::text as ended_on,
	cp.verification_status::text, pc.phone_number,
	coalesce((select lr.public_stats_consent from public.layoff_records lr where lr.candidate_id=cp.id order by lr.created_at desc limit 1),false) as public_stats_consent,
	exists(select 1 from public.candidate_documents d where d.candidate_id=cp.id and d.document_type='resume' and d.deleted_at is null) as has_resume
	from public.candidate_profiles cp
	left join lateral (select * from public.employments where candidate_id=cp.id and is_latest=true limit 1) e on true
	left join public.private_contacts pc on pc.user_id=cp.user_id
	where cp.user_id=$1`, actor.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result, err := pgx.CollectOneRow(rows, pgx.RowToMap)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return result, err
}

func (s *Store) SaveCandidate(ctx context.Context, actor Actor, in CandidateInput) (map[string]any, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var oldContactMode, oldResumeMode string
	oldErr := tx.QueryRow(ctx, `select contact_visibility::text,resume_visibility::text from public.candidate_profiles where user_id=$1`, actor.ID).Scan(&oldContactMode, &oldResumeMode)
	if oldErr != nil && !errors.Is(oldErr, pgx.ErrNoRows) {
		return nil, oldErr
	}
	_, err = tx.Exec(ctx, `update public.user_accounts set full_name=$2, linkedin_url=nullif($3,''), updated_at=now() where id=$1`, actor.ID, in.FullName, in.LinkedInURL)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `insert into public.private_contacts(user_id,personal_email,phone_number)
	values($1,$2::citext,nullif($3,''))
	on conflict(user_id) do update set personal_email=coalesce(private_contacts.personal_email,excluded.personal_email),
	phone_number=excluded.phone_number`, actor.ID, actor.Email, in.Phone)
	if err != nil {
		return nil, err
	}
	var candidateID string
	err = tx.QueryRow(ctx, `insert into public.candidate_profiles(user_id,full_name,headline,location,years_experience,summary,skills,open_to_remote,available_from,contact_visibility,resume_visibility,visibility,published_at)
	values($1,$2,$3,$4,$5,$6,'{}',false,nullif($7,'')::date,$8::public.contact_mode,$9::public.contact_mode,'published',now())
	on conflict(user_id) do update set full_name=excluded.full_name,headline=excluded.headline,location=excluded.location,years_experience=excluded.years_experience,summary=excluded.summary,available_from=excluded.available_from,contact_visibility=excluded.contact_visibility,resume_visibility=excluded.resume_visibility,visibility='published',published_at=coalesce(candidate_profiles.published_at,now()),updated_at=now() returning id`, actor.ID, in.FullName, in.Role, in.Location, in.YearsExperience, in.Intro, in.Availability, in.ContactVisibility, in.ResumeVisibility).Scan(&candidateID)
	if err != nil {
		return nil, err
	}
	if oldErr == nil && (oldContactMode != in.ContactVisibility || oldResumeMode != in.ResumeVisibility) {
		if _, err := tx.Exec(ctx, `update public.contact_grants set revoked_at=now() where candidate_id=$1 and revoked_at is null`, candidateID); err != nil {
			return nil, err
		}
	}
	var employmentID string
	err = tx.QueryRow(ctx, `select id from public.employments where candidate_id=$1 and is_latest=true limit 1`, candidateID).Scan(&employmentID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `insert into public.employments(candidate_id,company,role_title,org_name,team_name,started_on,ended_on,is_latest) values($1,$2,$3,nullif($4,''),nullif($5,''),nullif($6,'')::date,nullif($7,'')::date,true) returning id`, candidateID, in.Company, in.Role, in.OrgName, in.TeamName, in.StartedOn, in.EndedOn).Scan(&employmentID)
	} else if err == nil {
		_, err = tx.Exec(ctx, `update public.employments set company=$2,role_title=$3,org_name=nullif($4,''),team_name=nullif($5,''),started_on=nullif($6,'')::date,ended_on=nullif($7,'')::date where id=$1`, employmentID, in.Company, in.Role, in.OrgName, in.TeamName, in.StartedOn, in.EndedOn)
	}
	if err != nil {
		return nil, err
	}
	var layoffID string
	err = tx.QueryRow(ctx, `select id from public.layoff_records where candidate_id=$1 order by created_at desc limit 1`, candidateID).Scan(&layoffID)
	if errors.Is(err, pgx.ErrNoRows) {
		_, err = tx.Exec(ctx, `insert into public.layoff_records(candidate_id,employment_id,last_working_date,public_stats_consent) values($1,$2,nullif($3,'')::date,$4)`, candidateID, employmentID, in.EndedOn, in.PublicStatsConsent)
	} else if err == nil {
		_, err = tx.Exec(ctx, `update public.layoff_records set employment_id=$2,last_working_date=nullif($3,'')::date,public_stats_consent=$4,updated_at=now() where id=$1`, layoffID, employmentID, in.EndedOn, in.PublicStatsConsent)
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"id": candidateID, "employment_id": employmentID}, nil
}

func (s *Store) RecruiterProfile(ctx context.Context, actor Actor) (map[string]any, error) {
	if actor.AccountType != "recruiter" {
		return nil, ErrForbidden
	}
	rows, err := s.db.Query(ctx, `select company,title,work_email,linkedin_url,verification_status::text,verified_at from public.recruiter_profiles where user_id=$1`, actor.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result, err := pgx.CollectOneRow(rows, pgx.RowToMap)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return result, err
}

func (s *Store) SaveRecruiter(ctx context.Context, actor Actor, in RecruiterInput) (map[string]any, error) {
	if actor.AccountType != "recruiter" {
		return nil, ErrForbidden
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var previousEmail *string
	previousErr := tx.QueryRow(ctx, `select work_email::text from public.recruiter_profiles where user_id=$1`, actor.ID).Scan(&previousEmail)
	if previousErr != nil && !errors.Is(previousErr, pgx.ErrNoRows) {
		return nil, previousErr
	}
	_, err = tx.Exec(ctx, `update public.user_accounts set full_name=$2,linkedin_url=nullif($3,''),updated_at=now() where id=$1`, actor.ID, in.FullName, in.LinkedInURL)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `insert into public.private_contacts(user_id,company_email) values($1,$2::citext) on conflict(user_id) do update set company_email=excluded.company_email,company_email_verified_at=case when private_contacts.company_email=excluded.company_email then private_contacts.company_email_verified_at else null end`, actor.ID, in.WorkEmail)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `insert into public.recruiter_profiles(user_id,full_name,company,title,work_email,linkedin_url) values($1,$2,$3,$4,$5,$6)
	on conflict(user_id) do update set full_name=excluded.full_name,company=excluded.company,title=excluded.title,
	work_email=excluded.work_email,linkedin_url=excluded.linkedin_url,
	verified_at=case when recruiter_profiles.work_email::citext=excluded.work_email::citext then recruiter_profiles.verified_at else null end,
	verification_status=case when recruiter_profiles.work_email::citext=excluded.work_email::citext then recruiter_profiles.verification_status else 'unverified'::public.verification_status end
	returning user_id`, actor.ID, in.FullName, in.Company, in.JobTitle, in.WorkEmail, in.LinkedInURL)
	if err != nil {
		return nil, err
	}
	if previousEmail != nil && !strings.EqualFold(*previousEmail, in.WorkEmail) {
		if _, err := tx.Exec(ctx, `update public.contact_grants set revoked_at=now() where recruiter_id=$1 and revoked_at is null`, actor.ID); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"user_id": actor.ID}, nil
}

func (s *Store) SearchCandidates(ctx context.Context, actor Actor, query, discipline string, limit int) ([]map[string]any, error) {
	if err := s.VerifiedRecruiter(ctx, actor); err != nil {
		return nil, err
	}
	pattern := "%" + strings.TrimSpace(query) + "%"
	rows, err := s.db.Query(ctx, `select candidate_directory.id::text as id,full_name,headline,discipline,location,years_experience,short_intro,available_from::text as available_from,
	(available_from is null or available_from <= current_date) as available_now,open_to_remote,
	verification_status::text,latest_company,previous_role,latest_period,
	contact_visibility::text,resume_visibility::text,layoff_category::text,
	exists(select 1 from public.candidate_documents d where d.candidate_id=candidate_directory.id and d.document_type='resume' and d.deleted_at is null) as has_resume,
	(select ua.linkedin_url from public.user_accounts ua where ua.id=candidate_directory.user_id) as linkedin_url
	from public.candidate_directory
	where ($1='' or full_name ilike $2 or headline ilike $2 or latest_company ilike $2) and ($3='' or $3='All' or discipline=$3) order by published_at desc limit $4`, query, pattern, discipline, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, pgx.RowToMap)
}

// PublicLayoffStats includes only published profiles with explicit statistics
// consent. Small company cohorts are suppressed before leaving the database.
func (s *Store) PublicLayoffStats(ctx context.Context) (map[string]any, error) {
	rows, err := s.db.Query(ctx, `with cohorts as (
		select lower(trim(e.company)) as company_key, min(trim(e.company)) as company_name, count(*)::int as people
		from public.candidate_profiles cp
		join lateral (select company from public.employments where candidate_id=cp.id and is_latest=true limit 1) e on true
		join lateral (select public_stats_consent from public.layoff_records where candidate_id=cp.id order by created_at desc limit 1) lr on true
		where cp.visibility='published' and lr.public_stats_consent=true and nullif(trim(e.company),'') is not null
		and (exists(select 1 from public.private_contacts pc where pc.user_id=cp.user_id and pc.company_email_verified_at is not null)
			or exists(select 1 from public.candidate_documents d where d.candidate_id=cp.id and d.document_type in ('exit_letter','salary_slip') and d.deleted_at is null))
		group by lower(trim(e.company))
		having count(*) >= 3
	) select company_name, people from cohorts order by people desc, company_name asc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	companies := make([]map[string]any, 0)
	total := 0
	companyCount := 0
	for rows.Next() {
		var name string
		var count int
		if err := rows.Scan(&name, &count); err != nil {
			return nil, err
		}
		total += count
		companyCount++
		if len(companies) < 20 {
			companies = append(companies, map[string]any{"company": name, "people": count})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return map[string]any{"people_represented": total, "companies_represented": companyCount, "companies": companies, "minimum_cohort": 3}, nil
}

func (s *Store) Reviews(ctx context.Context, actor Actor, query string, limit int) ([]Review, error) {
	if !actor.CompanyEmailVerified {
		return nil, ErrForbidden
	}
	pattern := "%" + strings.TrimSpace(query) + "%"
	rows, err := s.db.Query(ctx, `select mr.id,mr.manager_name,coalesce(c.name,mr.company),mr.relationship,mr.rating,mr.leadership_rating,mr.communication_rating,mr.fairness_rating,mr.career_growth_rating,coalesce(mr.review_title,''),mr.review,mr.published_at from public.manager_reviews mr left join public.employments e on e.id=mr.employment_id left join public.companies c on c.id=e.company_id where mr.status='published' and ($1='' or mr.manager_name ilike $2 or coalesce(c.name,mr.company) ilike $2 or mr.review ilike $2) order by mr.published_at desc limit $3`, query, pattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Review
	for rows.Next() {
		var r Review
		if err := rows.Scan(&r.ID, &r.ManagerName, &r.CompanyName, &r.Relationship, &r.Rating, &r.LeadershipRating, &r.CommunicationRating, &r.FairnessRating, &r.CareerGrowthRating, &r.ReviewTitle, &r.ReviewBody, &r.PublishedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) SubmitReview(ctx context.Context, actor Actor, in ReviewInput) (map[string]any, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	var employmentID string
	err := s.db.QueryRow(ctx, `select e.id from public.employments e
	join public.candidate_profiles cp on cp.id=e.candidate_id
	where cp.user_id=$1 and e.is_latest=true and lower(trim(e.company))=lower(trim($2))
	limit 1`, actor.ID, in.Company).Scan(&employmentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEmploymentMismatch
	}
	if err != nil {
		return nil, err
	}
	if err := s.requireEvidence(ctx, actor); err != nil {
		return nil, err
	}
	average := CalculateOverallRating(in.LeadershipRating, in.CommunicationRating, in.FairnessRating, in.CareerGrowthRating)
	var id string
	err = s.db.QueryRow(ctx, `insert into public.manager_reviews(author_id,employment_id,manager_name,manager_linkedin_url,company,relationship,rating,leadership_rating,communication_rating,fairness_rating,career_growth_rating,review_title,review,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending') returning id`, actor.ID, employmentID, in.ManagerName, in.ManagerLinkedInURL, in.Company, in.Relationship, average, in.LeadershipRating, in.CommunicationRating, in.FairnessRating, in.CareerGrowthRating, in.ReviewTitle, in.ReviewBody).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("submit review: %w", err)
	}
	return map[string]any{"id": id, "status": "pending", "rating": average}, nil
}

func (s *Store) requireEvidence(ctx context.Context, actor Actor) error {
	var evidenceExists bool
	if err := s.db.QueryRow(ctx, `select exists(select 1 from public.candidate_documents
		where candidate_id=(select id from public.candidate_profiles where user_id=$1)
		and document_type in ('exit_letter','salary_slip') and deleted_at is null)`, actor.ID).Scan(&evidenceExists); err != nil {
		return err
	}
	if !evidenceExists {
		return ErrEmploymentEvidenceRequired
	}
	return nil
}

func (s *Store) CandidateReviews(ctx context.Context, actor Actor) ([]Review, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	rows, err := s.db.Query(ctx, `select id::text,manager_name,manager_linkedin_url,company,relationship,rating,
		leadership_rating,communication_rating,fairness_rating,career_growth_rating,coalesce(review_title,''),review,status::text,published_at,created_at
		from public.manager_reviews where author_id=$1 order by created_at desc`, actor.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Review
	for rows.Next() {
		var review Review
		if err := rows.Scan(&review.ID, &review.ManagerName, &review.ManagerLinkedInURL, &review.CompanyName, &review.Relationship, &review.Rating, &review.LeadershipRating, &review.CommunicationRating, &review.FairnessRating, &review.CareerGrowthRating, &review.ReviewTitle, &review.ReviewBody, &review.Status, &review.PublishedAt, &review.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, review)
	}
	return out, rows.Err()
}

func (s *Store) UpdateCandidateReview(ctx context.Context, actor Actor, reviewID string, in ReviewInput) (map[string]any, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	var employmentID string
	err := s.db.QueryRow(ctx, `select e.id::text from public.employments e join public.candidate_profiles cp on cp.id=e.candidate_id
		where cp.user_id=$1 and e.is_latest=true and lower(trim(e.company))=lower(trim($2)) limit 1`, actor.ID, in.Company).Scan(&employmentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEmploymentMismatch
	}
	if err != nil {
		return nil, err
	}
	if err := s.requireEvidence(ctx, actor); err != nil {
		return nil, err
	}
	average := CalculateOverallRating(in.LeadershipRating, in.CommunicationRating, in.FairnessRating, in.CareerGrowthRating)
	var id string
	err = s.db.QueryRow(ctx, `update public.manager_reviews set employment_id=$3,manager_name=$4,manager_linkedin_url=$5,company=$6,
		relationship=$7,rating=$8,leadership_rating=$9,communication_rating=$10,fairness_rating=$11,career_growth_rating=$12,
		review_title=$13,review=$14,status='pending',published_at=null,moderation_notes=null
		where id=$1 and author_id=$2 returning id::text`, reviewID, actor.ID, employmentID, in.ManagerName, in.ManagerLinkedInURL, in.Company, in.Relationship, average, in.LeadershipRating, in.CommunicationRating, in.FairnessRating, in.CareerGrowthRating, in.ReviewTitle, in.ReviewBody).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "status": "pending", "rating": average}, nil
}

func (s *Store) DeleteCandidateReview(ctx context.Context, actor Actor, reviewID string) error {
	if actor.AccountType != "candidate" {
		return ErrForbidden
	}
	result, err := s.db.Exec(ctx, `delete from public.manager_reviews where id=$1 and author_id=$2`, reviewID, actor.ID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ReviewEligibility(ctx context.Context, actor Actor) (map[string]any, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	var profileExists, evidenceUploaded bool
	err := s.db.QueryRow(ctx, `select
		exists(select 1 from public.candidate_profiles where user_id=$1),
		exists(select 1 from public.candidate_documents d
		join public.candidate_profiles cp on cp.id=d.candidate_id
		where cp.user_id=$1 and d.document_type in ('exit_letter','salary_slip') and d.deleted_at is null)`, actor.ID).
		Scan(&profileExists, &evidenceUploaded)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"profile_exists":         profileExists,
		"company_email_verified": actor.CompanyEmailVerified,
		"evidence_uploaded":      evidenceUploaded,
		"eligible":               profileExists && actor.CompanyEmailVerified && evidenceUploaded,
	}, nil
}

func CalculateOverallRating(ratings ...int) int {
	if len(ratings) == 0 {
		return 0
	}
	total := 0
	for _, value := range ratings {
		total += value
	}
	return (total + len(ratings)/2) / len(ratings)
}

func (s *Store) RecordDocument(ctx context.Context, actor Actor, documentType, storagePath, originalName, mimeType string, size int64) (map[string]any, []string, error) {
	if actor.AccountType != "candidate" {
		return nil, nil, ErrForbidden
	}
	var candidateID string
	if err := s.db.QueryRow(ctx, `select id from public.candidate_profiles where user_id=$1`, actor.ID).Scan(&candidateID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}
	rows, err := s.db.Query(ctx, `select storage_path from public.candidate_documents where candidate_id=$1 and document_type=$2::public.document_type and deleted_at is null`, candidateID, documentType)
	if err != nil {
		return nil, nil, err
	}
	oldPaths, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, nil, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `update public.candidate_documents set deleted_at=now() where candidate_id=$1 and document_type=$2::public.document_type and deleted_at is null`, candidateID, documentType); err != nil {
		return nil, nil, err
	}
	var id string
	if err := tx.QueryRow(ctx, `insert into public.candidate_documents(candidate_id,document_type,storage_path,original_filename,mime_type,file_size_bytes) values($1,$2::public.document_type,$3,$4,$5,$6) returning id`, candidateID, documentType, storagePath, originalName, mimeType, size).Scan(&id); err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, nil, err
	}
	return map[string]any{"id": id, "document_type": documentType, "uploaded": true}, oldPaths, nil
}

func (s *Store) CandidateDocuments(ctx context.Context, actor Actor) ([]DocumentRecord, error) {
	if actor.AccountType != "candidate" {
		return nil, ErrForbidden
	}
	rows, err := s.db.Query(ctx, `select d.id::text,d.document_type::text,d.storage_path,d.original_filename,d.mime_type,d.file_size_bytes,d.uploaded_at
		from public.candidate_documents d join public.candidate_profiles cp on cp.id=d.candidate_id
		where cp.user_id=$1 and d.deleted_at is null order by d.document_type,d.uploaded_at desc`, actor.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DocumentRecord{}
	for rows.Next() {
		var d DocumentRecord
		if err := rows.Scan(&d.ID, &d.DocumentType, &d.StoragePath, &d.OriginalFilename, &d.MimeType, &d.FileSizeBytes, &d.UploadedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) DeleteCandidateDocument(ctx context.Context, actor Actor, documentID string) (string, error) {
	if actor.AccountType != "candidate" {
		return "", ErrForbidden
	}
	var path string
	err := s.db.QueryRow(ctx, `update public.candidate_documents d set deleted_at=now() from public.candidate_profiles cp
		where d.id=$1 and d.candidate_id=cp.id and cp.user_id=$2 and d.deleted_at is null returning d.storage_path`, documentID, actor.ID).Scan(&path)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return path, err
}

func (s *Store) LatestDocument(ctx context.Context, actor Actor, documentType string) (DocumentRecord, error) {
	if actor.AccountType != "candidate" {
		return DocumentRecord{}, ErrForbidden
	}
	var document DocumentRecord
	err := s.db.QueryRow(ctx, `select d.id,d.storage_path,d.original_filename,d.mime_type,d.file_size_bytes,d.uploaded_at
		from public.candidate_documents d
		join public.candidate_profiles cp on cp.id=d.candidate_id
		where cp.user_id=$1 and d.document_type=$2::public.document_type and d.deleted_at is null
		order by d.uploaded_at desc limit 1`, actor.ID, documentType).
		Scan(&document.ID, &document.StoragePath, &document.OriginalFilename, &document.MimeType, &document.FileSizeBytes, &document.UploadedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return DocumentRecord{}, ErrNotFound
	}
	return document, err
}

func (s *Store) CreateCompanyEmailChallenge(ctx context.Context, actor Actor, email, tokenHash string, expiresAt time.Time) error {
	var profileExists bool
	if actor.AccountType == "candidate" {
		if err := s.db.QueryRow(ctx, `select exists(select 1 from public.candidate_profiles where user_id=$1)`, actor.ID).Scan(&profileExists); err != nil {
			return err
		}
	} else {
		if err := s.db.QueryRow(ctx, `select exists(select 1 from public.recruiter_profiles where user_id=$1)`, actor.ID).Scan(&profileExists); err != nil {
			return err
		}
	}
	if !profileExists {
		return ErrProfileRequired
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if actor.AccountType == "recruiter" {
		var previousEmail *string
		if err := tx.QueryRow(ctx, `select company_email::text from public.private_contacts where user_id=$1`, actor.ID).Scan(&previousEmail); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if previousEmail != nil && !strings.EqualFold(*previousEmail, email) {
			if _, err := tx.Exec(ctx, `update public.contact_grants set revoked_at=now() where recruiter_id=$1 and revoked_at is null`, actor.ID); err != nil {
				return err
			}
		}
	}
	var userAttempts, emailAttempts int
	if err := tx.QueryRow(ctx, `select
	count(*) filter (where user_id=$1 and created_at>now()-interval '15 minutes'),
	count(*) filter (where email=$2::citext and created_at>now()-interval '1 hour')
	from public.company_email_challenges`, actor.ID, email).Scan(&userAttempts, &emailAttempts); err != nil {
		return err
	}
	if userAttempts >= 3 || emailAttempts >= 5 {
		return ErrRateLimited
	}
	if _, err := tx.Exec(ctx, `insert into public.private_contacts(user_id,company_email) values($1,$2::citext)
	on conflict(user_id) do update set company_email=excluded.company_email,
	company_email_verified_at=case when private_contacts.company_email=excluded.company_email then private_contacts.company_email_verified_at else null end`, actor.ID, email); err != nil {
		return err
	}
	if actor.AccountType == "recruiter" {
		if _, err := tx.Exec(ctx, `update public.recruiter_profiles rp set work_email=$2,
		verified_at=pc.company_email_verified_at,
		verification_status=case when pc.company_email_verified_at is null then 'pending'::public.verification_status else 'verified'::public.verification_status end
		from public.private_contacts pc where rp.user_id=$1 and pc.user_id=rp.user_id`, actor.ID, email); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `update public.company_email_challenges set consumed_at=now() where user_id=$1 and consumed_at is null`, actor.ID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `insert into public.company_email_challenges(user_id,email,token_hash,expires_at) values($1,$2::citext,$3,$4)`, actor.ID, email, tokenHash, expiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// DiscardCompanyEmailChallenge removes a challenge whose email could not be
// delivered, so a delivery failure does not count against the user's attempts.
func (s *Store) DiscardCompanyEmailChallenge(ctx context.Context, actor Actor, tokenHash string) error {
	_, err := s.db.Exec(ctx, `delete from public.company_email_challenges where user_id=$1 and token_hash=$2 and consumed_at is null`, actor.ID, tokenHash)
	return err
}

func (s *Store) ConfirmCompanyEmail(ctx context.Context, actor Actor, tokenHash string) (string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var email string
	err = tx.QueryRow(ctx, `update public.company_email_challenges set consumed_at=now()
	where user_id=$1 and token_hash=$2 and consumed_at is null and expires_at>now()
	returning email::text`, actor.ID, tokenHash).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrInvalidVerificationToken
	}
	if err != nil {
		return "", err
	}
	var usedByAnother bool
	if err := tx.QueryRow(ctx, `select exists(select 1 from public.private_contacts where company_email=$2::citext and company_email_verified_at is not null and user_id<>$1)`, actor.ID, email).Scan(&usedByAnother); err != nil {
		return "", err
	}
	if usedByAnother {
		return "", ErrEmailInUse
	}
	if _, err := tx.Exec(ctx, `update public.private_contacts set company_email=$2::citext,company_email_verified_at=now() where user_id=$1`, actor.ID, email); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return "", ErrEmailInUse
		}
		return "", err
	}
	if actor.AccountType == "recruiter" {
		if _, err := tx.Exec(ctx, `update public.recruiter_profiles set work_email=$2,verified_at=now(),verification_status='verified' where user_id=$1`, actor.ID, email); err != nil {
			return "", err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return email, nil
}
