import { config } from "../config";

export const log = {
  info: (tag: string, msg: string) =>
    console.log(`[${new Date().toLocaleTimeString()}] [${tag}] ${msg}`),
  warn: (tag: string, msg: string) =>
    console.warn(`[${new Date().toLocaleTimeString()}] [${tag}] ⚠ ${msg}`),
  error: (tag: string, msg: string, err?: unknown) => {
    console.error(`[${new Date().toLocaleTimeString()}] [${tag}] ✗ ${msg}`);
    if (err) console.error(err);
  },
  success: (tag: string, msg: string) =>
    console.log(`[${new Date().toLocaleTimeString()}] [${tag}] ✓ ${msg}`),
  banner: () => {
    console.log("");
    console.log("╔════════════════════════════════════════════════╗");
    console.log("║         SCRAPER SERVER STARTING                ║");
    console.log("╠════════════════════════════════════════════════╣");
    console.log(`║  WebSocket: ws://localhost:${config.port}/ws             ║`);
    console.log(`║  API:       http://localhost:${config.port}/api          ║`);
    console.log(
      `║  Workers:   ${config.bulk.concurrency} concurrent (rate: ${config.bulk.rateLimitMs}ms)      ║`,
    );
    console.log("╚════════════════════════════════════════════════╝");
    console.log("");
  },
};
