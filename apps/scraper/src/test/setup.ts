import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-node";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export const createTestSqlClient = () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scraper-test-"));
  const dbPath = path.join(tmpDir, "test.sqlite");

  return SqliteClient.layer({
    filename: dbPath,
  });
};

export const runTest = <A, E>(
  effect: Effect.Effect<A, E, SqlClient.SqlClient>,
) => Effect.runPromise(effect.pipe(Effect.provide(createTestSqlClient())));
