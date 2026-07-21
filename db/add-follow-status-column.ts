import postgres from "postgres";
import { env } from "../api/lib/env";

const sql = postgres(env.databaseUrl, {
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
});

try {
    // Default "accepted" so every existing follow (created back when following
    // was instant) keeps working exactly as before — only new rows going
    // forward are inserted as "pending" by the application code.
    await sql.unsafe(
        `ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "status" varchar(16) DEFAULT 'accepted' NOT NULL;`,
    );
    console.log("✅ follows.status column ready (created or already existed).");
} catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
} finally {
    await sql.end();
}