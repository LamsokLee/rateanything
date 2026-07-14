/**
 * Root app router — merges all sub-routers into a single tRPC router.
 * This is the main entry point for all API procedures.
 */
import { router } from './trpc';
import { topicsRouter } from './routers/topics';
import { ratingsRouter } from './routers/ratings';
import { commentsRouter } from './routers/comments';
import { usersRouter } from './routers/users';
import { moderationRouter } from './routers/moderation';
import { arenaRouter } from './routers/arena';

export const appRouter = router({
  topics: topicsRouter,
  ratings: ratingsRouter,
  comments: commentsRouter,
  users: usersRouter,
  moderation: moderationRouter,
  arena: arenaRouter,
});

/** Type export for client-side type inference */
export type AppRouter = typeof appRouter;
