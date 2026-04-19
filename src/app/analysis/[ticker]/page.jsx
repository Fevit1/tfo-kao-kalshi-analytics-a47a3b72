// KAO — Kalshi Analytics Optimizer
// Opportunity Analysis page — /analysis/[ticker]
// Shows full analysis for a single Kalshi market.
// Fetches market data + triggers analysis pipeline.

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Bookmark, BookmarkCheck, AlertCircle, Clock } from 'lucide-react'
import TopNav from '@/components/TopNav'
import { fetchMarket, analyzeMarket } from '@/lib/api'
import { useAnalysisContext } from '@/lib/analysisContext'
import { readWatchlist, addToWatchlist } from '@/lib/localStorage'
import { isValidKalshiUrl, isValidCitationUrl } from '@/lib/validation'
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold ${colorClass}`}>
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${styles[direction] ?? styles.PASS}`}>
      {direction}
    </span>
  )
}

function ConfidenceBadge({ confidence }) {
  if (!confidence) return null
  const styles = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-gray-400',
  }
  return (
    <span className={`text-sm font-medium capitalize ${styles[confidence] ?? 'text-gray-400'}`}>
      {confidence} confidence
    </span>
  )
}

function CitationLink({ url, index }) {
  if (isValidCitationUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <ExternalLink size={10} />
        [{index + 1}] {url.length > 60 ? url.slice(0, 60) + '…' : url}
      </a>
    )
  }
  // Non-https: render as plain text only
  return (
    <span className="text-xs text-gray-500">[{index + 1}] {url}</span>
  )
}

