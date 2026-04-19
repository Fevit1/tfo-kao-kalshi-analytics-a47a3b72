// KAO — Kalshi Analytics Optimizer
// next.config.js — HTTP security headers and build configuration.

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode for catching React issues in development
  reactStrictMode: true,

  // HTTP Security Headers — applied to all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // script-src: self + Vercel CDN for Next.js internals
            // style-src: self + unsafe-inline required for Tailwind
            // img-src: self + data URIs + https for external market images
            // connect-src: self for API routes only (all external calls are server-side)
            // frame-ancestors: none — prevents clickjacking
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://vercel.live wss://ws-us3.pusher.com",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // Environment variable exposure control
  // CRITICAL: Only NEXT_PUBLIC_KALSHI_ENV is permitted as a NEXT_PUBLIC_ variable.
  // NEVER add NEXT_PUBLIC_KALSHI_API_KEY, NEXT_PUBLIC_PERPLEXITY_API_KEY,
  // or NEXT_PUBLIC_ANTHROPIC_API_KEY here — CI grep will fail deploy if found.
  env: {
    // No secrets here. NEXT_PUBLIC_KALSHI_ENV is set in Vercel dashboard.
  },
}

module.exports = nextConfig