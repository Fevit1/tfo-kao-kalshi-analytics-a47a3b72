// KAO — Kalshi Analytics Optimizer
// RefreshButton — re-fetches page 1 of the Market Feed.
// Shows 60s cooldown countdown after a rate limit error.

'use client'

import { RefreshCw } from 'lucide-react'

export default function RefreshButton({ onRefresh, loading, cooldown }) {
  const isDisabled = loading || cooldown > 0

  return (
    <button
      onClick={onRefresh}
      disabled={isDisabled}
      aria-label={
        cooldown > 0
          ? `Rate limited — wait ${cooldown}s`
          : loading
          ? 'Refreshing…'
          : 'Refresh markets'
      }
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        isDisabled
          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600'
      }`}
    >
      <RefreshCw
        size={14}
        className={loading ? 'animate-spin' : ''}
      />
      {cooldown > 0 ? (
        <span className="tabular-nums text-amber-400">{cooldown}s</span>
      ) : loading ? (
        'Refreshing…'
      ) : (
        'Refresh'
      )}
    </button>
  )
}