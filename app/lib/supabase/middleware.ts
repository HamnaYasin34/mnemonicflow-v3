import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

const PROTECTED_PATHS = ['/', '/profile']
const AUTH_PATHS = ['/login']

/**
 * Refreshes the Supabase session on every request and enforces route
 * protection at the edge — before any page ever renders. This is what
 * eliminates the "flash of protected content" / redirect races that
 * client-only guards (the old `AuthGuard` calling `getUser()` in a
 * `useEffect`) can't fully avoid.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not run any code between createServerClient and this call.
  // getUser() revalidates the token against Supabase Auth and, as a side
  // effect, refreshes it if it's expired — keeping sessions alive across
  // reloads without ever hitting the "Failed to fetch" state the old code
  // could get stuck in.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PATHS.includes(pathname)
  const isAuthPage = AUTH_PATHS.includes(pathname)

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}
