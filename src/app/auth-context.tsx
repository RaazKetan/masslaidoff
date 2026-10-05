import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  getCurrentUser,
  onAuthStateChange,
  signOut as supabaseSignOut,
} from "../lib/auth";
import { api, APIError } from "../lib/api";
import { isSupabaseConfigured } from "../lib/supabase";
import type { UserAccount } from "../lib/types";

export type Audience = "candidate" | "recruiter";

export type DemoSession = {
  accountType: Audience;
  email: string;
  firstName: string;
  lastName: string;
  companyEmailVerified: boolean;
};

export type AuthState = {
  loading: boolean;
  error: Error | null;
  authenticated: boolean;
  account: UserAccount | null;
  accountType: Audience | null;
  accountName: string;
  email: string;
  companyEmail: string;
  companyEmailVerified: boolean;
  demo: boolean;
  refresh: () => Promise<void>;
  createDemoSession: (session: DemoSession) => void;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

function readDemoSession(): DemoSession | null {
  if (
    isSupabaseConfigured ||
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  )
    return null;
  try {
    return JSON.parse(
      localStorage.getItem("masslaidoff_demo_session") || "null",
    ) as DemoSession | null;
  } catch {
    localStorage.removeItem("masslaidoff_demo_session");
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const hasAccount = useRef(false);
  const [email, setEmail] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyEmailVerified, setCompanyEmailVerified] = useState(false);
  const [demoSession, setDemoSession] = useState<DemoSession | null>(() =>
    readDemoSession(),
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setDemoSession(readDemoSession());
      setLoading(false);
      return;
    }
    // Only block the UI on first load; background refreshes must not unmount the workspace.
    if (!hasAccount.current) setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        setAccount(null);
        setEmail("");
        setCompanyEmail("");
        setCompanyEmailVerified(false);
        hasAccount.current = false;
        setError(null);
        return;
      }
      let me;
      try {
        me = await api.getMe();
      } catch (error) {
        if (
          !(error instanceof APIError) ||
          error.code !== "account_unavailable"
        )
          throw error;
        const role =
          (user.user_metadata?.account_type ||
            sessionStorage.getItem("masslaidoff_account_type")) === "recruiter"
            ? "recruiter"
            : "candidate";
        const fallbackName = String(
          user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Member",
        );
        await api.onboard(role, fallbackName);
        sessionStorage.removeItem("masslaidoff_account_type");
        me = await api.getMe();
      }
      setAccount({
        id: me.id,
        account_type: me.account_type,
        full_name: me.full_name,
        avatar_path: null,
        linkedin_url: me.linkedin_url,
        onboarding_completed_at: null,
        created_at: "",
        updated_at: "",
      });
      setEmail(me.email);
      setCompanyEmail(me.company_email || "");
      setCompanyEmailVerified(me.company_email_verified);
      hasAccount.current = true;
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
    if (!isSupabaseConfigured) return;
    const subscription = onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") return;
      void refresh().catch(() => undefined);
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const createDemoSession = useCallback((session: DemoSession) => {
    localStorage.setItem("masslaidoff_demo_session", JSON.stringify(session));
    setDemoSession(session);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    if (demoSession) {
      localStorage.removeItem("masslaidoff_demo_session");
      setDemoSession(null);
      return;
    }
    if (isSupabaseConfigured) await supabaseSignOut();
    setAccount(null);
    setEmail("");
    setCompanyEmail("");
    setCompanyEmailVerified(false);
    hasAccount.current = false;
    setError(null);
  }, [demoSession]);

  const value = useMemo<AuthState>(() => {
    const accountType =
      demoSession?.accountType ||
      (account?.account_type === "candidate" ||
      account?.account_type === "recruiter"
        ? account.account_type
        : null);
    return {
      loading,
      error,
      authenticated: Boolean(demoSession || account),
      account,
      accountType,
      accountName: demoSession
        ? `${demoSession.firstName} ${demoSession.lastName}`.trim()
        : account?.full_name || "",
      email: demoSession?.email || email,
      companyEmail: demoSession?.email || companyEmail,
      companyEmailVerified:
        demoSession?.companyEmailVerified || companyEmailVerified,
      demo: Boolean(demoSession),
      refresh,
      createDemoSession,
      signOut,
    };
  }, [
    account,
    companyEmailVerified,
    companyEmail,
    createDemoSession,
    demoSession,
    email,
    error,
    loading,
    refresh,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
