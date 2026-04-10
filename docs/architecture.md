# Architecture — Codestuff Music SaaS

## Overview

A self-hosted, containerized SaaS product that wraps the MiniMax Music Generation API in a consumer-facing web product. Built for creators who want to generate AI music through a polished web interface — no CLI required.

The architecture is designed around two principles:
1. **Self-hosted from day one** via Docker + Coolify — runs on a $5-10 VPS
2. **Cloudflare as the service layer** — storage, CDN, DNS, bot protection. Services that scale without infrastructure management and can be dropped if needed

---

## Tech Stack

### Always-On (Self-Hosted via Coolify)

| Service | Role | Why |
|---------|------|-----|
| **Next.js (App Router)** | Web app + API routes | Full-stack React framework, handles auth, billing UI, dashboard |
| **Postgres 16** | Primary database | Users, subscriptions, generation history, API keys. Schema is portable — export to any Postgres host |
| **BullMQ** | Job queue | Async music generation jobs. Worker process polls MiniMax until audio is ready |
| **Redis** | Queue backend + cache | Required by BullMQ. Also caches rate limit counters |
| **Nginx** | Reverse proxy + SSL | Terminates HTTPS, routes to Next.js and worker |

### Cloudflare (Managed Services — Scales Auto, No Infra Work)

| Service | Role | Why |
|---------|------|-----|
| **Cloudflare Pages** | CDN + edge caching | Serves the Next.js app globally. Free. Point your domain CNAME here |
| **Cloudflare R2** | Audio file storage | S3-compatible object storage. Generated MP3s live here. ~$0.01/GB/month |
| **Cloudflare DNS** | Domain management | Free. One-click SSL, proxying, DDoS protection |
| **Cloudflare Turnstile** | Bot protection | Free, privacy-friendly captcha alternative for signup/login |
| **Cloudflare Workers** | Webhooks + middleware | Receives MiniMax webhook callbacks, forwards to internal services via Tunnel |

### External Services (Work with Self-Hosted)

| Service | Role | Why |
|---------|------|-----|
| **Stripe** | Payments + subscriptions | Industry standard. Handles billing, invoices, failed payment recovery |
| **Resend** | Transactional email | Works regardless of hosting. Welcome emails, receipts, error alerts |

---

## System Architecture

```
                         ┌─────────────────────────────────────────┐
                         │            Cloudflare Layer             │
                         │                                         │
  User Browser ──────────►│  Cloudflare DNS / Pages CDN / Turnstile │
                         │                         │                 │
                         │                    R2 Storage             │
                         │                 (audio files)            │
                         │                                         │
                         │          Cloudflare Workers              │
                         │     (webhook receiver, no infra)         │
                         │                                         │
                         └─────────────────────┬───────────────────┘
                                               │
                         ┌─────────────────────▼───────────────────┐
                         │           Nginx (reverse proxy)          │
                         │              + SSL termination            │
                         └─────────────────────┬───────────────────┘
                                               │
                         ┌─────────────────────▼───────────────────┐
                         │           Next.js (App Server)            │
                         │  Auth │ Dashboard │ Billing UI │ API    │
                         └─────────────────────┬───────────────────┘
                                               │
                         ┌─────────────────────▼───────────────────┐
                         │         BullMQ + Redis (Job Queue)        │
                         │                                         │
                         └─────────────────────┬───────────────────┘
                                               │
                         ┌─────────────────────▼───────────────────┐
                         │              Worker Process             │
                         │  Polls MiniMax API │ Saves to R2       │
                         │  Updates DB status │ Sends email        │
                         └─────────────────────────────────────────┘
                                               │
                         ┌─────────────────────▼───────────────────┐
                         │              Postgres DB                  │
                         │  users, keys, generations, subs           │
                         └─────────────────────────────────────────┘

External:
  MiniMax API ◄────────── Worker polls for job completion
  Stripe      ◄────────── Webhooks for billing events
  Resend      ◄────────── Transactional emails
```

### Data Flow: Music Generation

1. User fills out the web form (genre, mood, vocals, lyrics)
2. Next.js validates, checks rate limit, creates a generation record in Postgres with status `pending`
3. Next.js publishes job to BullMQ queue
4. User sees "Generating..." UI — frontend polls every 2s via SSE or polling
5. Worker picks up job from queue
6. Worker calls MiniMax API, gets a `task_id`
7. Worker polls MiniMax every 5s until `status === complete` (typically 20-60s)
8. On completion, Worker downloads audio from MiniMax response (hex), writes to R2
9. Worker updates Postgres: generation status → `complete`, R2 file URL stored
10. User's browser receives poll response with `complete` status
11. User sees "Download" button, gets a time-limited R2 URL

