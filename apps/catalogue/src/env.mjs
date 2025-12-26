import { z } from "zod";

/**
 * Specify your server-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars.
 */
const server = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXTAUTH_URL: z.preprocess(
    // This makes Vercel deployments not fail if you don't set NEXTAUTH_URL
    // Since NextAuth.js automatically uses the VERCEL_URL if present.
    (str) => process.env.VERCEL_URL ?? str,
    // VERCEL_URL doesn't include `https` so it cant be validated as a URL
    process.env.VERCEL ? z.string().min(1) : z.string().url()
  ),
  // Add `.min(1) on ID and SECRET if you want to make sure they're not empty
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  RMQ_CONNSTR: z.string().optional(),
  COD_SCRAPER_WS_URL: z.string().default("ws://localhost:1488/ws"),
  SCRAPER_API_SECRET: z.string(),
  YANDEX_DISTRIBUTION_AUTH_KEY: z.string(),
  YOURLS_SIGNATURE: z.string().optional(),
  // Admitad API credentials
  ADMITAD_CLIENT_ID: z.string().optional(),
  ADMITAD_CLIENT_SECRET: z.string().optional(),
  ADMITAD_BASE64_AUTH: z.string().optional(),
  ADMITAD_API_BASE_URL: z.string().optional(),
  // Extension API secret
  EXTENSION_SECRET: z.string(),
});

/**
 * Specify your client-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars. To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
const client = z.object({
  // NEXT_PUBLIC_CLIENTVAR: z.string().min(1),
});

/**
 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
 * middlewares) or client-side so we need to destruct manually.
 *
 * @type {Record<keyof z.infer<typeof server> | keyof z.infer<typeof client>, string | undefined>}
 */
const processEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  RMQ_CONNSTR: process.env.RMQ_CONNSTR,
  COD_SCRAPER_WS_URL: process.env.COD_SCRAPER_WS_URL,
  SCRAPER_API_SECRET: process.env.SCRAPER_API_SECRET,
  YANDEX_DISTRIBUTION_AUTH_KEY: process.env.YANDEX_DISTRIBUTION_AUTH_KEY,
  YOURLS_SIGNATURE: process.env.YOURLS_SIGNATURE,
  // Admitad API credentials
  ADMITAD_CLIENT_ID: process.env.ADMITAD_CLIENT_ID,
  ADMITAD_CLIENT_SECRET: process.env.ADMITAD_CLIENT_SECRET,
  ADMITAD_BASE64_AUTH: process.env.ADMITAD_BASE64_AUTH,
  ADMITAD_API_BASE_URL: process.env.ADMITAD_API_BASE_URL,
  // Extension API secret
  EXTENSION_SECRET: process.env.EXTENSION_SECRET,

  // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
};

// Don't touch the part below
// --------------------------

const merged = server.merge(client);

/** @typedef {z.input<typeof merged>} MergedInput */
/** @typedef {z.infer<typeof merged>} MergedOutput */
/** @typedef {z.SafeParseReturnType<MergedInput, MergedOutput>} MergedSafeParseReturn */

let env = /** @type {MergedOutput} */ (process.env);

if (!!process.env.SKIP_ENV_VALIDATION == false) {
  const isServer = typeof window === "undefined";
  const parsed = /** @type {MergedSafeParseReturn} */ (
    isServer
      ? merged.safeParse(processEnv) // on server we can validate all env vars
      : client.safeParse(processEnv) // on client we can only validate the ones that are exposed
  );

  if (parsed.success === false) {
    console.error(
      "❌ Invalid environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables");
  }

  env = new Proxy(parsed.data, {
    get (target, prop) {
      if (typeof prop !== "string") return undefined;
      // Throw a descriptive error if a server-side env var is accessed on the client
      // Otherwise it would just be returning `undefined` and be annoying to debug
      if (!isServer && !prop.startsWith("NEXT_PUBLIC_"))
        throw new Error(
          process.env.NODE_ENV === "production"
            ? "❌ Attempted to access a server-side environment variable on the client"
            : `❌ Attempted to access server-side environment variable '${prop}' on the client`
        );
      return target[/** @type {keyof typeof target} */ (prop)];
    },
  });
}

export { env };
