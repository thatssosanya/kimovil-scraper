import { Effect, Context, Stream } from "effect";
import { SearchResult } from "@repo/scraper-protocol";

export class SearchError extends Error {
  readonly _tag = "SearchError";
}

// Event types that can be streamed during search
export type SearchEvent = 
  | { type: "log", level: "info" | "warn" | "error", message: string }
  | { type: "retry", attempt: number, maxAttempts: number, delay: number, reason: string };

export interface SearchService {
  readonly search: (query: string) => Stream.Stream<SearchResult | SearchEvent, SearchError>;
}

export const SearchService = Context.GenericTag<SearchService>("SearchService");
