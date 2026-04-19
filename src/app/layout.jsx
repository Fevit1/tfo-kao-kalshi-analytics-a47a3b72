// KAO — Kalshi Analytics Optimizer
// Root layout — shared across all routes.
// Includes DemoBanner, TopNav, and AnalysisProvider (session cache).
// NO auth wrapper — KAO has no authentication layer.

import './globals.css'
import { AnalysisProvider } from '@/lib/analysisContext'
import DemoBanner from '@/components/DemoBanner'

export const metadata = {
  title: 'KAO — Kalshi Analytics Optimizer',
  description:
    'Personal research tool for finding mispriced Kalshi prediction markets using Perplexity news context and Claude AI analysis.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <AnalysisProvider>
          {/* DemoBanner — sticky top, renders only when NEXT_PUBLIC_KALSHI_ENV=demo */}
          <DemoBanner />
          {/* Page content — TopNav is rendered per-page to allow settings gear callback */}
          <main className="min-h-screen">{children}</main>
        </AnalysisProvider>
      </body>
    </html>
  )
}