// Server-side Supabase client — uses service_role key for staff operations
// Only used in API routes (never client-side)

import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL) {
  console.warn('SUPABASE_URL not set — thermography storage disabled')
}

export const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null
