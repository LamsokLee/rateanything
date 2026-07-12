# Tasks

## Completed

- **2026-07-11**: Trending algorithm implemented — read-time decay formula `total_ratings / (hours_since_last_activity + 2)^1.5` applied on-write + at query time for correct feed ordering without cron.
- **2026-07-11**: Dynamic OG share-image implemented — `opengraph-image.tsx` renders branded card with topic title, top-rated option, avg rating, and total votes via Next.js built-in `ImageResponse`.
- **2026-07-11**: Rate limiting implemented — Redis-backed fixed-window per-user/per-IP rate limiting via tRPC middleware. Limits applied (per DESIGN.md):
  - `ratings.submit`: 30/hour per IP (guests) or per user (auth)
  - `comments.create`: 60/hour per user
  - `comments.reply`: 60/hour per user
  - `comments.upvote`: 120/hour per user
  - `comments.downvote`: 120/hour per user
  - `topics.create`: 10/hour per user
  - `moderation.report`: 10/hour per user
  
  **Fail-open design**: If Redis is unavailable (connection error, timeout, or REDIS_URL not set), all requests are allowed and a warning is logged. This ensures the app never crashes due to Redis being down.
  
  **Production caveat**: REDIS_URL is currently empty in production. Until a Redis instance (e.g., Upstash) is provisioned and REDIS_URL is set in `.env.production.local`, rate limiting will fail open in prod (all requests allowed). This is intentional — rate limiting degrades gracefully rather than blocking legitimate users.
- **2026-07-11**: Automated test suite added — **vitest** (^2.0.0) set up as test framework in `apps/web`.
  
  **Files added:**
  - `apps/web/vitest.config.ts` — minimal config (node env, path aliases)
  - `apps/web/src/server/__tests__/rate-limit.test.ts` — 7 unit tests
  - `apps/web/src/server/__tests__/schemas.test.ts` — 25 unit tests
  - `apps/web/src/server/schemas.ts` — extracted Zod schemas for testability
  
  **Coverage (32 tests total, all passing):**
  - Rate limiter enforcement (allows up to limit, blocks at limit+1 with TOO_MANY_REQUESTS)
  - Rate limiter fail-open (null Redis, Redis error, Redis timeout → request allowed)
  - Rate limiter identifier extraction (dbUserId for auth, x-forwarded-for IP for guests)
  - Validation: moderation.report reason enum (all 6 valid reasons pass, invalid rejected)
  - Validation: moderation.report targetType, targetId (UUID), details length
  - Validation: topic.create title bounds (min 5, max 100)
  - Validation: topic.create options bounds (min 2, max 20), option name constraints
  - Validation: topic.create optional fields (description length, URL format)
  
  **Deferred (follow-up):**
  - DB-backed integration tests (score recalculation, guest 3-topic limit) — requires test harness with isolated Postgres schema or transactions; skipped to avoid flakiness. Can be added when a test DB seeding/teardown pattern is established.

- **2026-07-11**: Schema deduplication — `apps/web/src/server/schemas.ts` is now the **single source of truth** for validation schemas. `moderation.ts` and `topics.ts` routers import `reportInputSchema` and `topicCreateInputSchema` from `schemas.ts` instead of defining them inline. The existing schema unit tests (`schemas.test.ts`, 25 tests) now directly validate the real router input schemas, eliminating drift risk. Also removed `as never` type-escape casts in `rate-limit.test.ts` in favor of a typed `FakeRedisClient` interface using `Pick<Redis, "incr" | "expire">`.
