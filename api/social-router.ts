import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { loadAuthors, logActivity, parseJson, publicUser, createNotification } from "./queries/wora";

export const socialRouter = createRouter({
  /** Send a follow/connection request. Doesn't connect you right away — the
   * other person has to accept it first (see respondToRequest). */
  follow: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id)
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't follow yourself" });
      const db = getDb();
      const target = await db.query.users.findFirst({ where: eq(schema.users.id, input.userId) });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // If they'd already sent *you* a pending request, this is a mutual
      // interest — connect immediately instead of leaving two crossed requests.
      const theirs = await db.query.follows.findFirst({
        where: and(eq(schema.follows.followerId, input.userId), eq(schema.follows.followeeId, ctx.user.id)),
      });
      if (theirs && theirs.status === "pending") {
        await db.update(schema.follows).set({ status: "accepted" }).where(eq(schema.follows.id, theirs.id));
        await db
          .insert(schema.follows)
          .values({ followerId: ctx.user.id, followeeId: input.userId, status: "accepted" })
          .onConflictDoUpdate({
            target: [schema.follows.followerId, schema.follows.followeeId],
            set: { status: "accepted" },
          });
        await logActivity(ctx.user.id, "followed", { userId: input.userId, name: target.name });
        await createNotification(input.userId, "follow_accepted", { actorId: ctx.user.id });
        return { ok: true, status: "accepted" as const };
      }

      await db
        .insert(schema.follows)
        .values({ followerId: ctx.user.id, followeeId: input.userId, status: "pending" })
        .onConflictDoNothing({
          target: [schema.follows.followerId, schema.follows.followeeId],
        });
      await createNotification(input.userId, "follow_request", { actorId: ctx.user.id });
      return { ok: true, status: "pending" as const };
    }),

  /** Unfollow, or cancel a request you sent that's still pending. */
  unfollow: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(schema.follows)
        .where(and(eq(schema.follows.followerId, ctx.user.id), eq(schema.follows.followeeId, input.userId)));
      return { ok: true };
    }),

  /** Pending requests waiting on my response. */
  pendingRequests: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.follows)
      .where(and(eq(schema.follows.followeeId, ctx.user.id), eq(schema.follows.status, "pending")))
      .orderBy(desc(schema.follows.createdAt));
    const authors = await loadAuthors(rows.map((r) => r.followerId));
    return rows.map((r) => ({
      requesterId: r.followerId,
      requestedAt: r.createdAt,
      requester: authors.get(r.followerId) ?? null,
    }));
  }),

  /** Accept or decline a follow request someone sent you. */
  respondToRequest: authedQuery
    .input(z.object({ requesterId: z.number().int().positive(), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.follows.findFirst({
        where: and(
          eq(schema.follows.followerId, input.requesterId),
          eq(schema.follows.followeeId, ctx.user.id),
          eq(schema.follows.status, "pending"),
        ),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "No pending request from that person" });

      if (input.accept) {
        await db.update(schema.follows).set({ status: "accepted" }).where(eq(schema.follows.id, row.id));
        await logActivity(input.requesterId, "followed", { userId: ctx.user.id });
        await createNotification(input.requesterId, "follow_accepted", { actorId: ctx.user.id });
      } else {
        await db.delete(schema.follows).where(eq(schema.follows.id, row.id));
      }
      return { ok: true };
    }),

  /** Recent activity by me + people I'm connected with. */
  feed: authedQuery
    .input(z.object({ limit: z.number().int().min(1).max(50).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const following = await db
        .select()
        .from(schema.follows)
        .where(and(eq(schema.follows.followerId, ctx.user.id), eq(schema.follows.status, "accepted")));
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

  /** People you may want to follow: most-connected users you're not connected with. */
  suggestions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const top = await db
      .select({ userId: schema.follows.followeeId, count: sql<number>`count(*)` })
      .from(schema.follows)
      .where(eq(schema.follows.status, "accepted"))
      .groupBy(schema.follows.followeeId)
      .orderBy(desc(sql`count(*)`))
      .limit(20);
    const myConnections = new Set(
      (
        await db
          .select()
          .from(schema.follows)
          .where(
            sql`(${schema.follows.followerId} = ${ctx.user.id} OR ${schema.follows.followeeId} = ${ctx.user.id})`,
          )
      ).flatMap((f) => [f.followerId, f.followeeId]),
    );
    let candidates = top.map((t) => t.userId).filter((id) => id !== ctx.user.id && !myConnections.has(id));
    if (candidates.length < 6) {
      const more = await db
        .select()
        .from(schema.profiles)
        .where(ne(schema.profiles.userId, ctx.user.id))
        .orderBy(desc(schema.profiles.createdAt))
        .limit(20);
      candidates = [
        ...candidates,
        ...more.map((m) => m.userId).filter((id) => !candidates.includes(id) && !myConnections.has(id)),
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