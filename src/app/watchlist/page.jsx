// KAO — Kalshi Analytics Optimizer
// Watchlist page — /watchlist
// Shows saved markets with live price delta indicators.
// Fetches current prices in parallel (concurrency-capped).

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BookmarkCheck, ExternalLink, RefreshCw, Trash2, AlertCircle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'
import TopNav from '@/components/TopNav'
import {
  readWatchlist,
  writeWatchlist,
  removeFromWatchlist,
  reAnalyzeWatchlistItem,
} from '@/lib/localStorage'
import { fetchWatchlistPrices, analyzeMarket, isMarketNotFoundError } from '@/lib/api'
import { isValidKalshiUrl } from '@/lib/validation'
import { getCategoryColor, getCategoryLabel } from '@/lib/kalshiCategories'
import { useAnalysisContext } from '@/lib/analysisContext'

function PriceDeltaIndicator({ item, currentPrice, priceStatus }) {
  if (priceStatus === 'loading') {
    return <span className="text-gray-600 text-sm">—</span>
  }

  if (priceStatus === 'not-found') {
    return (
      <span className="text-xs text-red-400 bg-red-900/20 px-2 py-0.5 rounded">
        Market no longer available
      </span>
    )
  }

  if (priceStatus === 'error') {
    return <span className="text-gray-600 text-sm">Error fetching price</span>
  }

  if (currentPrice === null || currentPrice === undefined) {
    return <span className="text-gray-600 text-sm">—</span>
  }

  const delta = currentPrice - item.saved_yes_price
  const absVal = Math.abs(delta)

  // "Moving toward prediction" means:
  //  - direction=YES and price is going up (delta > 0)
  //  - direction=NO and price is going down (delta < 0)
  const isFavorable =
    (item.direction === 'YES' && delta > 0) ||
    (item.direction === 'NO' && delta < 0) ||
    (item.direction === 'PASS' && Math.abs(delta) < 5)

  const isUnfavorable =
    (item.direction === 'YES' && delta < 0) ||
    (item.direction === 'NO' && delta > 0)

  if (delta === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-400 text-sm">
        <Minus size={12} />
        <span>No change · {currentPrice}¢ current</span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-1 text-sm font-medium ${
        isFavorable ? 'text-emerald-400' : isUnfavorable ? 'text-red-400' : 'text-gray-400'
      }`}
    >
      {isFavorable ? <TrendingUp size={14} /> : isUnfavorable ? <TrendingDown size={14} /> : <Minus size={12} />}
      <span>
        {delta > 0 ? '+' : ''}{delta}¢ · {currentPrice}¢ now (was {item.saved_yes_price}¢)
      </span>
    </div>
  )
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return null
  const colorClass =
    score >= 7
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      : score >= 4
      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${colorClass}`}>
      {score}/10
    </span>
  )
}

