# RateAnything — Technical Design Doc

## 1. Overview

RateAnything is a universal rating platform where users create topics with defined options, rate those options 1-10, and debate via comments. It's "Polymarket for opinions" — structured scoring meets social debate. The system is a Next.js monolith (App Router + tRPC API) backed by Postgres, Redis, and Clerk auth, deployed on Fly.io. Target: solo-dev ships MVP in 9 weeks.

**Technical Constraints:**
- Solo developer — optimize for simplicity over scalability patterns
- MVP budget: $30-100/mo infrastructure (see PRODUCT.md Section 9.5)
- Must support guest ratings (device fingerprint, no account required for 3 topics)
- Real-time not needed — optimistic UI + fresh-on-load; live-event SSE is Phase 3 if demand exists
- Web-first, mobile-responsive; native app deferred

**Non-goals:** microservices, Kubernetes, custom auth, native mobile, ML-based scoring.

**Product spec:** See `PRODUCT.md` for full requirements, user stories, and business context.

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTS                                │
│   Browser (Next.js SSR/CSR)  •  Share Card Previews (OG)     │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────────────┐
│                    CLOUDFLARE CDN                              │
│   Static assets • SSR page cache (60s) • DDoS protection     │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                 FLY.IO APP SERVER                              │
│   Next.js (App Router) + tRPC API + BullMQ Workers           │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────────┐        │
│   │  SSR Pages  │  │ tRPC Router │  │  BullMQ Jobs │        │
│   │  (React)    │  │  (API)      │  │  (async)     │        │
│   └─────────────┘  └──────┬──────┘  └──────┬───────┘        │
└────────────────────────────┼────────────────┼────────────────┘
                             │                │
              ┌──────────────┼────────────────┼──────┐
              │              │                │      │
     ┌────────▼───┐  ┌──────▼──────┐  ┌─────▼────┐ │
     │   CLERK    │  │ NEON POSTGRES│  │ UPSTASH  │ │
     │   (Auth)   │  │  (Primary)   │  │  REDIS   │ │
     │            │  │              │  │(Cache+Q) │ │
     └────────────┘  └──────────────┘  └──────────┘ │
              │                                      │
     ┌────────▼────────┐                             │
     │  CLOUDFLARE R2  │                             │
     │  (Images/Cards) │                             │
     └─────────────────┘                             │
              └──────────────────────────────────────┘
