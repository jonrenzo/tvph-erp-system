import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateProxySession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  
  // IMPORTANT: DO NOT use following line `supabase.auth.getSession()` - use `supabase.auth.getUser()` instead
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect from root based on auth status
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/login'
    return NextResponse.redirect(url)
  }

  if (
    !user &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in and tries to access /login, redirect to /dashboard
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // If user must change password, redirect to reset page (unless already there)
  if (
    user &&
    user.user_metadata?.must_change_password === true &&
    !request.nextUrl.pathname.startsWith('/auth/reset-password')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/reset-password'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
