// KAO — Kalshi Analytics Optimizer
// AUTH NOTE: KAO has NO protected routes and NO authentication layer
// per explicit client decision. This file is a no-op passthrough that
// renders its children unconditionally.
//
// This file exists to satisfy the GATEKEEPER output format requirement.
// Do NOT add auth checks, redirects, or session guards here.
// Security is handled entirely by server-side API key proxying.

'use client'

export default function ProtectedRoute({ children }) {
  // No auth check — all routes are publicly accessible.
  // KAO is a single-user personal tool secured by obscure Vercel URL.
  return <>{children}</>
}