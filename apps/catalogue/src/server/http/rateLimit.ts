import type { NextApiRequest } from "next";

export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded
    ? (typeof forwarded === "string" ? forwarded : forwarded[0])?.split(",")[0]
    : req.socket.remoteAddress;
  return ip || "unknown";
}

export function makeMemoryRateLimiter({
  max = 100,
  windowMs = 60_000,
} = {}) {
  const map = new Map<string, { count: number; resetTime: number }>();

  return {
    check(ip: string): boolean {
      const now = Date.now();
      const clientData = map.get(ip);

      if (!clientData || now > clientData.resetTime) {
        map.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
      }

      if (clientData.count >= max) {
        return false;
      }

      clientData.count++;
      return true;
    },
  };
}
