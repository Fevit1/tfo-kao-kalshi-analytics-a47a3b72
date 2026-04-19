// KAO — Kalshi Analytics Optimizer
// localStorage helpers: kalshi_watchlist and kalshi_preferences
// ALL reads are wrapped in try/catch with shape validation.
// Malformed data resets to safe defaults — never throws to caller.

// ─── Storage Keys ────────────────────────────────────────────
const WATCHLIST_KEY = 'kalshi_watchlist'
const PREFERENCES_KEY = 'kalshi_preferences'

// ─── Default Values ──────────────────────────────────────────

// Confirmed Kalshi API category values are set by ENDPOINTS agent after
// live API enumeration. This default list is a placeholder that will be
// replaced in the ENDPOINTS Foundation step. The preferences default uses
// all known categories so nothing is filtered out before confirmation.
const KNOWN_CATEGORIES_PLACEHOLDER = [
  'Politics',
  'Economics',
  'Finance',
  'Climate',
  'Sports',
  'Crypto',
  'Culture',
  'Science',
  'Other',
]

function defaultPreferences() {
  return {
    categories: [...KNOWN_CATEGORIES_PLACEHOLDER],
    sort_by: 'volume',
    last_updated: new Date().toISOString(),
  }
}

function defaultWatchlist() {
  return []
}

// ─── Shape Validators ─────────────────────────────────────────

function isValidPreferences(obj) {
  if (!obj || typeof obj !== 'object') return false
  if (!Array.isArray(obj.categories)) return false
  if (!obj.categories.every((c) => typeof c === 'string')) return false
  if (!['score', 'volume', 'close_date'].includes(obj.sort_by)) return false
  if (typeof obj.last_updated !== 'string') return false
  return true
}

function isValidWatchlistItem(item) {
  if (!item || typeof item !== 'object') return false
  if (typeof item.ticker !== 'string' || !item.ticker) return false
  if (typeof item.title !== 'string') return false
  if (typeof item.category !== 'string') return false
  if (typeof item.score !== 'number' || item.score < 1 || item.score > 10) return false
  if (!['YES', 'NO', 'PASS'].includes(item.direction)) return false
  if (typeof item.assessed_probability !== 'number') return false
  if (typeof item.implied_probability !== 'number') return false
  if (!['high', 'medium', 'low'].includes(item.confidence)) return false
  if (!Array.isArray(item.key_factors)) return false
  if (typeof item.summary !== 'string') return false
  if (typeof item.analyzed_at !== 'string') return false
  if (typeof item.kalshi_url !== 'string') return false
  if (typeof item.saved_yes_price !== 'number') return false
  return true
}

function isValidWatchlist(arr) {
  if (!Array.isArray(arr)) return false
  // Filter out malformed items rather than rejecting the whole array,
  // so one corrupted entry doesn't nuke the entire watchlist.
  return true
}

// ─── localStorage: kalshi_preferences ────────────────────────

export function readPreferences() {
  if (typeof window === 'undefined') return defaultPreferences()
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    if (!raw) return defaultPreferences()
    const parsed = JSON.parse(raw)
    if (!isValidPreferences(parsed)) {
      console.warn('[KAO] kalshi_preferences: invalid shape, resetting to defaults')
      return defaultPreferences()
    }
    return parsed
  } catch (err) {
    console.warn('[KAO] kalshi_preferences: read error, resetting to defaults', err)
    return defaultPreferences()
  }
}

export function writePreferences(prefs) {
  if (typeof window === 'undefined') return { ok: false, error: 'SSR' }
  try {
    const toWrite = {
      ...prefs,
      last_updated: new Date().toISOString(),
    }
    if (!isValidPreferences(toWrite)) {
      return { ok: false, error: 'Invalid preferences shape' }
    }
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(toWrite))
    return { ok: true }
  } catch (err) {
    // DOMException: QuotaExceededError — localStorage full
    const isQuotaError =
      err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    if (isQuotaError) {
      console.error('[KAO] localStorage full — cannot save preferences')
      return { ok: false, error: 'QUOTA_EXCEEDED' }
    }
    console.error('[KAO] kalshi_preferences: write error', err)
    return { ok: false, error: String(err) }
  }
}

// ─── localStorage: kalshi_watchlist ──────────────────────────

