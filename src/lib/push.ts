import webpush from "web-push";
import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { env } from "./env";
import { getDb } from "../queries/connection";

let configured = false;
function ensureConfigured() {
    if (configured) return true;
    if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    configured = true;
    return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Send a push notification to every device a user has enabled push on.
 * No-ops quietly if VAPID keys aren't configured, or the user has no
 * subscriptions — this should never be the thing that breaks a request. */
export async function sendPushToUser(userId: number, payload: PushPayload) {
    if (!ensureConfigured()) return;
    const db = getDb();
    const subs = await db
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.userId, userId));
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    body,
                );
            } catch (err) {
                const status = (err as { statusCode?: number }).statusCode;
                // 404/410 = the subscription is dead (browser unsubscribed, user
                // cleared site data, etc.) — clean it up so we stop retrying it.
                if (status === 404 || status === 410) {
                    await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id));
                } else {
                    console.error("Push send failed:", err);
                }
            }
        }),
    );
}