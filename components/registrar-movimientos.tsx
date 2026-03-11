"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowDownCircle, History } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { createCashMovementAction, getShiftMovementsAction, type CashMovement } from "@/lib/actions/cash.actions"

interface RegistrarMovimientoProps {
  cajaId: string
  onMovimientoRegistrado: () => void
}

export default function RegistrarMovimiento({ cajaId, onMovimientoRegistrado }: RegistrarMovimientoProps) {
  const [loading, setLoading] = useState(false)
  const [monto, setMonto] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [categoria, setCategoria] = useState("proveedores")
  const [historial, setHistorial] = useState<CashMovement[]>([])

  const fetchMovimientos = async () => {
    // Solo traer egresos reales (pagos a proveedores, retiros, etc.)
    // Las ventas y servicios NO son gastos del turno
    const result = await getShiftMovementsAction(cajaId, 'egreso')

    if (result.success) {
      setHistorial(result.movements)
    } else {
      console.error("Error cargando movimientos:", result.error)
    }
  }

  useEffect(() => {
    if (cajaId) fetchMovimientos()
  }, [cajaId])

  const handleGuardarGasto = async () => {
    const valorMonto = parseFloat(monto)
    if (isNaN(valorMonto) || valorMonto <= 0) return toast.error("Ingresa un monto válido")
    if (!descripcion.trim()) return toast.error("Agregá una descripción")

    setLoading(true)
    try {
      const result = await createCashMovementAction({
        monto: valorMonto,
        descripcion: descripcion.trim(),
        tipo: 'egreso',
        turnoId: cajaId,
        categoria: categoria
      })

      if (!result.success) {
        toast.error("Error al registrar: " + result.error)
        return
      }

      toast.success("Gasto registrado")
      setMonto("")
      setDescripcion("")
      fetchMovimientos()
      onMovimientoRegistrado()
    } catch (error: any) {
      toast.error("Error al registrar: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="space-y-4">
      <Card className="p-5 border-2 border-amber-100 bg-white shadow-lg rounded-2xl">
        <div className="flex items-center gap-2 mb-4 text-amber-700">
          <ArrowDownCircle className="h-5 w-5" />
          <h2 className="font-black uppercase tracking-tighter text-sm">Registrar Salida de Dinero</h2>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Monto (ARS)</Label>
              <Input
                type="number"
                placeholder="$ 0"
                className="h-12 font-black text-lg"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-12 font-bold text-xs uppercase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proveedores">Proveedores</SelectItem>
                  <SelectItem value="art_limpieza">Art. Limpieza</SelectItem>
                  <SelectItem value="servicios">Servicios / Boletas</SelectItem>
                  <SelectItem value="retiro_dueno">Retiro de Dueño</SelectItem>
                  <SelectItem value="viaticos">Viáticos / Varios</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-slate-500">Descripción del gasto</Label>
            <Input placeholder="Ej: Repartidor de Pan" className="h-12 text-sm" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <Button onClick={handleGuardarGasto} disabled={loading} className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs uppercase">
            {loading ? <Loader2 className="animate-spin" /> : "REGISTRAR GASTO"}
          </Button>
        </div>
      </Card>

      {historial.length > 0 && (
        <Card className="p-4 bg-slate-50 border-dashed border-2 border-slate-200 rounded-2xl shadow-inner">
          <div className="flex items-center gap-2 mb-3 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <History className="h-3 w-3" /> Gastos del Turno
          </div>
          <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-hide">
            {historial.map((m) => (
              <div key={m.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <div>
                  <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1">{m.description}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{m.category} • {format(new Date(m.created_at), 'HH:mm')} HS</p>
                </div>
                <span className="text-red-600 font-black text-sm">-{formatMoney(m.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}