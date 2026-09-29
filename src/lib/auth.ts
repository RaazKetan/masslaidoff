import { requireSupabase, supabase } from './supabase';
import type { AccountType, UserAccount, PrivateContacts } from './types';

/** Get the current authenticated user, or null */
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Get the user's account record (includes account_type) */
export async function getUserAccount(): Promise<UserAccount | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await requireSupabase()
    .from('user_accounts')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  return data;
}

/** Sign in with email magic link (OTP) */
export async function signInWithEmail(email: string) {
  const { error } = await requireSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/workspace.html#profile` },
  });
  if (error) throw error;
}

/** Sign out the current user */
export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

/** Select a role and create the user_accounts + private_contacts records */
export async function selectRole(
  accountType: AccountType,
  fullName: string,
  email: string,
): Promise<UserAccount> {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) throw new Error('You must be signed in to select a role.');

  const userId = authData.user.id;

  // Create user_accounts row
  const { data: account, error: accountError } = await client
    .from('user_accounts')
    .upsert({
      id: userId,
      account_type: accountType,
      full_name: fullName,
    }, { onConflict: 'id' })
    .select()
    .single();
  if (accountError) throw accountError;

  // Create private_contacts row
  const { error: contactError } = await client
    .from('private_contacts')
    .upsert({
      user_id: userId,
      personal_email: email,
    }, { onConflict: 'user_id' });
  if (contactError) throw contactError;

  return account;
}

/** Mark onboarding as completed */
export async function completeOnboarding() {
  const client = requireSupabase();
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) throw new Error('Not signed in.');

  const { error } = await client
    .from('user_accounts')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', authData.user.id);
  if (error) throw error;
}

/** Get private contacts for the current user */
export async function getPrivateContacts(): Promise<PrivateContacts | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await requireSupabase()
    .from('private_contacts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return data;
}

/** Update private contact information */
export async function updatePrivateContacts(
  fields: Partial<Omit<PrivateContacts, 'user_id'>>,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');
  const { error } = await requireSupabase()
    .from('private_contacts')
    .update(fields)
    .eq('user_id', user.id);
  if (error) throw error;
}

/** Record privacy consent */
export async function recordConsent(consentType: string, policyVersion: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');
  const { error } = await requireSupabase()
    .from('consent_records')
    .insert({
      user_id: user.id,
      consent_type: consentType,
      policy_version: policyVersion,
    });
  if (error) throw error;
}

/** Listen for auth state changes */
export function onAuthStateChange(callback: (user: unknown) => void) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return data.subscription;
}
