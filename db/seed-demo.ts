/**
 * Demo content seed: a few readers, shelves, reviews, posts, comments, votes.
 * Idempotent — safe to run once on a fresh database after db/seed.ts.
 * Run with: npx tsx db/seed-demo.ts
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import { ensureDefaultShelves, ensureBookCached, logActivity } from "../api/queries/wora";
import { catalogById } from "../api/books/catalog";
import { hashPassword } from "../api/lib/password";

const db = getDb();

// All seeded demo accounts share this password so you can log in and poke around.
const DEMO_PASSWORD = "wora-demo-1234";

async function upsertUser(name: string, username: string, bio: string, genres: string[]) {
  const email = `${username}@wora.demo`;
  let [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!u) {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const [{ id }] = await db
      .insert(schema.users)
      .values({ email, passwordHash, name })
      .returning({ id: schema.users.id });
    u = (await db.query.users.findFirst({ where: eq(schema.users.id, id) }))!;
  }
  const prof = await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, u.id) });
  if (!prof) {
    await db.insert(schema.profiles).values({
      userId: u.id,
      username,
      bio,
      genres: JSON.stringify(genres),
    });
    await ensureDefaultShelves(u.id);
  }
  return u;
}

async function shelve(userId: number, slug: string, systemKey: string) {
  const summary = catalogById(`local:${slug}`);
  if (!summary) return;
  const book = await ensureBookCached(summary);
  const shelf = (await db.query.shelves.findMany({ where: eq(schema.shelves.userId, userId) })).find(
    (s) => s.systemKey === systemKey,
  );
  if (!shelf) return;
  await db
    .insert(schema.shelfItems)
    .values({ shelfId: shelf.id, bookId: book.id })
    .onConflictDoNothing({ target: [schema.shelfItems.shelfId, schema.shelfItems.bookId] });
  await logActivity(userId, "shelved", {
    shelf: systemKey,
    bookExternalId: book.externalId,
    bookTitle: book.title,
    bookCover: book.cover,
  });
}

async function review(userId: number, slug: string, rating: number, body: string) {
  const summary = catalogById(`local:${slug}`);
  if (!summary) return;
  const book = await ensureBookCached(summary);
  const existing = await db.query.reviews.findFirst({
    where: and(eq(schema.reviews.userId, userId), eq(schema.reviews.bookId, book.id)),
  });
  if (existing) return;
  await db.insert(schema.reviews).values({ userId, bookId: book.id, rating, body });
  await logActivity(userId, "reviewed", {
    rating,
    bookExternalId: book.externalId,
    bookTitle: book.title,
    bookCover: book.cover,
    excerpt: body.slice(0, 140),
  });
}

async function join(userId: number, slug: string) {
  const c = await db.query.communities.findFirst({ where: eq(schema.communities.slug, slug) });
  if (!c) return;
  await db
    .insert(schema.communityMembers)
    .values({ communityId: c.id, userId })
    .onConflictDoNothing({ target: [schema.communityMembers.communityId, schema.communityMembers.userId] });
}

async function post(
  userId: number,
  slug: string,
  type: (typeof schema.POST_TYPES)[number],
  title: string,
  body: string,
  bookSlug?: string,
  score = 0,
  hoursAgo = 5,
) {
  const c = await db.query.communities.findFirst({ where: eq(schema.communities.slug, slug) });
  if (!c) return;
  const dup = await db.query.posts.findFirst({
    where: and(eq(schema.posts.communityId, c.id), eq(schema.posts.title, title)),
  });
  if (dup) return dup;
  let bookId: number | null = null;
  if (bookSlug) {
    const summary = catalogById(`local:${bookSlug}`);
    if (summary) bookId = (await ensureBookCached(summary)).id;
  }
  const [{ id }] = await db
    .insert(schema.posts)
    .values({
      communityId: c.id,
      userId,
      bookId,
      type,
      title,
      body,
      score,
      createdAt: new Date(Date.now() - hoursAgo * 3.6e6),
    })
    .returning({ id: schema.posts.id });
  await logActivity(userId, "posted", { postId: id, communitySlug: slug, title });
  return { id };
}

async function comment(userId: number, postId: number, body: string, score = 0, parentId?: number) {
  const [{ id }] = await db
    .insert(schema.comments)
    .values({ postId, userId, body, score, parentId: parentId ?? null })
    .returning({ id: schema.comments.id });
  await db
    .update(schema.posts)
    .set({ commentCount: (await db.query.comments.findMany({ where: eq(schema.comments.postId, postId) })).length })
    .where(eq(schema.posts.id, postId));
  return id;
}

async function main() {
  console.log("Seeding demo content...");

  // Rename the earlier e2e test user into the first demo persona
  await db.update(schema.users).set({ name: "Amelia Hart", email: "amelia@wora.demo" }).where(eq(schema.users.email, "testreader@wora.demo"));
  await db.update(schema.profiles).set({
    username: "amelia_reads",
    bio: "Fantasy first, everything else second. Perpetually three books behind on my TBR.",
    genres: JSON.stringify(["Fantasy", "Sci-Fi", "Classics"]),
  }).where(eq(schema.profiles.username, "testreader"));

  const amelia = (await db.query.users.findFirst({ where: eq(schema.users.email, "amelia@wora.demo") }))!;
  const marcus = await upsertUser(
    "Marcus Chen",
    "marcus_pages",
    "Recovering English major. I annotate everything and regret nothing.",
    ["Fiction", "Non-Fiction", "Historical Fiction"],
  );
  const sam = await upsertUser(
    "Sam Okafor",
    "sam_in_orbit",
    "Hard sci-fi enthusiast. If it has orbital mechanics, I'm in.",
    ["Sci-Fi", "Science", "Thriller"],
  );

  for (const uid of [amelia.id, marcus.id, sam.id]) {
    for (const slug of ["fantasy", "sciencefiction", "bookclub"]) await join(uid, slug);
  }
  await join(marcus.id, "nonfiction");
  await join(marcus.id, "classics");
  await join(sam.id, "mystery");

  await shelve(marcus.id, "mistborn", "finished");
  await shelve(marcus.id, "the-way-of-kings", "reading");
  await shelve(marcus.id, "sapiens", "want");
  await shelve(sam.id, "project-hail-mary", "finished");
  await shelve(sam.id, "dune", "finished");
  await shelve(sam.id, "foundation", "reading");
  await shelve(amelia.id, "name-of-the-wind", "want");

  await review(marcus.id, "mistborn", 5, "The magic system is a masterclass in setup and payoff. Vin's arc alone is worth the read.");
  await review(sam.id, "project-hail-mary", 4, "Weir does it again — science as both puzzle and plot. Rocky is an all-time great character.");
  await review(amelia.id, "name-of-the-wind", 5, "Prose like music. I've reread the opening more times than I'll admit.");

  // Amelia's existing e2e post (id 1) stays; add the rest
  const p2 = await post(marcus.id, "fantasy", "theory", "Sanderson's magic systems: rigorous rules or training wheels?",
    "Hard magic systems make solutions feel earned — but do they drain the mystery? I keep going back and forth. Where does everyone land on the hard/soft spectrum?", undefined, 14, 7);
  const p3 = await post(sam.id, "sciencefiction", "discussion", "Project Hail Mary film adaptation — dream casting for Rocky?",
    "With the movie on the way, the big question is how they handle Rocky. Full CGI? Puppet? And who voices them? My pick: a physical build with a character actor on voice.", "project-hail-mary", 22, 12);
  const p4 = await post(amelia.id, "bookclub", "discussion", "July pick: Piranesi by Susanna Clarke — discussion thread",
    "Our July read is Piranesi! Spoiler-free reactions in the top level, marked spoiler threads below. The House deserves its own fan theory wiki.", "piranesi", 31, 26);
  const p5 = await post(marcus.id, "nonfiction", "review", "Sapiens rewired how I think about money and myths",
    "Harari's 'shared fictions' framing explains everything from corporations to nations. Part history, part philosophy — occasionally sweeping, always thought-provoking.", "sapiens", 9, 30);
  const p6 = await post(sam.id, "mystery", "question", "Best locked-room mysteries that actually play fair?",
    "I want the solution to be deducible from the clues. The kind where you kick yourself for not seeing it. Recommendations?", undefined, 6, 16);

  if (p2) {
    await comment(amelia.id, p2.id, "Team hard magic all the way — the Allomancy heist in Mistborn works *because* we know the rules.", 8);
    await comment(sam.id, p2.id, "Counterpoint: Tolkien barely explains anything and it's the most beloved fantasy ever written.", 5);
  }
  if (p4) {
    const c = await comment(marcus.id, p4.id, "Finished it in two sittings. The ending reframe got me — I'll say nothing more here.", 11);
    await comment(amelia.id, p4.id, "The Albatross scene. That's all. That's the comment.", 6, c);
  }
  if (p3) {
    await comment(amelia.id, p3.id, "If they CGI Rocky I'm rioting. Practical effects or bust.", 4);
  }

  // Follows
  for (const [a, b] of [[marcus.id, amelia.id], [sam.id, amelia.id], [amelia.id, marcus.id]] as const) {
    await db
      .insert(schema.follows)
      .values({ followerId: a, followeeId: b })
      .onConflictDoNothing({ target: [schema.follows.followerId, schema.follows.followeeId] });
  }

  console.log("Demo content ready.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