export default function AnalysisPage() {
  const { ticker } = useParams()
  const router = useRouter()
  const { addItem, getItem } = useAnalysisContext()

  const [market, setMarket] = useState(null)
  const [marketLoading, setMarketLoading] = useState(true)
  const [marketError, setMarketError] = useState(null)

  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [analyzeStartTime, setAnalyzeStartTime] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const [isWatchlisted, setIsWatchlisted] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [justSaved, setJustSaved] = useState(false)

  // Check watchlist status on mount
  useEffect(() => {
    const wl = readWatchlist()
    setIsWatchlisted(wl.some((item) => item.ticker === ticker))
  }, [ticker])

  // Check session cache for existing analysis
  useEffect(() => {
    const cached = getItem(ticker)
    if (cached) {
      setAnalysis(cached)
    }
  }, [ticker, getItem])

  // Fetch market details
  useEffect(() => {
    if (!ticker) return
    setMarketLoading(true)
    fetchMarket(ticker).then(({ data, error }) => {
      setMarketLoading(false)
      if (error) {
        setMarketError(error)
        return
      }
      setMarket(data.market)
    })
  }, [ticker])

  // Elapsed timer while analyzing
  useEffect(() => {
    if (!analyzing) {
      setElapsedSeconds(0)
      return
    }
    setAnalyzeStartTime(Date.now())
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - (analyzeStartTime ?? Date.now())) / 1000))
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzing])

  const handleAnalyze = useCallback(async () => {
    if (!market || analyzing) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalyzeStartTime(Date.now())
    setElapsedSeconds(0)

    const { data, error } = await analyzeMarket({
      ticker: market.ticker,
      title: market.title,
      close_date: market.close_date,
      yes_price: market.yes_price,
      implied_probability: market.yes_price,
      rules_text: market.rules_text,
    })

    setAnalyzing(false)

    if (error) {
      setAnalyzeError(error)
      return
    }

    setAnalysis(data)
    addItem(ticker, data)
  }, [market, analyzing, ticker, addItem])

  const handleSaveToWatchlist = useCallback(() => {
    if (!market || !analysis || analysis.prose_only || analysis.score === null) return
    setSaveError(null)

    const item = {
      ticker: market.ticker,
      title: market.title,
      category: market.category,
      score: analysis.score,
      direction: analysis.direction,
      assessed_probability: analysis.assessed_probability,
      implied_probability: analysis.implied_probability,
      confidence: analysis.confidence,
      key_factors: analysis.key_factors ?? [],
      summary: analysis.prose_explanation?.split('.')[0] + '.' ?? market.title,
      analyzed_at: analysis.analyzed_at,
      kalshi_url: market.kalshi_url,
      saved_yes_price: market.yes_price,
    }

    const result = addToWatchlist(item)
    if (!result.ok) {
      if (result.error === 'QUOTA_EXCEEDED') {
        setSaveError('localStorage is full. Please remove some watchlist items.')
      } else {
        setSaveError(result.error)
      }
      return
    }

    setIsWatchlisted(true)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }, [market, analysis])

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

  const formatVolume = (vol) => {
    if (!vol) return '—'
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
    return String(vol)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Feed
        </Link>

        {/* Market loading */}
        {marketLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-2/3" />
            <div className="h-4 bg-gray-800 rounded w-1/4" />
            <div className="grid grid-cols-4 gap-4 mt-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-800 rounded-lg" />
              ))}
            </div>
          </div>
        )}

        {/* Market error */}
        {marketError && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Market not found</p>
              <p className="text-gray-400 text-sm mt-1">
                {marketError.error ?? 'This market may be closed or delisted.'}
              </p>
            </div>
          </div>
        )}

        {/* Market header */}
        {market && !marketLoading && (
          <>
            {/* Title + category */}
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(market.category)}`}
                >
                  {getCategoryLabel(market.category)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-snug">{market.title}</h1>
              <p className="text-sm text-gray-500 mt-1">Ticker: {market.ticker}</p>
            </div>

            {/* Market stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Yes Price</p>
                <p className="text-xl font-bold text-emerald-400">{market.yes_price}¢</p>
                <p className="text-xs text-gray-400">{market.yes_price}% implied</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">No Price</p>
                <p className="text-xl font-bold text-red-400">{market.no_price}¢</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Volume</p>
                <p className="text-xl font-bold text-white">{formatVolume(market.volume)}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Closes</p>
                <p className="text-base font-bold text-white">{formatDate(market.close_date)}</p>
              </div>
            </div>

            {/* Trade button */}
            <div className="flex flex-wrap gap-3 mb-8">
              {isValidKalshiUrl(market.kalshi_url) ? (
                <a
                  href={market.kalshi_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                >
                  <ExternalLink size={16} />
                  Trade on Kalshi →
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-500 font-semibold rounded-lg cursor-not-allowed">
                  Trade on Kalshi (URL unavailable)
                </span>
              )}

              {/* Analyze button */}
              {!analysis && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`inline-flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${
                    analyzing
                      ? 'bg-blue-900/50 text-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {analyzing ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Analyzing… (~{10 + elapsedSeconds}s)
                    </>
                  ) : (
                    '🔍 Analyze Market'
                  )}
                </button>
              )}

              {/* Re-analyze if already analyzed */}
              {analysis && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`inline-flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${
                    analyzing
                      ? 'bg-blue-900/50 text-blue-400 cursor-not-allowed'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {analyzing ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Re-analyzing…
                    </>
                  ) : (
                    '↻ Re-analyze'
                  )}
                </button>
              )}

              {/* Save to watchlist */}
              {analysis && !analysis.prose_only && analysis.score !== null && (
                <button
                  onClick={handleSaveToWatchlist}
                  className={`inline-flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-colors ${
                    isWatchlisted
                      ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {isWatchlisted ? (
                    <>
                      <BookmarkCheck size={16} />
                      {justSaved ? 'Saved!' : 'Watchlisted'}
                    </>
                  ) : (
                    <>
                      <Bookmark size={16} />
                      Save to Watchlist
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Save error */}
            {saveError && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 mb-4 text-red-400 text-sm">
                {saveError}
              </div>
            )}

            {/* Analyze error */}
            {analyzeError && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-start gap-3 mb-6">
                <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-400 font-medium">Analysis failed</p>
                  <p className="text-gray-400 text-sm mt-1">{analyzeError.error}</p>
                </div>
              </div>
            )}

            {/* Analysis results */}
            {analysis && (
              <div className="space-y-6">
                {/* Opportunity Score Card */}
                {!analysis.prose_only && analysis.score !== null && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                      Opportunity Score
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <ScoreBadge score={analysis.score} />
                      <DirectionBadge direction={analysis.direction} />
                      <ConfidenceBadge confidence={analysis.confidence} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Implied Probability</p>
                        <p className="text-xl font-bold text-white">{analysis.implied_probability}%</p>
                        <p className="text-xs text-gray-500">from market price</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Claude's Assessment</p>
                        <p className="text-xl font-bold text-emerald-400">{analysis.assessed_probability}%</p>
                        <p className="text-xs text-gray-500">true probability est.</p>
                      </div>
                    </div>
                    {/* Probability delta */}
                    {analysis.assessed_probability !== null && analysis.implied_probability !== null && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <p className="text-sm text-gray-400">
                          Edge:{' '}
                          <span
                            className={
                              analysis.assessed_probability > analysis.implied_probability
                                ? 'text-emerald-400 font-semibold'
                                : analysis.assessed_probability < analysis.implied_probability
                                ? 'text-red-400 font-semibold'
                                : 'text-gray-400 font-semibold'
                            }
                          >
                            {analysis.assessed_probability > analysis.implied_probability ? '+' : ''}
                            {analysis.assessed_probability - analysis.implied_probability}pp
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Prose-only fallback notice */}
                {analysis.prose_only && (
                  <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
                    <p className="text-amber-400 text-sm">
                      Score N/A — Claude returned a prose assessment only (JSON parse failed).
                    </p>
                  </div>
                )}

                {/* Claude Assessment Panel */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                    Claude's Assessment
                  </h2>

                  {/* Prose explanation — escaped strings, never dangerouslySetInnerHTML */}
                  {analysis.prose_explanation && (
                    <div className="text-gray-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                      {analysis.prose_explanation}
                    </div>
                  )}

                  {/* Key factors */}
                  {analysis.key_factors?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Key Factors
                      </p>
                      <ul className="space-y-1.5">
                        {analysis.key_factors.map((factor, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key uncertainties */}
                  {analysis.key_uncertainties?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Key Uncertainties
                      </p>
                      <ul className="space-y-1.5">
                        {analysis.key_uncertainties.map((u, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-amber-400 mt-0.5 flex-shrink-0">?</span>
                            <span>{u}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Analysis meta */}
                  <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock size={12} />
                      Analyzed {new Date(analysis.analyzed_at).toLocaleString()}
                    </div>
                    {!analysis.perplexity_available && (
                      <span className="text-xs text-amber-500 bg-amber-900/20 px-2 py-0.5 rounded">
                        Context unavailable — Claude-only analysis
                      </span>
                    )}
                  </div>
                </div>

                {/* Perplexity Context Panel */}
                {analysis.perplexity_context && (
                  <PerplexityContextPanel
                    context={analysis.perplexity_context}
                    citations={analysis.perplexity_citations ?? []}
                    analyzedAt={analysis.analyzed_at}
                  />
                )}
              </div>
            )}

            {/* Rules text (collapsed) */}
            {market.rules_text && <MarketRulesSection rulesText={market.rules_text} />}
          </>
        )}
      </div>
    </div>
  )
}

function PerplexityContextPanel({ context, citations, analyzedAt }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Perplexity Context
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-world context · {new Date(analyzedAt).toLocaleString()}
          </p>
        </div>
        <span className="text-gray-500 text-lg">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {/* Context prose — escaped, never dangerouslySetInnerHTML */}
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-4">
            {context}
          </div>

          {/* Citations as validated https:// anchors */}
          {citations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sources
              </p>
              <div className="space-y-1">
                {citations.map((url, i) => (
                  <CitationLink key={i} url={url} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MarketRulesSection({ rulesText }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden mt-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/40 transition-colors"
      >
        <span className="text-sm font-medium text-gray-400">Market Rules</span>
        <span className="text-gray-600 text-sm">{expanded ? 'Hide ▲' : 'Show ▼'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
          {rulesText}
        </div>
      )}
    </div>
  )
}