### Data Flow: Webhook (MiniMax async)

MiniMax supports async generation. Cloudflare Worker receives the webhook, writes to a temporary endpoint on the Next.js server (behind nginx, not public). Worker picks it up the same as above.

---

## Database Schema (Postgres)

```sql
-- Users (managed by NextAuth or custom)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  password_hash TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys (for developer access)
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash     TEXT UNIQUE NOT NULL,  -- stored as hash, shown once at creation
  name         TEXT NOT NULL,          -- "Production", "Dev Key", etc.
  rate_limit   INT DEFAULT 10,         -- requests per minute
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Subscriptions
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id     TEXT,
  tier                  TEXT DEFAULT 'free',  -- free | pro | power
  status                TEXT DEFAULT 'active', -- active | cancelled | past_due
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Generations
CREATE TABLE generations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  status           TEXT DEFAULT 'pending',  -- pending | processing | complete | failed
  prompt           TEXT,
  lyrics           TEXT,
  genre            TEXT,
  mood             TEXT,
  vocal_style      TEXT,
  r2_url           TEXT,    -- null until complete
  file_size_bytes  INT,
  duration_ms      INT,
  mini_max_task_id TEXT,
  trace_id         TEXT,
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- Usage tracking (for billing)
CREATE TABLE usage_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES generations(id),
  song_count  INT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Pricing Tiers

| Tier | Price | Songs/Month | Overage | Features |
|------|-------|-------------|---------|----------|
| **Free** | $0 | 3 | N/A | Basic generation, no API access |
| **Pro** | $15/mo | 30 | $0.50/song | Priority generation, full history, share links |
| **Power** | $50/mo | 150 | $0.30/song | Everything in Pro + API access + longer tracks |

Billing via Stripe:
- Subscription items as metered billing
- Overage calculated from `usage_logs` table, reconciled monthly
- Free tier gets no overage option (hard cap at 3)

---

## Self-Hosting with Coolify

### Repository Structure

```
/
├── docker-compose.yml        # All services (Next.js, worker, postgres, redis, nginx)
├── Dockerfile.app            # Next.js multi-stage build
├── Dockerfile.worker         # BullMQ worker process
├── nginx.conf                # Reverse proxy config
├── docs/
│   └── architecture.md       # This file
└── ...app files...
```

### Docker Compose Overview

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.app
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/musicdb
      REDIS_URL: redis://redis:6379
      MINIMAX_API_KEY: ${MINIMAX_API_KEY}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
    depends_on:
      - postgres
      - redis

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/musicdb
      REDIS_URL: redis://redis:6379
      MINIMAX_API_KEY: ${MINIMAX_API_KEY}
      R2_BUCKET: ${R2_BUCKET}
      R2_ACCESS_KEY: ${R2_ACCESS_KEY}
      R2_SECRET_KEY: ${R2_SECRET_KEY}
      R2_ENDPOINT: ${R2_ENDPOINT}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: musicdb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass

  redis:
    image: redis:7-alpine

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app

volumes:
  pgdata:
```

### Cloudflare Tunnel

To expose your self-hosted Coolify instance to the internet without opening firewall ports:

```bash
cloudflared tunnel --url http://localhost:80
```

Cloudflare Tunnel is free and routes traffic through Cloudflare's edge — you get free SSL, DDoS protection, and a public URL even on a residential connection.

---

## Portability Strategy

The architecture is designed so any major component can be swapped:

| Component | Default | Portability |
|-----------|--------|-------------|
| Database | Postgres (Coolify) | Export schema/data → Neon, Supabase, any Postgres host |
| Storage | R2 (Cloudflare) | R2 is S3-compatible → migrate to Backblaze B2, AWS S3, MinIO with zero code change |
| Queue | BullMQ + Redis | Drop-in replacement for any AMQP-compatible queue |
| App Server | Next.js on Coolify | Docker container → any Kubernetes, Railway, Render, Fly.io |
| CDN | Cloudflare Pages | CNAME swap → Vercel, Netlify, or self-hosted Nginx |

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** A working end-to-end generation on your own server

- [ ] Set up Docker Compose with Next.js, Postgres, Redis, Nginx
- [ ] Cloudflare: register domain, set up R2 bucket, configure Turnstile
- [ ] Database schema migrations
- [ ] User signup/login (NextAuth with credentials provider + email verification)
- [ ] Basic generation form (no wizard complexity — just genre, prompt, lyrics)
- [ ] Worker process: takes job from queue, calls MiniMax, saves to R2
- [ ] "Generating..." UI with polling
- [ ] R2 file download link on completion