function DirectionBadge({ direction }) {
  if (!direction) return null
  const styles = {
    YES: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    NO: 'bg-red-500/20 text-red-400 border border-red-500/30',
    PASS: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[direction] ?? styles.PASS}`}>
      {direction}
    </span>
  )
}

export default function WatchlistPage() {
  const router = useRouter()
  const { addItem } = useAnalysisContext()

  const [items, setItems] = useState([])
  const [sortBy, setSortBy] = useState('score') // 'score' | 'close_date'

  // Price fetching state: Map<ticker, { price: number | null, status: 'loading'|'ok'|'error'|'not-found' }>
  const [priceMap, setPriceMap] = useState(new Map())
  const [pricesLoading, setPricesLoading] = useState(false)

  // Re-analyze state: Set<ticker>
  const [reAnalyzing, setReAnalyzing] = useState(new Set())

  const [quotaWarning, setQuotaWarning] = useState(false)

  // Load watchlist from localStorage
  useEffect(() => {
    setItems(readWatchlist())
  }, [])

  // Fetch prices on mount and when items change
  const fetchPrices = useCallback(async (watchlistItems) => {
    if (!watchlistItems.length) return
    setPricesLoading(true)

    // Initialize all as loading
    const initialMap = new Map(
      watchlistItems.map((item) => [item.ticker, { price: null, status: 'loading' }])
    )
    setPriceMap(initialMap)

    const tickers = watchlistItems.map((i) => i.ticker)
    const results = await fetchWatchlistPrices(tickers)

    const newMap = new Map()
    for (const item of watchlistItems) {
      const result = results.get(item.ticker)
      if (!result) {
        newMap.set(item.ticker, { price: null, status: 'error' })
      } else if (result.error) {
        if (isMarketNotFoundError(result.error)) {
          newMap.set(item.ticker, { price: null, status: 'not-found' })
        } else {
          newMap.set(item.ticker, { price: null, status: 'error' })
        }
      } else {
        newMap.set(item.ticker, { price: result.yes_price, status: 'ok' })
      }
    }

    setPriceMap(newMap)
    setPricesLoading(false)
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      fetchPrices(items)
    }
  }, [items, fetchPrices])

  const handleRemove = useCallback((ticker) => {
    const result = removeFromWatchlist(ticker)
    if (result.ok) {
      setItems((prev) => prev.filter((i) => i.ticker !== ticker))
    }
  }, [])

  const handleReAnalyze = useCallback(async (item) => {
    setReAnalyzing((prev) => new Set([...prev, item.ticker]))

    const { data, error } = await analyzeMarket({
      ticker: item.ticker,
      title: item.title,
      close_date: item.analyzed_at,
      yes_price: priceMap.get(item.ticker)?.price ?? item.saved_yes_price,
      implied_probability: priceMap.get(item.ticker)?.price ?? item.saved_yes_price,
      rules_text: '',
    })

    setReAnalyzing((prev) => {
      const next = new Set(prev)
      next.delete(item.ticker)
      return next
    })

    if (error || !data || data.prose_only || data.score === null) {
      return
    }

    // mergeWatchlistItem is called inside reAnalyzeWatchlistItem — preserves saved_yes_price
    const freshAnalysis = {
      score: data.score,
      direction: data.direction,
      assessed_probability: data.assessed_probability,
      implied_probability: data.implied_probability,
      confidence: data.confidence,
      key_factors: data.key_factors ?? [],
      summary: data.prose_explanation?.split('.')[0] + '.' ?? item.summary,
      analyzed_at: data.analyzed_at,
    }

    const result = reAnalyzeWatchlistItem(item.ticker, freshAnalysis)

    if (result.error === 'QUOTA_EXCEEDED') {
      setQuotaWarning(true)
      return
    }

    if (result.ok) {
      // Update session cache
      addItem(item.ticker, data)
      // Reload from localStorage to get the merged item
      setItems(readWatchlist())
    }
  }, [priceMap, addItem])

  // Sorted items
  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === 'score') {
      return (b.score ?? 0) - (a.score ?? 0)
    }
    if (sortBy === 'close_date') {
      return new Date(a.analyzed_at) - new Date(b.analyzed_at)
    }
    return 0
  })

  const formatDate = (isoString) => {
    if (!isoString) return '—'
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Watchlist</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {items.length > 0
                ? `${items.length} saved market${items.length !== 1 ? 's' : ''}`
                : 'No saved markets yet'}
            </p>
          </div>

          {/* Sort toggle */}
          {items.length > 1 && (
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-1">
              <button
                onClick={() => setSortBy('score')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortBy === 'score'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                By Score
              </button>
              <button
                onClick={() => setSortBy('close_date')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortBy === 'close_date'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                By Date
              </button>
            </div>
          )}
        </div>

        {/* localStorage quota warning */}
        {quotaWarning && (
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-400 text-sm">
              localStorage is full. Remove some watchlist items to save new analyses.
            </p>
            <button
              onClick={() => setQuotaWarning(false)}
              className="ml-auto text-amber-600 hover:text-amber-400 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookmarkCheck size={48} className="text-gray-700 mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Your watchlist is empty</h2>
            <p className="text-gray-400 text-sm max-w-sm mb-6">
              Analyze a market from the Feed and save it here to track price movements over time.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
            >
              Browse Markets →
            </a>
          </div>
        )}

        {/* Watchlist items */}
        {sortedItems.length > 0 && (
          <div className="space-y-4">
            {sortedItems.map((item) => {
              const priceEntry = priceMap.get(item.ticker)
              const currentPrice = priceEntry?.price ?? null
              const priceStatus = priceEntry?.status ?? 'loading'
              const isReAnalyzing = reAnalyzing.has(item.ticker)

              return (
                <div
                  key={item.ticker}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 transition-colors hover:border-gray-700"
                >
                  {/* Top row: title + badges + actions */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getCategoryColor(item.category)}`}
                        >
                          {getCategoryLabel(item.category)}
                        </span>
                        <ScoreBadge score={item.score} />
                        <DirectionBadge direction={item.direction} />
                        <span
                          className={`text-xs font-medium capitalize ${
                            item.confidence === 'high'
                              ? 'text-emerald-400'
                              : item.confidence === 'medium'
                              ? 'text-amber-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {item.confidence}
                        </span>
                      </div>
                      <h3
                        className="text-white font-semibold text-base leading-snug cursor-pointer hover:text-emerald-400 transition-colors"
                        onClick={() => router.push(`/analysis/${item.ticker}`)}
                      >
                        {item.title}
                      </h3>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isValidKalshiUrl(item.kalshi_url) && (
                        <a
                          href={item.kalshi_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                          aria-label="Trade on Kalshi"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <button
                        onClick={() => handleReAnalyze(item)}
                        disabled={isReAnalyzing}
                        className={`p-2 rounded-lg transition-colors ${
                          isReAnalyzing
                            ? 'text-blue-400 bg-blue-900/20 cursor-not-allowed'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                        aria-label="Re-analyze"
                      >
                        <RefreshCw size={16} className={isReAnalyzing ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handleRemove(item.ticker)}
                        className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        aria-label="Remove from watchlist"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Summary */}
                  {item.summary && (
                    <p className="text-sm text-gray-400 leading-relaxed mb-3">{item.summary}</p>
                  )}

                  {/* Price delta row */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-gray-800">
                    <PriceDeltaIndicator
                      item={item}
                      currentPrice={currentPrice}
                      priceStatus={priceStatus}
                    />
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock size={11} />
                      Analyzed {formatDate(item.analyzed_at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}