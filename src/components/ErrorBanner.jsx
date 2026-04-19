// KAO — Kalshi Analytics Optimizer
// ErrorBanner — shows named error states on the Feed screen.
// Handles: invalid API key, rate limit countdown, generic fetch errors.

'use client'

import { AlertCircle, Key, Clock, X } from 'lucide-react'
import { isInvalidKeyError, isRateLimitError } from '@/lib/api'

export default function ErrorBanner({ error, rateLimitCooldown, onDismiss }) {
  if (!error) return null

  const isKeyError = isInvalidKeyError(error)
  const isRateLimit = isRateLimitError(error)

  let icon = <AlertCircle size={16} className="flex-shrink-0" />
  let bgClass = 'bg-red-900/20 border-red-700/50 text-red-400'
  let message = error.error ?? 'An error occurred fetching markets. Please try again.'

  if (isKeyError) {
    icon = <Key size={16} className="flex-shrink-0" />
    bgClass = 'bg-red-900/30 border-red-600/60 text-red-300'
    message =
      'Invalid or missing Kalshi API key. Please check your KALSHI_API_KEY in the Vercel dashboard.'
  } else if (isRateLimit) {
    icon = <Clock size={16} className="flex-shrink-0" />
    bgClass = 'bg-amber-900/20 border-amber-700/50 text-amber-400'
    message =
      rateLimitCooldown > 0
        ? `Kalshi rate limit hit — Refresh available in ${rateLimitCooldown}s`
        : 'Kalshi rate limit exceeded. Please wait before refreshing.'
  }

  return (
    <div
      role="alert"
      className={`mx-4 mt-4 flex items-start gap-3 px-4 py-3 rounded-lg border ${bgClass}`}
    >
      {icon}
      <p className="flex-1 text-sm">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}