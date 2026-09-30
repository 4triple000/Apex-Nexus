/**
 * AuthContext — email/password auth layer on top of the session system
 * Stores sessionId + user in localStorage and syncs with the backend.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function api(path: string) { return `${BASE}/api${path}`; }

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...((opts?.headers) || {}) },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Request failed");
  }
  // Auth routes reply as { ok, data }; unwrap to the payload
  const body = await r.json() as { ok?: boolean; data?: T } | T;
  return (body && typeof body === "object" && "ok" in body && "data" in body ? body.data : body) as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: number;
  sessionId: string;
  username: string;
  avatarEmoji: string;
  email: string | null;
  bio: string | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  /** True for the app owner account(s); unlocks owner-only tools like the Dev Cockpit */
  isOwner?: boolean;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading:       boolean;
  user:            AuthUser | null;
  login:           (email: string, password: string) => Promise<void>;
  signup:          (email: string, password: string, username?: string) => Promise<void>;
  /** Finish "Continue with Google" with the one-time code the API sent back */
  loginWithGoogleCode: (code: string) => Promise<void>;
  logout:          () => void;
}

/** Where "Continue with Google" starts; Google sends the person back to `returnTo`. */
export function googleSignInUrl(returnTo: string): string {
  return `${api("/auth/google")}?returnTo=${encodeURIComponent(returnTo)}`;
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const SESSION_KEY = "apex_session_id";
const USER_KEY    = "apex_auth_user";

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { /* ignore */ }
    }
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      req<{ user?: AuthUser }>(api("/auth/me"), {
        headers: { "x-session-id": sessionId },
      }).then(({ user }) => {
        if (!user) throw new Error("Not signed in");
        setUser(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }).catch(() => {
        // Session invalid or expired — clear cached state so the user hits /login
        setUser(null);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(SESSION_KEY);
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user, sessionId } = await req<{ user: AuthUser; sessionId: string }>(
      api("/auth/login"),
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    localStorage.setItem(SESSION_KEY, sessionId);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // Keep legacy session ID in sync so existing hooks work
    localStorage.setItem("apex_session_id", sessionId);
    setUser(user);
  }, []);

  const signup = useCallback(async (email: string, password: string, username?: string) => {
    const { user, sessionId } = await req<{ user: AuthUser; sessionId: string }>(
      api("/auth/register"),
      { method: "POST", body: JSON.stringify({ email, password, username }) }
    );
    localStorage.setItem(SESSION_KEY, sessionId);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem("apex_session_id", sessionId);
    setUser(user);
  }, []);

  const loginWithGoogleCode = useCallback(async (code: string) => {
    const { user, sessionId } = await req<{ user: AuthUser; sessionId: string }>(
      api("/auth/google/exchange"),
      { method: "POST", body: JSON.stringify({ code }) }
    );
    localStorage.setItem(SESSION_KEY, sessionId);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
    // Don't clear apex_session_id immediately — let the login page decide
    setUser(null);
    window.location.href = `${BASE}/login`;
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!user,
      isLoading,
      user,
      login,
      signup,
      loginWithGoogleCode,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
