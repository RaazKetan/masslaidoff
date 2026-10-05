import { requireSupabase, supabase } from "./supabase";
import type { AccountType } from "./types";

/** Get the current authenticated user, or null */
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Sign in an existing account with email and password. The page's audience is
 * remembered so a first sign-in (e.g. a dashboard-created user with no role
 * metadata) is onboarded with the right account type.
 */
export async function signInWithPassword(
  email: string,
  password: string,
  accountType: AccountType,
) {
  sessionStorage.setItem("masslaidoff_account_type", accountType);
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/** Send the password recovery email for an existing account */
export async function requestPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/** Set a new password after following a recovery link */
export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

/** Create an account with email and password */
export async function signUpWithPassword({
  firstName,
  lastName,
  email,
  password,
  accountType,
  redirectPath,
}: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  accountType: AccountType;
  redirectPath: string;
}) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}${redirectPath}`,
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        account_type: accountType,
      },
    },
  });
  if (error) throw error;
  return data;
}

/** Continue with Google OAuth */
export async function signInWithGoogle(
  accountType: AccountType,
  redirectPath: string,
) {
  sessionStorage.setItem("masslaidoff_account_type", accountType);
  const { data, error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error) throw error;
  return data;
}

/** Sign out the current user */
export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

/** Listen for auth state changes */
export function onAuthStateChange(callback: (event: string, user: unknown) => void) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user ?? null);
  });
  return data.subscription;
}
