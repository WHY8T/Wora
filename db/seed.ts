import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import { CATALOG } from "../api/books/catalog";

const COMMUNITIES = [
  { slug: "fantasy", name: "Fantasy", color: "#7c2d12", description: "Epic quests, dragons, magic systems, and sprawling worlds. From Tolkien to Sanderson — all fantasy welcome." },
  { slug: "sciencefiction", name: "Science Fiction", color: "#0e7490", description: "Space operas, hard sci-fi, cyberpunk, first contact, and futures near and far." },
  { slug: "mystery", name: "Mystery & Thriller", color: "#1d4ed8", description: "Whodunits, psychological thrillers, crime fiction, and page-turners you can't put down." },
  { slug: "romance", name: "Romance", color: "#be123c", description: "Meet-cutes, slow burns, romantasy, and happily-ever-afters. All the feels." },
  { slug: "nonfiction", name: "Non-Fiction", color: "#0f766e", description: "History, science, memoirs, essays, and big ideas. Books that teach you something." },
  { slug: "classics", name: "Classics", color: "#b45309", description: "The canon and beyond — from Austen to Orwell. Read them, reread them, argue about them." },
  { slug: "youngadult", name: "Young Adult", color: "#a21caf", description: "YA fantasy, contemporary, dystopia, and everything in between." },
  { slug: "horror", name: "Horror", color: "#4d7c0f", description: "Haunted houses, cosmic dread, slashers, and slow-burning unease. Read with the lights on." },
  { slug: "bookclub", name: "Wora Book Club", color: "#b45309", description: "The community-wide book club. One pick a month, discussed together. Everyone's invited." },
];

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Communities (idempotent)
  for (const c of COMMUNITIES) {
    const existing = await db.query.communities.findFirst({
      where: eq(schema.communities.slug, c.slug),
    });
    if (!existing) {
      await db.insert(schema.communities).values({ ...c, creatorId: null });
      console.log(`  + community w/${c.slug}`);
    }
  }

  // Local catalog books (idempotent)
  let added = 0;
  for (const b of CATALOG) {
    const existing = await db.query.books.findFirst({
      where: eq(schema.books.externalId, b.externalId),
    });
    if (!existing) {
      await db.insert(schema.books).values({
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
        trendingScore: 0,
      });
      added++;
    }
  }
  console.log(`  + ${added} catalog books (${CATALOG.length} total)`);

  console.log("Done.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
