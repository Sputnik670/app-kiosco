'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, Minus, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { addManualXpAction } from '@/lib/actions/xp.actions'
import { getEmployeesForMissionsAction } from '@/lib/actions/missions.actions'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AJUSTE MANUAL DE PUNTOS — Para el dueño
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Modal que permite al dueño dar o quitar puntos a un empleado
 * con mensaje obligatorio. Crea un registro en xp_events + incident.
 *
 * Carga la lista de empleados automáticamente al abrir.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface AjusteManualXpProps {
  branchId?: string
  onComplete?: () => void
}

export default function AjusteManualXp({ branchId, onComplete }: AjusteManualXpProps) {
  const [open, setOpen] = useState(false)
  const [employees, setEmployees] = useState<Array<{ id: string; nombre: string }>>([])
  const [employeeId, setEmployeeId] = useState('')
  const [mode, setMode] = useState<'premio' | 'penalidad'>('premio')
  const [points, setPoints] = useState<number>(10)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // Cargar empleados al abrir el dialog
  useEffect(() => {
    if (open && employees.length === 0) {
      setLoadingEmployees(true)
      getEmployeesForMissionsAction().then(result => {
        if (result.success) {
          setEmployees(result.empleados.map(e => ({ id: e.id, nombre: e.nombre })))
        }
      }).finally(() => setLoadingEmployees(false))
    }
  }, [open, employees.length])

  const handleSubmit = async () => {
    if (!employeeId) {
      toast.error('Seleccioná un empleado')
      return
    }
    if (!message.trim() || message.trim().length < 3) {
      toast.error('El mensaje es obligatorio (mínimo 3 caracteres)')
      return
    }
    if (points <= 0) {
      toast.error('Los puntos deben ser mayor a 0')
      return
    }

    setSubmitting(true)
    try {
      const finalPoints = mode === 'premio' ? points : -points
      const result = await addManualXpAction({
        employeeId,
        branchId: branchId || null,
        points: finalPoints,
        message: message.trim(),
      })

      if (!result.success) {
        toast.error('Error', { description: result.error })
        return
      }

      const empName = employees.find(e => e.id === employeeId)?.nombre || 'Empleado'
      toast.success(
        mode === 'premio'
          ? `+${points} puntos para ${empName}`
          : `-${points} puntos para ${empName}`
      )

      // Reset
      setOpen(false)
      setEmployeeId('')
      setMessage('')
      setPoints(10)
      onComplete?.()
    } catch {
      toast.error('Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700">
          <Zap className="h-3.5 w-3.5" /> Ajustar puntos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-600" /> Ajuste manual de puntos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Empleado */}
          <div className="space-y-2">
            <Label>Empleado</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo: premio o penalidad */}
          <div className="space-y-2">
            <Label>Tipo de ajuste</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'premio' ? 'default' : 'outline'}
                className={`flex-1 text-xs font-bold ${
                  mode === 'premio' ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-emerald-700 border-emerald-200'
                }`}
                onClick={() => setMode('premio')}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Premio
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'penalidad' ? 'default' : 'outline'}
                className={`flex-1 text-xs font-bold ${
                  mode === 'penalidad' ? 'bg-red-600 hover:bg-red-700' : 'text-red-700 border-red-200'
                }`}
                onClick={() => setMode('penalidad')}
              >
                <Minus className="h-3.5 w-3.5 mr-1" /> Penalidad
              </Button>
            </div>
          </div>

          {/* Cantidad de puntos */}
          <div className="space-y-2">
            <Label>Puntos</Label>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${mode === 'premio' ? 'text-emerald-600' : 'text-red-600'}`}>
                {mode === 'premio' ? '+' : '−'}
              </span>
              <Input
                type="number"
                min={1}
                max={500}
                value={points}
                onChange={(e) => setPoints(Math.max(1, Number(e.target.value)))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">puntos</span>
            </div>
          </div>

          {/* Mensaje obligatorio */}
          <div className="space-y-2">
            <Label>
              Motivo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder={
                mode === 'premio'
                  ? 'Ej: Excelente atención al cliente, resolvió un problema sin ayuda...'
                  : 'Ej: Mala actitud con un cliente, no siguió las instrucciones...'
              }
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Este mensaje será visible para el empleado y queda registrado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full ${
              mode === 'premio' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {submitting ? (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            {mode === 'premio' ? `Dar +${points} puntos` : `Descontar ${points} puntos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
