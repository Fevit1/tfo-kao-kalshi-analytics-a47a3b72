// KAO — Kalshi Analytics Optimizer
// Market Feed — home page (/)
// Fetches Kalshi markets via /api/markets, supports Load More cursor pagination.
// AnalysisContext cache is additive — scores never lost across Load More calls.

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TopNav from '@/components/TopNav'
import ErrorBanner from '@/components/ErrorBanner'
import MarketRow from '@/components/MarketRow'
import LoadMoreButton from '@/components/LoadMoreButton'
import RefreshButton from '@/components/RefreshButton'
import SettingsSlideOver from '@/components/SettingsSlideOver'
import { fetchMarkets, isInvalidKeyError, isRateLimitError } from '@/lib/api'
import { readPreferences, writePreferences } from '@/lib/localStorage'
import { useAnalysisContext } from '@/lib/analysisContext'

const RATE_LIMIT_COOLDOWN_SECONDS = 60

export default function FeedPage() {
  const { addItem, getItem, _cacheRef } = useAnalysisContext()

  // Feed state
  const [markets, setMarkets] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preferences, setPreferences] = useState(null)

  // Rate limit cooldown
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0)
  const cooldownTimer = useRef(null)

  // Force re-render when analysis cache updates (for score badges)
  const [cacheVersion, setCacheVersion] = useState(0)

  // Load preferences on mount
  useEffect(() => {
    setPreferences(readPreferences())
  }, [])

  // Fetch first page on mount / when preferences change
  useEffect(() => {
    if (preferences === null) return
    loadFirstPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences])

  const startCooldown = useCallback(() => {
    setRateLimitCooldown(RATE_LIMIT_COOLDOWN_SECONDS)
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    cooldownTimer.current = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    }
  }, [])

  const loadFirstPage = useCallback(async () => {
    if (!preferences) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await fetchMarkets({
      limit: 100,
      category: preferences.categories?.length === 1 ? preferences.categories[0] : undefined,
    })

    setLoading(false)

    if (fetchError) {
      if (isRateLimitError(fetchError)) {
        startCooldown()
      }
      setError(fetchError)
      return
    }

    setMarkets(data.markets ?? [])
    setCursor(data.cursor)
    setHasMore(data.has_more)
  }, [preferences, startCooldown])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)

    const { data, error: fetchError } = await fetchMarkets({
      cursor,
      limit: 100,
      category: preferences?.categories?.length === 1 ? preferences.categories[0] : undefined,
    })

    setLoadingMore(false)

    if (fetchError) {
      if (isRateLimitError(fetchError)) {
        startCooldown()
      }
      setError(fetchError)
      return
    }

    // Append — never replace. AnalysisContext cache entries are preserved.
    setMarkets((prev) => [...prev, ...(data.markets ?? [])])
    setCursor(data.cursor)
    setHasMore(data.has_more)
  }, [cursor, loadingMore, preferences, startCooldown])

  const handleRefresh = useCallback(() => {
    if (rateLimitCooldown > 0) return
    loadFirstPage()
  }, [rateLimitCooldown, loadFirstPage])

  const handleAnalysisComplete = useCallback((ticker, result) => {
    addItem(ticker, result)
    setCacheVersion((v) => v + 1)
  }, [addItem])

  const handleSavePreferences = useCallback((newPrefs) => {
    writePreferences(newPrefs)
    setPreferences(newPrefs)
    setSettingsOpen(false)
  }, [])

  // Dismiss error banner
  const handleDismissError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav onSettingsClick={() => setSettingsOpen(true)} />

      {/* Error Banner */}
      {error && (
        <ErrorBanner
          error={error}
          rateLimitCooldown={rateLimitCooldown}
          onDismiss={handleDismissError}
        />
      )}

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Market Feed</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Open prediction markets from Kalshi
              {markets.length > 0 && (
                <span className="ml-2 text-gray-500">· {markets.length} loaded</span>
              )}
            </p>
          </div>
          <RefreshButton
            onRefresh={handleRefresh}
            loading={loading}
            cooldown={rateLimitCooldown}
          />
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-800 rounded w-1/4" />
                  </div>
                  <div className="flex gap-3">
                    <div className="h-4 bg-gray-800 rounded w-16" />
                    <div className="h-4 bg-gray-800 rounded w-16" />
                    <div className="h-8 bg-gray-800 rounded w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && markets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-lg font-semibold text-white mb-2">No markets found</h2>
            <p className="text-gray-400 text-sm max-w-sm">
              No open markets matched your current filter settings. Try adjusting your category
              filters in Settings.
            </p>
          </div>
        )}

        {/* Market list */}
        {!loading && markets.length > 0 && (
          <div className="space-y-2">
            {markets.map((market) => (
              <MarketRow
                key={market.ticker}
                market={market}
                cachedAnalysis={getItem(market.ticker)}
                onAnalysisComplete={handleAnalysisComplete}
                cacheVersion={cacheVersion}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {!loading && hasMore && (
          <div className="mt-6 flex justify-center">
            <LoadMoreButton onLoadMore={loadMore} loading={loadingMore} />
          </div>
        )}

        {/* End of results */}
        {!loading && !hasMore && markets.length > 0 && (
          <p className="text-center text-gray-600 text-sm mt-8">
            All {markets.length} markets loaded
          </p>
        )}
      </div>

      {/* Settings slide-over */}
      {preferences && (
        <SettingsSlideOver
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          preferences={preferences}
          onSave={handleSavePreferences}
        />
      )}
    </div>
  )
}