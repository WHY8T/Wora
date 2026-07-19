import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  ensureBookCached,
  getBookByExternalIdCached,
  loadAuthors,
  logActivity,
} from "./queries/wora";
import { getBookByExternalId } from "./books/providers";

export const reviewsRouter = createRouter({
  forBook: publicQuery
    .input(z.object({ externalId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const cached = await getBookByExternalIdCached(input.externalId);
      if (!cached) return [];
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.reviews)
        .where(eq(schema.reviews.bookId, cached.id))
        .orderBy(desc(schema.reviews.createdAt))
        .limit(50);
      const authors = await loadAuthors(rows.map((r) => r.userId));
      return rows.map((r) => ({ ...r, author: authors.get(r.userId) ?? null }));
    }),

  mineForBook: authedQuery
    .input(z.object({ externalId: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const cached = await getBookByExternalIdCached(input.externalId);
      if (!cached) return null;
      const db = getDb();
      const mine = await db.query.reviews.findFirst({
        where: and(eq(schema.reviews.userId, ctx.user.id), eq(schema.reviews.bookId, cached.id)),
      });
      return mine ?? null;
    }),

  upsert: authedQuery
    .input(
      z.object({
        externalId: z.string().min(1).max(64),
        rating: z.number().int().min(1).max(5),
        body: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const summary = await getBookByExternalId(input.externalId);
      if (!summary) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      const book = await ensureBookCached(summary);
      const db = getDb();
      await db
        .insert(schema.reviews)
        .values({ userId: ctx.user.id, bookId: book.id, rating: input.rating, body: input.body ?? null })
        .onConflictDoUpdate({
          target: [schema.reviews.userId, schema.reviews.bookId],
          set: { rating: input.rating, body: input.body ?? null },
        });
      await logActivity(ctx.user.id, "reviewed", {
        rating: input.rating,
        bookExternalId: book.externalId,
        bookTitle: book.title,
        bookCover: book.cover,
        excerpt: (input.body ?? "").slice(0, 140),
      });
      return { ok: true };
    }),

  delete: authedQuery
    .input(z.object({ externalId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const cached = await getBookByExternalIdCached(input.externalId);
      if (!cached) return { ok: true };
      const db = getDb();
      await db
        .delete(schema.reviews)
        .where(and(eq(schema.reviews.bookId, cached.id), eq(schema.reviews.userId, ctx.user.id)));
      return { ok: true };
    }),
});
