/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || "https://c.click-or-die.ru",
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  exclude: ["/dashboard*", "/sign-in*", "/sign-up*", "/test", "/api*"],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/sign-in", "/sign-up", "/api", "/test"],
      },
    ],
  },
  transform: (config, path) => {
    // Default transform
    const defaultTransform = {
      loc: path,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
      changefreq: "weekly",
      priority: 0.7,
    };

    // Custom priorities and changefreq
    if (path === "/") {
      return {
        ...defaultTransform,
        priority: 1.0,
        changefreq: "daily",
      };
    }

    if (path === "/devices" || path === "/ratings" || path === "/rating") {
      return {
        ...defaultTransform,
        priority: 0.9,
        changefreq: "daily",
      };
    }

    if (path === "/catalogue") {
      return {
        ...defaultTransform,
        priority: 0.8,
        changefreq: "weekly",
      };
    }

    // Rating pages (both ID and slug based)
    if (path.startsWith("/rating/") || path.startsWith("/ratings/")) {
      return {
        ...defaultTransform,
        priority: 0.8,
        changefreq: "weekly",
      };
    }

    if (path.startsWith("/devices/")) {
      return {
        ...defaultTransform,
        priority: 0.8,
        changefreq: "weekly",
      };
    }

    return defaultTransform;
  },
};
