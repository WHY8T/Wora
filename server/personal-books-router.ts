import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { createRouter, authedQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import {
    uploadPersonalBookFile,
    getPersonalBookSignedUrl,
    deletePersonalBookFile,
} from "./lib/storage.js";

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB raw file

export const personalBooksRouter = createRouter({
    /** Lists the current user's uploaded books, most recent first. */
    list: authedQuery.query(async ({ ctx }) => {
        const db = getDb();
        return db
            .select()
            .from(schema.personalBooks)
            .where(eq(schema.personalBooks.userId, ctx.user.id))
            .orderBy(desc(schema.personalBooks.updatedAt));
    }),

    /** Accepts a base64 data URL for an EPUB or PDF the user owns and stores it privately. */
    upload: authedQuery
        .input(
            z.object({
                title: z.string().min(1).max(300),
                author: z.string().max(300).optional(),
                dataUrl: z.string().max(45_000_000),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const match = input.dataUrl.match(
                /^data:(application\/epub\+zip|application\/pdf);base64,(.+)$/,
            );
            if (!match) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Only EPUB or PDF files are supported.",
                });
            }
            const [, mime, base64] = match;
            const format = mime === "application/pdf" ? "pdf" : "epub";
            const bytes = Buffer.from(base64, "base64");
            if (bytes.length > MAX_FILE_BYTES) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "File is too large (max 30MB).",
                });
            }

            const storagePath = await uploadPersonalBookFile(ctx.user.id, bytes, format);

            const db = getDb();
            const [row] = await db
                .insert(schema.personalBooks)
                .values({
                    userId: ctx.user.id,
                    title: input.title.trim(),
                    author: input.author?.trim() || null,
                    format,
                    storagePath,
                    fileSizeBytes: bytes.length,
                })
                .returning();
            return row;
        }),

    /** Returns a short-lived signed URL to stream the file, only to its owner. */
    getReadUrl: authedQuery
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
            const db = getDb();
            const [book] = await db
                .select()
                .from(schema.personalBooks)
                .where(
                    and(eq(schema.personalBooks.id, input.id), eq(schema.personalBooks.userId, ctx.user.id)),
                );
            if (!book) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Book not found." });
            }
            const url = await getPersonalBookSignedUrl(book.storagePath);
            return { url, format: book.format, title: book.title, progress: book.progress };
        }),

    /** Saves reading position (epub.js CFI string, or a PDF page number as text). */
    saveProgress: authedQuery
        .input(z.object({ id: z.number(), progress: z.string().max(2000) }))
        .mutation(async ({ ctx, input }) => {
            const db = getDb();
            await db
                .update(schema.personalBooks)
                .set({ progress: input.progress })
                .where(
                    and(eq(schema.personalBooks.id, input.id), eq(schema.personalBooks.userId, ctx.user.id)),
                );
            return { ok: true };
        }),

    remove: authedQuery
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const db = getDb();
            const [book] = await db
                .select()
                .from(schema.personalBooks)
                .where(
                    and(eq(schema.personalBooks.id, input.id), eq(schema.personalBooks.userId, ctx.user.id)),
                );
            if (!book) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Book not found." });
            }
            await deletePersonalBookFile(book.storagePath);
            await db.delete(schema.personalBooks).where(eq(schema.personalBooks.id, input.id));
            return { ok: true };
        }),
});