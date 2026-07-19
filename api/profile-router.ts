import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, like, or, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { GENRES } from "@contracts/constants";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  ensureDefaultShelves,
  getProfileByUserId,
  getProfileByUsername,
  isFollowing,
  publicUser,
} from "./queries/wora";
import { uploadAvatarImage } from "./lib/storage";

const usernameSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(24)
  .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only");

async function profileStats(userId: number) {
  const db = getDb();
  const [finished] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.shelfItems)
    .innerJoin(schema.shelves, eq(schema.shelfItems.shelfId, schema.shelves.id))
    .where(and(eq(schema.shelves.userId, userId), eq(schema.shelves.systemKey, "finished")));
  const [reading] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.shelfItems)
    .innerJoin(schema.shelves, eq(schema.shelfItems.shelfId, schema.shelves.id))
    .where(and(eq(schema.shelves.userId, userId), eq(schema.shelves.systemKey, "reading")));
  const [reviewCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.reviews)
    .where(eq(schema.reviews.userId, userId));
  const [followers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.follows)
    .where(eq(schema.follows.followeeId, userId));
  const [following] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.follows)
    .where(eq(schema.follows.followerId, userId));
  return {
    finished: Number(finished?.count ?? 0),
    reading: Number(reading?.count ?? 0),
    reviews: Number(reviewCount?.count ?? 0),
    followers: Number(followers?.count ?? 0),
    following: Number(following?.count ?? 0),
  };
}

export const profileRouter = createRouter({
  me: authedQuery.query(async ({ ctx }) => {
    const profile = await getProfileByUserId(ctx.user.id);
    return { user: ctx.user, profile: profile ?? null };
  }),

  byUsername: publicQuery
    .input(z.object({ username: z.string().min(1).max(24) }))
    .query(async ({ ctx, input }) => {
      const profile = await getProfileByUsername(input.username);
      if (!profile) return null;
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
      if (!user) return null;
      const stats = await profileStats(user.id);
      const following = ctx.user ? await isFollowing(ctx.user.id, user.id) : false;
      const isMe = ctx.user?.id === user.id;
      return { user: publicUser(user, profile), readingGoal: profile.readingGoal, stats, following, isMe };
    }),

  /** First-run onboarding: claim username + pick genres, create shelves. */
  setup: authedQuery
    .input(
      z.object({
        username: usernameSchema,
        genres: z.array(z.enum(GENRES)).max(8).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getProfileByUserId(ctx.user.id);
      if (existing) return existing;
      const taken = await getProfileByUsername(input.username);
      if (taken) throw new TRPCError({ code: "CONFLICT", message: "Username is taken" });
      const db = getDb();
      const [{ id }] = await db
        .insert(schema.profiles)
        .values({
          userId: ctx.user.id,
          username: input.username.toLowerCase(),
          genres: JSON.stringify(input.genres),
        })
        .returning({ id: schema.profiles.id });
      await ensureDefaultShelves(ctx.user.id);
      return db.query.profiles.findFirst({ where: eq(schema.profiles.id, id) });
    }),
  update: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        bio: z.string().max(500).optional(),
        avatar: z.string().url().max(1000).or(z.literal("")).optional(),
        avatarPreset: z.string().max(64).or(z.literal("")).optional(),
        genres: z.array(z.enum(GENRES)).max(8).optional(),
        readingGoal: z.number().int().min(1).max(500).optional(),
        discordUsername: z
          .string()
          .max(64)
          .regex(/^[a-z0-9._]{2,32}$/, "Enter a valid Discord username (lowercase, no @)")
          .or(z.literal(""))
          .optional(),
        spotifyUrl: z
          .string()
          .url()
          .max(300)
          .refine((v) => v.includes("open.spotify.com"), "Must be an open.spotify.com link")
          .or(z.literal(""))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { name, avatar, ...rest } = input;
      if (name !== undefined || avatar !== undefined) {
        await db
          .update(schema.users)
          .set({
            ...(name !== undefined ? { name } : {}),
            ...(avatar !== undefined ? { avatar: avatar || null } : {}),
          })
          .where(eq(schema.users.id, ctx.user.id));
      }
      const profile = await getProfileByUserId(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete setup first" });
      await db
        .update(schema.profiles)
        .set({
          ...(rest.bio !== undefined ? { bio: rest.bio } : {}),
          ...(rest.genres !== undefined ? { genres: JSON.stringify(rest.genres) } : {}),
          ...(rest.readingGoal !== undefined ? { readingGoal: rest.readingGoal } : {}),
          ...(rest.avatarPreset !== undefined ? { avatarPreset: rest.avatarPreset || null } : {}),
          ...(rest.discordUsername !== undefined
            ? { discordUsername: rest.discordUsername || null }
            : {}),
          ...(rest.spotifyUrl !== undefined ? { spotifyUrl: rest.spotifyUrl || null } : {}),
        })
        .where(eq(schema.profiles.userId, ctx.user.id));
      return getProfileByUserId(ctx.user.id);
    }),
  /** Accepts a small base64-encoded image (already resized client-side) and stores it. */
  uploadAvatar: authedQuery
    .input(
      z.object({
        dataUrl: z.string().max(4_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
      if (!match) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only JPEG or PNG images are supported.",
        });
      }
      const [, contentType, base64] = match;
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length > 3_000_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Image is too large (max ~3MB)." });
      }
      const url = await uploadAvatarImage(ctx.user.id, bytes, contentType);
      return { url };
    }),
  search: publicQuery
    .input(z.object({ q: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const db = getDb();
      const q = `%${input.q.trim()}%`;
      const profs = await db
        .select()
        .from(schema.profiles)
        .where(like(schema.profiles.username, q))
        .limit(12);
      if (profs.length === 0) return [];
      const users = await db
        .select()
        .from(schema.users)
        .where(
          or(...profs.map((p) => eq(schema.users.id, p.userId))),
        );
      const pmap = new Map(profs.map((p) => [p.userId, p]));
      return users.map((u) => publicUser(u, pmap.get(u.id) ?? null));
    }),

  stats: publicQuery
    .input(z.object({ username: z.string().min(1).max(24) }))
    .query(async ({ input }) => {
      const profile = await getProfileByUsername(input.username);
      if (!profile) return null;
      return profileStats(profile.userId);
    }),
});
