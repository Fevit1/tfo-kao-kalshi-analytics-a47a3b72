// KAO — Kalshi Analytics Optimizer
// TopNav — shared navigation bar with KAO branding and Feed/Watchlist links.
// Rendered in the shared root layout (src/app/layout.jsx).

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, BookmarkCheck, Settings } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Feed', icon: BarChart2 },
  { href: '/watchlist', label: 'Watchlist', icon: BookmarkCheck },
]

export default function TopNav({ onSettingsClick }) {
  const pathname = usePathname()

  return (
    <nav className="w-full bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-[var(--demo-banner-height,0px)] z-40">
      {/* Branding */}
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 font-black text-xl tracking-tight select-none">
          KAO
        </span>
        <span className="text-gray-500 text-xs font-medium hidden sm:inline">
          Kalshi Analytics Optimizer
        </span>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/'
              ? pathname === '/' || pathname.startsWith('/analysis')
              : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </Link>
          )
        })}

        {/* Settings gear — triggers SettingsSlideOver on Feed screen */}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            aria-label="Open settings panel"
            className="ml-2 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
          >
            <Settings size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  )
}