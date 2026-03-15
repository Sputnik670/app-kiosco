/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 MERCADO PAGO OAUTH - CALLBACK
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Recibe el código de autorización de Mercado Pago después de que el usuario
 * autoriza la app, y lo intercambia por un access_token.
 *
 * FLUJO:
 * 1. MP redirige aquí con ?code=XXX&state=YYY
 * 2. Validamos state (anti-CSRF) contra la cookie
 * 3. Intercambiamos code por access_token con MP API
 * 4. Guardamos credenciales encriptadas en Supabase
 * 5. Redirigimos al dashboard con éxito
 *
 * SEGURIDAD:
 * - Validar state token contra cookie
 * - Code se usa una sola vez (MP lo invalida después del intercambio)
 * - access_token se encripta antes de guardar
 * - Redirect solo a rutas internas
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logging'
import { randomBytes, createCipheriv } from 'crypto'

// ───────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────

const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token'
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 1: Verificar si MP retornó un error
    // ─────────────────────────────────────────────────────────────────────────

    if (errorParam) {
      logger.warn('MPOAuthCallback', 'MP retornó error', { error: errorParam })
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=access_denied', request.url)
      )
    }

    if (!code || !state) {
      logger.warn('MPOAuthCallback', 'Parámetros faltantes', {
        hasCode: !!code,
        hasState: !!state,
      })
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=invalid_request', request.url)
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2: Validar state anti-CSRF
    // ─────────────────────────────────────────────────────────────────────────

    const savedState = request.cookies.get('mp_oauth_state')?.value

    if (!savedState || savedState !== state) {
      logger.warn('MPOAuthCallback', 'State mismatch (posible CSRF)', {
        hasState: !!savedState,
        matches: savedState === state,
      })
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=csrf_failed', request.url)
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 3: Verificar usuario autenticado
    // ─────────────────────────────────────────────────────────────────────────

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Obtener org_id del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.organization_id) {
      logger.error('MPOAuthCallback', 'Usuario sin organización', new Error(`userId: ${user.id}`))
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=no_org', request.url)
      )
    }

    if (profile.role !== 'owner') {
      logger.warn('MPOAuthCallback', 'Usuario no es owner', {
        userId: user.id,
        role: profile.role,
      })
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=not_owner', request.url)
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 4: Intercambiar code por access_token
    // ─────────────────────────────────────────────────────────────────────────

    const appId = process.env.MP_APP_ID
    const clientSecret = process.env.MP_CLIENT_SECRET
    const redirectUri = process.env.MP_REDIRECT_URI

    if (!appId || !clientSecret || !redirectUri) {
      logger.error('MPOAuthCallback', 'Variables de entorno MP faltantes')
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=server_config', request.url)
      )
    }

    const tokenResponse = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      logger.error('MPOAuthCallback', 'Error intercambiando code por token', new Error(`Status ${tokenResponse.status}: ${errorData.message || errorData.error}`))
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=token_exchange', request.url)
      )
    }

    const tokenData = await tokenResponse.json()

    // tokenData contiene: access_token, token_type, expires_in, scope, user_id, refresh_token, public_key
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      user_id: mpUserId,
      public_key: publicKey,
      expires_in: expiresIn,
    } = tokenData

    if (!accessToken) {
      logger.error('MPOAuthCallback', 'Token response sin access_token', new Error(`keys: ${Object.keys(tokenData).join(',')}`))
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=no_token', request.url)
      )
    }

    logger.info('MPOAuthCallback', 'Token obtenido exitosamente', {
      mpUserId,
      expiresIn,
      hasRefreshToken: !!refreshToken,
    })

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 5: Encriptar y guardar credenciales
    // ─────────────────────────────────────────────────────────────────────────

    const encryptedToken = encrypt(accessToken)
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null

    // Calcular fecha de expiración del token
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

    const { error: upsertError } = await supabase
      .from('mercadopago_credentials')
      .upsert(
        {
          organization_id: profile.organization_id,
          access_token_encrypted: encryptedToken,
          refresh_token_encrypted: encryptedRefreshToken,
          webhook_secret_encrypted: null, // OAuth no necesita webhook secret manual
          collector_id: String(mpUserId),
          public_key: publicKey || '',
          is_sandbox: false,
          is_active: true,
          token_expires_at: tokenExpiresAt,
          connected_via: 'oauth',
        },
        { onConflict: 'organization_id' }
      )
      .select('id')
      .single()

    if (upsertError) {
      logger.error('MPOAuthCallback', 'Error guardando credenciales', upsertError)
      return NextResponse.redirect(
        new URL('/dashboard?tab=ajustes&mp_error=save_failed', request.url)
      )
    }

    logger.info('MPOAuthCallback', 'Credenciales OAuth guardadas', {
      orgId: profile.organization_id,
      mpUserId,
    })

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 6: Limpiar cookie y redirigir con éxito
    // ─────────────────────────────────────────────────────────────────────────

    const response = NextResponse.redirect(
      new URL('/dashboard?tab=ajustes&mp_success=connected', request.url)
    )

    // Limpiar cookie de state
    response.cookies.set('mp_oauth_state', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('MPOAuthCallback', 'Error inesperado en callback', err)
    return NextResponse.redirect(
      new URL('/dashboard?tab=ajustes&mp_error=unexpected', request.url)
    )
  }
}

// ───────────────────────────────────────────────────────────────────────────
// UTILIDADES DE ENCRIPTACIÓN (duplicadas del actions para uso en route handler)
// ───────────────────────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.MP_ENCRYPTION_KEY

  if (!keyEnv) {
    throw new Error('MP_ENCRYPTION_KEY no está configurada')
  }

  if (/^[0-9a-f]{64}$/i.test(keyEnv)) {
    return Buffer.from(keyEnv, 'hex')
  }

  if (keyEnv.length >= 32) {
    return Buffer.from(keyEnv.substring(0, 32), 'utf8')
  }

  const padded = keyEnv.padEnd(32, '\0')
  return Buffer.from(padded.substring(0, 32), 'utf8')
}

function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}
