"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MapPin, Store, ArrowRight, Sparkles } from "lucide-react"
import { toast } from "sonner"
import GestionSucursales from "@/components/gestion-sucursales"
import { cn } from "@/lib/utils"
import { getBranchesAction } from "@/lib/actions/branch.actions"

interface Sucursal {
  id: string
  nombre: string
  direccion: string | null
}

interface SeleccionarSucursalProps {
  organizationId: string
  onSelect: (sucursalId: string) => void
  userId: string 
  userRol: "dueño" | "empleado"
}

export default function SeleccionarSucursal({ organizationId, onSelect, userRol }: SeleccionarSucursalProps) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)

  const cargarSucursales = useCallback(async () => {
    try {
      const result = await getBranchesAction()

      if (!result.success) {
        toast.error("Error al cargar sucursales", { description: result.error })
        return
      }

      if (result.branches) {
        setSucursales(result.branches)
      }
    } catch (error) {
      console.error(error)
      toast.error("Error al cargar sucursales")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarSucursales()
  }, [cargarSucursales])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Localizando Sucursales...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
      <Card className={cn(
        "w-full shadow-2xl border-0 rounded-[2.5rem] overflow-hidden transition-all duration-500 bg-white",
        sucursales.length === 0 ? 'max-w-2xl' : 'max-w-lg'
      )}>
        {/* HEADER PREMIUM */}
        <div className="bg-slate-900 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="bg-blue-500 p-3 rounded-2xl shadow-lg shadow-blue-500/20">
              <Store className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Kiosco 24hs</h1>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.4em]">Control de Acceso</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {sucursales.length > 0 ? "¿Dónde operamos hoy?" : "Configuración Inicial"}
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {userRol === 'dueño' ? "Selecciona una sucursal para auditar o crear una nueva." : "Selecciona tu puesto de trabajo actual."}
            </p>
          </div>

          {sucursales.length > 0 ? (
            /* LISTADO TIPO BOTONERA DE ALTA INTENSIDAD */
            <div className="grid gap-4">
              {sucursales.map((sucursal) => (
                <button
                  key={sucursal.id}
                  onClick={() => onSelect(sucursal.id)}
                  className="group relative w-full flex items-center justify-between p-6 rounded-[1.5rem] border-2 border-slate-100 bg-white hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                      <MapPin className="h-6 w-6 text-slate-400 group-hover:text-white" />
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-slate-700 text-lg uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                        {sucursal.nombre}
                      </span>
                      {sucursal.direccion && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {sucursal.direccion}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-6 w-6 text-slate-200 group-hover:text-blue-500 group-hover:translate-x-2 transition-all" />
                </button>
              ))}
            </div>
          ) : (
            /* FLUJO PARA DUEÑO NUEVO */
            <div className="space-y-4">
              {userRol === 'dueño' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl mb-6 flex items-start gap-4">
                    <Sparkles className="h-6 w-6 text-amber-500 shrink-0" />
                    <p className="text-sm font-bold text-amber-800 italic">
                      ¡Bienvenido, líder! Para comenzar la expansión de <span className="font-black">ZEGA</span>, registra tu primer local ahora mismo.
                    </p>
                  </div>
                  <GestionSucursales onUpdate={cargarSucursales} />
                </div>
              ) : (
                <div className="text-center p-10 bg-red-50 border-2 border-red-100 rounded-[2rem] space-y-3">
                  <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                    <Store className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-black text-red-800 uppercase tracking-tight">Sin sucursales activas</p>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Avisa a tu supervisor para que te asigne un local.</p>
                </div>
              )}
            </div>
          )}

          {/* PIE DE PÁGINA */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
             <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors tracking-[0.2em]">
                Actualizar Lista
             </Button>
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Kiosco 24hs v2.0</p>
          </div>
        </div>
      </Card>
    </div>
  )
}