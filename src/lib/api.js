// KAO — Kalshi Analytics Optimizer
// Client-side API helpers — all calls route through Next.js API routes.
// API keys never touch the browser.
// Import these functions in React components and pages.

/**
 * @typedef {Object} Market
 * @property {string} ticker
 * @property {string} title
 * @property {string} category
 * @property {number} yes_price - cents 0-99, equals implied probability %
 * @property {number} no_price
 * @property {number} volume
 * @property {string} close_date - ISO 8601
 * @property {string} rules_text
 * @property {string} kalshi_url
 */

/**
 * @typedef {Object} MarketsPage
 * @property {Market[]} markets
 * @property {string|null} cursor
 * @property {boolean} has_more
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} ticker
 * @property {number|null} score - 1-10, null if prose_only
 * @property {'YES'|'NO'|'PASS'|null} direction
 * @property {number|null} assessed_probability - 0-100
 * @property {number} implied_probability - 0-100
 * @property {'high'|'medium'|'low'|null} confidence
 * @property {string[]} key_factors
 * @property {string[]} key_uncertainties
 * @property {string} prose_explanation
 * @property {string|null} perplexity_context
 * @property {string[]} perplexity_citations
 * @property {boolean} perplexity_available
 * @property {boolean} prose_only
 * @property {string} analyzed_at - ISO 8601
 */

/**
 * @typedef {Object} ApiError
 * @property {string} error
 * @property {string} code
 * @property {number} [status]
 * @property {number} [retry_after]
 */

// ─── Markets Feed ──────────────────────────────────────────────────────────────

/**
 * Fetch a page of open Kalshi markets.
 * Routes through /api/markets — Kalshi API key never exposed to browser.
 *
 * @param {Object} options
 * @param {string} [options.cursor] - Pagination cursor from previous response
 * @param {number} [options.limit=100] - Markets per page (1-100)
 * @param {string} [options.category] - Filter by category (server-side allowlist enforced)
 * @returns {Promise<{ data: MarketsPage | null, error: ApiError | null }>}
 */
export async function fetchMarkets({ cursor, limit = 100, category } = {}) {
  try {
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    if (limit !== 100) params.set('limit', String(limit))
    if (category) params.set('category', category)

    const queryString = params.toString()
    const url = `/api/markets${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    const data = await response.json()

    if (!response.ok) {
      return { data: null, error: { ...data, status: response.status } }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: {
        error: 'Network error — could not reach the server.',
        code: 'NETWORK_ERROR',
      },
    }
  }
}

/**
 * Fetch a single market by ticker.
 * Used by Watchlist to get current yes_price for price delta calculation.
 *
 * @param {string} ticker - Kalshi market ticker
 * @returns {Promise<{ data: { market: Market } | null, error: ApiError | null }>}
 */
export async function fetchMarket(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    return {
      data: null,
      error: { error: 'Invalid ticker', code: 'INVALID_TICKER' },
    }
  }

  try {
    const response = await fetch(`/api/markets/${encodeURIComponent(ticker)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    const data = await response.json()

    if (!response.ok) {
      return { data: null, error: { ...data, status: response.status } }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: {
        error: 'Network error — could not reach the server.',
        code: 'NETWORK_ERROR',
      },
    }
  }
}

// ─── Analysis Pipeline ─────────────────────────────────────────────────────────

/**
 * Trigger the three-layer analysis pipeline for a market.
 * Calls /api/analyze which proxies Perplexity + Anthropic — keys never exposed.
 *
 * @param {Object} marketData
 * @param {string} marketData.ticker
 * @param {string} marketData.title
 * @param {string} [marketData.close_date]
 * @param {number} marketData.yes_price - cents 0-100
 * @param {number} marketData.implied_probability - 0-100
 * @param {string} [marketData.rules_text]
 * @returns {Promise<{ data: AnalysisResult | null, error: ApiError | null }>}
 */
export async function analyzeMarket({
  ticker,
  title,
  close_date,
  yes_price,
  implied_probability,
  rules_text,
}) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ticker,
        title,
        close_date: close_date ?? null,
        yes_price,
        implied_probability,
        rules_text: rules_text ?? '',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { data: null, error: { ...data, status: response.status } }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: {
        error: 'Network error — could not reach the analysis server.',
        code: 'NETWORK_ERROR',
      },
    }
  }
}

// ─── Watchlist Batch Price Fetching ───────────────────────────────────────────

/**
 * Fetch current yes_price for multiple watchlist tickers in parallel.
 * Concurrency-capped at 5 simultaneous requests to avoid overwhelming Kalshi API.
 * Returns a Map<ticker, { yes_price: number } | { error: ApiError }>.
 *
 * @param {string[]} tickers
 * @returns {Promise<Map<string, { yes_price: number } | { error: ApiError }>>}
 */
export async function fetchWatchlistPrices(tickers) {
  const results = new Map()
  if (!Array.isArray(tickers) || tickers.length === 0) return results

  const CONCURRENCY_LIMIT = 5

  // Process in batches
  for (let i = 0; i < tickers.length; i += CONCURRENCY_LIMIT) {
    const batch = tickers.slice(i, i + CONCURRENCY_LIMIT)
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        const { data, error } = await fetchMarket(ticker)
        if (error) {
          return { ticker, result: { error } }
        }
        return {
          ticker,
          result: { yes_price: data.market.yes_price },
        }
      })
    )
    for (const { ticker, result } of batchResults) {
      results.set(ticker, result)
    }
  }

  return results
}

// ─── Error Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if an API error represents an invalid/missing API key.
 * Used to trigger the invalid key banner on the Feed screen.
 * @param {ApiError} error
 * @returns {boolean}
 */
export function isInvalidKeyError(error) {
  return error?.code === 'INVALID_API_KEY' || error?.code === 'MISSING_API_KEY'
}

/**
 * Returns true if an API error is a rate limit error.
 * Used to trigger the 60-second cooldown UI state on RefreshButton.
 * @param {ApiError} error
 * @returns {boolean}
 */
export function isRateLimitError(error) {
  return error?.code === 'RATE_LIMITED' || error?.status === 429
}

/**
 * Returns true if an API error indicates a market was not found (closed/delisted).
 * Used by Watchlist to show the "Market no longer available" state.
 * @param {ApiError} error
 * @returns {boolean}
 */
export function isMarketNotFoundError(error) {
  return error?.code === 'MARKET_NOT_FOUND' || error?.status === 404
}

/**
 * Get a user-friendly error message from an ApiError.
 * @param {ApiError} error
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.'
  if (isInvalidKeyError(error)) {
    return 'Invalid Kalshi API key. Please check your configuration in the Vercel dashboard.'
  }
  if (isRateLimitError(error)) {
    const retryAfter = error.retry_after ? ` Please wait ${error.retry_after} seconds.` : ''
    return `Rate limit exceeded.${retryAfter}`
  }
  if (isMarketNotFoundError(error)) {
    return 'This market is no longer available on Kalshi.'
  }
  return error.error ?? 'An unexpected error occurred.'
}