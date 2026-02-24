"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMe, ApiError, type User } from "@/lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Call after token is stored in localStorage to refresh user. */
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("osr_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
    } catch (err) {
      // Only clear the token on auth failures (401/403).
      // Network errors or server errors should NOT log the user out.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem("osr_token");
        setUser(null);
      }
      // For other errors, keep the existing user state (may be null on
      // first load, but won't nuke a valid session on a transient failure).
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("osr_token");
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