```

**Communication patterns:**
- Sync: tRPC over HTTP (all client↔server)
- Async: BullMQ jobs via Redis (score recalc, notifications, share card gen)
- Data freshness: optimistic UI for own writes, fresh-on-load for others (no polling, no SSE at MVP)
- Auth: Clerk webhook → user sync; JWT in httpOnly cookie for session

---

## 3. Technology Choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14 (App Router) | SSR for SEO, API routes colocated, React Server Components |
| Language | TypeScript (strict) | End-to-end type safety with tRPC |
| API | tRPC v11 | Type-safe RPC, no codegen, shared types between client/server |
| ORM | Drizzle ORM | SQL-close, lightweight, excellent raw query escape hatch |
| Database | Neon Postgres | Serverless, branching for dev/staging, generous free tier |
| Cache/Queue | Upstash Redis | Serverless, pay-per-request, BullMQ compatible |
| Auth | Clerk | Handles OAuth/social/MFA, 10K MAU free, fastest integration |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, accessible components, fast iteration |
| Validation | Zod | Runtime validation + tRPC input schemas |
| Job Queue | BullMQ | Redis-backed, retries, scheduling, no extra infra |
| Image Gen | @vercel/og (Satori) | Share card generation from JSX templates |
| Hosting | Fly.io | Single platform for app + workers, multi-region, $5/mo base |
| CDN | Cloudflare | Free tier, global edge, R2 for object storage |
| Monitoring | Sentry + PostHog | Error tracking + product analytics, both have free tiers |

---

## 4. Data Model

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  slug        VARCHAR(50) NOT NULL UNIQUE,
  parent_id   INT REFERENCES categories(id),
  description TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Users (synced from Clerk via webhook)
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id        VARCHAR(64) NOT NULL UNIQUE,
  username        VARCHAR(30) NOT NULL UNIQUE,
  email           VARCHAR(255),
  avatar_url      TEXT,
  bio             VARCHAR(200),
  location        VARCHAR(100),
  is_verified     BOOLEAN DEFAULT FALSE,
  is_admin        BOOLEAN DEFAULT FALSE,
  reputation      INT DEFAULT 0,
  rating_count    INT DEFAULT 0,
  follower_count  INT DEFAULT 0,
  following_count INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Guests (device fingerprint tracking)
CREATE TABLE guests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint_hash VARCHAR(64) NOT NULL UNIQUE,
  ip_address       INET,
  user_agent       TEXT,
  rating_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_seen        TIMESTAMPTZ DEFAULT NOW()
);

-- Topics
CREATE TABLE topics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(100) NOT NULL,
  slug            VARCHAR(120) NOT NULL UNIQUE,
  description     VARCHAR(500),
  category_id     INT NOT NULL REFERENCES categories(id),
  image_url       TEXT,
  source_url      TEXT,
  creator_id      UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closing', 'closed', 'archived', 'pinned')),
  allow_new_options BOOLEAN DEFAULT FALSE,
  total_ratings   INT DEFAULT 0,
  trending_score  FLOAT DEFAULT 0,
  is_pinned       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  last_activity   TIMESTAMPTZ DEFAULT NOW()
);

-- Options within topics
CREATE TABLE options (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id      UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  description   VARCHAR(300),
  image_url     TEXT,
  sort_order    INT DEFAULT 0,
  avg_rating    FLOAT DEFAULT 0,
  rating_count  INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, name)
);

-- Ratings (one per user per option)
CREATE TABLE ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id   UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_id    UUID REFERENCES guests(id) ON DELETE SET NULL,
  score       SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  comment     VARCHAR(500),
  tags        VARCHAR(20)[] DEFAULT '{}',
  is_edited   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_rating_per_user_per_option UNIQUE (user_id, option_id),
  CONSTRAINT one_rating_per_guest_per_option UNIQUE (guest_id, option_id),
  CONSTRAINT must_have_rater CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

-- Comments (replies to ratings or topics, 2-level threading, topic-scoped)
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rating_id   UUID REFERENCES ratings(id) ON DELETE CASCADE,  -- optional: comment on a rating
  topic_id    UUID REFERENCES topics(id) ON DELETE CASCADE,    -- optional: comment on a topic (at least one must be set)
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
  content     VARCHAR(500) NOT NULL CHECK (char_length(content) >= 20),
  upvotes     INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Follows
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Notifications
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id  UUID NOT NULL REFERENCES users(id),
  target_type  VARCHAR(20) NOT NULL CHECK (target_type IN ('topic', 'rating', 'comment', 'user')),
  target_id    UUID NOT NULL,
  reason       VARCHAR(50) NOT NULL,
  details      VARCHAR(500),
  status       VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed', 'appealed')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

-- Badges (user achievements)
CREATE TABLE badges (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(200),
  icon        VARCHAR(10) NOT NULL,
  criteria    JSONB NOT NULL
);

CREATE TABLE user_badges (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id   INT NOT NULL REFERENCES badges(id),
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- Collections
CREATE TABLE collections (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_items (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  topic_id      UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, topic_id)
);

-- Indexes
CREATE INDEX idx_topics_category_trending ON topics(category_id, trending_score DESC);
CREATE INDEX idx_topics_created_at ON topics(created_at DESC);
CREATE INDEX idx_topics_status ON topics(status) WHERE status = 'active';
CREATE INDEX idx_topics_slug ON topics(slug);
CREATE INDEX idx_topics_trgm ON topics USING GIN (title gin_trgm_ops);
CREATE INDEX idx_options_topic ON options(topic_id, sort_order);
CREATE INDEX idx_ratings_option_created ON ratings(option_id, created_at DESC);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_guest ON ratings(guest_id);
CREATE INDEX idx_comments_rating ON comments(rating_id, upvotes DESC);
CREATE INDEX idx_comments_topic ON comments(topic_id, upvotes DESC);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_reports_status ON reports(status) WHERE status = 'pending';
CREATE INDEX idx_follows_following ON follows(following_id);
```

**Denormalization strategy:** `options.avg_rating`, `options.rating_count`, `topics.total_ratings`, and `topics.trending_score` are maintained by BullMQ workers within 5s of the triggering event. Acceptable staleness for a read-heavy workload (see PRODUCT.md Section 10.2).

