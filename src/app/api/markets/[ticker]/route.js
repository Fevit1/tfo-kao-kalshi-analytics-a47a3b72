// KAO — Kalshi Analytics Optimizer
// GET /api/markets/[ticker] — Proxy to Kalshi GET /markets/{ticker}
// Validates ticker regex before forwarding.
// Returns full market detail including current yes_price and rules_text.
// Returns mapped 404 if market is closed or delisted.

import { isValidTicker } from '@/lib/validation'

const KALSHI_BASE_URL = 'https://demo-api.kalshi.co/trade-api/v2'

/**
 * Map a raw Kalshi single-market response to the canonical Market runtime type.
 * @param {Object} raw
 * @returns {import('@/lib/types').Market}
 */
function mapMarketDetail(raw) {
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

export async function GET(request, { params }) {
  const { ticker } = params

  // --- Validate ticker ---
  if (!isValidTicker(ticker)) {
    return Response.json(
      {
        error: `Invalid ticker format: "${ticker}". Ticker must match /^[A-Z0-9\\-]{1,64}$/.`,
        code: 'INVALID_TICKER',
      },
      { status: 400 }
    )
  }

  // --- Check API key ---
  const apiKey = process.env.KALSHI_API_KEY
  if (!apiKey) {
    console.error('[/api/markets/[ticker]] KALSHI_API_KEY is not set')
    return Response.json(
      {
        error: 'Kalshi API key is not configured.',
        code: 'MISSING_API_KEY',
      },
      { status: 500 }
    )
  }

  // --- Fetch from Kalshi ---
  const kalshiUrl = `${KALSHI_BASE_URL}/markets/${encodeURIComponent(ticker)}`

  let kalshiResponse
  try {
    kalshiResponse = await fetch(kalshiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })
  } catch (fetchError) {
    console.error(`[/api/markets/${ticker}] Network error:`, fetchError)
    return Response.json(
      {
        error: 'Failed to connect to Kalshi API.',
        code: 'NETWORK_ERROR',
      },
      { status: 502 }
    )
  }

  // --- Handle error responses ---
  if (kalshiResponse.status === 401) {
    return Response.json(
      {
        error: 'Invalid Kalshi API key.',
        code: 'INVALID_API_KEY',
      },
      { status: 401 }
    )
  }

  if (kalshiResponse.status === 404) {
    return Response.json(
      {
        error: `Market "${ticker}" not found. It may be closed or delisted.`,
        code: 'MARKET_NOT_FOUND',
        ticker,
      },
      { status: 404 }
    )
  }

  if (!kalshiResponse.ok) {
    const errorBody = await kalshiResponse.text().catch(() => '')
    console.error(`[/api/markets/${ticker}] Kalshi returned ${kalshiResponse.status}:`, errorBody)
    return Response.json(
      {
        error: `Kalshi API error (${kalshiResponse.status}).`,
        code: 'KALSHI_API_ERROR',
        status: kalshiResponse.status,
      },
      { status: 502 }
    )
  }

  // --- Parse and return ---
  let kalshiData
  try {
    kalshiData = await kalshiResponse.json()
  } catch (parseError) {
    console.error(`[/api/markets/${ticker}] Failed to parse Kalshi response:`, parseError)
    return Response.json(
      { error: 'Failed to parse Kalshi API response', code: 'PARSE_ERROR' },
      { status: 502 }
    )
  }

  // Kalshi single-market response: { market: {...} }
  const raw = kalshiData.market ?? kalshiData
  const market = mapMarketDetail(raw)

  return Response.json({ market })
}