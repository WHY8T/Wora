import { authRouter } from "./auth-router.js";
import { booksRouter } from "./books/router.js";
import { profileRouter } from "./profile-router.js";
import { shelvesRouter } from "./shelves-router.js";
import { reviewsRouter } from "./reviews-router.js";
import { communitiesRouter } from "./communities-router.js";
import { postsRouter } from "./posts-router.js";
import { commentsRouter } from "./comments-router.js";
import { socialRouter } from "./social-router.js";
import { chatRouter } from "./chat-router.js";
import { createRouter, publicQuery } from "./middleware.js";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  books: booksRouter,
  profile: profileRouter,
  shelves: shelvesRouter,
  reviews: reviewsRouter,
  communities: communitiesRouter,
  posts: postsRouter,
  comments: commentsRouter,
  social: socialRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
