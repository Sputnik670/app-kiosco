"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Clock, LogIn, LogOut, MapPin, Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { getAttendanceStatusAction, toggleAttendanceAction, type AttendanceRecord } from "@/lib/actions/attendance.actions"

interface RelojControlProps {
  sucursalId: string
  sucursalNombre: string
  onActionComplete: () => void // ✅ Prop agregada para sincronizar con el padre
  onScanQR?: () => void // ✅ Opción para escanear QR en lugar de botón manual
}

export default function RelojControl({ sucursalId, sucursalNombre, onActionComplete, onScanQR }: RelojControlProps) {
  const [loading, setLoading] = useState(false)
  const [fichajeActivo, setFichajeActivo] = useState<AttendanceRecord | null>(null)

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

      if (!result.success) {
        toast.error("Error al procesar el fichaje", { description: result.error })
        return
      }

      if (result.action === 'entrada') {
        setFichajeActivo(result.record || null)
        toast.success("Entrada registrada", { description: `Local: ${sucursalNombre}` })
        onActionComplete()
      } else if (result.action === 'salida') {
        setFichajeActivo(null)
        toast.info("Salida registrada", { description: "Jornada finalizada correctamente." })
        onActionComplete()
      }
    } catch (error: any) {
      console.error("Error fichaje:", error)
      toast.error("Error al procesar el fichaje", { description: error.message })
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
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Control de Asistencia</p>
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
    </Card>
  )
}