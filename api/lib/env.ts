import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}



export const env = {
  sessionSecret: required("SESSION_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  ownerEmail: (process.env.OWNER_EMAIL ?? "").trim().toLowerCase(),
  supabaseUrl: (process.env.SUPABASE_URL ?? "").replace(/\/$/, ""),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  // Web Push (VAPID). Optional: if either key is missing, push notifications
  // are silently skipped rather than crashing the app — everything else
  // (in-app notifications, the bell, sound) keeps working regardless.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:support@example.com",
};