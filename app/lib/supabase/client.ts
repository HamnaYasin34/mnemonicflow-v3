import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/**
 * Browser-side Supabase client.
 *
 * Uses @supabase/ssr's cookie-based storage instead of localStorage, so the
 * session is visible to Server Components, Route Handlers, and middleware —
 * not just this tab. `createBrowserClient` memoizes internally, so calling
 * this in multiple components does NOT create duplicate GoTrueClient
 * instances (which was the root cause of the "Lock ... auth-token was
 * released" warnings in the old singleton `createClient()` setup).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
