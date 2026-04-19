// KAO — Kalshi Analytics Optimizer
// DemoBanner — persistent banner on all screens when NEXT_PUBLIC_KALSHI_ENV=demo.
// Clearly labels all prices as non-real to avoid demo/production confusion.
// This component is rendered in the shared layout (src/app/layout.jsx).

'use client'

const isDemoMode = process.env.NEXT_PUBLIC_KALSHI_ENV === 'demo'

export default function DemoBanner() {
  if (!isDemoMode) return null

  return (
    <div
      role="alert"
      aria-label="Demo mode active — prices are not real"
      className="w-full bg-amber-500 text-black text-center text-sm font-semibold py-2 px-4 sticky top-0 z-50 flex items-center justify-center gap-2"
    >
      <span aria-hidden="true">⚠️</span>
      <span>
        DEMO MODE — All prices and market data are simulated. Not real money.
        Switch to production API when ready to trade.
      </span>
      <span aria-hidden="true">⚠️</span>
    </div>
  )
}