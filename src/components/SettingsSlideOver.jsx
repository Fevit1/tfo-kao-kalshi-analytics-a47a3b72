// KAO — Kalshi Analytics Optimizer
// SettingsSlideOver — category filter + sort preferences.
// Reads/writes localStorage:kalshi_preferences.

'use client'

import { useState, useEffect } from 'react'
import { X, Settings } from 'lucide-react'
import { CONFIRMED_CATEGORIES } from '@/lib/kalshiCategories'
import { getCategoryColor, getCategoryLabel } from '@/lib/kalshiCategories'

export default function SettingsSlideOver({ open, onClose, preferences, onSave }) {
  const [localCategories, setLocalCategories] = useState([])
  const [localSortBy, setLocalSortBy] = useState('volume')

  useEffect(() => {
    if (preferences) {
      setLocalCategories(preferences.categories ?? [...CONFIRMED_CATEGORIES])
      setLocalSortBy(preferences.sort_by ?? 'volume')
    }
  }, [preferences, open])

  const toggleCategory = (cat) => {
    setLocalCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const selectAll = () => setLocalCategories([...CONFIRMED_CATEGORIES])
  const clearAll = () => setLocalCategories([])

  const handleSave = () => {
    onSave({
      categories: localCategories,
      sort_by: localSortBy,
      last_updated: new Date().toISOString(),
    })
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-gray-900 border-l border-gray-800 z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-400" />
            <h2 className="text-white font-semibold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Sort order */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Sort Markets By</h3>
            <div className="space-y-2">
              {[
                { value: 'volume', label: 'Volume (highest first)' },
                { value: 'close_date', label: 'Close Date (soonest first)' },
                { value: 'score', label: 'Opportunity Score (when available)' },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name="sort_by"
                    value={value}
                    checked={localSortBy === value}
                    onChange={() => setLocalSortBy(value)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Category filters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Categories</h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  All
                </button>
                <span className="text-gray-700">·</span>
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {CONFIRMED_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={localCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                    className="accent-emerald-500"
                  />
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(cat)}`}
                  >
                    {getCategoryLabel(cat)}
                  </span>
                </label>
              ))}
            </div>
            {localCategories.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">
                ⚠️ No categories selected — no markets will appear in the feed.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </>
  )
}