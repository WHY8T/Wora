import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  ensureBookCached,
  ensureDefaultShelves,
  getBooksByIds,
  getProfileByUsername,
  logActivity,
} from "./queries/wora";
import { getBookByExternalId } from "./books/providers";

async function shelvesWithItems(userId: number) {
  const db = getDb();
  const shelves = await ensureDefaultShelves(userId);
  const items = await db
    .select()
    .from(schema.shelfItems)
    .innerJoin(schema.shelves, eq(schema.shelfItems.shelfId, schema.shelves.id))
    .where(eq(schema.shelves.userId, userId))
    .orderBy(desc(schema.shelfItems.createdAt));
  const bookMap = await getBooksByIds(items.map((i) => i.shelf_items.bookId));
  return shelves.map((shelf) => ({
    ...shelf,
    items: items
      .filter((i) => i.shelf_items.shelfId === shelf.id)
      .map((i) => ({ ...i.shelf_items, book: bookMap.get(i.shelf_items.bookId)! }))
      .filter((i) => i.book),
  }));
}

export const shelvesRouter = createRouter({
  mine: authedQuery.query(({ ctx }) => shelvesWithItems(ctx.user.id)),

  byUsername: publicQuery
    .input(z.object({ username: z.string().min(1).max(24) }))
    .query(async ({ input }) => {
      const profile = await getProfileByUsername(input.username);
      if (!profile) return [];
      return shelvesWithItems(profile.userId);
    }),

  createShelf: authedQuery
    .input(z.object({ name: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [{ id }] = await db
        .insert(schema.shelves)
        .values({ userId: ctx.user.id, name: input.name })
        .returning({ id: schema.shelves.id });
      return db.query.shelves.findFirst({ where: eq(schema.shelves.id, id) });
    }),

  add: authedQuery
    .input(
      z.object({
        externalId: z.string().min(1).max(64),
        shelfId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const shelf = await db.query.shelves.findFirst({
        where: and(eq(schema.shelves.id, input.shelfId), eq(schema.shelves.userId, ctx.user.id)),
      });
      if (!shelf) throw new TRPCError({ code: "NOT_FOUND", message: "Shelf not found" });
      const summary = await getBookByExternalId(input.externalId);
      if (!summary) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      const book = await ensureBookCached(summary);
      // A book lives on one system shelf at a time: remove from other system shelves
      if (shelf.systemKey) {
        const myShelves = await db.query.shelves.findMany({
          where: eq(schema.shelves.userId, ctx.user.id),
        });
        for (const s of myShelves) {
          if (s.systemKey && s.id !== shelf.id) {
            await db
              .delete(schema.shelfItems)
              .where(and(eq(schema.shelfItems.shelfId, s.id), eq(schema.shelfItems.bookId, book.id)));
          }
        }
      }
      await db
        .insert(schema.shelfItems)
        .values({ shelfId: shelf.id, bookId: book.id })
        .onConflictDoNothing({
          target: [schema.shelfItems.shelfId, schema.shelfItems.bookId],
        });
      await logActivity(ctx.user.id, "shelved", {
        shelf: shelf.systemKey ?? shelf.name,
        bookExternalId: book.externalId,
        bookTitle: book.title,
        bookCover: book.cover,
      });
      return { ok: true };
    }),

  remove: authedQuery
    .input(z.object({ shelfId: z.number().int().positive(), bookId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const shelf = await db.query.shelves.findFirst({
        where: and(eq(schema.shelves.id, input.shelfId), eq(schema.shelves.userId, ctx.user.id)),
      });
      if (!shelf) throw new TRPCError({ code: "NOT_FOUND", message: "Shelf not found" });
      await db
        .delete(schema.shelfItems)
        .where(and(eq(schema.shelfItems.shelfId, input.shelfId), eq(schema.shelfItems.bookId, input.bookId)));
      return { ok: true };
    }),
});
