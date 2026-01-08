import "dotenv/config";
import { createClient } from "@clickhouse/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
    username: process.env.CLICKHOUSE_USERNAME ?? "default",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
  });

  console.log("Running ClickHouse migrations...");

  try {
    const schemaPath = join(__dirname, "../src/sql/schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.startsWith("--")) continue;
      
      const firstLine = statement.split("\n")[0].substring(0, 80);
      console.log(`Executing: ${firstLine}...`);
      
      try {
        await client.command({ query: statement });
        console.log("  ✓ OK");
      } catch (e) {
        const error = e as { message?: string };
        if (error.message?.includes("already exists")) {
          console.log("  ⊘ Already exists, skipping");
        } else {
          throw e;
        }
      }
    }

    console.log("\nMigration complete!");

    const result = await client.query({
      query: "SHOW TABLES FROM analytics",
      format: "JSONEachRow",
    });
    const tables = await result.json();
    console.log("\nTables in analytics database:");
    for (const table of tables as Array<{ name: string }>) {
      console.log(`  - ${table.name}`);
    }
  } finally {
    await client.close();
  }
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