---

## 5. API Design

All endpoints use tRPC. Below shows the router structure with input/output types.

### Error Format
```typescript
interface ApiError {
  code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL';
  message: string;
  details?: Record<string, string[]>; // field-level validation errors
}
```

### Pagination (cursor-based)
```typescript
interface CursorInput {
  cursor?: string;  // opaque, base64-encoded (id + sort value)
  limit?: number;   // default 20, max 50
}
interface CursorOutput<T> {
  items: T[];
  nextCursor: string | null;
}
```

### Topics Router

```typescript
// topics.create
input: {
  title: string;          // 5-100 chars
  description?: string;   // max 500
  categoryId: number;
  imageUrl?: string;
  sourceUrl?: string;
  allowNewOptions: boolean;
  options: { name: string; description?: string; imageUrl?: string }[];  // 1-20 options
}
output: { id: string; slug: string }
auth: required | rateLimit: 10/hour

// topics.getBySlug
input: { slug: string }
output: {
  id: string; title: string; slug: string; description: string | null;
  category: { id: number; name: string; slug: string };
  creator: { id: string; username: string; avatarUrl: string | null };
  status: string; totalRatings: number; createdAt: string;
  options: {
    id: string; name: string; avgRating: number; ratingCount: number;
    userRating?: { score: number; comment: string | null };
  }[];
}
auth: public | rateLimit: standard

// topics.trending
input: CursorInput & { categoryId?: number }
output: CursorOutput<TopicSummary>
auth: public | rateLimit: standard

// topics.search
input: { query: string; categoryId?: number } & CursorInput
output: CursorOutput<TopicSummary>
auth: public | rateLimit: standard

// topics.addOption (if topic allows)
input: { topicId: string; name: string; description?: string }
output: { id: string }
auth: required | rateLimit: 20/hour
```

### Ratings Router

```typescript
// ratings.submit
input: {
  optionId: string;
  score: number;        // 1-10 integer
  comment?: string;     // 20-500 chars if provided
  tags?: ('hot_take' | 'overrated' | 'underrated' | 'stat_head' | 'meme')[];
}
output: { id: string; optionAvgRating: number; optionRatingCount: number }
auth: required OR guest token | rateLimit: 30/hour (auth), 3/device (guest)

// ratings.getForOption
input: { optionId: string; sort: 'hot' | 'newest' | 'controversial' } & CursorInput
output: CursorOutput<{
  id: string; score: number; comment: string | null; tags: string[];
  user: { username: string; avatarUrl: string | null } | null;
  upvotes: number; replyCount: number; createdAt: string;
}>
auth: public | rateLimit: standard
```

### Comments Router

```typescript
// comments.getForTopic
input: { topicId: string; sort: 'newest' | 'top'; cursor?: string; limit?: number }
output: {
  comments: {
    id: string; content: string; upvotes: number; downvotes: number;
    createdAt: string; user: { id: string; username: string } | null;
    userVote: 'upvote' | 'downvote' | null;
    replies: (Omit<Comment, 'replies'>)[];
  }[];
  nextCursor: string | null;
}
auth: public | rateLimit: standard

// comments.create
input: { topicId: string; content: string; parentId?: string }  // 1-500 chars
output: { id: string; createdAt: string }
auth: required | rateLimit: 60/hour

// comments.reply (reply to a rating, max 2-level nesting)
input: { ratingId: string; parentId?: string; content: string }  // 20-500 chars
output: { id: string; createdAt: string }
auth: required | rateLimit: 60/hour

// comments.upvote
input: { commentId: string }
output: { success: boolean; upvotes: number; downvotes: number; score: number; userVote: string | null }
auth: required | rateLimit: 120/hour

// comments.downvote
input: { commentId: string }
output: { success: boolean; upvotes: number; downvotes: number; score: number; userVote: string | null }
auth: required | rateLimit: 120/hour
```

### Users Router

```typescript
// users.getProfile
input: { username: string }
output: { id: string; username: string; bio: string | null; avatarUrl: string | null;
  ratingCount: number; followerCount: number; followingCount: number;
  badges: { name: string; icon: string }[]; createdAt: string }
auth: public | rateLimit: standard

// users.follow / users.unfollow
input: { userId: string }
output: { followerCount: number }
auth: required | rateLimit: 60/hour

// users.deleteAccount
input: { confirmation: 'DELETE' }
output: { success: boolean }
auth: required | rateLimit: 1/day
```

