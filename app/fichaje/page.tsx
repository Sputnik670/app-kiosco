"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle, AlertCircle, LogIn, LogOut } from "lucide-react"
import { toast } from "sonner"

function FichajeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [resultado, setResultado] = useState<"success" | "error" | null>(null)
  const [mensaje, setMensaje] = useState("")
  const [tipo, setTipo] = useState<"entrada" | "salida" | null>(null)
  const [sucursalNombre, setSucursalNombre] = useState("")
  const [sucursalId, setSucursalId] = useState<string | null>(null)
  const [procesado, setProcesado] = useState(false) // Prevenir reprocesamiento

  useEffect(() => {
    // Solo procesar si no se ha procesado ya
    if (!procesado) {
      procesarFichaje()
    }
  }, [procesado])

  const procesarFichaje = async () => {
    try {
      setLoading(true)

      // Obtener parámetros de la URL
      const sucursalId = searchParams.get("sucursal_id")
      const tipoParam = searchParams.get("tipo")

      // Validar parámetros
      if (!sucursalId || !tipoParam) {
        throw new Error("QR inválido: faltan parámetros requeridos")
      }

      if (tipoParam !== "entrada" && tipoParam !== "salida") {
        throw new Error("QR inválido: tipo debe ser 'entrada' o 'salida'")
      }

      setTipo(tipoParam as "entrada" | "salida")

      // Verificar sesión
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error("No hay sesión activa. Por favor, inicia sesión en la app.")
      }

      // Verificar que la sucursal existe y obtener su nombre
      const { data: sucursal, error: sucursalError } = await supabase
        .from('sucursales')
        .select('id, nombre, organization_id')
        .eq('id', sucursalId)
        .single()

      if (sucursalError || !sucursal) {
        throw new Error("Sucursal no encontrada. El QR puede estar desactualizado.")
      }

      setSucursalNombre(sucursal.nombre)
      setSucursalId(sucursalId)

      // Verificar que el empleado pertenece a la misma organización
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('organization_id, rol')
        .eq('id', user.id)
        .single()

      if (!perfil) {
        throw new Error("Perfil de usuario no encontrado")
      }

      if (perfil.rol !== "empleado") {
        throw new Error("Solo los empleados pueden fichar")
      }

      if (perfil.organization_id !== sucursal.organization_id) {
        throw new Error("No tienes acceso a esta sucursal")
      }

      // Verificar estado actual de fichaje (en TODAS las sucursales)
      const { data: asistenciaActual } = await supabase
        .from('asistencia')
        .select('id, sucursal_id, sucursales(nombre)')
        .eq('empleado_id', user.id)
        .is('salida', null)
        .maybeSingle()

      // Validar lógica de entrada/salida
      if (tipoParam === "entrada") {
        if (asistenciaActual) {
          // Verificar si la asistencia abierta es de otra sucursal
          if (asistenciaActual.sucursal_id !== sucursalId) {
            const otraSucursal = (asistenciaActual.sucursales as any)?.nombre || "otra sucursal"
            throw new Error(`Ya tienes una entrada activa en ${otraSucursal}. Debes fichar la salida allí primero.`)
          }
          throw new Error(`Ya tienes una entrada registrada. Debes fichar la salida primero.`)
        }

        // Registrar entrada
        const { error: insertError } = await supabase.from('asistencia').insert({
          organization_id: perfil.organization_id,
          sucursal_id: sucursalId,
          empleado_id: user.id,
          entrada: new Date().toISOString()
        })

        if (insertError) throw insertError

        setResultado("success")
        setMensaje(`Entrada registrada en ${sucursal.nombre}`)
        toast.success("Entrada registrada", { description: `Local: ${sucursal.nombre}` })

        // Vibración si está disponible
        if (navigator.vibrate) {
          navigator.vibrate(200)
        }

      } else { // tipo === "salida"
        if (!asistenciaActual) {
          throw new Error("No tienes una entrada registrada. Debes fichar la entrada primero.")
        }

        if (asistenciaActual.sucursal_id !== sucursalId) {
          throw new Error("Tu entrada fue registrada en otro local. Debes fichar la salida en el mismo local.")
        }

        // Registrar salida
        const { error: updateError } = await supabase
          .from('asistencia')
          .update({ salida: new Date().toISOString() })
          .eq('id', asistenciaActual.id)

        if (updateError) throw updateError

        setResultado("success")
        setMensaje(`Salida registrada en ${sucursal.nombre}`)
        toast.info("Salida registrada", { description: `Jornada finalizada en ${sucursal.nombre}` })

        // Vibración si está disponible
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100])
        }
      }

      // Marcar como procesado ANTES de redirección para prevenir doble procesamiento
      setProcesado(true)

      // Redirigir a la app con el sucursalId en la URL para que se establezca automáticamente
      // Usar router.push en lugar de window.location.href para mantener la sesión
      setTimeout(() => {
        const appUrl = `/?sucursal_id=${sucursalId}`
        router.push(appUrl)
      }, 1500)

    } catch (err: any) {
      console.error("Error procesando fichaje:", err)
      setResultado("error")
      setMensaje(err.message || "Error al procesar el fichaje")
      toast.error("Error", { description: err.message })
      setProcesado(false) // Permitir reintentar en caso de error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md p-8 shadow-2xl border-2">
        {loading && (
          <div className="text-center space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto" />
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Procesando fichaje...</h2>
              <p className="text-sm text-slate-500">Validando acceso al local</p>
            </div>
          </div>
        )}

        {!loading && resultado === "success" && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-green-700 mb-2 uppercase">
                {tipo === "entrada" ? "Entrada Registrada" : "Salida Registrada"}
              </h2>
              <p className="text-lg font-bold text-slate-700">{mensaje}</p>
              <p className="text-sm text-slate-500 mt-2">{sucursalNombre}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              {tipo === "entrada" ? (
                <LogIn className="h-5 w-5 text-blue-600" />
              ) : (
                <LogOut className="h-5 w-5 text-red-600" />
              )}
              <span className="font-bold">
                {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <Button
              onClick={() => router.push(`/?sucursal_id=${sucursalId}`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black"
            >
              Ir a la App
            </Button>
          </div>
        )}

        {!loading && resultado === "error" && (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-red-700 mb-2 uppercase">Error</h2>
              <p className="text-lg font-bold text-slate-700">{mensaje}</p>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-bold text-yellow-800">Sugerencias:</p>
                  <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                    <li>• Asegúrate de estar logueado en la app</li>
                    <li>• Verifica que el QR sea del local correcto</li>
                    <li>• Si es entrada, no debes tener otra entrada activa</li>
                    <li>• Si es salida, debes tener una entrada registrada</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="flex-1"
              >
                Ir a la App
              </Button>
              <Button
                onClick={procesarFichaje}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Reintentar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function FichajePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md p-8 shadow-2xl border-2">
          <div className="text-center space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto" />
            <h2 className="text-xl font-black text-slate-800">Cargando...</h2>
          </div>
        </Card>
      </div>
    }>
      <FichajeContent />
    </Suspense>
  )
}

