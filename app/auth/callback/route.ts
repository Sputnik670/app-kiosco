import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * GET /auth/callback
 *
 * Callback de autenticación de Supabase (PKCE flow).
 * Intercambia el `code` por una sesión válida y redirige al destino.
 *
 * FLUJO MAGIC LINK EMPLEADOS:
 * 1. Empleado hace clic en magic link del email
 * 2. Supabase verifica el OTP y redirige aquí con ?code=xxx&invite_token=yyy
 * 3. Este handler intercambia el code por una sesión (cookies)
 * 4. Redirige a /?invite_token=yyy → ProfileSetup detecta la invitación
 *
 * FLUJO GENÉRICO:
 * También funciona para cualquier otro flujo de auth (password reset, etc.)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const inviteToken = searchParams.get('invite_token')
  // Supabase puede enviar `next` como redirect destino
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Puede fallar en ciertos contextos de Next.js
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Éxito: redirigir con invite_token si existe
      const redirectUrl = new URL(next, origin)
      if (inviteToken) {
        redirectUrl.searchParams.set('invite_token', inviteToken)
      }
      return NextResponse.redirect(redirectUrl)
    }

    // Error en el intercambio: redirigir a signup con error
    const errorUrl = new URL('/signup', origin)
    errorUrl.searchParams.set('error', 'auth_error')
    errorUrl.searchParams.set('error_code', error.code || 'unknown')
    errorUrl.searchParams.set('error_description', error.message)
    return NextResponse.redirect(errorUrl)
  }

  // Sin code: redirigir al inicio
  return NextResponse.redirect(new URL('/', origin))
}
