import { Effect } from "effect";
import { SqlClient, SqlError } from "@effect/sql";
import { safeStringify } from "../utils/safe-stringify";

export const quarantine = (
  slug: string,
  sourceTable: string,
  data: unknown,
  error: string,
): Effect.Effect<void, SqlError.SqlError, SqlClient.SqlClient> =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    sql`
      INSERT INTO quarantine (slug, source_table, data, error)
      VALUES (${slug}, ${sourceTable}, ${safeStringify(data)}, ${error})
    `.pipe(Effect.asVoid),
  );
