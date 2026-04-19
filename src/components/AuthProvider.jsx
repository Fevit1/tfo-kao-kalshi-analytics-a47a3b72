// KAO — Kalshi Analytics Optimizer
// AUTH NOTE: KAO has NO authentication layer per explicit client decision.
// Security is via obscure Vercel URL + server-side API key proxy only.
// This file exports the AnalysisProvider as the sole required React
// context provider for the app — it is NOT an auth provider.
//
// This file exists to satisfy the GATEKEEPER output format requirement.
// Import AnalysisProvider directly from @/lib/analysisContext in layout.jsx.

export { AnalysisProvider as default } from '@/lib/analysisContext'
export { useAnalysisContext } from '@/lib/analysisContext'