import { createHash } from "crypto";

/**
 * Generate a deterministic device ID from a slug.
 * Uses SHA-256 hash truncated to 16 hex characters.
 * 
 * NOTE: Server-only utility - uses Node.js crypto module.
 */
export const generateDeviceId = (slug: string): string =>
  createHash("sha256").update(slug).digest("hex").slice(0, 16);
