import { Effect, Layer, Context, Data } from "effect";
import { createClient, type Client, type ResultSet, type InArgs } from "@libsql/client";

export class CatalogueSqlError extends Data.TaggedError("CatalogueSqlError")<{
  message: string;
  cause?: unknown;
}> {}

export interface CatalogueSqlClient {
  readonly execute: (
    sql: string,
    args?: InArgs,
  ) => Effect.Effect<ResultSet, CatalogueSqlError>;

  readonly executeRaw: <T>(
    sql: string,
    args?: InArgs,
  ) => Effect.Effect<T[], CatalogueSqlError>;
}

export const CatalogueSqlClient =
  Context.GenericTag<CatalogueSqlClient>("CatalogueSqlClient");

const makeClient = Effect.gen(function* () {
  const url = process.env.TURSO_CATALOGUE_URL;
  const authToken = process.env.TURSO_CATALOGUE_TOKEN;

  if (!url) {
    yield* Effect.logWarning(
      "TURSO_CATALOGUE_URL not set, catalogue DB unavailable",
    );
    return yield* Effect.fail(
      new CatalogueSqlError({ message: "TURSO_CATALOGUE_URL not configured" }),
    );
  }

  const client: Client = createClient({
    url,
    authToken,
  });

  yield* Effect.logInfo("Catalogue DB connected").pipe(
    Effect.annotateLogs({ url: url.replace(/\/\/.*@/, "//<redacted>@") }),
  );

  return client;
});

const makeCatalogueSqlClient = (client: Client): CatalogueSqlClient => ({
  execute: (sql, args) =>
    Effect.tryPromise({
      try: () => client.execute({ sql, args }),
      catch: (error) =>
        new CatalogueSqlError({
          message: error instanceof Error ? error.message : String(error),
          cause: error,
        }),
    }),

  executeRaw: <T>(sql: string, args?: InArgs) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => client.execute({ sql, args }),
        catch: (error) =>
          new CatalogueSqlError({
            message: error instanceof Error ? error.message : String(error),
            cause: error,
          }),
      });

      return result.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj as T;
      });
    }),
});

export const CatalogueSqlClientLive: Layer.Layer<
  CatalogueSqlClient,
  CatalogueSqlError
> = Layer.scoped(
  CatalogueSqlClient,
  Effect.gen(function* () {
    const client = yield* makeClient;

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        client.close();
      }).pipe(Effect.tap(() => Effect.logInfo("Catalogue DB connection closed"))),
    );

    return makeCatalogueSqlClient(client);
  }),
);
