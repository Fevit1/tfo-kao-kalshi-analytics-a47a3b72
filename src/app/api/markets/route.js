// KAO — Kalshi Analytics Optimizer
// GET /api/markets — Proxy to Kalshi GET /markets
// Handles: cursor pagination, category filtering, exponential backoff on 429
// Returns: { markets: Market[], cursor: string | null, has_more: boolean }

import { isValidCursor, isValidCategory, KALSHI_CATEGORY_ALLOWLIST } from '@/lib/validation'

const KALSHI_BASE_URL = 'https://demo-api.kalshi.co/trade-api/v2'

/**
 * Sleep helper for exponential backoff
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch Kalshi markets with exponential backoff on 429.
 * Retries: 1s, 2s, 4s (max 3 retries).
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<Response>}
 */
async function fetchWithBackoff(url, options, retries = 0) {
  const MAX_RETRIES = 3
  const BACKOFF_DELAYS = [1000, 2000, 4000]

  const response = await fetch(url, options)

  if (response.status === 429 && retries < MAX_RETRIES) {
    const delay = BACKOFF_DELAYS[retries] ?? 4000
    console.warn(`[/api/markets] Kalshi rate limit hit. Retrying in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})`)
    await sleep(delay)
    return fetchWithBackoff(url, options, retries + 1)
  }

  return response
}

/**
 * Map a raw Kalshi market object to the canonical Market runtime type.
 * Normalizes field names and validates kalshi_url domain.
 * @param {Object} raw
 * @returns {import('@/lib/types').Market}
 */
function mapMarket(raw) {
  // Kalshi demo API market URL construction
  const kalshiEnv = process.env.KALSHI_ENV ?? 'demo'
  const baseMarketUrl = kalshiEnv === 'demo'
    ? 'https://demo-api.kalshi.co/trade-api/v2'
    : 'https://kalshi.com'

  // yes_ask is the price to buy Yes contracts (cents, 0-99)
  const yes_price = raw.yes_ask ?? raw.yes_bid ?? raw.last_price ?? 50
  const no_price = raw.no_ask ?? raw.no_bid ?? (100 - yes_price)

  return {
    ticker: raw.ticker ?? '',
    title: raw.title ?? raw.question ?? '',
    category: raw.category ?? '',
    yes_price: Number(yes_price),
    no_price: Number(no_price),
    volume: Number(raw.volume ?? 0),
    close_date: raw.close_time ?? raw.expiration_time ?? '',
    rules_text: raw.rules_primary ?? raw.rules_secondary ?? '',
    kalshi_url: `https://kalshi.com/markets/${raw.ticker ?? ''}`,
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  // --- Validate cursor param ---
  const cursor = searchParams.get('cursor') ?? ''
  if (!isValidCursor(cursor)) {
    return Response.json(
      { error: 'Invalid cursor parameter', code: 'INVALID_CURSOR' },
      { status: 400 }
    )
  }

  // --- Validate limit param ---
  const limitRaw = searchParams.get('limit')
  let limit = 100
  if (limitRaw !== null) {
    const parsed = parseInt(limitRaw, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      return Response.json(
        { error: 'limit must be an integer between 1 and 100', code: 'INVALID_LIMIT' },
        { status: 400 }
      )
    }
    limit = parsed
  }

  // --- Validate category param ---
  const category = searchParams.get('category')
  if (category !== null && category !== '') {
    if (!isValidCategory(category)) {
      return Response.json(
        {
          error: `Unrecognized category: "${category}". Allowed values: ${KALSHI_CATEGORY_ALLOWLIST.join(', ')}`,
          code: 'INVALID_CATEGORY',
        },
        { status: 400 }
      )
    }
  }

  // --- Check API key ---
  const apiKey = process.env.KALSHI_API_KEY
  if (!apiKey) {
    console.error('[/api/markets] KALSHI_API_KEY is not set')
    return Response.json(
      {
        error: 'Kalshi API key is not configured. Please set KALSHI_API_KEY in the Vercel dashboard.',
        code: 'MISSING_API_KEY',
      },
      { status: 500 }
    )
  }

  // --- Build Kalshi API URL ---
  const kalshiUrl = new URL(`${KALSHI_BASE_URL}/markets`)
  kalshiUrl.searchParams.set('limit', String(limit))
  if (cursor) {
    kalshiUrl.searchParams.set('cursor', cursor)
  }
  if (category) {
    kalshiUrl.searchParams.set('category', category)
  }
  // Only fetch open markets
  kalshiUrl.searchParams.set('status', 'open')

  // --- Fetch from Kalshi ---
  let kalshiResponse
  try {
    kalshiResponse = await fetchWithBackoff(kalshiUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })
  } catch (fetchError) {
    console.error('[/api/markets] Network error fetching from Kalshi:', fetchError)
    return Response.json(
      {
        error: 'Failed to connect to Kalshi API. Check your network connection.',
        code: 'NETWORK_ERROR',
      },
      { status: 502 }
    )
  }

  // --- Handle Kalshi error responses ---
  if (kalshiResponse.status === 401) {
    console.error('[/api/markets] Kalshi returned 401 — invalid API key')
    return Response.json(
      {
        error: 'Invalid Kalshi API key. Please check your KALSHI_API_KEY in the Vercel dashboard.',
        code: 'INVALID_API_KEY',
      },
      { status: 401 }
    )
  }

  if (kalshiResponse.status === 429) {
    // This is reached only after all retries are exhausted
    console.error('[/api/markets] Kalshi rate limit exceeded after all retries')
    return Response.json(
      {
        error: 'Kalshi API rate limit exceeded. Please wait 60 seconds before refreshing.',
        code: 'RATE_LIMITED',
        retry_after: 60,
      },
      { status: 429 }
    )
  }

  if (!kalshiResponse.ok) {
    const errorBody = await kalshiResponse.text().catch(() => '')
    console.error(`[/api/markets] Kalshi returned ${kalshiResponse.status}:`, errorBody)
    return Response.json(
      {
        error: `Kalshi API error (${kalshiResponse.status}). Please try again.`,
        code: 'KALSHI_API_ERROR',
        status: kalshiResponse.status,
      },
      { status: 502 }
    )
  }

  // --- Parse and map response ---
  let kalshiData
  try {
    kalshiData = await kalshiResponse.json()
  } catch (parseError) {
    console.error('[/api/markets] Failed to parse Kalshi response:', parseError)
    return Response.json(
      { error: 'Failed to parse Kalshi API response', code: 'PARSE_ERROR' },
      { status: 502 }
    )
  }

  // Kalshi API returns { markets: [...], cursor: "..." }
  // cursor is null/absent when there are no more pages
  const rawMarkets = Array.isArray(kalshiData.markets) ? kalshiData.markets : []
  const nextCursor = kalshiData.cursor ?? null
  const hasCursor = typeof nextCursor === 'string' && nextCursor.length > 0

  const markets = rawMarkets.map(mapMarket)

  return Response.json({
    markets,
    cursor: hasCursor ? nextCursor : null,
    has_more: hasCursor,
  })
}