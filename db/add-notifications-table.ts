import postgres from "postgres";
import { env } from "../api/lib/env";

const sql = postgres(env.databaseUrl, {
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
});

try {
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS "notifications" (
            "id" serial PRIMARY KEY NOT NULL,
            "userId" integer NOT NULL REFERENCES "users"("id"),
            "actorId" integer REFERENCES "users"("id"),
            "type" varchar(32) NOT NULL,
            "targetId" integer,
            "meta" text,
            "read" integer DEFAULT 0 NOT NULL,
            "createdAt" timestamp DEFAULT now() NOT NULL
        );
    `);
    await sql.unsafe(
        `CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("userId", "createdAt");`,
    );
    await sql.unsafe(
        `CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "notifications" ("userId", "read");`,
    );
    console.log("✅ notifications table ready (created or already existed).");
} catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
} finally {
    await sql.end();
}