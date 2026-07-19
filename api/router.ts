import { authRouter } from "./auth-router";
import { booksRouter } from "./books/router";
import { profileRouter } from "./profile-router";
import { shelvesRouter } from "./shelves-router";
import { reviewsRouter } from "./reviews-router";
import { communitiesRouter } from "./communities-router";
import { postsRouter } from "./posts-router";
import { commentsRouter } from "./comments-router";
import { socialRouter } from "./social-router";
import { chatRouter } from "./chat-router";
import { createRouter, publicQuery } from "./middleware";

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
