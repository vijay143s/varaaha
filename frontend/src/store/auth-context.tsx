import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { JSX, ReactNode } from "react";

import { apiClient } from "../api/client.js";
import type { SignInPayload, SignUpPayload, User } from "../types/auth.js";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  signin: (payload: SignInPayload) => Promise<void>;
  signup: (payload: SignUpPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "varaaha_access_token";

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState<boolean>(true);

  const persistToken = useCallback((token: string | null) => {
    setAccessToken(token);
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem(STORAGE_KEY);
      delete apiClient.defaults.headers.common.Authorization;
    }
  }, []);

  const bootstrap = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
  const response = await apiClient.post("/auth/refresh");
      const { user: fetchedUser, tokens } = response.data.data;
      setUser(fetchedUser);
      persistToken(tokens.accessToken);
    } catch (error) {
      console.warn("Failed to refresh auth", error);
      setUser(null);
      persistToken(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, persistToken]);

  useEffect(() => {
    bootstrap().catch(console.error);
  }, [bootstrap]);

  const signin = useCallback(async (payload: SignInPayload) => {
    const response = await apiClient.post("/auth/signin", payload);
    const { user: signedInUser, tokens } = response.data.data;
    setUser(signedInUser);
    persistToken(tokens.accessToken);
  }, [persistToken]);

  const signup = useCallback(async (payload: SignUpPayload) => {
    const response = await apiClient.post("/auth/signup", payload);
    const { user: createdUser, tokens } = response.data.data;
    setUser(createdUser);
    persistToken(tokens.accessToken);
  }, [persistToken]);

  const logout = useCallback(async () => {
    await apiClient.post("/auth/logout");
    setUser(null);
    persistToken(null);
  }, [persistToken]);

  const refresh = useCallback(async () => {
    const response = await apiClient.post("/auth/refresh");
    const { user: refreshedUser, tokens } = response.data.data;
    setUser(refreshedUser);
    persistToken(tokens.accessToken);
  }, [persistToken]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      loading,
      signin,
      signup,
      logout,
      refresh
    }),
    [user, accessToken, loading, signin, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
