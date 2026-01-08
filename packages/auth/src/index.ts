import { betterAuth, type BetterAuthOptions } from "better-auth";
import { admin as adminPlugin } from "better-auth/plugins";
import { mcp } from "better-auth/plugins";
import Database from "better-sqlite3";
import { ac, roles } from "./permissions";

export type AuthConfig = {
  database: string;
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
};

export const createAuth = (config: AuthConfig): ReturnType<typeof betterAuth> => {
  const db = new Database(config.database);

  return betterAuth({
    database: db,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: false,
      },
    },

    plugins: [
      adminPlugin({
        ac,
        roles,
        defaultRole: "subscriber",
      }),
      mcp({
        loginPage: "/auth/login",
        oidcConfig: {
          loginPage: "/auth/login",
          accessTokenExpiresIn: 3600, // 1 hour
          refreshTokenExpiresIn: 604800, // 7 days
          scopes: ["openid", "profile", "email", "offline_access"],
        },
      }),
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;

export { ac, roles } from "./permissions";
export type { Role, Permission } from "./permissions";
