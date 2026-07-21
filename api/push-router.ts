import { z } from "zod";
import { and, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";

export const pushRouter = createRouter({
    /** The VAPID public key the frontend needs to call pushManager.subscribe(). */
    publicKey: publicQuery.query(() => ({ key: env.vapidPublicKey })),

    /** Register (or refresh) this device's push subscription. */
    subscribe: authedQuery
        .input(
            z.object({
                endpoint: z.string().url(),
                keys: z.object({ p256dh: z.string(), auth: z.string() }),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const db = getDb();
            await db
                .insert(schema.pushSubscriptions)
                .values({
                    userId: ctx.user.id,
                    endpoint: input.endpoint,
                    p256dh: input.keys.p256dh,
                    auth: input.keys.auth,
                })
                .onConflictDoUpdate({
                    target: schema.pushSubscriptions.endpoint,
                    set: { userId: ctx.user.id, p256dh: input.keys.p256dh, auth: input.keys.auth },
                });
            return { ok: true };
        }),

    /** Stop sending push to this device. */
    unsubscribe: authedQuery
        .input(z.object({ endpoint: z.string().url() }))
        .mutation(async ({ ctx, input }) => {
            const db = getDb();
            await db
                .delete(schema.pushSubscriptions)
                .where(
                    and(
                        eq(schema.pushSubscriptions.userId, ctx.user.id),
                        eq(schema.pushSubscriptions.endpoint, input.endpoint),
                    ),
                );
            return { ok: true };
        }),

    /** Whether this exact device/endpoint is already subscribed (for the Settings toggle). */
    isSubscribed: authedQuery
        .input(z.object({ endpoint: z.string().url() }))
        .query(async ({ ctx, input }) => {
            const db = getDb();
            const row = await db.query.pushSubscriptions.findFirst({
                where: and(
                    eq(schema.pushSubscriptions.userId, ctx.user.id),
                    eq(schema.pushSubscriptions.endpoint, input.endpoint),
                ),
            });
            return { subscribed: !!row };
        }),
});