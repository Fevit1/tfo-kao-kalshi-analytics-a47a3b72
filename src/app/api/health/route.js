// KAO — Kalshi Analytics Optimizer
// GET /api/health — Internal health check endpoint.
// Returns environment variable presence (not values) and build info.
// Used to verify Vercel deployment configuration without exposing secrets.

export async function GET() {
  const checks = {
    KALSHI_API_KEY: !!process.env.KALSHI_API_KEY,
    PERPLEXITY_API_KEY: !!process.env.PERPLEXITY_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    KALSHI_ENV: process.env.KALSHI_ENV ?? 'not set',
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? 'not set',
    NEXT_PUBLIC_KALSHI_ENV: process.env.NEXT_PUBLIC_KALSHI_ENV ?? 'not set',
  }

  const allKeysPresent =
    checks.KALSHI_API_KEY &&
    checks.PERPLEXITY_API_KEY &&
    checks.ANTHROPIC_API_KEY

  return Response.json({
    status: allKeysPresent ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  })
}