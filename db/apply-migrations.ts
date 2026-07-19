import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { env } from "../api/lib/env";

const migrationsDir = join(import.meta.dirname, "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No migration files found. Run `npm run db:generate` first.");
  process.exit(1);
}

const sql = postgres(env.databaseUrl, {
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});

// Postgres error codes that mean "this already exists / already matches" —
// safe to skip since it means a previous run (possibly from an older copy of
// this project) already created that table/type/column/index.
const ALREADY_EXISTS_CODES = new Set([
  "42710", // duplicate_object (types, constraints)
  "42P07", // duplicate_table
  "42701", // duplicate_column
  "42P06", // duplicate_schema
  "42723", // duplicate_function
]);

let applied = 0;
let skipped = 0;

try {
  for (const file of files) {
    console.log(`Applying ${file}...`);
    const raw = readFileSync(join(migrationsDir, file), "utf-8");
    const statements = raw.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
        applied++;
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code && ALREADY_EXISTS_CODES.has(code)) {
          skipped++;
          console.log(`  ↳ skipped (already exists): ${statement.split("\n")[0].slice(0, 80)}...`);
          continue;
        }
        throw err;
      }
    }
  }
  console.log(`✅ Done. ${applied} statement(s) applied, ${skipped} already existed and were skipped.`);
} catch (err) {
  console.error("❌ Migration failed:");
  console.error(err);
  process.exit(1);
} finally {
  await sql.end();
}