### Moderation Router

```typescript
// moderation.report
input: { targetType: 'topic' | 'rating' | 'comment' | 'user'; targetId: string;
  reason: 'spam' | 'harassment' | 'hate_speech' | 'off_topic' | 'private_individual' | 'other';
  details?: string }
output: { id: string }
auth: required | rateLimit: 10/hour

// moderation.queue (admin)
input: CursorInput & { status?: 'pending' | 'appealed' }
output: CursorOutput<Report>
auth: admin | rateLimit: standard

// moderation.resolve (admin)
input: { reportId: string; action: 'dismiss' | 'hide_content' | 'ban_user'; reason: string }
output: { success: boolean }
auth: admin | rateLimit: standard
```

**Rate limiting tiers:**
| Tier | Limit | Applies to |
|------|-------|-----------|
| standard | 60 req/min per IP | Public reads |
| authenticated | 300 req/min per user | Logged-in users |
| write | Varies (see above) | Mutations |
| admin | 600 req/min | Admin endpoints |

---

## 6. Authentication & Authorization

**Provider:** Clerk (see PRODUCT.md Section 10.4, 14.2)

**Session strategy:**
- Clerk issues JWT, stored in `__session` httpOnly cookie (SameSite=Lax)
- tRPC middleware validates JWT via Clerk SDK on every request
- No Bearer tokens — cookie-only simplifies CSRF for same-origin

**Guest user flow:**
1. Client computes fingerprint via FingerprintJS (canvas + WebGL + fonts hash)
2. POST to `guests.register` with fingerprint hash → returns guest token (signed JWT, 7-day expiry)
3. Guest token allows rating on up to 3 topics (tracked server-side via `guests.rating_count`)
4. On signup, existing guest ratings migrate to the new user account (match by fingerprint)

**Permission model:**
| Action | Guest | Authenticated | Admin |
|--------|-------|---------------|-------|
| Browse topics | ✓ | ✓ | ✓ |
| Rate (≤3 topics) | ✓ | — | — |
| Rate (unlimited) | — | ✓ | ✓ |
| Create topic | — | ✓ | ✓ |
| Comment/reply | — | ✓ | ✓ |
| Report content | — | ✓ | ✓ |
| Moderate | — | — | ✓ |
| Pin/feature topics | — | — | ✓ |
| Delete any content | — | — | ✓ |
| Ban users | — | — | ✓ |

---

## 7. Client Data Freshness

**Approach: Optimistic UI + fresh-on-load. No real-time infrastructure.**

This is not a live ticker. Scores updating within seconds of another user’s rating provides negligible UX benefit at MVP scale (5K DAU, median ~3 concurrent viewers per topic). The correct model is Yelp/IMDB/Letterboxd: your own writes are instant, everyone else sees updated data on their next page load.

### How it works

```tsx
// User rates an option
function handleRate(score: number) {
  // 1. Optimistic: update local state immediately (0ms perceived latency)
  setMyRating(score);
  setAverage(computeNewAvg(currentAvg, ratingCount, score));
  setRatingCount(prev => prev + 1);

  // 2. Background: persist to server
  mutation.mutate({ optionId, score }, {
    onError: () => {
      // 3. Rollback on failure (rare: <0.1% of requests)
      setMyRating(null);
      setAverage(previousAvg);
      setRatingCount(prev => prev - 1);
      toast.error("Rating failed — try again");
    }
  });
}
```

### Data freshness guarantees

| Scenario | Freshness | Mechanism |
|----------|-----------|----------|
| User's own rating | Instant (0ms) | Optimistic local state |
| User's own comment | Instant (0ms) | Optimistic insert into local list |
| Other users' ratings (score) | Fresh on page load | Server-rendered or fetched on mount |
| Trending feed | ≤15 min stale | Background worker recalculates; CDN caches 60s |
| Topic page revisit | ≤60s stale | CDN TTL; user can pull-to-refresh |

### What we DON'T build

- ❌ WebSocket server
- ❌ SSE endpoints
- ❌ Redis pub/sub channels
- ❌ Client-side polling intervals
- ❌ Connection managers / reconnection logic
- ❌ Multi-instance message broadcasting

