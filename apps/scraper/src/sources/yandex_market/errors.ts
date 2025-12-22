import { Data } from "effect";

export class YandexBrowserError extends Data.TaggedError("YandexBrowserError")<{
  message: string;
  url?: string;
  cause?: unknown;
}> {}

export class YandexValidationError extends Data.TaggedError("YandexValidationError")<{
  message: string;
  url?: string;
}> {}
