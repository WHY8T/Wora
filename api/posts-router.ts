import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { POST_TYPES } from "@db/schema";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  ensureBookCached,
  getBooksByIds,
  hotScore,
  loadAuthors,
  logActivity,
  myVoteMap,
} from "./queries/wora";
import { getBookByExternalId } from "./books/providers";

type PostRow = typeof schema.posts.$inferSelect;

async function enrichPosts(rows: PostRow[], userId?: number) {
  const authors = await loadAuthors(rows.map((p) => p.userId));
  const bookMap = await getBooksByIds(rows.map((p) => p.bookId).filter((x): x is number => x != null));
  const db = getDb();
  const communities = await db
    .select()
    .from(schema.communities)
    .where(inArray(schema.communities.id, [...new Set(rows.map((p) => p.communityId))]));
  const cmap = new Map(communities.map((c) => [c.id, c]));
  const votes = userId ? await myVoteMap(userId, "post", rows.map((p) => p.id)) : new Map<number, number>();
  return rows.map((p) => ({
    ...p,
    author: authors.get(p.userId) ?? null,
    book: p.bookId ? bookMap.get(p.bookId) ?? null : null,
    community: cmap.get(p.communityId) ?? null,
    myVote: votes.get(p.id) ?? 0,
  }));
}

export const postsRouter = createRouter({
  listByCommunity: publicQuery
    .input(
      z.object({
        slug: z.string().min(1).max(64),
        sort: z.enum(["hot", "new", "top"]).default("hot"),
        limit: z.number().int().min(1).max(50).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const community = await db.query.communities.findFirst({
        where: eq(schema.communities.slug, input.slug.toLowerCase()),
      });
      if (!community) return [];
      const rows = await db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.communityId, community.id))
        .orderBy(desc(schema.posts.createdAt))
        .limit(200);
      const sorted =
        input.sort === "new"
          ? rows
          : input.sort === "top"
            ? [...rows].sort((a, b) => b.score - a.score)
            : [...rows].sort((a, b) => hotScore(b.score, b.createdAt) - hotScore(a.score, a.createdAt));
      return enrichPosts(sorted.slice(0, input.limit), ctx.user?.id);
    }),

  trending: publicQuery
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.posts)
        .orderBy(desc(schema.posts.createdAt))
        .limit(150);
      const sorted = [...rows].sort(
        (a, b) => hotScore(b.score, b.createdAt) - hotScore(a.score, a.createdAt),
      );
      return enrichPosts(sorted.slice(0, input?.limit ?? 10), ctx.user?.id);
    }),

  byId: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, input.id) });
      if (!post) return null;
      const [enriched] = await enrichPosts([post], ctx.user?.id);
      return enriched;
    }),

  create: authedQuery
    .input(
      z.object({
        slug: z.string().min(1).max(64),
        title: z.string().min(3).max(300),
        body: z.string().max(20000).optional(),
        type: z.enum(POST_TYPES).default("discussion"),
        bookExternalId: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const community = await db.query.communities.findFirst({
        where: eq(schema.communities.slug, input.slug.toLowerCase()),
      });
      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });
      const member = await db.query.communityMembers.findFirst({
        where: and(
          eq(schema.communityMembers.communityId, community.id),
          eq(schema.communityMembers.userId, ctx.user.id),
        ),
      });
      if (!member)
        throw new TRPCError({ code: "FORBIDDEN", message: "Join the community to post" });
      let bookId: number | null = null;
      if (input.bookExternalId) {
        const summary = await getBookByExternalId(input.bookExternalId);
        if (summary) bookId = (await ensureBookCached(summary)).id;
      }
      const [{ id }] = await db
        .insert(schema.posts)
        .values({
          communityId: community.id,
          userId: ctx.user.id,
          bookId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
        })
        .returning({ id: schema.posts.id });
      await logActivity(ctx.user.id, "posted", {
        postId: id,
        communitySlug: community.slug,
        title: input.title,
      });
      return db.query.posts.findFirst({ where: eq(schema.posts.id, id) });
    }),

  vote: authedQuery
    .input(
      z.object({
        postId: z.number().int().positive(),
        value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.votes.findFirst({
        where: and(
          eq(schema.votes.userId, ctx.user.id),
          eq(schema.votes.targetType, "post"),
          eq(schema.votes.targetId, input.postId),
        ),
      });
      if (input.value === 0) {
        if (existing) await db.delete(schema.votes).where(eq(schema.votes.id, existing.id));
      } else if (existing) {
        await db.update(schema.votes).set({ value: input.value }).where(eq(schema.votes.id, existing.id));
      } else {
        await db.insert(schema.votes).values({
          userId: ctx.user.id,
          targetType: "post",
          targetId: input.postId,
          value: input.value,
        });
      }
      const [sum] = await db
        .select({ total: sql<number>`coalesce(sum(${schema.votes.value}),0)` })
        .from(schema.votes)
        .where(and(eq(schema.votes.targetType, "post"), eq(schema.votes.targetId, input.postId)));
      const score = Number(sum?.total ?? 0);
      await db.update(schema.posts).set({ score }).where(eq(schema.posts.id, input.postId));
      return { score };
    }),
});
