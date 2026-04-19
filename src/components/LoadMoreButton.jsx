// KAO — Kalshi Analytics Optimizer
// LoadMoreButton — appends next cursor page to the Market Feed.
// AnalysisContext cache entries from prior pages are preserved (never evicted).

'use client'

import { ChevronDown } from 'lucide-react'

export default function LoadMoreButton({ onLoadMore, loading }) {
  return (
    <button
      onClick={onLoadMore}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-6 py-2.5 font-semibold rounded-lg transition-colors ${
        loading
          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
          : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 hover:border-gray-600'
      }`}
    >
      {loading ? (
        <>
          <span className="animate-spin inline-block">⟳</span>
          Loading more…
        </>
      ) : (
        <>
          <ChevronDown size={16} />
          Load More Markets
        </>
      )}
    </button>
  )
}