import { Elysia, Context } from "elysia";
import { createAuth, type Auth } from "@repo/auth";
import { config } from "../config";

const authConfig = {
  database: process.env.AUTH_DATABASE ?? "./auth.sqlite",
  baseURL: process.env.AUTH_BASE_URL ?? `http://localhost:${config.port}`,
  secret: process.env.AUTH_SECRET ?? "dev-secret-change-in-production",
  trustedOrigins: (process.env.AUTH_TRUSTED_ORIGINS ?? "http://localhost:5173").split(","),
};

export const auth = createAuth(authConfig);

const betterAuthHandler = (context: Context) => {
  const BETTER_AUTH_ACCEPT_METHODS = ["POST", "GET"];
  if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
    return auth.handler(context.request);
  } else {
    context.set.status = 405;
    return { error: "Method not allowed" };
  }
};

export const createAuthRoutes = () =>
  new Elysia({ prefix: "/api/auth" }).all("/*", betterAuthHandler);

export const getSession = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  return session;
};

export const requireAuth = async (request: Request) => {
  const session = await getSession(request);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
};

export const requireRole = async (request: Request, role: string) => {
  const session = await requireAuth(request);
  const userRole = (session.user as { role?: string }).role;
  if (userRole !== role && userRole !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
};