export function readWatchlist() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    if (!raw) return defaultWatchlist()
    const parsed = JSON.parse(raw)
    if (!isValidWatchlist(parsed)) {
      console.warn('[KAO] kalshi_watchlist: invalid shape (not an array), resetting to []')
      return defaultWatchlist()
    }
    // Filter out individually malformed items, preserve valid ones
    const valid = parsed.filter((item) => {
      if (!isValidWatchlistItem(item)) {
        console.warn('[KAO] kalshi_watchlist: dropping malformed item', item?.ticker ?? item)
        return false
      }
      return true
    })
    return valid
  } catch (err) {
    console.warn('[KAO] kalshi_watchlist: read error, resetting to []', err)
    return defaultWatchlist()
  }
}

export function writeWatchlist(items) {
  if (typeof window === 'undefined') return { ok: false, error: 'SSR' }
  if (!Array.isArray(items)) return { ok: false, error: 'items must be an array' }
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items))
    return { ok: true }
  } catch (err) {
    const isQuotaError =
      err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    if (isQuotaError) {
      console.error('[KAO] localStorage full — cannot save watchlist')
      return { ok: false, error: 'QUOTA_EXCEEDED' }
    }
    console.error('[KAO] kalshi_watchlist: write error', err)
    return { ok: false, error: String(err) }
  }
}

// ─── Watchlist Mutation Helpers ───────────────────────────────

/**
 * addToWatchlist — adds a new WatchlistItem, deduplicates by ticker.
 * If ticker already exists, behaves like mergeWatchlistItem (re-analyze path).
 * saved_yes_price is set from newItem.saved_yes_price on first add and
 * NEVER overwritten on subsequent calls.
 */
export function addToWatchlist(newItem) {
  if (!isValidWatchlistItem(newItem)) {
    return { ok: false, error: 'Invalid WatchlistItem shape' }
  }
  const existing = readWatchlist()
  const idx = existing.findIndex((i) => i.ticker === newItem.ticker)
  let updated
  if (idx === -1) {
    // First save — store saved_yes_price as the immutable price anchor
    updated = [...existing, { ...newItem }]
  } else {
    // Ticker already in watchlist — use mergeWatchlistItem to preserve anchor
    updated = existing.map((item, i) =>
      i === idx ? mergeWatchlistItem(item, newItem) : item
    )
  }
  return writeWatchlist(updated)
}

/**
 * mergeWatchlistItem — applies re-analysis data to an existing WatchlistItem.
 * CRITICAL CONTRACT: saved_yes_price is NEVER overwritten.
 * Only these fields are updated from fresh analysis:
 *   score, direction, assessed_probability, implied_probability,
 *   confidence, key_factors, summary, analyzed_at
 * All other fields (ticker, title, category, kalshi_url, saved_yes_price)
 * are preserved from the stored item.
 */
export function mergeWatchlistItem(storedItem, freshAnalysis) {
  return {
    // Immutable fields — always from stored item
    ticker: storedItem.ticker,
    title: storedItem.title,
    category: storedItem.category,
    kalshi_url: storedItem.kalshi_url,
    saved_yes_price: storedItem.saved_yes_price, // NEVER overwritten

    // Updatable fields — from fresh analysis
    score: freshAnalysis.score,
    direction: freshAnalysis.direction,
    assessed_probability: freshAnalysis.assessed_probability,
    implied_probability: freshAnalysis.implied_probability,
    confidence: freshAnalysis.confidence,
    key_factors: freshAnalysis.key_factors,
    summary: freshAnalysis.summary ?? storedItem.summary,
    analyzed_at: freshAnalysis.analyzed_at ?? new Date().toISOString(),
  }
}

/**
 * reAnalyzeWatchlistItem — updates stored item from fresh AnalysisResult.
 * Preserves saved_yes_price anchor per blueprint contract.
 */
export function reAnalyzeWatchlistItem(ticker, freshAnalysis) {
  const existing = readWatchlist()
  const idx = existing.findIndex((i) => i.ticker === ticker)
  if (idx === -1) {
    return { ok: false, error: `Ticker ${ticker} not found in watchlist` }
  }
  const updated = existing.map((item, i) =>
    i === idx ? mergeWatchlistItem(item, freshAnalysis) : item
  )
  return writeWatchlist(updated)
}

/**
 * removeFromWatchlist — removes a WatchlistItem by ticker.
 */
export function removeFromWatchlist(ticker) {
  if (typeof ticker !== 'string' || !ticker) {
    return { ok: false, error: 'Invalid ticker' }
  }
  const existing = readWatchlist()
  const updated = existing.filter((i) => i.ticker !== ticker)
  return writeWatchlist(updated)
}