### Phase 3: Live Event Mode (if demand exists)

If a "live rating during Super Bowl" feature is ever needed (thousands watching the same score move in real-time), add opt-in SSE on a per-topic basis:
- Topic creator toggles "Live Mode" on
- Server opens SSE stream for that topic only
- Score pushes on every new rating batch (debounced 2s)
- Only built if users explicitly request it — do NOT pre-architect for this


## 8. Caching Strategy

| Layer | What | TTL | Invalidation |
|-------|------|-----|-------------|
| Cloudflare CDN | SSR topic pages | 60s | Stale-while-revalidate |
| Cloudflare CDN | Static assets (JS/CSS/images) | 1 year | Content hash in filename |
| Redis | Option scores (avg_rating, rating_count) | 5s | On rating submit (BullMQ job) |
| Redis | Trending feed | 15 min | Recalculated by cron job |
| Redis | User session/profile | 5 min | On profile update |
| Redis | Rate limit counters | Sliding window | Auto-expire |
| In-memory | Category list | App lifetime | Restart (rarely changes) |

**Pattern:** Cache-aside for all reads. Write-through not needed — 5s staleness acceptable.

**Hot path optimization:** Topic page load hits Redis for option scores, not Postgres. Cache miss → query DB → populate Redis → return.

---

## 9. Background Workers

All jobs run via BullMQ on the same Fly.io machine (separate process). Scale to dedicated worker machine at >10K DAU.

| Job | Trigger | SLA | Retry |
|-----|---------|-----|-------|
| `recalculate-score` | Rating submitted | <5s | 3x exponential |
| `update-trending` | Cron every 15 min | — | 3x |
| `generate-share-card` | First share of topic/rating | <10s | 3x |
| `dispatch-notification` | Comment/reply/follow | <30s | 5x |
| `auto-archive-topics` | Daily at 3am UTC | — | 1x |
| `cleanup-expired-guests` | Weekly | — | 1x |

**Score recalculation:**
```typescript
// On rating submit, enqueue:
await scoreQueue.add('recalculate', { optionId }, { delay: 0, priority: 1 });

// Worker:
const ratings = await db.select({ score: ratings.score })
  .from(ratings).where(eq(ratings.optionId, job.data.optionId));
const avg = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
await db.update(options).set({ avgRating: avg, ratingCount: ratings.length })
  .where(eq(options.id, job.data.optionId));
await redis.del(`option:${job.data.optionId}:score`);
```

---

## 10. Search & Discovery

**MVP:** Postgres trigram search (sufficient for <50K topics):
```sql
SELECT id, title, slug, ts_rank(to_tsvector(title), plainto_tsquery($1)) AS rank
FROM topics
WHERE title % $1 OR title ILIKE '%' || $1 || '%'
ORDER BY rank DESC, trending_score DESC
LIMIT 20;
```

The `idx_topics_trgm` GIN index powers fuzzy matching.

**Trending algorithm** (recalculated every 15 min):
```
trending_score = (ratings_24h * 1.0 + comments_24h * 0.5 + shares_24h * 2.0)
                 / (hours_since_creation + 2) ^ 1.5
```

**Category browsing:** Direct indexed query on `topics(category_id, trending_score DESC)`.

**Phase 2 migration:** If search latency exceeds 200ms p95 or topic count exceeds 50K, migrate to Meilisearch (self-hosted on Fly.io, ~$5/mo extra).

---

## 11. Content Moderation Pipeline

```
User submits content (topic/rating/comment)
        │
        ▼
┌─────────────────┐     BLOCK      ┌─────────────┐
│ Text toxicity   │───────────────▶│  Reject +    │
│ check (basic)   │                │  show error  │
└────────┬────────┘                └─────────────┘
         │ PASS
         ▼
┌─────────────────┐
│  Publish live   │
└────────┬────────┘
         │
         ▼ (async, post-publish)
┌─────────────────┐    5+ flags   ┌──────────────┐
│ Community flags  │──────────────▶│  Auto-hide   │
│ accumulate      │               │  Queue review │
└─────────────────┘               └──────────────┘
```

**Pre-publish (sync, <200ms):** Basic regex + word list for slurs/spam. No external API call at MVP (too slow + costly). Phase 2: Perspective API.

**Post-publish:** Community flagging. 5 unique flags → content auto-hidden, queued for admin review.

