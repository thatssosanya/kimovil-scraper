import { createClient } from "@repo/auth/client";

export const authClient = createClient({
  baseURL: "",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
