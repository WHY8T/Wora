import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { searchBooks, getBookByExternalId, trendingBooks } from "./providers";
import { getReaderPage } from "./reader";
import {
  ensureBookCached,
  getBookByExternalIdCached,
  bookCommunityStats,
} from "../queries/wora";

export const booksRouter = createRouter({
  search: publicQuery
    .input(z.object({ q: z.string().min(3).max(200), startIndex: z.number().int().min(0).default(0) }))
    .query(({ input }) => searchBooks(input.q.trim(), input.startIndex)),

  trending: publicQuery.query(() => trendingBooks()),

  byExternalId: publicQuery
    .input(z.object({ externalId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const summary = await getBookByExternalId(input.externalId);
      if (!summary) return null;
      const cached = await ensureBookCached(summary);
      const stats = await bookCommunityStats(cached.id);
      return { book: summary, stats, dbId: cached.id };
    }),

  /** Lightweight cached-book lookup for internal linking (no provider fetch). */
  cached: publicQuery
    .input(z.object({ externalId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const row = await getBookByExternalIdCached(input.externalId);
      return row ?? null;
    }),

  /** Paginated full-text page for public-domain (Project Gutenberg) books only. */
  readerPage: publicQuery
    .input(
      z.object({
        externalId: z.string().min(1).max(64),
        page: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getReaderPage(input.externalId, input.page);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Unable to load this book's text.",
        });
      }
    }),
});
