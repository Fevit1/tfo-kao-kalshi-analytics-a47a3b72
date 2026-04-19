// KAO — Kalshi Analytics Optimizer
// Shared validation helpers — used by both client components and API routes.
// All security-critical validators live here as the single source of truth.

// ─── Ticker Validation ────────────────────────────────────────

/**
 * Valid Kalshi ticker: 1–64 uppercase alphanumeric characters plus hyphens.
 * Used server-side in /api/markets/[ticker] before forwarding to Kalshi API.
 * Returns true if valid, false if not.
 */
export const TICKER_REGEX = /^[A-Z0-9\-]{1,64}$/

export function isValidTicker(ticker) {
  if (typeof ticker !== 'string') return false
  return TICKER_REGEX.test(ticker)
}

// ─── Kalshi URL Domain Validation ────────────────────────────

/**
 * Validates a kalshi_url before use in TradeOnKalshiButton or storage.
 * Only the two known Kalshi domains are permitted.
 * Returns true if the URL is safe to use as an anchor href.
 */
const KALSHI_ALLOWED_DOMAINS = [
  'kalshi.com',
  'demo-api.kalshi.co',
]

export function isValidKalshiUrl(url) {
  if (typeof url !== 'string' || !url) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return KALSHI_ALLOWED_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain ||
        parsed.hostname.endsWith('.' + domain)
    )
  } catch {
    return false
  }
}

// ─── Citation URL Validation ──────────────────────────────────

/**
 * Validates a Perplexity citation URL before rendering as an anchor tag.
 * Only https:// URLs are rendered as links.
 * Non-https citations are rendered as plain text only (not as anchors).
 * This prevents javascript: and data: URI injection.
 * Never use dangerouslySetInnerHTML — always use this before rendering citations.
 */
