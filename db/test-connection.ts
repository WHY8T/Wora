import postgres from "postgres";
import { env } from "../api/lib/env";

console.log("Connecting to:", env.databaseUrl.replace(/:[^:@]+@/, ":****@"));

const sql = postgres(env.databaseUrl, {
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
});

try {
  const result = await sql`select 1 as ok`;
  console.log("✅ Connected successfully:", result);
} catch (err) {
  console.error("❌ Connection failed:");
  console.error(err);
} finally {
  await sql.end();
  process.exit(0);
}
