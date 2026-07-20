import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { loadAuthors, parseJson } from "./queries/wora";

export const notificationsRouter = createRouter({
    /** Recent notifications for the current user, newest first, with actor info attached. */
    list: authedQuery
        .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
        .query(async ({ ctx, input }) => {
            const db = getDb();
            const rows = await db
                .select()
                .from(schema.notifications)
                .where(eq(schema.notifications.userId, ctx.user.id))
                .orderBy(desc(schema.notifications.createdAt))
                .limit(input?.limit ?? 30);

            const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is number => id != null))];
            const actors = await loadAuthors(actorIds);

            return rows.map((r) => ({
                id: r.id,
                type: r.type as "follow" | "message" | "comment" | "reply",
                targetId: r.targetId,
                meta: parseJson<Record<string, unknown>>(r.meta, {}),
                read: r.read === 1,
                createdAt: r.createdAt,
                actor: r.actorId != null ? actors.get(r.actorId) ?? null : null,
            }));
        }),

    /** Count of unread notifications, for the bell badge. */
    unreadCount: authedQuery.query(async ({ ctx }) => {
        const db = getDb();
        const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.notifications)
            .where(and(eq(schema.notifications.userId, ctx.user.id), eq(schema.notifications.read, 0)));
        return { count: row?.count ?? 0 };
    }),

    markAllRead: authedQuery.mutation(async ({ ctx }) => {
        const db = getDb();
        await db
            .update(schema.notifications)
            .set({ read: 1 })
            .where(and(eq(schema.notifications.userId, ctx.user.id), eq(schema.notifications.read, 0)));
        return { ok: true };
    }),

    markRead: authedQuery
        .input(z.object({ ids: z.array(z.number().int().positive()).min(1) }))
        .mutation(async ({ ctx, input }) => {
            const db = getDb();
            await db
                .update(schema.notifications)
                .set({ read: 1 })
                .where(and(eq(schema.notifications.userId, ctx.user.id), inArray(schema.notifications.id, input.ids)));
            return { ok: true };
        }),
});