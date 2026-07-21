import postgres from "postgres";
import { env } from "../api/lib/env";

const sql = postgres(env.databaseUrl, {
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
});

try {
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS "push_subscriptions" (
            "id" serial PRIMARY KEY NOT NULL,
            "userId" integer NOT NULL REFERENCES "users"("id"),
            "endpoint" text NOT NULL UNIQUE,
            "p256dh" varchar(255) NOT NULL,
            "auth" varchar(255) NOT NULL,
            "createdAt" timestamp DEFAULT now() NOT NULL
        );
    `);
    await sql.unsafe(
        `CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("userId");`,
    );
    console.log("✅ push_subscriptions table ready (created or already existed).");
} catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
} finally {
    await sql.end();
}