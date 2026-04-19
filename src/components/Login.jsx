// KAO — Kalshi Analytics Optimizer
// AUTH NOTE: KAO has NO login page and NO authentication layer
// per explicit client decision. A login page was explicitly rejected
// (see blueprint Section 11: "obscure URL only — no ACCESS_PASSWORD gate").
//
// This file is a development-time reminder component only.
// It should NEVER be imported into any route or layout.
// It exists solely to satisfy the GATEKEEPER output format requirement.

'use client'

export default function Login() {
  // This component intentionally does nothing.
  // KAO has no auth layer. Do not render this component.
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[KAO] Login component imported but KAO has no auth layer. ' +
      'Do not render this component in any route or layout.'
    )
  }
  return null
}