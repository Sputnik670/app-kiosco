// components/auth-form.tsx

"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2, Mail, Lock, LogIn, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  signInWithPasswordAction,
  signUpAction,
  resetPasswordAction,
} from '@/lib/actions/auth.actions'

/**
 * AuthForm — pantalla de login / signup / recuperar contraseña.
 *
 * FIX 2026-04-22: Se eliminaron el botón "Continuar con Google" (OAuth) y
 * el botón "Ingresar sin contraseña" (magic link) del login.
 *
 * Motivos:
 * - Magic link: duplicaba funcionalidad con "olvidé mi contraseña" y agregaba
 *   una tercera vía de auth que el kiosquero no iba a usar.
 * - Google OAuth: expone el project ref de Supabase en la pantalla de Google
 *   ("Ir a vrgexonzlrdptrplqpri.supabase.co") lo cual se ve poco profesional
 *   sin un custom domain (plan Pro). También había un historial de bugs
 *   (oauth v2, oauth v3, forzar selector google oauth) que no pagaba la pena
 *   mantener.
 *
 * NOTA: El magic link sigue existiendo internamente para invitar empleados
 * (ver invitar-empleado.tsx + app/auth/callback/route.ts). Solo se saca del
 * login público.
 */
export default function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [usePasswordReset, setUsePasswordReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let result

      if (usePasswordReset) {
        // Opción 0: Recuperar contraseña
        // El redirectTo va DIRECTO a /auth/set-password (no pasa por callback).
        // Supabase manda recovery por PKCE (?code=) o implicit (#access_token=);
        // la página set-password tiene consumers para ambos flujos.
        const redirectTo = typeof window !== 'undefined'
          ? `${window.location.origin}/auth/set-password`
          : undefined
        result = await resetPasswordAction(email, redirectTo)
      } else if (isLogin) {
        // Opción 1: Login con email + contraseña
        result = await signInWithPasswordAction(email, password)
      } else {
        // Opción 2: Signup con email + contraseña
        // El link de confirmación del email entra por /auth/callback para
        // intercambiar el code de PKCE por una sesión válida.
        const signUpRedirectTo = typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined
        result = await signUpAction(email, password, signUpRedirectTo)

        // Si el registro fue exitoso, volvemos a modo login así el user
        // confirma el mail y después entra con su password recién creada.
        if (result.success) {
          setIsLogin(true)
        }
      }

      if (result.success) {
        const successMessage = usePasswordReset
          ? 'Enlace de recuperación enviado'
          : isLogin
            ? '¡Bienvenido!'
            : 'Registro exitoso'

        toast.success(successMessage, { description: result.message })

        // Full reload tras login exitoso para refrescar cookies de sesión.
        if (isLogin && !usePasswordReset) {
          window.location.href = '/'
        }

        // Después de mandar el reset, volver a la pantalla de login.
        if (usePasswordReset) {
          setUsePasswordReset(false)
        }
      } else {
        throw new Error(result.error || 'Error de autenticación')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Credenciales inválidas.'
      toast.error('Error de autenticación', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-accent/10">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Kiosco App</h1>
          <p className="text-muted-foreground mt-1">
            {usePasswordReset ? 'Recuperar contraseña' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email
            </label>
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Campo de contraseña oculto en modo "recuperar contraseña" */}
          {!usePasswordReset && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Contraseña
              </label>
              <Input
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : usePasswordReset ? (
              <><Mail className="mr-2 h-5 w-5" /> Enviar enlace de recuperación</>
            ) : isLogin ? (
              <><LogIn className="mr-2 h-5 w-5" /> Iniciar Sesión</>
            ) : (
              <><UserPlus className="mr-2 h-5 w-5" /> Registrar Cuenta</>
            )}
          </Button>
        </form>

        <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
          {usePasswordReset ? (
            <Button
              variant="link"
              type="button"
              onClick={() => setUsePasswordReset(false)}
              className="h-auto p-0 text-xs"
              disabled={loading}
            >
              Volver a iniciar sesión
            </Button>
          ) : (
            <>
              {isLogin && (
                <Button
                  variant="link"
                  type="button"
                  onClick={() => setUsePasswordReset(true)}
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                  disabled={loading}
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              )}

              <Button
                variant="link"
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:text-primary/80 h-auto p-0 mt-2"
                disabled={loading}
              >
                {isLogin
                  ? "¿Necesitas una cuenta? Regístrate aquí."
                  : "¿Ya tienes cuenta? Inicia sesión."
                }
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
