import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import { ac, roles } from "./permissions";

export type AuthClientConfig = {
  baseURL: string;
};

export const createClient = (config: AuthClientConfig) => {
  return createAuthClient({
    baseURL: config.baseURL,
    fetchOptions: {
      credentials: "include",
    },
    plugins: [
      adminClient({
        ac,
        roles,
      }),
    ],
  });
};

export type AuthClient = ReturnType<typeof createClient>;
