// KAO — Kalshi Analytics Optimizer
// Canonical TypeScript-style type documentation for all runtime types.
// This file is for JSDoc reference — the actual contracts live in validation.js
// and are enforced at runtime by the validation helpers.

/**
 * @typedef {Object} Market
 * Runtime market data from Kalshi API — never persisted to localStorage or DB.
 * @property {string} ticker - Kalshi market ticker, matches /^[A-Z0-9\-]{1,64}$/
 * @property {string} title - Market question text, max 500 chars
 * @property {string} category - Confirmed Kalshi API category value
 * @property {number} yes_price - cents 0-99, equals implied probability %
 * @property {number} no_price - cents 0-99
 * @property {number} volume - total contracts traded
 * @property {string} close_date - ISO 8601 timestamptz string
 * @property {string} rules_text - Kalshi market rules, max 10000 chars
 * @property {string} kalshi_url - validated to https://kalshi.com or https://demo-api.kalshi.co
 */

/**
 * @typedef {Object} AnalysisResult
 * Session cache entry — stored in AnalysisContext Map<ticker, AnalysisResult>.
 * Lost on page refresh by design.
 * @property {number|null} score - 1-10, clamped by validateClaudeOutput(). null if prose_only.
 * @property {'YES'|'NO'|'PASS'|null} direction
 * @property {number|null} assessed_probability - 0-100
 * @property {number} implied_probability - 0-100
 * @property {'high'|'medium'|'low'|null} confidence
 * @property {string[]} key_factors
 * @property {string[]} key_uncertainties
 * @property {string} prose_explanation - escaped, never dangerouslySetInnerHTML
 * @property {string|null} perplexity_context - null if Perplexity call failed
 * @property {string[]} perplexity_citations - each validated: URL.protocol === 'https:'
 * @property {boolean} perplexity_available
 * @property {boolean} prose_only - true if Claude JSON parse failed
 * @property {string} analyzed_at - ISO 8601 timestamptz
 */

/**
 * @typedef {Object} WatchlistItem
 * Persisted to localStorage:kalshi_watchlist as WatchlistItem[].
 * Deduplication key: ticker.
 * CRITICAL: saved_yes_price is IMMUTABLE — never overwritten on re-analyze.
 * @property {string} ticker - deduplication key
 * @property {string} title
 * @property {string} category
 * @property {number} score - 1-10
 * @property {'YES'|'NO'|'PASS'} direction
 * @property {number} assessed_probability - 0-100
 * @property {number} implied_probability - 0-100
 * @property {'high'|'medium'|'low'} confidence
 * @property {string[]} key_factors
 * @property {string} summary - one-sentence summary
 * @property {string} analyzed_at - ISO 8601, updated on re-analyze
 * @property {string} kalshi_url - validated to Kalshi domain before use
 * @property {number} saved_yes_price - IMMUTABLE: original price at first save, NEVER overwritten
 */

/**
 * @typedef {Object} KalshiPreferences
 * Persisted to localStorage:kalshi_preferences.
 * Defaults: { categories: <all>, sort_by: 'volume', last_updated: <now> }
 * @property {string[]} categories - subset of confirmed Kalshi API category allowlist
 * @property {'score'|'volume'|'close_date'} sort_by
 * @property {string} last_updated - ISO 8601 timestamptz
 */

/**
 * @typedef {Object} ApiError
 * Standard error shape returned by all /api/* routes.
 * @property {string} error - Human-readable error message
 * @property {string} code - Machine-readable error code
 * @property {number} [status] - HTTP status code (attached client-side)
 * @property {number} [retry_after] - Seconds to wait before retrying (rate limit)
 */

export {}