**Deliverable:** `https://yourdomain.com` — user can sign up, generate a song, download MP3

### Phase 2: Polish & Rate Limits (Week 3)

**Goal:** Prevent abuse, clean up UX

- [ ] Free tier enforcement (3 songs/month cap in DB)
- [ ] Generation history page
- [ ] Error handling — MiniMax failures, network timeouts, worker restarts
- [ ] Retry logic in worker (BullMQ has built-in retry with backoff)
- [ ] Email onboarding sequence (Resend)
- [ ] Basic stats dashboard: songs generated, storage used

**Deliverable:** A product you'd be comfortable showing to a friend

### Phase 3: Billing (Weeks 4-5)

**Goal:** Accept money

- [ ] Stripe integration — create products/tiers, checkout flow
- [ ] Webhook handler for: `customer.subscription.created`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Tier enforcement in UI and API (Pro gets 30/mo, Power gets 150/mo)
- [ ] Usage calculation script (run as nightly cron or Stripe webhook)
- [ ] Billing portal page (Stripe Customer Portal embed)
- [ ] Free tier: no credit card required

**Deliverable:** Real paying customers can subscribe

### Phase 4: Developer API (Weeks 6-7)

**Goal:** Power users and builders can integrate via API

- [ ] Per-user API key generation (show once, store hash)
- [ ] API key auth middleware on API routes
- [ ] Rate limiting per key (Upstash Ratelimit with Redis)
- [ ] Swagger / OpenAPI docs (Scalar or ReDoc)
- [ ] Postman collection + example code
- [ ] Usage stats per key in dashboard

**Deliverable:** Developers can sign up, get an API key, generate songs via curl

### Phase 5: Share & Social (Week 8)

**Goal:** Viral loop, discoverability

- [ ] Public song pages (e.g., `yourdomain.com/song/[id]`) with OG image
- [ ] Share to Twitter/X with audio player card
- [ ] "Featured" community page (staff picks)
- [ ] Like/bookmark functionality
- [ ] Landing page with audio previews

### Phase 6: Scaling & Ops (Ongoing)

- [ ] Move Postgres from Docker volume to a dedicated host (Coolify supports external DB)
- [ ] Add Redis Sentinel for queue HA
- [ ] Sentry for error tracking
- [ ] Uptime monitoring (Better Uptime or Cloudflare Health Checks — free)
- [ ] Lighthouse CI on PRs for performance regression
- [ ] Database backups (pg_dump to R2)

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| MiniMax API cost overrun | Hard song cap per tier; overage billing; cost monitoring alert at $0.50 above typical |
| Audio storage costs | Auto-delete files older than 90 days (configurable); warn users at 80% storage quota |
| Worker crash during generation | BullMQ persists jobs — restart picks up where it left off |
| Abuse of free tier | Email verification required; Turnstile on signup; hard cap at 3, no overage |
| MiniMax rate limits | Exponential backoff; queue with priority levels (paid users get priority) |
| Long generation times UX | Optimistic UI; progress polling; email notification on completion |
| Stripe payment failures | Dunning emails via Stripe; grace period before tier downgrade |

---

## Monthly Cost Estimate (Early Stage)

| Component | Monthly Cost |
|-----------|-------------|
| VPS (Hetzner, Contabo, or Oracle Free Tier) | $0–$10 |
| Domain + DNS | $0–$15/yr (~$1/mo) |
| Cloudflare Pages (free) | $0 |
| Cloudflare R2 (100GB) | ~$1 |
| Cloudflare Turnstile (free) | $0 |
| Cloudflare Workers (webhook relay) | $0 (free tier: 100k req/day) |
| Stripe (2.9% + 30¢ per transaction) | Only on revenue |
| Resend (free tier: 3k emails/mo) | $0 |
| Sentry (free tier) | $0 |
| **Total** | **~$2–12/mo** |

---

## Environment Variables

```bash
# App
DATABASE_URL=postgresql://user:pass@postgres:5432/musicdb
REDIS_URL=redis://redis:6379
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://yourdomain.com

# MiniMax
MINIMAX_API_KEY=your-minimax-key

# Cloudflare R2
R2_BUCKET=music-generated
R2_ACCESS_KEY=your-r2-access-key
R2_SECRET_KEY=your-r2-secret-key
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Resend
RESEND_API_KEY=re_...
```
