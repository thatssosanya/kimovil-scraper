import { createSignal, createRoot } from "solid-js";
import { authClient } from "../lib/auth";

type User = {
  id: string;
  email: string;
  name: string | null;
  role?: string;
};

type Session = {
  user: User;
  session: {
    id: string;
    expiresAt: Date;
  };
};

function createAuthStore() {
  const [session, setSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const fetchSession = async () => {
    try {
      console.log("[Auth] Fetching session...");
      const result = await authClient.getSession({
        fetchOptions: { credentials: "include" },
      });
      console.log("[Auth] Session result:", result);
      if (result.data) {
        console.log("[Auth] Setting session:", result.data);
        setSession(result.data as unknown as Session);
      } else {
        console.log("[Auth] No session data");
        setSession(null);
      }
    } catch (e) {
      console.error("[Auth] Failed to get session:", e);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  fetchSession();

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
        fetchOptions: { credentials: "include" },
      });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
        return false;
      }
      await fetchSession();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      return false;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
        fetchOptions: { credentials: "include" },
      });
      if (result.error) {
        setError(result.error.message ?? "Sign up failed");
        return false;
      }
      await fetchSession();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
      return false;
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: { credentials: "include" },
      });
      setSession(null);
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  const hasRole = (role: string) => {
    const s = session();
    if (!s) return false;
    return s.user.role === role || s.user.role === "admin";
  };

  return {
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    hasRole,
    isAdmin: () => hasRole("admin"),
    isAuthenticated: () => session() !== null,
    refetch: fetchSession,
  };
}

export const authStore = createRoot(createAuthStore);

export const useAuth = () => authStore;
