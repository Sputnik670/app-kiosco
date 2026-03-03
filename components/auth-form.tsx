// components/auth-form.tsx

"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Loader2, Mail, Lock, LogIn, UserPlus, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  signInWithPasswordAction,
  signUpAction,
  signInWithMagicLinkAction,
  resetPasswordAction,
} from '@/lib/actions/auth.actions'

export default function AuthForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [useMagicLink, setUseMagicLink] = useState(false)
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
              {/* Botón para alternar entre Contraseña y Magic Link */}
              <Button
                variant="link"
                type="button"
                onClick={() => setUseMagicLink(!useMagicLink)}
                className="h-auto p-0 text-xs"
                disabled={loading}
              >
                {useMagicLink
                  ? "Volver a usar contraseña"
                  : "Ingresar sin contraseña (Magic Link)"
                }
              </Button>

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