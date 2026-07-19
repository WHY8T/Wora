import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { COMMUNITY_COLORS } from "@contracts/constants";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { logActivity } from "./queries/wora";

async function withStats(community: schema.Community, userId?: number) {
  const db = getDb();
  const [members] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.communityMembers)
    .where(eq(schema.communityMembers.communityId, community.id));
  const [postCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.posts)
    .where(eq(schema.posts.communityId, community.id));
  let joined = false;
  let myRole: "member" | "moderator" | null = null;
  if (userId) {
    const m = await db.query.communityMembers.findFirst({
      where: and(
        eq(schema.communityMembers.communityId, community.id),
        eq(schema.communityMembers.userId, userId),
      ),
    });
    joined = !!m;
    myRole = m?.role ?? null;
  }
  return {
    ...community,
    memberCount: Number(members?.count ?? 0),
    postCount: Number(postCount?.count ?? 0),
    joined,
    myRole,
  };
}

const slugSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores only");

export const communitiesRouter = createRouter({
  list: publicQuery
    .input(z.object({ q: z.string().max(64).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const q = input?.q?.trim();
      const rows = await db
        .select()
        .from(schema.communities)
        .where(q ? like(schema.communities.name, `%${q}%`) : undefined)
        .orderBy(desc(schema.communities.createdAt))
        .limit(60);
      const enriched = await Promise.all(rows.map((c) => withStats(c, ctx.user?.id)));
      return enriched.sort((a, b) => b.memberCount - a.memberCount);
    }),

  mine: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const memberships = await db
      .select()
      .from(schema.communityMembers)
      .where(eq(schema.communityMembers.userId, ctx.user.id));
    if (memberships.length === 0) return [];
    const rows = await db
      .select()
      .from(schema.communities)
      .where(inArray(schema.communities.id, memberships.map((m) => m.communityId)));
    return Promise.all(rows.map((c) => withStats(c, ctx.user.id)));
  }),

  bySlug: publicQuery
    .input(z.object({ slug: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const community = await db.query.communities.findFirst({
        where: eq(schema.communities.slug, input.slug.toLowerCase()),
      });
      if (!community) return null;
      return withStats(community, ctx.user?.id);
    }),

  create: authedQuery
    .input(
      z.object({
        slug: slugSchema,
        name: z.string().min(2).max(64),
        description: z.string().max(1000).optional(),
        color: z.enum(COMMUNITY_COLORS).default("#b45309"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const slug = input.slug.toLowerCase();
      const exists = await db.query.communities.findFirst({
        where: eq(schema.communities.slug, slug),
      });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "That community name is taken" });
      const [{ id }] = await db
        .insert(schema.communities)
        .values({
          slug,
          name: input.name,
          description: input.description ?? null,
          color: input.color,
          creatorId: ctx.user.id,
        })
        .returning({ id: schema.communities.id });
      await db.insert(schema.communityMembers).values({
        communityId: id,
        userId: ctx.user.id,
        role: "moderator",
      });
      await logActivity(ctx.user.id, "created_community", { slug, name: input.name });
      return db.query.communities.findFirst({ where: eq(schema.communities.id, id) });
    }),

  join: authedQuery
    .input(z.object({ communityId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const community = await db.query.communities.findFirst({
        where: eq(schema.communities.id, input.communityId),
      });
      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });
      await db
        .insert(schema.communityMembers)
        .values({ communityId: input.communityId, userId: ctx.user.id })
        .onConflictDoNothing({
          target: [schema.communityMembers.communityId, schema.communityMembers.userId],
        });
      await logActivity(ctx.user.id, "joined", { slug: community.slug, name: community.name });
      return withStats(community, ctx.user.id);
    }),

  leave: authedQuery
    .input(z.object({ communityId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(schema.communityMembers)
        .where(
          and(
            eq(schema.communityMembers.communityId, input.communityId),
            eq(schema.communityMembers.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),
});
