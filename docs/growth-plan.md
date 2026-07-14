# Growth Plan for rating.fyi

> Phased plan for making rating.fyi easy to access and attracting users.

---

## Phase 1: Remove Friction (Week 1)

**Goal:** Turn every visitor into a participant, and every participant into a referrer.

- **Anonymous voting** — Let visitors vote without logging in. Gate auth only on *creating* topics or *commenting*. Auth friction is the #1 conversion killer for a rating app.
- **PWA install prompt** — Add `next-pwa` (or a simple `manifest.json` + service worker) so repeat visitors get a home-screen icon. Removes the "open Safari, type URL, wait" friction.
- **Open Graph (OG) share cards** — Auto-generate shareable images for every topic page. Show topic title + current winner + star rating. Use `@vercel/og` or `satori`.
- **Native share button** — Use `navigator.share()` on mobile; copy-link + social buttons on desktop.

**Outcome:** A visitor can vote in 2 seconds and share a link that looks great on social/Slack/iMessage.

---

## Phase 2: Be Discoverable (Week 2)

**Goal:** Make Google and social platforms do the distribution work.

- **Structured data (JSON-LD)** — Add `AggregateRating` schema to topic pages so Google renders star snippets in search results.
- **SEO page titles** — Stop generic titles. Use dynamic titles like: `iPhone 16 Ratings & Reviews — rating.fyi`.
- **Trending / sitemap pages** — Public `/trending` and `/latest` feeds that update frequently and get indexed by search engines.
- **Comparison URLs** — Build `/compare/a-vs-b` pages (manual at first). These are inherently searched and shared.

**Outcome:** People find your site via Google when searching for "best gaming console ratings" or "iPhone 16 vs Samsung S25".

---

## Phase 3: Make It Spread (Week 3-4)

**Goal:** Turn users into a distribution channel.

- **Embeddable widgets** — Let bloggers paste an `<iframe>` showing a live rating for any topic. Free backlinks + referral traffic.
- **"Share your vote" prompt** — After voting, suggest sharing with pre-filled text: *"I rated iPhone 16 a 7/10 on rating.fyi"*.
- **Seed controversial topics** — Create 50 polarizing comparisons yourself (e.g., "best pizza chain", "overrated tech products", "Android vs iOS"). Controversy drives engagement and shares.
- **Reddit/TikTok bait** — Design topic pages to look good as screenshots. People share screenshots of polls more than they share links.

**Outcome:** Every vote becomes a potential social post; every topic becomes a potential backlink.

---

## Phase 4: Retention (Month 2)

**Goal:** Bring people back instead of hoping they remember.

- **Weekly email digest** — "Trending topics you voted on" or "Top movers this week". Use Clerk user profiles or a simple email list.
- **Follow topics** — Let users get notified when a topic they care about gets a new rating or comment.
- **Re-engagement push** — PWA push notifications for followed topics (optional, user-controlled).

**Outcome:** Users return weekly instead of one-and-done.

---

## What to Build First

The highest ROI right now:

1. **Anonymous voting** — Biggest friction removal. Do this first.
2. **OG share cards** — Turns every page into a shareable asset. Do this second.
3. **PWA install** — Makes repeat visits effortless. Do this third.

These three are low-effort, high-impact, and turn the site from a static page into a viral loop.

---

*Last updated: 2026-07-13*
