import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { loadAuthors, myVoteMap } from "./queries/wora";

export const commentsRouter = createRouter({
  byPost: publicQuery
    .input(z.object({ postId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.comments)
        .where(eq(schema.comments.postId, input.postId))
        .orderBy(asc(schema.comments.createdAt))
        .limit(500);
      const authors = await loadAuthors(rows.map((c) => c.userId));
      const votes = ctx.user
        ? await myVoteMap(ctx.user.id, "comment", rows.map((c) => c.id))
        : new Map<number, number>();
      return rows.map((c) => ({
        ...c,
        author: authors.get(c.userId) ?? null,
        myVote: votes.get(c.id) ?? 0,
      }));
    }),

  create: authedQuery
    .input(
      z.object({
        postId: z.number().int().positive(),
        body: z.string().min(1).max(5000),
        parentId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, input.postId) });
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      const [{ id }] = await db
        .insert(schema.comments)
        .values({
          postId: input.postId,
          userId: ctx.user.id,
          parentId: input.parentId ?? null,
          body: input.body,
        })
        .returning({ id: schema.comments.id });
      await db
        .update(schema.posts)
        .set({ commentCount: sql`${schema.posts.commentCount} + 1` })
        .where(eq(schema.posts.id, input.postId));
      return db.query.comments.findFirst({ where: eq(schema.comments.id, id) });
    }),

  vote: authedQuery
    .input(
      z.object({
        commentId: z.number().int().positive(),
        value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.votes.findFirst({
        where: and(
          eq(schema.votes.userId, ctx.user.id),
          eq(schema.votes.targetType, "comment"),
          eq(schema.votes.targetId, input.commentId),
        ),
      });
      if (input.value === 0) {
        if (existing) await db.delete(schema.votes).where(eq(schema.votes.id, existing.id));
      } else if (existing) {
        await db.update(schema.votes).set({ value: input.value }).where(eq(schema.votes.id, existing.id));
      } else {
        await db.insert(schema.votes).values({
          userId: ctx.user.id,
          targetType: "comment",
          targetId: input.commentId,
          value: input.value,
        });
      }
      const [sum] = await db
        .select({ total: sql<number>`coalesce(sum(${schema.votes.value}),0)` })
        .from(schema.votes)
        .where(and(eq(schema.votes.targetType, "comment"), eq(schema.votes.targetId, input.commentId)));
      const score = Number(sum?.total ?? 0);
      await db.update(schema.comments).set({ score }).where(eq(schema.comments.id, input.commentId));
      return { score };
    }),
});
