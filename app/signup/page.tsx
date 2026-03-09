"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Suspense } from "react"

/**
 * /signup?token=xxx
 *
 * Ruta destino del Magic Link de invitación de empleados.
 * Redirige a la página principal preservando el token de invitación.
 *
 * FLUJO:
 * 1. Dueño invita empleado → se genera magic link con token
 * 2. Empleado hace clic en magic link → Supabase autentica → redirige aquí
 * 3. Esta página redirige a /?invite_token=xxx
 * 4. page.tsx detecta la sesión → muestra ProfileSetup → usa el token
 */
function SignupRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get("token")

    if (token) {
      // Redirigir a home con el token de invitación
      router.replace(`/?invite_token=${token}`)
    } else {
      // Sin token, ir a home normal
      router.replace("/")
    }
  }, [router, searchParams])

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
