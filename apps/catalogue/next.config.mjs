// import MillionLint from "@million/lint";
// @ts-check

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
if (!process.env.SKIP_ENV_VALIDATION) {
  await import("./src/env.mjs");
}

/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: ["ws"],
  reactStrictMode: true,
  experimental: {
    // Cache compiled modules on disk for faster restarts
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "yastatic.net" },
      { protocol: "https", hostname: "clik-or-die.fra1.digitaloceanspaces.com" },
      { protocol: "https", hostname: "click-or-die.fra1.digitaloceanspaces.com" },
      { protocol: "https", hostname: "click-or-die.fra1.cdn.digitaloceanspaces.com" },
      { protocol: "https", hostname: "cdn.kimovil.com" },
      { protocol: "https", hostname: "cdn-files.kimovil.com" },
    ],
  },
};
export default config;

// export default MillionLint.next({
//   enabled: true
// })(config);
