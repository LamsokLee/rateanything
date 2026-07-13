# RateAnything — Deployment Guide

> Last updated: 2026-07-11

## Overview

| Component | Service | Status |
|-----------|---------|--------|
| Frontend | Next.js (Turborepo) on Vercel | ✅ Live at https://rating.fyi |
| Database | Supabase PostgreSQL | ✅ Connected |
| Auth | Clerk | ✅ Production keys (pk_live_/sk_live_) |
| Domain | rating.fyi | ✅ Live |
| DNS | Cloudflare | ✅ Configured |
| Workers | Redis (optional) | ⚠️ Not configured |

**Production URL:** https://rating.fyi
**Vercel Alias:** https://rateanything-pi.vercel.app

## Environment Files

| File | Purpose | Gitignored? |
|------|---------|-------------|
| `.env` | Local dev defaults (non-secrets) | No |
| `.env.local` | Local dev secrets | Yes |
| `.env.prod` | Production secrets | Yes |
| `.env.example` | Template / documentation | No |

### Quick Start

```bash
# Local dev
cp .env.example .env.local
# Edit .env.local with your Clerk TEST keys and local DB
npm install
npm run dev

# Production deploy
vercel --prod
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:***@db.ref.supabase.co:5432/postgres` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | `pk_live_...` |
| `CLERK_SECRET_KEY` | Clerk secret key | `sk_live_...` |
| `NEXT_PUBLIC_APP_URL` | App URL for redirects | `https://rating.fyi` |

### Optional

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis for workers (e.g. `redis://localhost:6379`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-side key |

### Important Notes

- **Test keys (`pk_test_`/`sk_test_`)** only work on `localhost` — production requires **live keys (`pk_live_`/`sk_live_`)**
- `NEXT_PUBLIC_*` vars are bundled at build time — any change requires redeploy
- Secret vars (no `NEXT_PUBLIC_` prefix) are server-side only

## Deployment Steps

### 1. Database (Supabase)

Already configured. If setting up from scratch:

```bash
# Run migrations
DATABASE_URL=your-supabase-url npx drizzle-kit migrate

# Seed with demo data
DATABASE_URL=your-supabase-url node scripts/seed.js
```

### 2. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**Vercel settings:**
- Project name: `rateanything`
- Framework: Next.js (auto-detected)
- Root directory: `.` (Turborepo root)

### 3. Set Environment Variables in Vercel

Go to [Vercel Dashboard](https://vercel.com) → Project → Settings → Environment Variables, add:

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL` = `https://rating.fyi`

### 4. Configure Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Switch to **Production** environment
3. Add to **Allowed redirect URLs:**
   - `https://rating.fyi`
   - `https://rateanything-pi.vercel.app`

### 5. Configure DNS (Cloudflare)

For Clerk to work on a custom domain, add these DNS records as **DNS-only** (not proxied):

| Type | Name | Target |
|------|------|--------|
| CNAME | `accounts` | `accounts.clerk.services` |
| CNAME | `clerk` | `frontend-api.clerk.services` |
| CNAME | `clk._domainkey` | `dkim1.[instance].clerk.services` |
| CNAME | `clk2._domainkey` | `dkim2.[instance].clerk.services` |
| CNAME | `clkmail` | `mail.[instance].clerk.services` |

Verify domain in Clerk Dashboard after adding records.

## Deployment History

- **2026-07-10:** Initial Vercel deploy to `rateanything-pi.vercel.app`
- **2026-07-10:** Switched from Clerk test keys to production keys (fixed `MIDDLEWARE_INVOCATION_FAILED`)
- **2026-07-10:** Purchased `rating.fyi`, migrated DNS to Cloudflare
- **2026-07-11:** Fixed DNS for `clerk.rating.fyi`, resolved React hydration error (#418)
- **2026-07-11:** Fixed missing DB columns (`is_verified`, `updated_at`, `rating_id`)
- **2026-07-11:** Added Supabase client SDK keys

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| React error #418 | Hydration mismatch (Clerk) | Add `useEffect` mount guard |
| Login button missing | DNS not resolving `clerk.rating.fyi` | Check Cloudflare CNAME records |
| `MIDDLEWARE_INVOCATION_FAILED` | Clerk test keys on production | Switch to `pk_live_`/`sk_live_` |
| DB column errors | Missing columns in Supabase | Run SQL migration in Supabase SQL Editor |
| 500 on `ratings.submit` | `users` table missing `is_verified` | Add column via SQL |

## Credential Storage

Sensitive keys are stored in two places:

1. **Agent Vault** (most secure) — encrypted, for programmatic use:
   - Supabase access token
   - Cloudflare API token
   - Clerk production keys
   - Supabase anon key & service role key

2. **Project `.env` files** — for local dev and runtime:
   - `.env.local` → local dev secrets
   - `.env.prod` → production secrets

## Free Tier Limits

| Service | Free Tier | When to Upgrade |
|---------|-----------|-----------------|
| Vercel | 100GB/mo bandwidth | >100GB traffic |
| Supabase | 500MB storage | >500MB data |
| Clerk | 10K MAU | >10K users |
| Upstash Redis | 10K requests/day | Workers needed |

Total cost for hobby project: **$0/month**.

## Next Steps

- [ ] Confirm Supabase project URL (`NEXT_PUBLIC_SUPABASE_URL`)
- [ ] Test Supabase client SDK integration
- [ ] Set up Redis for workers (optional)
- [ ] Configure CI/CD pipeline for auto-deploy
