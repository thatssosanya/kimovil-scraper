import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { runTest } from "./setup";

describe("Test harness", () => {
  it("can connect to temp SQLite", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql`SELECT 1 as value`;
        return rows[0].value;
      }),
    );
    expect(result).toBe(1);
  });

  it("can create and query table", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)`;
        yield* sql`INSERT INTO test_table (name) VALUES ('hello')`;
        const rows = yield* sql`SELECT name FROM test_table`;
        return rows[0].name;
      }),
    );
    expect(result).toBe("hello");
  });
});
