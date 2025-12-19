import { Context, Stream } from "effect";
import { ScrapeResult } from "@repo/scraper-protocol";

export class ScrapeError extends Error {
  readonly _tag = "ScrapeError";
}

// Event types that can be streamed during scraping
export type ScrapeEvent =
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "progress"; stage: string; percent?: number; durationMs?: number }
  | {
      type: "retry";
      attempt: number;
      maxAttempts: number;
      delay: number;
      reason: string;
    };

export interface ScrapeService {
  readonly scrape: (
    slug: string,
  ) => Stream.Stream<ScrapeResult | ScrapeEvent, ScrapeError>;
  readonly scrapeFast: (
    slug: string,
  ) => Stream.Stream<ScrapeEvent, ScrapeError>;
}

export const ScrapeService = Context.GenericTag<ScrapeService>("ScrapeService");