export function isValidCitationUrl(url) {
  if (typeof url !== 'string' || !url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// ─── Analysis Input Validation ────────────────────────────────

/**
 * Validates the POST body for /api/analyze before LLM prompt injection.
 * All fields are sanitized and length-capped per security spec.
 * Returns { valid: true, sanitized: {...} } or { valid: false, error: string }
 */
export function validateAnalyzeInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  const { ticker, title, close_date, yes_price, implied_probability, rules_text } = body

  // Ticker
  if (!isValidTicker(ticker)) {
    return { valid: false, error: 'ticker must match /^[A-Z0-9\\-]{1,64}$/' }
  }

  // Title
  if (typeof title !== 'string' || title.length === 0) {
    return { valid: false, error: 'title must be a non-empty string' }
  }
  if (title.length > 500) {
    return { valid: false, error: 'title must be ≤500 characters' }
  }

  // close_date — optional but must be valid ISO if provided
  if (close_date !== undefined && close_date !== null) {
    if (typeof close_date !== 'string') {
      return { valid: false, error: 'close_date must be a string' }
    }
    if (isNaN(Date.parse(close_date))) {
      return { valid: false, error: 'close_date must be a valid ISO 8601 date string' }
    }
  }

  // yes_price
  if (typeof yes_price !== 'number' || yes_price < 0 || yes_price > 100) {
    return { valid: false, error: 'yes_price must be a number between 0 and 100' }
  }

  // implied_probability
  if (
    typeof implied_probability !== 'number' ||
    implied_probability < 0 ||
    implied_probability > 100
  ) {
    return { valid: false, error: 'implied_probability must be a number between 0 and 100' }
  }

  // rules_text — optional but capped
  const sanitizedRulesText =
    typeof rules_text === 'string'
      ? stripNullBytes(rules_text).slice(0, 10000)
      : ''

  // Sanitize other string fields
  const sanitized = {
    ticker: stripNullBytes(ticker),
    title: stripNullBytes(title).slice(0, 500),
    close_date: close_date ?? null,
    yes_price,
    implied_probability,
    rules_text: sanitizedRulesText,
  }

  return { valid: true, sanitized }
}

/**
 * Strip null bytes from strings before injecting into LLM prompts.
 * Null bytes can be used to manipulate prompt boundaries in some models.
 */
export function stripNullBytes(str) {
  if (typeof str !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return str.replace(/\0/g, '')
}

// ─── Claude Output Validation ─────────────────────────────────

/**
 * validateClaudeOutput — schema-validates Claude's parsed JSON response.
 * Out-of-range values are clamped or rejected before storage.
 * Called after JSON.parse succeeds in /api/analyze.
 * Returns { valid: true, validated: {...} } or { valid: false, error: string }
 */
export function validateClaudeOutput(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Claude output must be a JSON object' }
  }

  // score: 1–10, clamp if out of range
  let score = Number(parsed.score)
  if (isNaN(score)) {
    return { valid: false, error: 'score must be a number' }
  }
  score = Math.round(Math.max(1, Math.min(10, score)))

  // direction: enum
  if (!['YES', 'NO', 'PASS'].includes(parsed.direction)) {
    return {
      valid: false,
      error: `direction must be YES, NO, or PASS — got: ${parsed.direction}`,
    }
  }

  // assessed_probability: 0–100
  let assessedProb = Number(parsed.assessed_probability)
  if (isNaN(assessedProb) || assessedProb < 0 || assessedProb > 100) {
    return { valid: false, error: 'assessed_probability must be a number 0–100' }
  }
  assessedProb = Math.round(Math.max(0, Math.min(100, assessedProb)))

  // implied_probability: 0–100
  let impliedProb = Number(parsed.implied_probability)
  if (isNaN(impliedProb) || impliedProb < 0 || impliedProb > 100) {
    return { valid: false, error: 'implied_probability must be a number 0–100' }
  }
  impliedProb = Math.round(Math.max(0, Math.min(100, impliedProb)))

  // confidence: enum
  if (!['high', 'medium', 'low'].includes(parsed.confidence)) {
    return {
      valid: false,
      error: `confidence must be high, medium, or low — got: ${parsed.confidence}`,
    }
  }

  // key_factors: string[]
  if (!Array.isArray(parsed.key_factors)) {
    return { valid: false, error: 'key_factors must be an array' }
  }
  const keyFactors = parsed.key_factors.filter((f) => typeof f === 'string')

  // key_uncertainties: string[] (optional, default to [])
  const keyUncertainties = Array.isArray(parsed.key_uncertainties)
    ? parsed.key_uncertainties.filter((u) => typeof u === 'string')
    : []

  // prose_explanation: string
  if (typeof parsed.prose_explanation !== 'string') {
    return { valid: false, error: 'prose_explanation must be a string' }
  }

  const validated = {
    score,
    direction: parsed.direction,
    assessed_probability: assessedProb,
    implied_probability: impliedProb,
    confidence: parsed.confidence,
    key_factors: keyFactors,
    key_uncertainties: keyUncertainties,
    prose_explanation: stripNullBytes(parsed.prose_explanation),
  }

  return { valid: true, validated }
}

// ─── Cursor Validation ────────────────────────────────────────

/**
 * Validates a Kalshi pagination cursor before forwarding to Kalshi API.
 * Must be a string, max 256 chars, base64url characters only.
 */
const BASE64URL_REGEX = /^[A-Za-z0-9\-_=]+$/

export function isValidCursor(cursor) {
  if (cursor === undefined || cursor === null || cursor === '') return true // absent cursor is valid
  if (typeof cursor !== 'string') return false
  if (cursor.length > 256) return false
  return BASE64URL_REGEX.test(cursor)
}

// ─── Category Allowlist Validation ───────────────────────────

/**
 * PLACEHOLDER: Category allowlist to be replaced by ENDPOINTS agent
 * after live Kalshi demo API enumeration at Foundation build time.
 * The ENDPOINTS agent MUST update this list with confirmed values.
 * HTTP 400 is returned by /api/markets for any unrecognized category.
 */
export const KALSHI_CATEGORY_ALLOWLIST = [
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

export function isValidCategory(category) {
  if (typeof category !== 'string') return false
  return KALSHI_CATEGORY_ALLOWLIST.includes(category)
}