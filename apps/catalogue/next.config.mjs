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
  // Use separate build directory to avoid conflicts with dev server
  distDir: process.env.BUILD_DIR || ".next",
  serverExternalPackages: ["ws"],
  reactStrictMode: true,

  /**
   * If you have the "experimental: { appDir: true }" setting enabled, then you
   * must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  // i18n: {
  //   locales: ["en"],
  //   defaultLocale: "en",
  // },
  images: {
    domains: ["yastatic.net", 'clik-or-die.fra1.digitaloceanspaces.com', 'click-or-die.fra1.digitaloceanspaces.com', 'click-or-die.fra1.cdn.digitaloceanspaces.com'],
  }
};
export default config;

// export default MillionLint.next({
//   enabled: true
// })(config);
