"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle, AlertCircle, LogIn, LogOut, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { useOfflineAttendance } from "@/hooks/use-offline-attendance"

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
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [saveOfflineOnError, setSaveOfflineOnError] = useState(false)

  // Offline hook - initialized after we have organizationId
  const offlineAttendance = organizationId && sucursalId
    ? useOfflineAttendance({ sucursalId, organizationId })
    : null

  useEffect(() => {
    // Solo procesar si no se ha procesado ya
    if (!procesado) {
      procesarFichaje()
    }
  }, [procesado])

  const procesarFichaje = async () => {
    let tipoParam: string | null = null
    let sucursalIdLocal: string | null = null
    let asistenciaActual: any = null

    try {
      setLoading(true)

      // Obtener parámetros de la URL
      sucursalIdLocal = searchParams.get("sucursal_id")
      tipoParam = searchParams.get("tipo")

      // Validar parámetros
      if (!sucursalIdLocal || !tipoParam) {
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

      // Schema V2: Verificar que la sucursal existe y obtener su nombre
      const { data: sucursal, error: sucursalError } = await supabase
        .from('branches')
        .select('id, name, organization_id')
        .eq('id', sucursalIdLocal)
        .eq('is_active', true)
        .single()

      if (sucursalError || !sucursal) {
        throw new Error("Sucursal no encontrada. El QR puede estar desactualizado.")
      }

      setSucursalNombre(sucursal.name)
      setSucursalId(sucursalIdLocal)
      setOrganizationId(sucursal.organization_id)

      // Schema V2: Verificar membership del empleado
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (!membership) {
        throw new Error("Perfil de usuario no encontrado")
      }

      if (membership.role !== "employee") {
        throw new Error("Solo los empleados pueden fichar")
      }

      if (membership.organization_id !== sucursal.organization_id) {
        throw new Error("No tienes acceso a esta sucursal")
      }

      // Verificar estado actual de fichaje (en TODAS las sucursales)
      const { data: asistenciaActualData } = await supabase
        .from('attendance')
        .select('id, branch_id, branches(name)')
        .eq('user_id', user.id)
        .is('check_out', null)
        .maybeSingle()

      asistenciaActual = asistenciaActualData

      // Validar lógica de entrada/salida
      if (tipoParam === "entrada") {
        if (asistenciaActual) {
          // Verificar si la asistencia abierta es de otra sucursal
          if (asistenciaActual.branch_id !== sucursalId) {
            const otraSucursal = (asistenciaActual.branches as any)?.name || "otra sucursal"
            throw new Error(`Ya tienes una entrada activa en ${otraSucursal}. Debes fichar la salida allí primero.`)
          }
          throw new Error(`Ya tienes una entrada registrada. Debes fichar la salida primero.`)
        }

        // Registrar entrada
        const { error: insertError } = await supabase.from('attendance').insert({
          organization_id: membership.organization_id,
          branch_id: sucursalId,
          user_id: user.id,
          check_in: new Date().toISOString()
        })

        if (insertError) {
          // Si falla por error de red, intentar guardar offline
          if (insertError.code === 'PGRST116' || !navigator.onLine) {
            console.warn('Insert falló, intentando guardar offline:', insertError)
            throw new Error('network_error')
          }
          throw insertError
        }

        setResultado("success")
        setMensaje(`Entrada registrada en ${sucursal.name}`)
        toast.success("Entrada registrada", { description: `Local: ${sucursal.name}` })

        // Vibración si está disponible
        if (navigator.vibrate) {
          navigator.vibrate(200)
        }

      } else { // tipo === "salida"
        if (!asistenciaActual) {
          throw new Error("No tienes una entrada registrada. Debes fichar la entrada primero.")
        }

        if (asistenciaActual.branch_id !== sucursalId) {
          throw new Error("Tu entrada fue registrada en otro local. Debes fichar la salida en el mismo local.")
        }

        // Registrar salida
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ check_out: new Date().toISOString() })
          .eq('id', asistenciaActual.id)

        if (updateError) {
          // Si falla por error de red, intentar guardar offline
          if (updateError.code === 'PGRST116' || !navigator.onLine) {
            console.warn('Update falló, intentando guardar offline:', updateError)
            throw new Error('network_error')
          }
          throw updateError
        }

        setResultado("success")
        setMensaje(`Salida registrada en ${sucursal.name}`)
        toast.info("Salida registrada", { description: `Jornada finalizada en ${sucursal.name}` })

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
        const appUrl = `/?sucursal_id=${sucursalIdLocal}`
        router.push(appUrl)
      }, 1500)

    } catch (err: any) {
      console.error("Error procesando fichaje:", err)

      // Intentar guardar offline si hay error de red
      if (err.message === 'network_error' && offlineAttendance && tipoParam) {
        console.log('[Fichaje] Guardando fichaje offline por error de red')
        const tipo = tipoParam as 'entrada' | 'salida'
        const attendanceId = tipo === 'salida' ? asistenciaActual?.id : undefined

        const offlineResult = await offlineAttendance.saveAttendanceOffline(
          tipo,
          attendanceId
        )

        if (offlineResult.success) {
          setResultado("success")
          setMensaje(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} guardada offline - Se sincronizará cuando haya conexión`)
          toast.success("Fichaje guardado offline", {
            description: "Se sincronizará cuando haya conexión",
          })

          // Vibración si está disponible
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100])
          }

          setProcesado(true)

          // Redirigir después de 2 segundos
          setTimeout(() => {
            const appUrl = `/?sucursal_id=${sucursalIdLocal}`
            router.push(appUrl)
          }, 2000)

          setLoading(false)
          return
        }
      }

      // Si no pudo guardarse offline tampoco, mostrar error
      setResultado("error")
      setMensaje(err.message || "Error al procesar el fichaje")
      toast.error("Error", { description: err.message })
      setProcesado(false) // Permitir reintentar en caso de error
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
              {mensaje.includes('offline') && (
                <div className="mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 border-2 border-amber-200 rounded-lg">
                  <WifiOff className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700">Se sincronizará cuando haya conexión</span>
                </div>
              )}
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

