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
} from '@/lib/actions/auth.actions'

export default function AuthForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [useMagicLink, setUseMagicLink] = useState(false) // Nuevo estado para alternar modo
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let result

      if (useMagicLink) {
        // Opción 1: Iniciar con Magic Link (Para empleados invitados o si olvidaron contraseña)
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
        toast.success(useMagicLink ? 'Enlace enviado' : (isLogin ? '¡Bienvenido!' : 'Registro exitoso'), {
          description: result.message
        })

        // Redirigir después del login exitoso con contraseña
        // Magic Link no redirige (el usuario recibe un email)
        // Registro no redirige (el usuario debe confirmar email o iniciar sesión)
        if (isLogin && !useMagicLink) {
          window.location.href = '/'
        }
      } else {
        throw new Error(result.error || 'Error de autenticación')
      }
    } catch (error: any) {
      console.error(error)
      toast.error('Error de autenticación', {
        description: error.message || 'Credenciales inválidas.'
      })
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
            {useMagicLink ? 'Acceso sin contraseña' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
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

          {/* Ocultamos el campo de contraseña si se usa Magic Link */}
          {!useMagicLink && (
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
              : "Ingresar sin contraseña / Olvidé mi clave"
            }
          </Button>

          {/* Botón para alternar entre Login y Registro (Solo visible si no es Magic Link) */}
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
        </div>
      </Card>
    </div>
  )
}