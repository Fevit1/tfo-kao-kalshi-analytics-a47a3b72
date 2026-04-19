// KAO — Kalshi Analytics Optimizer
// Supabase client — Phase 2 readiness only.
// Phase 1 has NO database tables and NO auth layer.
// This client is instantiated here so Phase 2 can add server-side
// persistence without restructuring imports. It is NOT used at runtime
// in Phase 1 (no tables exist to query).

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Guard: if env vars are absent (expected in Phase 1 since Supabase
// is not the primary data store), export a null client so imports
// don't crash. Phase 2 must set these env vars in Vercel dashboard.
let supabase = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export { supabase }

// NOTE FOR PHASE 2:
// When adding server-side persistence (watchlist_items, analysis_cache tables),
// import { supabase } from '@/lib/supabase' in API routes.
// The full schema is documented in the migration SQL comments.
// RLS policies will be needed — see Phase 2 schema in migration file.