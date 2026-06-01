/**
 * useCanvasAuth
 * Reactive auth state for canvas components.
 * Persists session in localStorage, validates against /api/auth/me on mount.
 */
import { useState, useEffect, useCallback } from "react";
import {
  register, loginUser, getMe, clearSession, setSessionId,
  type CanvasUser, type AuthResult,
} from "./authApi";

export interface CanvasAuthState {
  user:     CanvasUser | null;
  loading:  boolean;
  error:    string | null;
  isAuthed: boolean;
  signup:   (email: string, password: string, username?: string) => Promise<void>;
  login:    (email: string, password: string) => Promise<void>;
  logout:   () => void;
  clearError: () => void;
}

export function useCanvasAuth(): CanvasAuthState {
  const [user, setUser]       = useState<CanvasUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Validate persisted session on mount
  useEffect(() => {
    getMe().then(u => { setUser(u); }).finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback((result: AuthResult) => {
    setSessionId(result.sessionId);
    setUser(result.user);
    setError(null);
  }, []);

  const signup = useCallback(async (email: string, password: string, username?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await register(email, password, username);
      handleAuth(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [handleAuth]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginUser(email, password);
      handleAuth(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [handleAuth]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    loading,
    error,
    isAuthed: user !== null,
    signup,
    login,
    logout,
    clearError: () => setError(null),
  };
}
