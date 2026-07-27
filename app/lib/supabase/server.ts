import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Server-side Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Reads/writes the session via Next.js's cookie store,
 * so it always sees the exact same session the browser client set.
 *
 * NOTE: Server Components can't actually write cookies (Next.js will throw
 * if you try outside a Route Handler / Server Action), so `setAll` is
 * wrapped in a try/catch. That's fine as long as `middleware.ts` is also
 * refreshing the session on every request — which it is.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware.ts refreshes the session on every request anyway.
          }
        },
      },
    }
  )
}
