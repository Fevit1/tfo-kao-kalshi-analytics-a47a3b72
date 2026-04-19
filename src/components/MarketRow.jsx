// KAO — Kalshi Analytics Optimizer
// MarketRow — single market row in the Feed list.
// Shows title, category, yes_price, volume, close date, cached score badge, Analyze button.

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, AlertCircle } from 'lucide-react'
import { analyzeMarket } from '@/lib/api'
import { getCategoryColor, getCategoryLabel } from '@/lib/kalshiCategories'

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
    YES: 'text-emerald-400',
    NO: 'text-red-400',
    PASS: 'text-gray-500',
  }
  return (
    <span className={`text-xs font-semibold ${styles[direction] ?? 'text-gray-500'}`}>
      {direction}
    </span>
  )
}

const formatVolume = (vol) => {
  if (!vol) return '—'
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return String(vol)
}

const formatDate = (isoString) => {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return isoString
  }
}

export default function MarketRow({ market, cachedAnalysis, onAnalysisComplete, cacheVersion }) {
  const router = useRouter()
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const handleAnalyze = useCallback(
    async (e) => {
      e.stopPropagation()
      if (analyzing) return
      setAnalyzing(true)
      setAnalyzeError(null)
      setElapsedSeconds(0)

      const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)

      const { data, error } = await analyzeMarket({
        ticker: market.ticker,
        title: market.title,
        close_date: market.close_date,
        yes_price: market.yes_price,
        implied_probability: market.yes_price,
        rules_text: market.rules_text,
      })

      clearInterval(timer)
      setAnalyzing(false)
      setElapsedSeconds(0)

      if (error) {
        setAnalyzeError(error.error ?? 'Analysis failed')
        return
      }

      onAnalysisComplete?.(market.ticker, data)
      // Navigate to analysis page
      router.push(`/analysis/${market.ticker}`)
    },
    [analyzing, market, onAnalysisComplete, router]
  )

  const handleRowClick = useCallback(() => {
    router.push(`/analysis/${market.ticker}`)
  }, [market.ticker, router])

  return (
    <div
      className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg p-4 transition-colors cursor-pointer group"
      onClick={handleRowClick}
    >
      <div className="flex items-start gap-3">
        {/* Left: title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getCategoryColor(market.category)}`}
            >
              {getCategoryLabel(market.category)}
            </span>
            {cachedAnalysis && (
              <>
                <ScoreBadge score={cachedAnalysis.score} />
                <DirectionBadge direction={cachedAnalysis.direction} />
              </>
            )}
          </div>
          <p className="text-white text-sm font-medium leading-snug group-hover:text-emerald-300 transition-colors line-clamp-2">
            {market.title}
          </p>

          {/* Error inline */}
          {analyzeError && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-400">{analyzeError}</span>
            </div>
          )}
        </div>

        {/* Right: stats + button */}
        <div
          className="flex items-center gap-3 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 text-right">
            <div>
              <p className="text-xs text-gray-500">Yes</p>
              <p className="text-sm font-semibold text-emerald-400">{market.yes_price}¢</p>
              <p className="text-xs text-gray-500">{market.yes_price}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Vol</p>
              <p className="text-sm font-semibold text-white">{formatVolume(market.volume)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Closes</p>
              <p className="text-sm font-semibold text-white">{formatDate(market.close_date)}</p>
            </div>
          </div>

          {/* Analyze button */}
          {cachedAnalysis ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/analysis/${market.ticker}`)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              View Analysis
            </button>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                analyzing
                  ? 'bg-blue-900/50 text-blue-400 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white'
              }`}
            >
              {analyzing ? (
                <>
                  <span className="animate-spin inline-block">⟳</span>
                  {elapsedSeconds > 0 ? `~${elapsedSeconds}s` : '…'}
                </>
              ) : (
                <>
                  <Zap size={12} />
                  Analyze
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile stats row */}
      <div className="sm:hidden flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span>Yes: <strong className="text-emerald-400">{market.yes_price}¢</strong></span>
        <span>·</span>
        <span>Vol: <strong className="text-white">{formatVolume(market.volume)}</strong></span>
        <span>·</span>
        <span>Closes: <strong className="text-white">{formatDate(market.close_date)}</strong></span>
      </div>
    </div>
  )
}