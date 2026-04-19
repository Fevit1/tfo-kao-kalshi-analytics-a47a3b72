// KAO — Kalshi Analytics Optimizer
// AnalysisContext: session-only cache for analysis results.
// Map<ticker, AnalysisResult> — additive on Load More, NEVER evicts entries.
// Resets on page refresh — this is intentional session-only behavior per blueprint.

'use client'

import { createContext, useContext, useCallback, useRef } from 'react'

// AnalysisResult shape (matches SCHEMA data contract):
// {
//   score:                number          // 1–10
//   direction:            'YES'|'NO'|'PASS'
//   assessed_probability: number          // 0–100
//   implied_probability:  number          // 0–100
//   confidence:           'high'|'medium'|'low'
//   key_factors:          string[]
//   key_uncertainties:    string[]
//   prose_explanation:    string
//   perplexity_context:   string | null
//   perplexity_citations: string[]        // each validated https:// only
//   analyzed_at:          string          // ISO 8601
//   prose_only?:          boolean
// }

const AnalysisContext = createContext(null)

export function AnalysisProvider({ children }) {
  // useRef keeps the Map stable across renders without triggering re-renders.
  // Components that need to display cached scores should call getItem() and
  // manage their own local state to trigger re-renders when scores arrive.
  const cacheRef = useRef(new Map())

  const addItem = useCallback((ticker, analysisResult) => {
    if (typeof ticker !== 'string' || !ticker) {
      console.warn('[AnalysisContext] addItem: invalid ticker', ticker)
      return
    }
    cacheRef.current.set(ticker, {
      ...analysisResult,
      cached_at: new Date().toISOString(),
    })
  }, [])

  const getItem = useCallback((ticker) => {
    if (typeof ticker !== 'string' || !ticker) return null
    return cacheRef.current.get(ticker) ?? null
  }, [])

  const hasItem = useCallback((ticker) => {
    if (typeof ticker !== 'string' || !ticker) return false
    return cacheRef.current.has(ticker)
  }, [])

  const getAllTickers = useCallback(() => {
    return Array.from(cacheRef.current.keys())
  }, [])

  const getCacheSize = useCallback(() => {
    return cacheRef.current.size
  }, [])

  const value = {
    addItem,
    getItem,
    hasItem,
    getAllTickers,
    getCacheSize,
    // Expose the cache ref for components that need to snapshot all entries
    // (e.g., Feed row score badges). Do NOT mutate cacheRef.current directly.
    _cacheRef: cacheRef,
  }

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysisContext() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) {
    throw new Error(
      '[useAnalysisContext] Must be used within an <AnalysisProvider>. ' +
      'Ensure AnalysisProvider wraps your layout in src/app/layout.jsx.'
    )
  }
  return ctx
}

export default AnalysisContext