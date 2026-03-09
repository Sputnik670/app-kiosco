"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, AlertTriangle, RotateCcw } from "lucide-react"
import { Suspense } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * /signup?token=xxx
 *
 * Ruta destino del Magic Link de invitación de empleados.
 * Redirige a la página principal preservando el token de invitación.
 *
 * FLUJO EXITOSO:
 * 1. Dueño invita empleado → se genera magic link con token
 * 2. Empleado hace clic en magic link → Supabase autentica → redirige aquí
 * 3. Esta página redirige a /?invite_token=xxx
 * 4. page.tsx detecta la sesión → muestra ProfileSetup → usa el token
 *
 * FLUJO CON ERROR (link expirado):
 * Supabase redirige aquí con ?error=access_denied&error_code=otp_expired
 * → Mostramos mensaje claro al empleado
 */
function SignupRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Detectar errores de Supabase Auth (magic link expirado, etc.)
    const authError = searchParams.get("error")
    const errorCode = searchParams.get("error_code")
    const errorDescription = searchParams.get("error_description")

    if (authError || errorCode) {
      // Magic link expirado o inválido
      if (errorCode === "otp_expired") {
        setError("El link de invitación expiró. Pedile a tu jefe que te envíe uno nuevo.")
      } else {
        setError(errorDescription?.replace(/\+/g, " ") || "Error al verificar tu invitación. Pedí un nuevo link.")
      }
      return
    }

    const token = searchParams.get("token")

    if (token) {
      // Redirigir a home con el token de invitación
      router.replace(`/?invite_token=${token}`)
    } else {
      // Sin token ni error, ir a home normal
      router.replace("/")
    }
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-8 border-2 shadow-xl rounded-[2rem] text-center space-y-6">
          <div className="h-16 w-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-800">
              Link Expirado
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              {error}
            </p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => router.replace("/")}
              className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-[0.2em]"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Ir al Inicio
            </Button>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              El dueño puede reenviar la invitación desde su panel
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          Configurando tu acceso...
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <SignupRedirect />
    </Suspense>
  )
}
