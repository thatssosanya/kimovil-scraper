import { Effect } from "effect";
import { SqlClient } from "@effect/sql";

export const quarantine = (
  slug: string,
  sourceTable: string,
  data: unknown,
  error: string,
): Effect.Effect<void, never, SqlClient.SqlClient> =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    sql`
      INSERT INTO quarantine (slug, source_table, data, error)
      VALUES (${slug}, ${sourceTable}, ${JSON.stringify(data)}, ${error})
    `.pipe(Effect.asVoid),
  );
