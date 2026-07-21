import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import type { BookSummary } from "@contracts/types";


/** Cache a provider book into the local books table; returns the row. */
export async function ensureBookCached(b: BookSummary) {
  const db = getDb();
  await db
    .insert(schema.books)
    .values({
      externalId: b.externalId,
      source: b.source,
      title: b.title.slice(0, 500),
      authors: JSON.stringify(b.authors),
      cover: b.cover,
      description: b.description,
      categories: JSON.stringify(b.categories),
      pageCount: b.pageCount,
      publishedDate: b.publishedDate,
      isbn: b.isbn,
    })
    .onConflictDoUpdate({
      target: schema.books.externalId,
      set: { cover: b.cover, description: b.description },
    });
  const row = await db.query.books.findFirst({
    where: eq(schema.books.externalId, b.externalId),
  });
  return row!;
}

export async function getBookByExternalIdCached(externalId: string) {
  return getDb().query.books.findFirst({
    where: eq(schema.books.externalId, externalId),
  });
}

export async function getProfileByUserId(userId: number) {
  return getDb().query.profiles.findFirst({
    where: eq(schema.profiles.userId, userId),
  });
}

export async function getProfileByUsername(username: string) {
  return getDb().query.profiles.findFirst({
    where: eq(schema.profiles.username, username.toLowerCase()),
  });
}

/** Create default shelves for a user (idempotent). */
export async function ensureDefaultShelves(userId: number) {
  const db = getDb();
  const existing = await db.query.shelves.findMany({
    where: eq(schema.shelves.userId, userId),
  });
  const have = new Set(existing.map((s) => s.systemKey));
  const defaults: Array<{ name: string; systemKey: string }> = [
    { name: "Want to Read", systemKey: "want" },
    { name: "Currently Reading", systemKey: "reading" },
    { name: "Finished", systemKey: "finished" },
  ];
  for (const d of defaults) {
    if (!have.has(d.systemKey)) {
      await db.insert(schema.shelves).values({ userId, name: d.name, systemKey: d.systemKey });
    }
  }
  return db.query.shelves.findMany({ where: eq(schema.shelves.userId, userId) });
}

export async function logActivity(
  userId: number,
  type: string,
  meta: Record<string, unknown>,
) {
  await getDb()
    .insert(schema.activities)
    .values({ userId, type, meta: JSON.stringify(meta) });
}

/** Notification types: "follow_request" | "follow_accepted" | "message" |
 * "comment" | "reply". Never notifies a user about their own action. */
export async function createNotification(
  userId: number,
  type: "follow_request" | "follow_accepted" | "message" | "comment" | "reply",
  opts: { actorId?: number | null; targetId?: number | null; meta?: Record<string, unknown> } = {},
) {
  const { actorId, targetId, meta } = opts;
  if (actorId != null && actorId === userId) return; // don't notify yourself
  await getDb()
    .insert(schema.notifications)
    .values({
      userId,
      actorId: actorId ?? null,
      type,
      targetId: targetId ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    });
}

/** Community book stats: avg rating, ratings count, readers count. */
export async function bookCommunityStats(bookId: number) {
  const db = getDb();
  const [rating] = await db
    .select({
      avg: sql<number | null>`avg(${schema.reviews.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(schema.reviews)
    .where(eq(schema.reviews.bookId, bookId));
  const [shelved] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.shelfItems)
    .innerJoin(schema.shelves, eq(schema.shelfItems.shelfId, schema.shelves.id))
    .where(eq(schema.shelfItems.bookId, bookId));
  return {
    avgRating: rating?.avg ? Math.round(rating.avg * 10) / 10 : null,
    ratingsCount: Number(rating?.count ?? 0),
    shelvedCount: Number(shelved?.count ?? 0),
  };
}

export type Relationship = "none" | "pending_sent" | "pending_received" | "accepted";

/** Relationship of `meId` looking at `otherId`'s profile:
 * - "accepted": connected (chat is unlocked)
 * - "pending_sent": I've requested to follow them, awaiting their response
 * - "pending_received": they've requested to follow me — I can accept/decline
 * - "none": no relationship either way
 */
export async function getRelationship(meId: number, otherId: number): Promise<Relationship> {
  if (meId === otherId) return "none";
  const db = getDb();
  const [mine, theirs] = await Promise.all([
    db.query.follows.findFirst({
      where: and(eq(schema.follows.followerId, meId), eq(schema.follows.followeeId, otherId)),
    }),
    db.query.follows.findFirst({
      where: and(eq(schema.follows.followerId, otherId), eq(schema.follows.followeeId, meId)),
    }),
  ]);
  if (mine?.status === "accepted" || theirs?.status === "accepted") return "accepted";
  if (mine?.status === "pending") return "pending_sent";
  if (theirs?.status === "pending") return "pending_received";
  return "none";
}

/** True once either direction between the two users is an accepted connection — this is what unlocks chat. */
export async function isConnected(userIdA: number, userIdB: number) {
  const rel = await getRelationship(userIdA, userIdB);
  return rel === "accepted";
}

export async function myVoteMap(userId: number, targetType: "post" | "comment", targetIds: number[]) {
  if (targetIds.length === 0) return new Map<number, number>();
  const rows = await getDb()
    .select()
    .from(schema.votes)
    .where(
      and(
        eq(schema.votes.userId, userId),
        eq(schema.votes.targetType, targetType),
        inArray(schema.votes.targetId, targetIds),
      ),
    );
  return new Map(rows.map((r) => [r.targetId, r.value]));
}

/** Hot ranking: score decayed by age. */
export function hotScore(score: number, createdAt: Date): number {
  const ageHours = Math.max(1, (Date.now() - createdAt.getTime()) / 3.6e6);
  return score / Math.pow(ageHours + 2, 1.4);
}

export function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function publicUser(u: schema.User, p?: schema.Profile | null) {
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    username: p?.username ?? null,
    bio: p?.bio ?? null,
    genres: parseJson<string[]>(p?.genres ?? null, []),
    avatarPreset: p?.avatarPreset ?? null,
    discordUsername: p?.discordUsername ?? null,
    spotifyUrl: p?.spotifyUrl ?? null,
  };
}
export async function loadAuthors(userIds: number[]) {
  if (userIds.length === 0) return new Map<number, ReturnType<typeof publicUser>>();
  const db = getDb();
  const users = await db.select().from(schema.users).where(inArray(schema.users.id, userIds));
  const profs = await db.select().from(schema.profiles).where(inArray(schema.profiles.userId, userIds));
  const pmap = new Map(profs.map((p) => [p.userId, p]));

  return new Map(users.map((u) => [u.id, publicUser(u, pmap.get(u.id) ?? null)]));
}

export async function getBooksByIds(ids: number[]) {
  if (ids.length === 0) return new Map<number, schema.Book>();
  const rows = await getDb().select().from(schema.books).where(inArray(schema.books.id, ids));
  return new Map(rows.map((b) => [b.id, b]));
}

export const orderDesc = desc;