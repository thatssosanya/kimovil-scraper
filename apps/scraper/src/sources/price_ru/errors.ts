import { Data } from "effect";

export class PriceRuApiError extends Data.TaggedError("PriceRuApiError")<{
  status: number;
  message: string;
  endpoint: string;
}> {}

export class PriceRuNetworkError extends Data.TaggedError("PriceRuNetworkError")<{
  message: string;
  cause?: unknown;
}> {}

export type PriceRuError = PriceRuApiError | PriceRuNetworkError;