**Spam detection heuristics:**
- Same user posts >5 ratings in 1 minute → throttle
- Identical comment text across multiple options → flag
- New account (<24h) + >10 ratings → flag for review

**Admin actions:** Dismiss flag, hide content (soft delete), ban user (sets `users.banned_at`), escalate.

---

## 12. Infrastructure & Deployment

| Component | Service | Cost (5K DAU) |
|-----------|---------|--------------|
| App server | Fly.io (shared-cpu-1x, 256MB) | $5/mo |
| Worker process | Fly.io (same machine, separate process) | included |
| Database | Neon Postgres (free → Pro at scale) | $0-19/mo |
| Cache/Queue | Upstash Redis (pay-per-request) | $0-10/mo |
| CDN + DNS | Cloudflare (free tier) | $0 |
| Object storage | Cloudflare R2 | $0-5/mo |
| Auth | Clerk (free tier, 10K MAU) | $0 |
| Error tracking | Sentry (free tier) | $0 |
| Analytics | PostHog (free tier, 1M events/mo) | $0 |
| **Total** | | **$5-39/mo** |

**CI/CD pipeline:**
```
Push to main → GitHub Actions:
  1. Type check (tsc --noEmit)
  2. Lint (eslint)
  3. Unit tests (vitest)
  4. Build (next build)
  5. Deploy to Fly.io (fly deploy)
  6. Run DB migrations (drizzle-kit push)
  7. Smoke test (curl health endpoint)
```

**Environments:**
- Local: `docker-compose up` (Postgres + Redis containers)
- Staging: Fly.io preview app + Neon branch database
- Production: Fly.io + Neon main branch

---

## 13. Security Considerations

| Threat | Mitigation |
|--------|-----------|
| SQL injection | Drizzle ORM (parameterized queries); no raw SQL without `sql.raw` review |
| XSS | React auto-escaping + strict CSP headers (`default-src 'self'`) |
| CSRF | SameSite=Lax cookies; tRPC mutations use POST (no GET side effects) |
| Rate abuse | Per-IP (60/min) + per-user (300/min) via Upstash rate limiter |
| Credential stuffing | Clerk handles (brute-force protection built-in) |
| Score manipulation | Device fingerprint limits guests; one-rating-per-user DB constraint |
| Data exposure | Zod schemas strip unknown fields; select only needed columns |
| Secrets | Fly.io secrets (env vars); never in repo; `.env.local` git-ignored |

**Device fingerprinting:**
- Client: FingerprintJS (open-source version for MVP, Pro for Phase 2)
- Only the SHA-256 hash is stored — raw signals never leave the client
- Used solely for guest rate limiting, not tracking

**Input validation:** Every tRPC procedure has a Zod schema. Example:
```typescript
const createTopicSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().max(500).optional(),
  categoryId: z.number().int().positive(),
  options: z.array(z.object({
    name: z.string().min(1).max(100),
  })).min(1).max(20),
});
```

---

## 14. Observability

**Structured logging:**
```typescript
// Every request gets a correlation ID
const logger = pino({ level: 'info' });
// Output: {"level":"info","reqId":"abc123","method":"topics.create","userId":"...","duration":42}
```

**Metrics to track:**
- Request latency p50/p95/p99 (target: p99 <500ms)
- Rating submission rate (proxy for engagement)
- Error rate by endpoint
- DB connection pool utilization
- BullMQ job queue depth + processing time

**Alerts (Sentry + Fly.io):**
- Error rate >5% over 5 min
- p99 latency >2s sustained 5 min
- BullMQ queue depth >1000 (jobs backing up)
- Fly.io machine memory >80%

---

## 15. Migration & Rollback Strategy

**Schema migrations:** Drizzle Kit generates SQL migration files, committed to repo. Applied via `drizzle-kit push` in CI/CD.

**Rules for safe migrations:**
- All migrations must be additive (add column, add table, add index)
- Column removal: first deploy ignores column, then next deploy removes it
- Never rename columns in production — add new, migrate data, drop old

**Rollback:**
- Code: `fly deploy --image <previous-image-ref>` (instant, <30s)
- Schema: Not rolled back (additive-only means old code still works with new schema)
- Data: Backfill scripts in `/scripts/`, all idempotent with dry-run mode

---

## 16. Trade-Off Decisions

