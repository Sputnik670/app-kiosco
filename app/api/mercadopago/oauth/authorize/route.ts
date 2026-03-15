/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 MERCADO PAGO OAUTH - AUTHORIZE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Redirige al usuario a Mercado Pago para autorizar la app.
 * El usuario inicia sesión con su cuenta NORMAL de MP (no developer).
 *
 * FLUJO:
 * 1. Owner hace click en "Conectar con Mercado Pago"
 * 2. Este endpoint genera un state token (anti-CSRF) y lo guarda en cookie
 * 3. Redirige a auth.mercadopago.com.ar/authorization
 * 4. MP muestra login → usuario autoriza → MP redirige a /callback
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { randomBytes } from 'crypto'
import { logger } from '@/lib/logging'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 1: Verificar que el usuario está autenticado
    // ─────────────────────────────────────────────────────────────────────────

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2: Validar configuración de la app
    // ─────────────────────────────────────────────────────────────────────────

    const appId = process.env.MP_APP_ID
    const redirectUri = process.env.MP_REDIRECT_URI

    if (!appId || !redirectUri) {
      logger.error('MPOAuthAuthorize', 'MP_APP_ID o MP_REDIRECT_URI no configurados')
      return NextResponse.redirect(
        new URL('/dashboard?error=mp_config_missing', request.url)
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 3: Generar state token anti-CSRF
    // ─────────────────────────────────────────────────────────────────────────

    const state = randomBytes(32).toString('hex')

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 4: Construir URL de autorización de Mercado Pago
    // ─────────────────────────────────────────────────────────────────────────

    const mpAuthUrl = new URL('https://auth.mercadopago.com.ar/authorization')
    mpAuthUrl.searchParams.set('client_id', appId)
    mpAuthUrl.searchParams.set('response_type', 'code')
    mpAuthUrl.searchParams.set('platform_id', 'mp')
    mpAuthUrl.searchParams.set('redirect_uri', redirectUri)
    mpAuthUrl.searchParams.set('state', state)

    logger.info('MPOAuthAuthorize', 'Redirigiendo a Mercado Pago OAuth', {
      userId: user.id,
      appId,
    })

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 5: Guardar state en cookie y redirigir
    // ─────────────────────────────────────────────────────────────────────────

    const response = NextResponse.redirect(mpAuthUrl.toString())

    response.cookies.set('mp_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutos
      path: '/',
    })

    return response
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('MPOAuthAuthorize', 'Error en authorize', err)
    return NextResponse.redirect(new URL('/dashboard?error=mp_oauth_error', request.url))
  }
}
