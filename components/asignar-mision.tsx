// components/asignar-mision.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, PlusCircle, Gamepad2, Target, Repeat } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createMisionAction, getEmpleadosAction } from "@/lib/actions/missions.actions"

interface AsignarMisionProps {
  turnoId?: string          
  empleadoNombre?: string   
  empleadoId?: string       
  sucursalId?: string       // ✅ Agregado: Sucursal de contexto
  onMisionCreated?: () => void
}

export default function AsignarMision({ turnoId, empleadoNombre, empleadoId, sucursalId, onMisionCreated }: AsignarMisionProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [descripcion, setDescripcion] = useState("")
  const [xp, setXp] = useState("50")
  const [esRecurrente, setEsRecurrente] = useState(false)
  
  const [selectedEmpId, setSelectedEmpId] = useState<string>(empleadoId || "")
  const [empleados, setEmpleados] = useState<{id: string, nombre: string}[]>([])

  useEffect(() => {
    if (open && !empleadoId) {
      const fetchEmpleados = async () => {
        const result = await getEmpleadosAction()
        if (result.success) {
          setEmpleados(result.empleados)
        } else {
          toast.error("Error al cargar empleados")
        }
      }
      fetchEmpleados()
    }
  }, [open, empleadoId])

  useEffect(() => {
    if (empleadoId) setSelectedEmpId(empleadoId)
  }, [empleadoId])

  const handleAsignar = async () => {
    if (!descripcion || !xp || (!esRecurrente && !selectedEmpId)) {
      toast.error("Faltan datos", { description: "Revisa la descripción y el destinatario." })
      return
    }

    setLoading(true)
    try {
      const result = await createMisionAction({
        descripcion,
        puntos: parseInt(xp),
        esRecurrente,
        sucursalId,
        turnoId,
        empleadoId: selectedEmpId,
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al crear misión')
      }

      // Mostrar mensaje según el tipo
      if (result.tipo === 'rutina') {
        toast.success("Rutina Creada 🔄", {
          description: "Se activará en los próximos turnos de este local."
        })
      } else {
        toast.success("Misión Asignada 🚀")
      }

      setOpen(false)
      setDescripcion("")
      setXp("50")
      setEsRecurrente(false)
      if (onMisionCreated) onMisionCreated()
    } catch (error: any) {
      console.error(error)
      toast.error("Error", { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {empleadoId ? (
            <Button size="sm" variant="outline" className="gap-2 border-dashed border-primary/50 hover:border-primary">
                <PlusCircle className="h-4 w-4" /> Asignar Tarea
            </Button>
        ) : (
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                <Target className="h-4 w-4" /> Nueva Misión
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Gamepad2 className="h-5 w-5" /> 
            {esRecurrente ? "Nueva Rutina Diaria" : (empleadoNombre ? `Misión para ${empleadoNombre}` : "Nueva Misión")}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-full", esRecurrente ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500")}>
                        <Repeat className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-700">Repetir en esta sucursal</span>
                        <span className="text-[10px] text-gray-500">Aparece siempre al abrir caja</span>
                    </div>
                </div>
                <input 
                    type="checkbox" 
                    className="h-5 w-5 accent-indigo-600 cursor-pointer" 
                    checked={esRecurrente} 
                    onChange={(e) => setEsRecurrente(e.target.checked)} 
                    aria-label="Hacer rutina recurrente"
                />
            </div>

            {!empleadoId && !esRecurrente && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label>¿Quién debe cumplirla?</Label>
                    <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar empleado..." />
                        </SelectTrigger>
                        <SelectContent>
                            {empleados.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.nombre || "Sin nombre"}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
                <Label>Descripción de la Tarea</Label>
                <Input 
                    placeholder={esRecurrente ? "Ej: Limpiar cafeteras..." : "Ej: Reponer heladera 1..."}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label>Recompensa (XP)</Label>
                <div className="flex gap-2">
                    {[30, 50, 100].map(val => (
                        <Button key={val} type="button" variant={parseInt(xp) === val ? "default" : "outline"} size="sm" onClick={() => setXp(val.toString())} className="flex-1">{val} XP</Button>
                    ))}
                </div>
            </div>
        </div>

        <DialogFooter>
            <Button onClick={handleAsignar} disabled={loading} className={cn("w-full", esRecurrente ? "bg-indigo-600 hover:bg-indigo-800" : "bg-primary")}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : (esRecurrente ? "Guardar Rutina para este Local" : "Enviar Misión")}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}