/**
 * AuthContext — manages user session for Apex mobile.
 * Persists to AsyncStorage so login survives app restarts.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "apex_mobile_user";

export interface ApexUser {
  userId: number;
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
    AsyncStorage.getItem(AUTH_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setUser(JSON.parse(raw) as ApexUser);
          } catch {}
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (userData: ApexUser) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
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
