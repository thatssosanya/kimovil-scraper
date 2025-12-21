import { Effect } from "effect";
import { SqlClient, SqlError } from "@effect/sql";

export const quarantine = (
  slug: string,
  sourceTable: string,
  data: unknown,
  error: string,
): Effect.Effect<void, SqlError.SqlError, SqlClient.SqlClient> =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    sql`
      INSERT INTO quarantine (slug, source_table, data, error)
      VALUES (${slug}, ${sourceTable}, ${JSON.stringify(data)}, ${error})
    `.pipe(Effect.asVoid),
  );
