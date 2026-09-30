/**
 * AuthContext — manages user session for Apex mobile.
 * Persists to AsyncStorage so login survives app restarts.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setAuthSession, authApi, parseGoogleReturn } from "@/services/api";

const AUTH_KEY = "apex_mobile_user";

export interface ApexUser {
  userId: number;
  sessionId: string;
  email: string;
  username: string;
  avatarEmoji: string;
  bio?: string | null;
}

interface AuthContextValue {
  user: ApexUser | null;
  isLoading: boolean;
  login: (user: ApexUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApexUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Website version: back from "Continue with Google" (#google_code=…). Finish signing in first.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const { code, error } = parseGoogleReturn(window.location.href);
      if (code || error) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (error) (window as unknown as { __apexGoogleError?: string }).__apexGoogleError = error;
        if (code) {
          authApi.googleExchange(code)
            .then(async (u) => {
              await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
              setAuthSession(u.sessionId);
              setUser(u);
            })
            .catch(() => { (window as unknown as { __apexGoogleError?: string }).__apexGoogleError = "failed"; })
            .finally(() => setIsLoading(false));
          return;
        }
      }
    }
    AsyncStorage.getItem(AUTH_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const saved = JSON.parse(raw) as ApexUser;
            // Accounts saved before session IDs existed must sign in again
            if (saved.sessionId) {
              setAuthSession(saved.sessionId);
              setUser(saved);
            }
          } catch {}
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (userData: ApexUser) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userData));
    setAuthSession(userData.sessionId);
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setAuthSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
