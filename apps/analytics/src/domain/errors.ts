import { Data } from "effect";

export class ClickHouseError extends Data.TaggedError("ClickHouseError")<{
  message: string;
  cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
  errors: string[];
}> {}

export class QueryError extends Data.TaggedError("QueryError")<{
  message: string;
  cause?: unknown;
}> {}

export class QueueFullError extends Data.TaggedError("QueueFullError")<{
  message: string;
  queueSize: number;
}> {}
