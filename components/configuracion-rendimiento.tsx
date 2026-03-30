'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Clock,
  DollarSign,
  ListChecks,
  Save,
  Loader2,
  RotateCcw,
  Settings,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getXpConfigAction,
  saveXpConfigAction,
  getBranchSchedulesAction,
  saveBranchScheduleAction,
  deleteBranchShiftAction,
  type XpConfig,
  type BranchShift,
} from '@/lib/actions/xp.actions'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REGLAS DE RENDIMIENTO — Configuración del dueño
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Permite al dueño personalizar los valores de premio/penalidad para
 * su organización. Los valores se usan en los triggers automáticos de
 * apertura y cierre de caja.
 *
 * Secciones:
 * - Asistencia: tolerancia, premios/penalidades de puntualidad
 * - Caja: umbrales de diferencia, premio por cierre limpio
 * - Misiones: penalidad por misiones incumplidas
 * - Horarios por sucursal
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Turnos predefinidos que el dueño puede agregar
const SHIFT_PRESETS = [
  { name: 'Mañana', order: 1, defaultTime: '06:00' },
  { name: 'Tarde', order: 2, defaultTime: '14:00' },
  { name: 'Noche', order: 3, defaultTime: '22:00' },
]

interface LocalShift {
  shift_name: string
  shift_order: number
  open_time: string
  tolerance: number
}

