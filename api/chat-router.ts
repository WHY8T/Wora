import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { loadAuthors } from "./queries/wora";

/** Verify the current user belongs to a conversation, or throw. */
async function requireMembership(conversationId: number, userId: number) {
  const db = getDb();
  const membership = await db.query.conversationMembers.findFirst({
    where: and(
      eq(schema.conversationMembers.conversationId, conversationId),
      eq(schema.conversationMembers.userId, userId),
    ),
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You're not part of this conversation" });
  }
  return membership;
}

export const chatRouter = createRouter({
  /** All conversations for the current user, newest activity first, with the other participant + last message + unread count. */
  conversations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const myMemberships = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, ctx.user.id));

    if (myMemberships.length === 0) return [];

    const convIds = myMemberships.map((m) => m.conversationId);
    const convs = await db
      .select()
      .from(schema.conversations)
      .where(inArray(schema.conversations.id, convIds))
      .orderBy(desc(schema.conversations.lastMessageAt));

    const allMembers = await db
      .select()
      .from(schema.conversationMembers)
      .where(inArray(schema.conversationMembers.conversationId, convIds));

    const otherUserIds = allMembers
      .filter((m) => m.userId !== ctx.user.id)
      .map((m) => m.userId);
    const authors = await loadAuthors(otherUserIds);
    const myMemberByConv = new Map(myMemberships.map((m) => [m.conversationId, m]));

    // Last message per conversation
    const lastMessages = await db
      .select()
      .from(schema.messages)
      .where(inArray(schema.messages.conversationId, convIds))
      .orderBy(desc(schema.messages.createdAt));
    const lastByConv = new Map<number, (typeof lastMessages)[number]>();
    for (const m of lastMessages) {
      if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
    }

    // Unread counts per conversation
    const unreadCounts = new Map<number, number>();
    for (const convId of convIds) {
      const mine = myMemberByConv.get(convId)!;
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, convId),
            gt(schema.messages.createdAt, mine.lastReadAt),
            sql`${schema.messages.senderId} != ${ctx.user.id}`,
          ),
        );
      unreadCounts.set(convId, count);
    }

    return convs.map((c) => {
      const otherId = allMembers.find(
        (m) => m.conversationId === c.id && m.userId !== ctx.user.id,
      )?.userId;
      const last = lastByConv.get(c.id);
      return {
        id: c.id,
        isGroup: c.isGroup === 1,
        name: c.name,
        lastMessageAt: c.lastMessageAt,
        otherUser: otherId ? authors.get(otherId) ?? null : null,
        lastMessage: last ? { body: last.body, senderId: last.senderId, createdAt: last.createdAt } : null,
        unreadCount: unreadCounts.get(c.id) ?? 0,
      };
    });
  }),

  /** Total unread messages across all conversations, for a nav badge. */
  unreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const myMemberships = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, ctx.user.id));
    let total = 0;
    for (const mine of myMemberships) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, mine.conversationId),
            gt(schema.messages.createdAt, mine.lastReadAt),
            sql`${schema.messages.senderId} != ${ctx.user.id}`,
          ),
        );
      total += count;
    }
    return { count: total };
  }),

  /** Find or create a 1-on-1 conversation with another user. */
  startDirect: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't message yourself" });
      }
      const db = getDb();
      const target = await db.query.users.findFirst({ where: eq(schema.users.id, input.userId) });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // Look for an existing direct conversation shared by both users.
      const mine = await db
        .select({ conversationId: schema.conversationMembers.conversationId })
        .from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.userId, ctx.user.id));
      const theirs = await db
        .select({ conversationId: schema.conversationMembers.conversationId })
        .from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.userId, input.userId));
      const shared = new Set(mine.map((m) => m.conversationId));
      const commonId = theirs.map((t) => t.conversationId).find((id) => shared.has(id));

      if (commonId) {
        const existing = await db.query.conversations.findFirst({
          where: eq(schema.conversations.id, commonId),
        });
        if (existing && existing.isGroup === 0) return { conversationId: existing.id };
      }

      const [conv] = await db
        .insert(schema.conversations)
        .values({ isGroup: 0 })
        .returning();
      await db.insert(schema.conversationMembers).values([
        { conversationId: conv.id, userId: ctx.user.id },
        { conversationId: conv.id, userId: input.userId },
      ]);
      return { conversationId: conv.id };
    }),

  /** Paginated messages for a conversation (must be a member). Cursor = message id to load before. */
  messages: authedQuery
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        cursor: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).default(40),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireMembership(input.conversationId, ctx.user.id);
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.conversationId, input.conversationId),
            input.cursor ? sql`${schema.messages.id} < ${input.cursor}` : undefined,
          ),
        )
        .orderBy(desc(schema.messages.id))
        .limit(input.limit);
      const authors = await loadAuthors([...new Set(rows.map((r) => r.senderId))]);
      return {
        items: rows
          .map((r) => ({ ...r, sender: authors.get(r.senderId) ?? null }))
          .reverse(),
        nextCursor: rows.length === input.limit ? rows[rows.length - 1]?.id : undefined,
      };
    }),

  /** Send a message into a conversation you belong to. */
  send: authedQuery
    .input(z.object({ conversationId: z.number().int().positive(), body: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      await requireMembership(input.conversationId, ctx.user.id);
      const db = getDb();
      const [msg] = await db
        .insert(schema.messages)
        .values({ conversationId: input.conversationId, senderId: ctx.user.id, body: input.body })
        .returning();
      await db
        .update(schema.conversations)
        .set({ lastMessageAt: msg.createdAt })
        .where(eq(schema.conversations.id, input.conversationId));
      await db
        .update(schema.conversationMembers)
        .set({ lastReadAt: msg.createdAt })
        .where(
          and(
            eq(schema.conversationMembers.conversationId, input.conversationId),
            eq(schema.conversationMembers.userId, ctx.user.id),
          ),
        );
      return msg;
    }),

  /** Mark a conversation as read up to now. */
  markRead: authedQuery
    .input(z.object({ conversationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireMembership(input.conversationId, ctx.user.id);
      const db = getDb();
      await db
        .update(schema.conversationMembers)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(schema.conversationMembers.conversationId, input.conversationId),
            eq(schema.conversationMembers.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),
});
