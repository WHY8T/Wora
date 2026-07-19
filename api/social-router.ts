import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { loadAuthors, logActivity, parseJson, publicUser } from "./queries/wora";

export const socialRouter = createRouter({
  follow: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id)
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't follow yourself" });
      const db = getDb();
      const target = await db.query.users.findFirst({ where: eq(schema.users.id, input.userId) });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await db
        .insert(schema.follows)
        .values({ followerId: ctx.user.id, followeeId: input.userId })
        .onConflictDoNothing({
          target: [schema.follows.followerId, schema.follows.followeeId],
        });
      await logActivity(ctx.user.id, "followed", { userId: input.userId, name: target.name });
      return { ok: true };
    }),

  unfollow: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(schema.follows)
        .where(and(eq(schema.follows.followerId, ctx.user.id), eq(schema.follows.followeeId, input.userId)));
      return { ok: true };
    }),

  /** Recent activity by me + people I follow. */
  feed: authedQuery
    .input(z.object({ limit: z.number().int().min(1).max(50).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const following = await db
        .select()
        .from(schema.follows)
        .where(eq(schema.follows.followerId, ctx.user.id));
      const ids = [ctx.user.id, ...following.map((f) => f.followeeId)];
      const rows = await db
        .select()
        .from(schema.activities)
        .where(inArray(schema.activities.userId, ids))
        .orderBy(desc(schema.activities.createdAt))
        .limit(input?.limit ?? 30);
      const authors = await loadAuthors(rows.map((a) => a.userId));
      return rows.map((a) => ({
        ...a,
        author: authors.get(a.userId) ?? null,
        meta: parseJson<Record<string, unknown>>(a.meta, {}),
      }));
    }),

  /** Public activity for a profile page. */
  userActivity: publicQuery
    .input(z.object({ userId: z.number().int().positive(), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.activities)
        .where(eq(schema.activities.userId, input.userId))
        .orderBy(desc(schema.activities.createdAt))
        .limit(input.limit);
      const authors = await loadAuthors(rows.map((a) => a.userId));
      return rows.map((a) => ({
        ...a,
        author: authors.get(a.userId) ?? null,
        meta: parseJson<Record<string, unknown>>(a.meta, {}),
      }));
    }),

  /** People you may want to follow: most-followed users you don't follow yet. */
  suggestions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const top = await db
      .select({ userId: schema.follows.followeeId, count: sql<number>`count(*)` })
      .from(schema.follows)
      .groupBy(schema.follows.followeeId)
      .orderBy(desc(sql`count(*)`))
      .limit(20);
    const myFollowing = new Set(
      (await db.select().from(schema.follows).where(eq(schema.follows.followerId, ctx.user.id))).map(
        (f) => f.followeeId,
      ),
    );
    let candidates = top.map((t) => t.userId).filter((id) => id !== ctx.user.id && !myFollowing.has(id));
    if (candidates.length < 6) {
      const more = await db
        .select()
        .from(schema.profiles)
        .where(ne(schema.profiles.userId, ctx.user.id))
        .orderBy(desc(schema.profiles.createdAt))
        .limit(20);
      candidates = [
        ...candidates,
        ...more.map((m) => m.userId).filter((id) => !candidates.includes(id) && !myFollowing.has(id)),
      ];
    }
    const picked = candidates.slice(0, 6);
    if (picked.length === 0) return [];
    const users = await db.select().from(schema.users).where(inArray(schema.users.id, picked));
    const profs = await db.select().from(schema.profiles).where(inArray(schema.profiles.userId, picked));
    const pmap = new Map(profs.map((p) => [p.userId, p]));
    return users.map((u) => publicUser(u, pmap.get(u.id) ?? null));
  }),
});