export default function ConfiguracionRendimiento({
  branches,
}: {
  branches: Array<{ id: string; name: string }>
}) {
  const [config, setConfig] = useState<XpConfig | null>(null)
  // Map<branchId, LocalShift[]> — múltiples turnos por sucursal
  const [branchShifts, setBranchShifts] = useState<Map<string, LocalShift[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState<string | null>(null)

  // ─── Cargar configuración ──────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const [configResult, schedulesResult] = await Promise.all([
        getXpConfigAction(),
        getBranchSchedulesAction(),
      ])

      if (configResult.success) {
        setConfig(configResult.config)
      }

      if (schedulesResult.success) {
        // Agrupar turnos por branch_id
        const map = new Map<string, LocalShift[]>()
        for (const s of schedulesResult.schedules) {
          const existing = map.get(s.branch_id) || []
          existing.push({
            shift_name: s.shift_name,
            shift_order: s.shift_order,
            open_time: s.open_time?.substring(0, 5) || '08:00',
            tolerance: s.open_tolerance_minutes,
          })
          map.set(s.branch_id, existing)
        }
        setBranchShifts(map)
      }
    } catch {
      toast.error('Error al cargar configuración')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // ─── Guardar configuración de rendimiento ──────────────────────────────────
  const handleSaveConfig = async () => {
    if (!config) return
    setSaving(true)
    try {
      const result = await saveXpConfigAction(config)
      if (result.success) {
        toast.success('Reglas de rendimiento guardadas')
      } else {
        toast.error(result.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  // ─── Guardar TODOS los turnos de una sucursal ─────────────────────────────
  const handleSaveShifts = async (branchId: string) => {
    const shifts = branchShifts.get(branchId)
    if (!shifts || shifts.length === 0) return

    setSavingSchedule(branchId)
    try {
      // Guardar cada turno en paralelo
      const results = await Promise.all(
        shifts.map((shift) =>
          saveBranchScheduleAction({
            branchId,
            shiftName: shift.shift_name,
            shiftOrder: shift.shift_order,
            openTime: shift.open_time,
            toleranceMinutes: shift.tolerance,
          })
        )
      )

      const failed = results.find((r) => !r.success)
      if (failed) {
        toast.error(failed.error || 'Error al guardar turnos')
      } else {
        toast.success(`${shifts.length} turno(s) guardado(s)`)
      }
    } catch {
      toast.error('Error inesperado')
    } finally {
      setSavingSchedule(null)
    }
  }

  // ─── Agregar turno a una sucursal ─────────────────────────────────────────
  const addShift = (branchId: string) => {
    const current = branchShifts.get(branchId) || []
    const existingNames = new Set(current.map((s) => s.shift_name))

    // Buscar el primer preset que no esté usado
    const nextPreset = SHIFT_PRESETS.find((p) => !existingNames.has(p.name))
    if (!nextPreset) {
      toast.info('Ya tenés los 3 turnos configurados para esta sucursal')
      return
    }

    const updated = [
      ...current,
      {
        shift_name: nextPreset.name,
        shift_order: nextPreset.order,
        open_time: nextPreset.defaultTime,
        tolerance: 15,
      },
    ].sort((a, b) => a.shift_order - b.shift_order)

    setBranchShifts(new Map(branchShifts).set(branchId, updated))
  }

  // ─── Eliminar turno ──────────────────────────────────────────────────────
  const removeShift = async (branchId: string, shiftName: string) => {
    const current = branchShifts.get(branchId) || []
    if (current.length <= 1) {
      toast.error('Debe haber al menos un turno por sucursal')
      return
    }

    // Eliminar del servidor
    const result = await deleteBranchShiftAction({ branchId, shiftName })
    if (!result.success) {
      toast.error(result.error || 'Error eliminando turno')
      return
    }

    // Eliminar del estado local
    const updated = current.filter((s) => s.shift_name !== shiftName)
    setBranchShifts(new Map(branchShifts).set(branchId, updated))
    toast.success(`Turno "${shiftName}" eliminado`)
  }

  // ─── Actualizar campo de un turno ─────────────────────────────────────────
  const updateShift = (
    branchId: string,
    shiftName: string,
    field: 'open_time' | 'tolerance',
    value: string | number
  ) => {
    const current = branchShifts.get(branchId) || []
    const updated = current.map((s) =>
      s.shift_name === shiftName ? { ...s, [field]: value } : s
    )
    setBranchShifts(new Map(branchShifts).set(branchId, updated))
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const updateConfig = (key: keyof XpConfig, value: number) => {
    if (!config) return
    setConfig({ ...config, [key]: value })
  }

  const resetDefaults = () => {
    setConfig({
      xp_apertura_puntual: 20,
      xp_tardanza_leve: -25,
      xp_tardanza_grave: -50,
      tardanza_tolerancia_min: 15,
      tardanza_grave_min: 60,
      xp_cierre_limpio: 30,
      xp_diferencia_grave: -40,
      umbral_diferencia_leve: 200,
      umbral_diferencia_grave: 1000,
      xp_mision_incumplida: -10,
    })
    toast.info('Valores restablecidos a los predeterminados. Guardá para aplicar.')
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Reglas de rendimiento
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurá los premios y penalidades que se aplican automáticamente a tus empleados.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetDefaults}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Restablecer
        </Button>
      </div>

      {/* ASISTENCIA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            Asistencia y puntualidad
          </CardTitle>
          <CardDescription>
            Se evalúa cada vez que un empleado abre la caja del turno.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="xp_apertura_puntual" className="text-sm">
                Premio por apertura puntual
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-emerald-600 text-sm font-medium">+</span>
                <Input
                  id="xp_apertura_puntual"
                  type="number"
                  min={0}
                  value={config.xp_apertura_puntual}
                  onChange={(e) => updateConfig('xp_apertura_puntual', Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">puntos</span>
              </div>
            </div>

            <div>
              <Label htmlFor="tardanza_tolerancia_min" className="text-sm">
                Tolerancia (minutos de gracia)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="tardanza_tolerancia_min"
                  type="number"
                  min={0}
                  max={120}
                  value={config.tardanza_tolerancia_min}
                  onChange={(e) => updateConfig('tardanza_tolerancia_min', Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>
            </div>

            <div>
              <Label htmlFor="xp_tardanza_leve" className="text-sm">
                Penalidad por tardanza leve
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-red-600 text-sm font-medium">−</span>
                <Input
                  id="xp_tardanza_leve"
                  type="number"
                  min={0}
                  value={Math.abs(config.xp_tardanza_leve)}
                  onChange={(e) => updateConfig('xp_tardanza_leve', -Math.abs(Number(e.target.value)))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">puntos</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Entre {config.tardanza_tolerancia_min} y {config.tardanza_grave_min} min de tardanza
              </p>
            </div>

            <div>
              <Label htmlFor="xp_tardanza_grave" className="text-sm">
                Penalidad por tardanza grave
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-red-600 text-sm font-medium">−</span>
                <Input
                  id="xp_tardanza_grave"
                  type="number"
                  min={0}
                  value={Math.abs(config.xp_tardanza_grave)}
                  onChange={(e) => updateConfig('xp_tardanza_grave', -Math.abs(Number(e.target.value)))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">puntos</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Más de {config.tardanza_grave_min} min de tardanza
              </p>
            </div>

            <div>
              <Label htmlFor="tardanza_grave_min" className="text-sm">
                Minutos para tardanza grave
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="tardanza_grave_min"
                  type="number"
                  min={15}
                  max={180}
                  value={config.tardanza_grave_min}
                  onChange={(e) => updateConfig('tardanza_grave_min', Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CAJA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Diferencias de caja
          </CardTitle>
          <CardDescription>
            Se evalúa cada vez que un empleado cierra la caja del turno.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="xp_cierre_limpio" className="text-sm">
                Premio por cierre limpio
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-emerald-600 text-sm font-medium">+</span>
                <Input
                  id="xp_cierre_limpio"
                  type="number"
                  min={0}
                  value={config.xp_cierre_limpio}
                  onChange={(e) => updateConfig('xp_cierre_limpio', Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">puntos</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Diferencia menor a ${config.umbral_diferencia_leve}
              </p>
            </div>

            <div>
              <Label htmlFor="xp_diferencia_grave" className="text-sm">
                Penalidad por diferencia grave
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-red-600 text-sm font-medium">−</span>
                <Input
                  id="xp_diferencia_grave"
                  type="number"
                  min={0}
                  value={Math.abs(config.xp_diferencia_grave)}
                  onChange={(e) => updateConfig('xp_diferencia_grave', -Math.abs(Number(e.target.value)))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">puntos</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Diferencia mayor a ${config.umbral_diferencia_grave}
              </p>
            </div>

            <div>
              <Label htmlFor="umbral_diferencia_leve" className="text-sm">
                Umbral diferencia leve
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id="umbral_diferencia_leve"
                  type="number"
                  min={0}
                  value={config.umbral_diferencia_leve}
                  onChange={(e) => updateConfig('umbral_diferencia_leve', Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Debajo de este monto se considera cierre limpio
              </p>
            </div>

            <div>
              <Label htmlFor="umbral_diferencia_grave" className="text-sm">
                Umbral diferencia grave
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id="umbral_diferencia_grave"
                  type="number"
                  min={0}
                  value={config.umbral_diferencia_grave}
                  onChange={(e) => updateConfig('umbral_diferencia_grave', Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Arriba de este monto se aplica penalidad + incidente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MISIONES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-600" />
            Misiones incumplidas
          </CardTitle>
          <CardDescription>
            Se evalúa al cerrar caja: cada misión del turno no completada aplica esta penalidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="xp_mision_incumplida" className="text-sm">
              Penalidad por misión incumplida
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-red-600 text-sm font-medium">−</span>
              <Input
                id="xp_mision_incumplida"
                type="number"
                min={0}
                value={Math.abs(config.xp_mision_incumplida)}
                onChange={(e) => updateConfig('xp_mision_incumplida', -Math.abs(Number(e.target.value)))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">puntos por misión</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BOTÓN GUARDAR REGLAS */}
      <Button onClick={handleSaveConfig} disabled={saving} className="w-full sm:w-auto">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Guardar reglas de rendimiento
      </Button>

      <Separator />

      {/* HORARIOS POR SUCURSAL — MULTI-TURNO */}
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4" />
          Turnos por sucursal
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configurá los turnos de cada sucursal (Mañana, Tarde, Noche). El sistema evalúa puntualidad contra el turno más cercano a la hora de apertura de caja.
        </p>

        <div className="space-y-4">
          {branches.map((branch) => {
            const shifts = branchShifts.get(branch.id) || []
            const isSaving = savingSchedule === branch.id
            const canAddMore = shifts.length < 3

            return (
              <Card key={branch.id}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">{branch.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {canAddMore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addShift(branch.id)}
                          className="h-7 text-[10px] font-bold gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Agregar turno
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveShifts(branch.id)}
                        disabled={isSaving || shifts.length === 0}
                        className="h-7 text-[10px] font-bold gap-1"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Guardar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  {shifts.length === 0 && (
                    <div className="text-center py-3">
                      <p className="text-xs text-muted-foreground mb-2">
                        Sin turnos configurados. La puntualidad no se evalúa.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addShift(branch.id)}
                        className="text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Configurar primer turno
                      </Button>
                    </div>
                  )}

                  {shifts.map((shift) => (
                    <div
                      key={shift.shift_name}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 px-3 rounded-lg bg-slate-50 border"
                    >
                      <span className="text-xs font-bold text-slate-700 min-w-[60px]">
                        {shift.shift_name}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
                          Hora:
                        </Label>
                        <Input
                          type="time"
                          value={shift.open_time}
                          onChange={(e) =>
                            updateShift(branch.id, shift.shift_name, 'open_time', e.target.value)
                          }
                          className="w-28 h-8 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
                          Tolerancia:
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={120}
                          value={shift.tolerance}
                          onChange={(e) =>
                            updateShift(branch.id, shift.shift_name, 'tolerance', Number(e.target.value))
                          }
                          className="w-16 h-8 text-sm"
                        />
                        <span className="text-[10px] text-muted-foreground">min</span>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeShift(branch.id, shift.shift_name)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 ml-auto"
                        disabled={shifts.length <= 1}
                        title="Eliminar turno"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {branches.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay sucursales configuradas.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
