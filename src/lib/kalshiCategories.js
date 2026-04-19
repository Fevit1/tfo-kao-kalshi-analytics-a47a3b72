// KAO — Kalshi Analytics Optimizer
// Confirmed Kalshi API category allowlist.
//
// IMPORTANT: This list is populated from a live authenticated GET /markets call
// against the Kalshi demo API at Foundation build time.
//
// The ENDPOINTS agent must replace this placeholder list with the actual
// category values returned by the Kalshi API. The server-side validation
// in /api/markets enforces this allowlist — HTTP 400 on any unrecognized value.
//
// TODO (Foundation build step): Make authenticated GET /markets call, enumerate
// the actual `category` field values, and replace CONFIRMED_CATEGORIES below.
// Also update KALSHI_CATEGORY_ALLOWLIST in src/lib/validation.js to match.

/**
 * Confirmed Kalshi API category values.
 * Source: authenticated GET /markets call against Kalshi demo API.
 * Last confirmed: Foundation build time (placeholder — update with live values).
 *
 * Common Kalshi categories observed in the API:
 * The Kalshi API uses 'series_ticker' groupings but also returns
 * category/event_ticker fields. Check the 'category' field in
 * the raw market response and enumerate unique values.
 */
export const CONFIRMED_CATEGORIES = [
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

/**
 * Category display labels — maps API values to UI-friendly labels.
 * Update keys to match confirmed API category strings.
 */
export const CATEGORY_LABELS = {
  Politics: 'Politics',
  Economics: 'Economics',
  Finance: 'Finance',
  Climate: 'Climate',
  Sports: 'Sports',
  Crypto: 'Crypto',
  Culture: 'Culture',
  Science: 'Science',
  Other: 'Other',
}

/**
 * Category color classes for badges in the Feed and Watchlist.
 * Add/remove entries to match confirmed API values.
 */
export const CATEGORY_COLORS = {
  Politics: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Economics: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Finance: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Climate: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  Sports: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Crypto: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Culture: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  Science: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

/**
 * Get the Tailwind CSS classes for a category badge.
 * Falls back to 'Other' color for unrecognized categories.
 * @param {string} category
 * @returns {string}
 */
export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Other']
}

/**
 * Get the display label for a category.
 * Returns the raw value if not in the labels map.
 * @param {string} category
 * @returns {string}
 */
export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category
}