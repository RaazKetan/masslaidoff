import { requireSupabase } from './supabase';
import { getCurrentUser } from './auth';
import type { CandidateDocument, DocumentType } from './types';

const BUCKET_MAP: Record<DocumentType, string> = {
  resume: 'resumes',
  exit_letter: 'employment-evidence',
  salary_slip: 'employment-evidence',
  other_employment_proof: 'employment-evidence',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Upload a document to Supabase Storage and record it in candidate_documents */
export async function uploadDocument(
  candidateId: string,
  file: File,
  documentType: DocumentType,
): Promise<CandidateDocument> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before uploading documents.');

  // Validate file
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File must be smaller than 10 MB.');
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Only PDF, JPEG, and PNG files are accepted.');
  }

  const bucket = BUCKET_MAP[documentType];
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const storagePath = `${user.id}/${documentType}_${Date.now()}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  // Soft-delete any existing document of the same type
  await client
    .from('candidate_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('candidate_id', candidateId)
    .eq('document_type', documentType)
    .is('deleted_at', null);

  // Record in candidate_documents
  const { data, error } = await client
    .from('candidate_documents')
    .insert({
      candidate_id: candidateId,
      document_type: documentType,
      storage_path: `${bucket}/${storagePath}`,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get all active (non-deleted) documents for a candidate */
export async function getDocuments(candidateId: string): Promise<CandidateDocument[]> {
  const { data, error } = await requireSupabase()
    .from('candidate_documents')
    .select('*')
    .eq('candidate_id', candidateId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Get a short-lived signed URL for a document */
export async function getDocumentUrl(doc: CandidateDocument): Promise<string> {
  const [bucket, ...pathParts] = doc.storage_path.split('/');
  const path = pathParts.join('/');
  const { data, error } = await requireSupabase().storage
    .from(bucket)
    .createSignedUrl(path, 300); // 5-minute expiry
  if (error) throw error;
  return data.signedUrl;
}

/** Soft-delete a document */
export async function deleteDocument(documentId: string) {
  const { error } = await requireSupabase()
    .from('candidate_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId);
  if (error) throw error;
}

/** Upload a profile avatar */
export async function uploadAvatar(file: File): Promise<string> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to upload an avatar.');

  if (file.size > 5 * 1024 * 1024) throw new Error('Avatar must be smaller than 5 MB.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP are accepted.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${user.id}/avatar.${ext}`;

  const { error } = await client.storage
    .from('profile-avatars')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;

  // Update user_accounts
  await client
    .from('user_accounts')
    .update({ avatar_path: `profile-avatars/${path}` })
    .eq('id', user.id);

  return `profile-avatars/${path}`;
}
