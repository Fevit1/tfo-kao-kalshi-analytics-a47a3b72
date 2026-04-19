# KAO — Kalshi Analytics Optimizer

A personal research tool for finding mispriced Kalshi prediction markets using real-world context from Perplexity and AI analysis from Claude.

## ⚠️ Security Notice

**Anyone who discovers this app's URL can trigger paid API calls (Kalshi, Perplexity, Anthropic) at the owner's expense.**

This is an accepted and documented trade-off. KAO is a single-user personal tool. Security relies on the unguessable Vercel deployment URL. There is no login or password gate by design.

**Do not share the Vercel URL publicly.**

## Demo Mode

When `NEXT_PUBLIC_KALSHI_ENV=demo`, a persistent banner is shown on all screens indicating that all prices and market data are simulated (Kalshi demo API). This is the default for Phase 1.

## Environment Variables

Set these in the Vercel dashboard for project `tfo-kao`. **Never commit them to git.**

| Variable | Description | Example |
|----------|-------------|---------|
| `KALSHI_API_KEY` | Kalshi demo API bearer token | `key_abc123...` |
| `PERPLEXITY_API_KEY` | Perplexity Sonar API key | `pplx-abc123...` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | `sk-ant-abc123...` |
| `KALSHI_ENV` | `demo` or `production` (server-side) | `demo` |
| `ANTHROPIC_MODEL` | Exact Claude Sonnet model slug (confirmed at Foundation) | `claude-3-5-sonnet-20241022` |
| `NEXT_PUBLIC_KALSHI_ENV` | `demo` or `production` (client-side, drives DemoBanner) | `demo` |

### Prohibited Variables

The following MUST NEVER exist — CI check will block deploy if found:
- `NEXT_PUBLIC_KALSHI_API_KEY`
- `NEXT_PUBLIC_PERPLEXITY_API_KEY`
- `NEXT_PUBLIC_ANTHROPIC_API_KEY`

## Tech Stack

- **Frontend**: Next.js 14 App Router, Tailwind CSS (dark mode), shadcn/ui, Lucide React
- **Backend**: Next.js API Routes (server-side proxy for all external API calls)
- **Persistence**: Browser localStorage only (no database in Phase 1)
- **Hosting**: Vercel — project `tfo-kao`

## Architecture

- `/` — Market Feed with Load More cursor pagination
- `/analysis/[ticker]` — Opportunity Analysis with Perplexity context + Claude score
- `/watchlist` — Saved markets with price delta tracking

All three external API calls (Kalshi, Perplexity, Anthropic) are proxied through Next.js API routes. API keys never reach the browser.

## Pre-Deploy Check

```bash
bash scripts/pre-deploy-check.sh
```

Checks for: NEXT_PUBLIC_ API key leaks, `dangerouslySetInnerHTML` usage, `.env.local` in git tracking.

## Local Development

```bash
# Install dependencies
npm install

# Copy env template and fill in your keys
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 2 Roadmap

- Server-side watchlist persistence (Supabase database)
- Multi-user support with Supabase Auth
- Analysis history and trend tracking
- Production Kalshi API switch