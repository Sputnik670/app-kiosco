// components/auth-form.tsx

"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2, Mail, Lock, LogIn, UserPlus, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'
import {
  signInWithPasswordAction,
  signUpAction,
  signInWithMagicLinkAction,
  resetPasswordAction,
} from '@/lib/actions/auth.actions'

// Ícono de Google como componente inline para no depender de librerías externas
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const [usePasswordReset, setUsePasswordReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPasswordError, setShowPasswordError] = useState(false)

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    try {
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : '/auth/callback'

      // Usar createBrowserClient (SSR) en lugar del cliente vanilla
      // para que el code verifier PKCE se guarde en cookies y sea
      // accesible desde el server callback route
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })

      if (error) throw error
      // Si no hay error, Supabase redirige al usuario a Google automáticamente
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo conectar con Google'
      toast.error('Error con Google', { description: message })
      setGoogleLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let result

      if (usePasswordReset) {
        // Opción 0: Recuperar contraseña
        const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
        result = await resetPasswordAction(email, redirectTo)
      } else if (useMagicLink) {
        // Opción 1: Iniciar con Magic Link (Para empleados invitados)
        const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
        result = await signInWithMagicLinkAction(email, redirectTo)
      } else if (isLogin) {
        // Opción 2: Login con Contraseña (Solo dueños o si el empleado ya configuró una)
        result = await signInWithPasswordAction(email, password)
      } else {
        // Opción 3: Registro nuevo (Signup con contraseña)
        result = await signUpAction(email, password)

        // Si el registro fue exitoso, cambiamos a modo login
        if (result.success) {
          setIsLogin(true)
        }
      }

      // Manejar resultado de la acción
      if (result.success) {
        const successMessage = usePasswordReset
          ? 'Enlace de recuperación enviado'
          : useMagicLink
            ? 'Enlace enviado'
            : isLogin
              ? '¡Bienvenido!'
              : 'Registro exitoso'

        toast.success(successMessage, { description: result.message })

        // Redirigir después del login exitoso con contraseña
        if (isLogin && !useMagicLink && !usePasswordReset) {
          window.location.href = '/'
        }

        // Después de enviar reset, volver al login
        if (usePasswordReset) {
          setUsePasswordReset(false)
        }
      } else {
        throw new Error(result.error || 'Error de autenticación')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Credenciales inválidas.'

      // Si falla el login con contraseña, sugerir Magic Link (empleados invitados sin password)
      if (isLogin && !useMagicLink && !usePasswordReset) {
        setShowPasswordError(true)
      }

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
            {usePasswordReset ? 'Recuperar contraseña' : useMagicLink ? 'Acceso sin contraseña' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </p>
        </div>

        {/* Botón Google — solo visible en login/signup, no en magic link ni reset */}
        {!useMagicLink && !usePasswordReset && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 gap-2 font-medium"
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <GoogleIcon />
              )}
              {googleLoading ? 'Conectando...' : 'Continuar con Google'}
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">o</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

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

          {/* Ocultamos el campo de contraseña si se usa Magic Link o Password Reset */}
          {!useMagicLink && !usePasswordReset && (
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
            ) : useMagicLink ? (
               <><Wand2 className="mr-2 h-5 w-5" /> Enviar Enlace Mágico</>
            ) : isLogin ? (
              <><LogIn className="mr-2 h-5 w-5" /> Iniciar Sesión</>
            ) : (
              <><UserPlus className="mr-2 h-5 w-5" /> Registrar Cuenta</>
            )}
          </Button>
        </form>

        {/* Banner de ayuda: aparece después de un login fallido con contraseña */}
        {showPasswordError && !useMagicLink && !usePasswordReset && isLogin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center space-y-2">
            <p className="text-xs font-medium text-amber-800">
              ¿Fuiste invitado como empleado? Es posible que no tengas contraseña aún.
            </p>
            <Button
              variant="outline"
              type="button"
              onClick={() => { setUseMagicLink(true); setShowPasswordError(false) }}
              className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Ingresar con enlace mágico
            </Button>
          </div>
        )}

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
              {/* Botón para alternar entre Contraseña y Magic Link — más visible */}
              {!useMagicLink && isLogin && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => { setUseMagicLink(true); setShowPasswordError(false) }}
                  className="h-9 text-xs gap-1.5"
                  disabled={loading}
                >
                  <Wand2 className="h-3.5 w-3.5" /> Ingresar sin contraseña
                </Button>
              )}

              {useMagicLink && (
                <Button
                  variant="link"
                  type="button"
                  onClick={() => setUseMagicLink(false)}
                  className="h-auto p-0 text-xs"
                  disabled={loading}
                >
                  Volver a usar contraseña
                </Button>
              )}

              {/* Botón Olvidé mi contraseña (solo en modo login con contraseña) */}
              {isLogin && !useMagicLink && (
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

              {/* Botón para alternar entre Login y Registro */}
              {!useMagicLink && (
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
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}