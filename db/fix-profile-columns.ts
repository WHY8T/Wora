import postgres from "postgres";
import { env } from "../api/lib/env";

const sql = postgres(env.databaseUrl, {
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
});

try {
    await sql.unsafe(`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatarPreset" varchar(64);`);
    await sql.unsafe(`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "discordUsername" varchar(64);`);
    await sql.unsafe(`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "spotifyUrl" varchar(300);`);
    console.log("✅ Columns added (or already existed).");
} catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
} finally {
    await sql.end();
}