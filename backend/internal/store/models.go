package store

import "time"

type Actor struct {
	ID                   string `json:"id"`
	Email                string `json:"email"`
	AccountType          string `json:"account_type"`
	FullName             string `json:"full_name"`
	CompanyEmailVerified bool   `json:"company_email_verified"`
}
type CandidateInput struct {
	FullName           string `json:"full_name"`
	LinkedInURL        string `json:"linkedin_url"`
	Location           string `json:"location"`
	Availability       string `json:"availability"`
	Intro              string `json:"intro"`
	Company            string `json:"company"`
	Role               string `json:"role"`
	OrgName            string `json:"org_name"`
	TeamName           string `json:"team_name"`
	StartedOn          string `json:"started_on"`
	EndedOn            string `json:"ended_on"`
	Phone              string `json:"phone"`
	ContactVisibility  string `json:"contact_visibility"`
	ResumeVisibility   string `json:"resume_visibility"`
	YearsExperience    int    `json:"years_experience"`
	PublicStatsConsent bool   `json:"public_stats_consent"`
}
type RecruiterInput struct {
	FullName    string `json:"full_name"`
	LinkedInURL string `json:"linkedin_url"`
	Company     string `json:"company"`
	JobTitle    string `json:"job_title"`
	WorkEmail   string `json:"work_email"`
}
type ReviewInput struct {
	ManagerName         string `json:"manager_name"`
	ManagerLinkedInURL  string `json:"manager_linkedin_url"`
	Company             string `json:"company"`
	Relationship        string `json:"relationship"`
	ReviewTitle         string `json:"review_title"`
	ReviewBody          string `json:"review_body"`
	LeadershipRating    int    `json:"leadership_rating"`
	CommunicationRating int    `json:"communication_rating"`
	FairnessRating      int    `json:"fairness_rating"`
	CareerGrowthRating  int    `json:"career_growth_rating"`
}
type Review struct {
	ID, ManagerName, CompanyName, Relationship, ReviewTitle, ReviewBody               string
	ManagerLinkedInURL                                                                string
	Rating, LeadershipRating, CommunicationRating, FairnessRating, CareerGrowthRating int
	Status                                                                            string
	PublishedAt                                                                       *time.Time
	CreatedAt                                                                         time.Time
}

type DocumentRecord struct {
	ID               string    `json:"id"`
	DocumentType     string    `json:"document_type"`
	StoragePath      string    `json:"-"`
	OriginalFilename string    `json:"original_filename"`
	MimeType         string    `json:"mime_type"`
	FileSizeBytes    int64     `json:"file_size_bytes"`
	UploadedAt       time.Time `json:"uploaded_at"`
}
