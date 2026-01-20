"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, Store, Trash2, MapPin, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  getBranchesAction,
  createBranchAction,
  deleteBranchAction,
  type BranchFull
} from "@/lib/actions/branch.actions"

// ⚠️ AUDITORÍA: Hacemos 'onUpdate' opcional para que no rompa si el padre no lo pasa.
interface GestionSucursalesProps {
    onUpdate?: () => void 
}

export default function GestionSucursales({ onUpdate }: GestionSucursalesProps) {
  const [sucursales, setSucursales] = useState<BranchFull[]>([])
  const [loading, setLoading] = useState(true)

  const [newNombre, setNewNombre] = useState("")
  const [newDireccion, setNewDireccion] = useState("")
  const [creating, setCreating] = useState(false)

  // ───────────────────────────────────────────────────────────────────────────
  // CARGAR SUCURSALES (Single useEffect - Sin lógica de orgId en cliente)
  // ───────────────────────────────────────────────────────────────────────────

  const fetchSucursales = useCallback(async () => {
    setLoading(true)

    const result = await getBranchesAction()

    if (result.success) {
      setSucursales(result.branches)
    } else {
      toast.error("Error al cargar sucursales", { description: result.error })
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSucursales()
  }, [fetchSucursales])

  // ───────────────────────────────────────────────────────────────────────────
  // CREAR SUCURSAL (Server Action)
  // ───────────────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newNombre.trim()) return toast.error("El nombre es obligatorio")

    setCreating(true)

    const result = await createBranchAction({
      nombre: newNombre,
      direccion: newDireccion,
    })

    if (result.success) {
      toast.success("Sucursal creada exitosamente")
      setNewNombre("")
      setNewDireccion("")
      fetchSucursales()
      if (onUpdate) onUpdate()
    } else {
      toast.error("Error al crear", { description: result.error })
    }

    setCreating(false)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ELIMINAR SUCURSAL (Server Action + Advertencia de Cascada)
  // ───────────────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    // ⚠️ ADVERTENCIA CRÍTICA: Esta operación borra en cascada
    if (!confirm("🛑 ¡CUIDADO! 🛑\n\nAl borrar esta sucursal SE BORRARÁN AUTOMÁTICAMENTE:\n- Todas las ventas\n- Todo el stock\n- Todas las cajas diarias\n\n¿Estás 100% seguro?")) {
      return
    }

    const result = await deleteBranchAction(id)

    if (result.success) {
      toast.success("Sucursal y sus datos eliminados")
      fetchSucursales()
      if (onUpdate) onUpdate()
    } else {
      toast.error("No se pudo eliminar", { description: result.error })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
        {/* FORMULARIO DE CREACIÓN */}
        <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Nueva Sucursal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                    <Label>Nombre del Local</Label>
                    <Input 
                        placeholder="Ej: Kiosco Centro" 
                        value={newNombre} 
                        onChange={(e) => setNewNombre(e.target.value)} 
                        className="bg-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input 
                        placeholder="Ej: Av. Principal 123" 
                        value={newDireccion} 
                        onChange={(e) => setNewDireccion(e.target.value)} 
                        className="bg-white"
                    />
                </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full md:w-auto">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
                Inaugurar Local
            </Button>
        </div>

        {/* LISTADO */}
        <div className="border rounded-md overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-slate-100">
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/50" /></TableCell></TableRow>
                    ) : sucursales.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            <MapPin className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            Aún no tienes sucursales. ¡Crea la primera arriba!
                        </TableCell></TableRow>
                    ) : (
                        sucursales.map((suc) => (
                            <TableRow key={suc.id}>
                                <TableCell className="font-medium flex items-center gap-2">
                                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                        <Store className="h-4 w-4" />
                                    </div>
                                    {suc.nombre}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{suc.direccion || "—"}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => handleDelete(suc.id)} title="Eliminar permanentemente">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
        
        {/* AVISO INFORMATIVO */}
        {sucursales.length > 0 && (
             <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-blue-50 p-2 rounded border border-blue-100">
                <AlertTriangle className="h-3 w-3 mt-0.5 text-blue-500" />
                <p>Las sucursales creadas aquí aparecerán como opciones para tus empleados al momento de fichar la entrada.</p>
             </div>
        )}
    </div>
  )
}