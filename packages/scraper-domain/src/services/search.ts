import { Context, Stream, Data } from "effect";
import { SearchResult } from "@repo/scraper-protocol";

export class KimovilHttpError extends Data.TaggedError("KimovilHttpError")<{
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly attempt: number;
}> {}

export class KimovilInvalidResponseError extends Data.TaggedError("KimovilInvalidResponseError")<{
  readonly url: string;
  readonly attempt: number;
  readonly raw: unknown;
}> {}

export class SearchBrowserError extends Data.TaggedError("SearchBrowserError")<{
  readonly message: string;
  readonly attempt: number;
}> {}

export class SearchRetryExhaustedError extends Data.TaggedError("SearchRetryExhaustedError")<{
  readonly query: string;
  readonly attempts: number;
  readonly lastError: SearchLeafError;
}> {}

export type SearchLeafError = KimovilHttpError | KimovilInvalidResponseError | SearchBrowserError;
export type SearchError = SearchLeafError | SearchRetryExhaustedError;

// Event types that can be streamed during search
export type SearchEvent = 
  | { type: "log", level: "info" | "warn" | "error", message: string }
  | { type: "retry", attempt: number, maxAttempts: number, delay: number, reason: string };

export interface SearchService {
  readonly search: (query: string) => Stream.Stream<SearchResult | SearchEvent, SearchError>;
}

export const SearchService = Context.GenericTag<SearchService>("SearchService");
