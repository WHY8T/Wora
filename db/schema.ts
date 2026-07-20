import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// FK helper: matches the integer type used by serial() PKs
const fk = (name: string) => integer(name);

/* ---------------------------------- profiles --------------------------------- */

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: fk("userId")
    .notNull()
    .unique()
    .references(() => users.id),
  username: varchar("username", { length: 24 }).notNull().unique(),
  bio: text("bio"),
  genres: text("genres"),
  avatarPreset: varchar("avatarPreset", { length: 64 }),
  discordUsername: varchar("discordUsername", { length: 64 }),
  spotifyUrl: varchar("spotifyUrl", { length: 300 }),
  readingGoal: integer("readingGoal").default(12).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

/* ----------------------------------- books ----------------------------------- */

export const books = pgTable(
  "books",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("externalId", { length: 64 }).notNull().unique(), // google id | gut:123 | local:slug
    source: varchar("source", { length: 16 }).notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    authors: text("authors"), // JSON array
    cover: text("cover"),
    description: text("description"),
    categories: text("categories"), // JSON array
    pageCount: integer("pageCount"),
    publishedDate: varchar("publishedDate", { length: 32 }),
    isbn: varchar("isbn", { length: 20 }),
    trendingScore: integer("trendingScore").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("books_title_idx").on(t.title)],
);
export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

/* ---------------------------------- shelves ---------------------------------- */

export const SHELF_KEYS = ["want", "reading", "finished"] as const;
export type ShelfKey = (typeof SHELF_KEYS)[number];

export const shelves = pgTable(
  "shelves",
  {
    id: serial("id").primaryKey(),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 64 }).notNull(),
    systemKey: varchar("systemKey", { length: 16 }), // want | reading | finished | null (custom)
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("shelves_user_idx").on(t.userId)],
);
export type Shelf = typeof shelves.$inferSelect;

export const shelfItems = pgTable(
  "shelf_items",
  {
    id: serial("id").primaryKey(),
    shelfId: fk("shelfId")
      .notNull()
      .references(() => shelves.id),
    bookId: fk("bookId")
      .notNull()
      .references(() => books.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("shelf_book_uniq").on(t.shelfId, t.bookId)],
);
export type ShelfItem = typeof shelfItems.$inferSelect;

/* ---------------------------------- reviews ---------------------------------- */

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    bookId: fk("bookId")
      .notNull()
      .references(() => books.id),
    rating: integer("rating").notNull(), // 1..5
    body: text("body"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("review_user_book_uniq").on(t.userId, t.bookId)],
);
export type Review = typeof reviews.$inferSelect;

/* -------------------------------- communities --------------------------------- */

export const communities = pgTable("communities", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 16 }).default("#b45309").notNull(),
  creatorId: fk("creatorId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Community = typeof communities.$inferSelect;

export const communityMemberRoleEnum = pgEnum("community_member_role", [
  "member",
  "moderator",
]);

export const communityMembers = pgTable(
  "community_members",
  {
    id: serial("id").primaryKey(),
    communityId: fk("communityId")
      .notNull()
      .references(() => communities.id),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    role: communityMemberRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("member_uniq").on(t.communityId, t.userId)],
);
export type CommunityMember = typeof communityMembers.$inferSelect;

/* ----------------------------------- posts ----------------------------------- */

export const POST_TYPES = [
  "discussion",
  "review",
  "theory",
  "fanart",
  "question",
] as const;
export type PostType = (typeof POST_TYPES)[number];

export const postTypeEnum = pgEnum("post_type", POST_TYPES);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    communityId: fk("communityId")
      .notNull()
      .references(() => communities.id),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    bookId: fk("bookId").references(() => books.id),
    type: postTypeEnum("type").default("discussion").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    body: text("body"),
    score: integer("score").default(0).notNull(),
    commentCount: integer("commentCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("posts_community_idx").on(t.communityId)],
);
export type Post = typeof posts.$inferSelect;

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: fk("postId")
      .notNull()
      .references(() => posts.id),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    parentId: fk("parentId"),
    body: text("body").notNull(),
    score: integer("score").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
);
export type Comment = typeof comments.$inferSelect;

export const voteTargetEnum = pgEnum("vote_target", ["post", "comment"]);

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    targetType: voteTargetEnum("targetType").notNull(),
    targetId: fk("targetId").notNull(),
    value: integer("value").notNull(), // 1 | -1
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("vote_uniq").on(t.userId, t.targetType, t.targetId)],
);
export type Vote = typeof votes.$inferSelect;

/* ----------------------------------- social ----------------------------------- */

export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: fk("followerId")
      .notNull()
      .references(() => users.id),
    followeeId: fk("followeeId")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("follow_uniq").on(t.followerId, t.followeeId)],
);
export type Follow = typeof follows.$inferSelect;

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 32 }).notNull(), // shelved | reviewed | posted | joined | followed
    meta: text("meta"), // JSON payload
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("activities_user_idx").on(t.userId)],
);
export type Activity = typeof activities.$inferSelect;

/* ----------------------------------- chat ----------------------------------- */

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  isGroup: integer("isGroup").default(0).notNull(), // 0 = direct (2 members), 1 = group
  name: varchar("name", { length: 128 }), // group name only; null for direct chats
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
});
export type Conversation = typeof conversations.$inferSelect;

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: serial("id").primaryKey(),
    conversationId: fk("conversationId")
      .notNull()
      .references(() => conversations.id),
    userId: fk("userId")
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    lastReadAt: timestamp("lastReadAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("conv_member_uniq").on(t.conversationId, t.userId),
    index("conv_member_user_idx").on(t.userId),
  ],
);
export type ConversationMember = typeof conversationMembers.$inferSelect;

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: fk("conversationId")
      .notNull()
      .references(() => conversations.id),
    senderId: fk("senderId")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);
export type Message = typeof messages.$inferSelect;

/* ------------------------------- notifications -------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: fk("userId") // recipient
      .notNull()
      .references(() => users.id),
    actorId: fk("actorId").references(() => users.id), // who triggered it (null for system notices)
    type: varchar("type", { length: 32 }).notNull(), // follow | message | comment | reply
    targetId: integer("targetId"), // conversationId / postId / commentId depending on type
    meta: text("meta"), // JSON payload: preview text, book title, etc.
    read: integer("read").default(0).notNull(), // 0 = unread, 1 = read
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_user_unread_idx").on(t.userId, t.read),
  ],
);
export type Notification = typeof notifications.$inferSelect;