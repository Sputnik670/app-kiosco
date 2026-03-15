"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Clock, LogIn, LogOut, MapPin, Loader2, QrCode, Wifi, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { getAttendanceStatusAction, toggleAttendanceAction, type AttendanceRecord } from "@/lib/actions/attendance.actions"
import { useOfflineAttendance } from "@/hooks/use-offline-attendance"

interface RelojControlProps {
  sucursalId: string
  sucursalNombre: string
  organizationId: string
  onActionComplete: () => void // ✅ Prop agregada para sincronizar con el padre
  onScanQR?: () => void // ✅ Opción para escanear QR en lugar de botón manual
}

export default function RelojControl({ sucursalId, sucursalNombre, organizationId, onActionComplete, onScanQR }: RelojControlProps) {
  const [loading, setLoading] = useState(false)
  const [fichajeActivo, setFichajeActivo] = useState<AttendanceRecord | null>(null)

  // Offline attendance hook
  const { saveAttendanceOffline, isOffline, pendingCount, syncNow } = useOfflineAttendance({
    sucursalId,
    organizationId,
  })

  // 1. Verificar estado de asistencia al cargar
  useEffect(() => {
    const checkFichaje = async () => {
      const result = await getAttendanceStatusAction(sucursalId)

      if (result.success) {
        setFichajeActivo(result.activeRecord)
      } else {
        console.error("Error al verificar asistencia:", result.error)
      }
    }
    checkFichaje()
  }, [sucursalId])

  const handleFichaje = async () => {
    setLoading(true)
    try {
      const result = await toggleAttendanceAction(sucursalId)

      if (result.success) {
        // Online success
        if (result.action === 'entrada') {
          setFichajeActivo(result.record || null)
          toast.success("Entrada registrada", { description: `Local: ${sucursalNombre}` })
          onActionComplete()
        } else if (result.action === 'salida') {
          setFichajeActivo(null)
          toast.info("Salida registrada", { description: "Jornada finalizada correctamente." })
          onActionComplete()
        }
      } else {
        // Online failed — try offline
        console.warn("Online fichaje falló, guardando offline:", result.error)
        const tipo = fichajeActivo ? 'salida' : 'entrada'
        const offlineResult = await saveAttendanceOffline(tipo, fichajeActivo?.id)

        if (offlineResult.success) {
          // Update local state optimistically
          if (tipo === 'entrada') {
            setFichajeActivo({
              id: 'pending-offline',
              organization_id: organizationId,
              branch_id: sucursalId,
              user_id: '',
              check_in: new Date().toISOString(),
              check_out: null,
              created_at: new Date().toISOString(),
            })
          } else {
            setFichajeActivo(null)
          }
          toast.success("Fichaje guardado offline", {
            description: "Se sincronizará cuando haya conexión",
          })
          onActionComplete()
        } else {
          toast.error("Error al procesar el fichaje", { description: offlineResult.error })
        }
      }
    } catch (error: any) {
      console.error("Error fichaje:", error)
      // Try offline as fallback
      const tipo = fichajeActivo ? 'salida' : 'entrada'
      const offlineResult = await saveAttendanceOffline(tipo, fichajeActivo?.id)

      if (offlineResult.success) {
        toast.success("Fichaje guardado offline", {
          description: "Se sincronizará cuando haya conexión",
        })
        if (tipo === 'entrada') {
          setFichajeActivo({
            id: 'pending-offline',
            organization_id: organizationId,
            branch_id: sucursalId,
            user_id: '',
            check_in: new Date().toISOString(),
            check_out: null,
            created_at: new Date().toISOString(),
          })
        } else {
          setFichajeActivo(null)
        }
        onActionComplete()
      } else {
        toast.error("Error al procesar el fichaje", { description: error.message })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={cn(
      "p-4 border-2 transition-all shadow-md rounded-[2rem]",
      fichajeActivo ? "border-emerald-200 bg-emerald-50/30" : "border-blue-200 bg-blue-50/30"
    )}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className={cn(
            "p-4 rounded-2xl shadow-inner transition-colors",
            fichajeActivo ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
          )}>
            <Clock className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Control de Asistencia</p>
              {isOffline && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-full">
                  <WifiOff className="h-3 w-3 text-amber-600" />
                  <span className="text-[9px] font-bold text-amber-700">OFFLINE</span>
                </div>
              )}
              {pendingCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 rounded-full">
                  <span className="text-[9px] font-black text-orange-700">{pendingCount} pendientes</span>
                </div>
              )}
            </div>
            <h3 className="font-black text-sm text-slate-800 uppercase italic">
                {fichajeActivo ? "Jornada Activa" : "Fuera de Servicio"}
            </h3>
            <p className="text-[11px] font-bold flex items-center gap-1 text-slate-500">
                <MapPin className="h-3 w-3" /> {sucursalNombre.toUpperCase()}
            </p>
          </div>
        </div>

        {onScanQR ? (
          <Button 
            onClick={onScanQR} 
            disabled={loading}
            variant={fichajeActivo ? "destructive" : "default"}
            className={cn(
              "w-full sm:w-auto rounded-2xl px-10 font-black text-xs h-14 shadow-lg transition-all active:scale-95",
              !fichajeActivo && "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
            )}
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              fichajeActivo ? (
                  <><QrCode className="mr-2 h-4 w-4"/> ESCANEAR QR SALIDA</>
              ) : (
                  <><QrCode className="mr-2 h-4 w-4"/> ESCANEAR QR ENTRADA</>
              )
            )}
          </Button>
        ) : (
          <Button 
            onClick={handleFichaje} 
            disabled={loading}
            variant={fichajeActivo ? "destructive" : "default"}
            className={cn(
              "w-full sm:w-auto rounded-2xl px-10 font-black text-xs h-14 shadow-lg transition-all active:scale-95",
              !fichajeActivo && "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
            )}
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              fichajeActivo ? (
                  <><LogOut className="mr-2 h-4 w-4"/> FINALIZAR TURNO</>
              ) : (
                  <><LogIn className="mr-2 h-4 w-4"/> REGISTRAR ENTRADA</>
              )
            )}
          </Button>
        )}
      </div>
      
      {fichajeActivo && (
        <div className="mt-4 pt-4 border-t border-emerald-100 flex justify-between items-center">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                Ingreso realizado a las:
            </span>
            <span className="text-xs font-mono font-black text-emerald-800 bg-white px-3 py-1 rounded-lg border-2 border-emerald-100">
                {format(parseISO(fichajeActivo.check_in), 'HH:mm:ss')} HS
            </span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="mt-4 pt-4 border-t border-orange-100 flex justify-between items-center">
            <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">
                {pendingCount} Fichajes Pendientes
            </span>
            <Button
              onClick={syncNow}
              disabled={loading || !isOffline}
              size="sm"
              variant="outline"
              className="h-8 px-3 text-[11px] font-bold border-orange-200 hover:bg-orange-50"
            >
              <Wifi className="h-3 w-3 mr-1" />
              Sincronizar
            </Button>
        </div>
      )}
    </Card>
  )
}