| Decision | Chosen | Alternative | Rationale |
|----------|--------|-------------|-----------|
| API style | tRPC | REST | End-to-end type safety, zero API layer boilerplate, ideal for single-dev monorepo |
| ORM | Drizzle | Prisma | ~3x lighter bundle, SQL-like syntax, better escape hatch for raw queries |
| Data freshness | Optimistic UI + fresh-on-load | Polling / SSE / WebSocket | No real-time infra needed at MVP scale; scores aren't live tickers. Add SSE per-topic only if live-event demand materializes. |
| Search | Postgres FTS | Meilisearch | No extra infra; pg_trgm sufficient until 50K+ topics |
| Auth | Clerk | Custom/Auth0 | Fastest integration, generous free tier, OAuth + guest handled |
| Hosting | Fly.io | Vercel + separate DB host | Single platform for app + workers + long-running processes |
| Scoring (MVP) | Simple average | Weighted | Ship simple; weighting adds perceived unfairness without abuse data |
| Monorepo tool | Turborepo | Nx | Simpler config, sufficient for 2-3 packages, zero learning curve |
| Image gen | @vercel/og | Puppeteer | Edge-compatible, fast (<50ms), no headless browser needed |

---

## 17. MVP Scope (Engineering Perspective)

**Ships (Weeks 1-9):**
- Topic CRUD + option management
- Rating submission (1-10, optional comment, tags)
- Simple average scoring (async recalculation via BullMQ)
- Comment system (2-level threading, upvotes)
- Auth via Clerk (signup/login/OAuth)
- Guest browsing + guest rating (3-topic limit)
- Homepage: trending, newest, by-category
- Topic pages: SSR with OG meta tags
- Share card generation (@vercel/og)
- Basic moderation (community flag → auto-hide at 5 flags)
- Rate limiting (per-IP + per-user)
- Category browsing
- User profiles (public, with rating history)
- Follow/unfollow users

**Deferred to Phase 2:**
- Real-time score updates (optimistic UI is sufficient; SSE live-event mode deferred to Phase 3 if demand exists)
- Weighted scoring algorithm
- Auto-topic generation from external APIs
- Push notifications (OneSignal)
- Badge system (tables exist, logic deferred)
- Leaderboards
- Email digests
- Full-text search (ILIKE substring match for MVP)
- Collections
- Perspective API toxicity check (use word list for MVP)

---

## Appendix A: Project Structure

```
rateanything/
├── apps/
│   └── web/                    # Next.js app (frontend + tRPC API)
│       ├── src/
│       │   ├── app/            # App Router: pages, layouts, loading states
│       │   │   ├── (auth)/     # Auth pages (sign-in, sign-up)
│       │   │   ├── topic/[slug]/ # Topic page (SSR)
│       │   │   ├── category/[slug]/ # Category listing
│       │   │   ├── user/[username]/ # Profile page
│       │   │   └── api/trpc/  # tRPC HTTP handler
│       │   ├── server/
│       │   │   ├── routers/    # tRPC routers (topics, ratings, comments, users, moderation)
│       │   │   ├── trpc.ts     # tRPC init + context + middleware
│       │   │   └── services/   # Business logic (scoring, trending, moderation)
│       │   ├── components/     # React components (shadcn/ui based)
│       │   ├── lib/            # Utils: slugify, fingerprint, formatters
│       │   └── styles/         # Tailwind config + globals.css
│       ├── public/             # Favicon, robots.txt, manifest
│       └── next.config.ts
├── packages/
│   ├── db/                     # Drizzle schema, client, migrations
│   │   ├── schema/             # Table definitions (one file per table)
│   │   ├── migrations/         # Generated SQL migrations
│   │   ├── seed.ts             # Development seed data
│   │   └── index.ts            # DB client export
│   └── workers/                # BullMQ job definitions + processors
│       ├── jobs/               # recalculate-score, update-trending, etc.
│       └── index.ts            # Worker startup
├── scripts/                    # One-off: seed-categories, backfill-slugs
├── docker-compose.yml          # Local: postgres:16 + redis:7
├── turbo.json                  # Build orchestration
├── .github/workflows/deploy.yml
└── fly.toml                    # Fly.io config
```

---

*Design doc v1.0 — 2026-07-09. Derived from PRODUCT.md v0.3.*
