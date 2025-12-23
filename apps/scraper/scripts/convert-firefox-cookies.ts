#!/usr/bin/env npx tsx
/**
 * Convert Firefox cookies from SQLite JSON export to Playwright format
 *
 * Usage:
 *   1. Export cookies from Firefox using sqlite3
 *   2. Run: npx tsx scripts/convert-firefox-cookies.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface FirefoxCookie {
  name: string;
  value: string;
  host: string;
  path: string;
  expiry: number;
  isSecure: number;
  isHttpOnly: number;
  sameSite: number;
}

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

const sameSiteMap: Record<number, "Strict" | "Lax" | "None"> = {
  0: "None",
  1: "Lax",
  2: "Strict",
  256: "Lax", // Firefox's default
};

const rawContent = readFileSync("/tmp/yandex-cookies-raw.json", "utf-8");
const firefoxCookies: FirefoxCookie[] = JSON.parse(rawContent);

// Convert and deduplicate (keep latest expiry for duplicate name+domain)
const cookieMap = new Map<string, PlaywrightCookie>();

for (const fc of firefoxCookies) {
  // Firefox stores expiry in milliseconds, Playwright expects seconds
  const expiresSeconds = fc.expiry > 1e12 ? fc.expiry / 1000 : fc.expiry;

  const cookie: PlaywrightCookie = {
    name: fc.name,
    value: fc.value,
    domain: fc.host,
    path: fc.path,
    expires: expiresSeconds,
    httpOnly: fc.isHttpOnly === 1,
    secure: fc.isSecure === 1,
    sameSite: sameSiteMap[fc.sameSite] ?? "Lax",
  };

  const key = `${fc.name}|${fc.host}`;
  const existing = cookieMap.get(key);

  // Keep the one with later expiry
  if (!existing || cookie.expires > existing.expires) {
    cookieMap.set(key, cookie);
  }
}

const cookies = Array.from(cookieMap.values());

// Sort by domain for readability
cookies.sort(
  (a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name),
);

const outputPath = join(__dirname, "../yandex-cookies.json");
writeFileSync(outputPath, JSON.stringify(cookies, null, 2));

console.log(`Converted ${firefoxCookies.length} Firefox cookies`);
console.log(`Deduplicated to ${cookies.length} unique cookies`);
console.log(`Saved to: ${outputPath}`);

// Show important auth cookies
const authCookies = cookies.filter((c) =>
  ["Session_id", "sessionid2", "L", "yandex_login", "muid"].includes(c.name),
);
console.log("\nAuth cookies found:");
for (const c of authCookies) {
  console.log(`  ${c.name} (${c.domain}): ${c.value.slice(0, 20)}...`);
}
