import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas de API que NO requieren autenticación
const PUBLIC_API_ROUTES = ['/api/health']

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
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

  // IMPORTANT: Refresh session if expired
  // This will update the cookies with a new session if needed
  const { data: { user } } = await supabase.auth.getUser()

  // ──────────────────────────────────────────────────────────────────────────
  // PROTECCIÓN DE RUTAS API
  // Las rutas /api/* (excepto las públicas) requieren autenticación
  // ──────────────────────────────────────────────────────────────────────────
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/api/')) {
    const isPublicRoute = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))

    if (!isPublicRoute && !user) {
      return NextResponse.json(
        { error: 'No autenticado', code: 'AUTH_001' },
        { status: 401 }
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
