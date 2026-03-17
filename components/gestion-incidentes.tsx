"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertTriangle, PlusCircle, Loader2, CheckCircle2,
  XCircle, MessageSquare, Clock, ChevronDown, ChevronUp
} from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  createIncidentAction,
  getIncidentsAction,
  resolveIncidentAction,
  type Incident,
  type CreateIncidentParams,
} from "@/lib/actions/incidents.actions"
import { getEmployeesForMissionsAction } from "@/lib/actions/missions.actions"

interface GestionIncidentesProps {
  sucursalId: string
  organizationId: string
}

const TIPOS_INCIDENTE = [
  { value: 'error', label: 'Error operativo' },
  { value: 'cash_difference', label: 'Diferencia de caja' },
  { value: 'stock_loss', label: 'Pérdida de stock' },
  { value: 'attendance', label: 'Asistencia' },
  { value: 'other', label: 'Otro' },
]

const SEVERIDADES = [
  { value: 'low', label: 'Leve', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'medium', label: 'Medio', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'high', label: 'Grave', color: 'bg-red-100 text-red-700 border-red-200' },
]

const JUSTIFICATION_LABELS: Record<string, string> = {
  desconocimiento: 'No sabía cómo hacerlo',
  olvido: 'Se me olvidó',
  externo: 'Causa externa',
  otro: 'Otro motivo',
}

export default function GestionIncidentes({ sucursalId, organizationId }: GestionIncidentesProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [empleados, setEmpleados] = useState<{ id: string; nombre: string }[]>([])

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState("")
  const [formType, setFormType] = useState<string>("error")
  const [formDescription, setFormDescription] = useState("")
  const [formSeverity, setFormSeverity] = useState<string>("low")
  const [formResolution, setFormResolution] = useState("")
  const [creating, setCreating] = useState(false)

  // Resolve state
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState("")

  const fetchIncidents = useCallback(async () => {
    try {
      const result = await getIncidentsAction({ branchId: sucursalId })
      if (result.success) {
        setIncidents(result.incidents)
      }
    } catch (err) {
      console.error('[Incidentes] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [sucursalId])

  const fetchEmpleados = useCallback(async () => {
    const result = await getEmployeesForMissionsAction()
    if (result.success) {
      setEmpleados(result.empleados.map(e => ({ id: e.id, nombre: e.nombre })))
    }
  }, [])

  useEffect(() => {
    fetchIncidents()
    fetchEmpleados()
  }, [fetchIncidents, fetchEmpleados])

  const handleCreate = async () => {
    if (!formEmployeeId || !formDescription) {
      toast.error("Completá empleado y descripción")
      return
    }
    setCreating(true)
    try {
      const params: CreateIncidentParams = {
        employeeId: formEmployeeId,
        branchId: sucursalId,
        type: formType as any,
        description: formDescription,
        severity: formSeverity as any,
        resolution: formResolution || undefined,
      }
      const result = await createIncidentAction(params)
      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }
      toast.success("Incidente registrado")
      setShowCreateDialog(false)
      setFormDescription("")
      setFormResolution("")
      setFormEmployeeId("")
      fetchIncidents()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setCreating(false)
    }
  }

  const handleResolve = async (id: string, status: 'resolved' | 'dismissed') => {
    setResolvingId(id)
    try {
      const result = await resolveIncidentAction(id, status, resolveNote || undefined)
      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }
      toast.success(status === 'resolved' ? "Incidente resuelto" : "Incidente descartado")
      setResolveNote("")
      fetchIncidents()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setResolvingId(null)
    }
  }

  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'justified')
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved' || i.status === 'dismissed')

  const severityBadge = (severity: string) => {
    const s = SEVERIDADES.find(sv => sv.value === severity)
    return s ? s.color : 'bg-slate-100 text-slate-600'
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-700 border-red-200'
      case 'justified': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'dismissed': return 'bg-slate-100 text-slate-500 border-slate-200'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Pendiente'
      case 'justified': return 'Justificado'
      case 'resolved': return 'Resuelto'
      case 'dismissed': return 'Descartado'
      default: return status
    }
  }

  return (
    <Card className="p-5 border-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" /> Registro de Incidentes
        </h3>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-[10px] font-black uppercase">
              <PlusCircle className="h-3.5 w-3.5" /> Reportar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" /> Reportar Incidente
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Empleado</Label>
                <Select value={formEmployeeId} onValueChange={setFormEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {empleados.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_INCIDENTE.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gravedad</Label>
                  <Select value={formSeverity} onValueChange={setFormSeverity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVERIDADES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Qué pasó</Label>
                <Textarea
                  placeholder="Describí el error o incidente..."
                  value={formDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Cómo solucionarlo <span className="text-slate-400">(opcional)</span></Label>
                <Textarea
                  placeholder="Instrucciones para el empleado..."
                  value={formResolution}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormResolution(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating} className="w-full bg-red-600 hover:bg-red-700">
                {creating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Registrar Incidente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : openIncidents.length === 0 ? (
        <div className="text-center py-6 bg-emerald-50 rounded-xl border-2 border-dashed border-emerald-200">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-700">Sin incidentes pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {openIncidents.map(inc => (
            <div key={inc.id} className="border-2 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">{inc.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className={`text-[8px] font-black ${severityBadge(inc.severity)}`}>
                      {SEVERIDADES.find(s => s.value === inc.severity)?.label || inc.severity}
                    </Badge>
                    <Badge className={`text-[8px] font-black ${statusBadge(inc.status)}`}>
                      {statusLabel(inc.status)}
                    </Badge>
                    <span className="text-[10px] text-slate-400">
                      {inc.employee_name || 'Empleado'} · {format(parseISO(inc.created_at), "dd MMM HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instrucciones del dueño */}
              {inc.resolution && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Instrucciones</p>
                  <p className="text-xs text-blue-800">{inc.resolution}</p>
                </div>
              )}

              {/* Justificación del empleado */}
              {inc.justification && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-[10px] font-black text-amber-600 uppercase mb-1">
                    Justificación: {JUSTIFICATION_LABELS[inc.justification_type || ''] || inc.justification_type}
                  </p>
                  <p className="text-xs text-amber-800">{inc.justification}</p>
                </div>
              )}

              {/* Acciones del dueño */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-[10px] font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  disabled={resolvingId === inc.id}
                  onClick={() => handleResolve(inc.id, 'resolved')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-[10px] font-bold text-slate-500 border-slate-200 hover:bg-slate-50"
                  disabled={resolvingId === inc.id}
                  onClick={() => handleResolve(inc.id, 'dismissed')}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Descartar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resueltos (colapsable) */}
      {resolvedIncidents.length > 0 && (
        <div className="mt-4">
          <button
            className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase hover:text-slate-600"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {resolvedIncidents.length} resueltos / descartados
          </button>
          {showResolved && (
            <div className="mt-2 space-y-2">
              {resolvedIncidents.map(inc => (
                <div key={inc.id} className="border rounded-lg p-3 opacity-60">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-600">{inc.description}</p>
                    <Badge className={`text-[8px] ${statusBadge(inc.status)}`}>
                      {statusLabel(inc.status)}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {inc.employee_name || 'Empleado'} · {format(parseISO(inc.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
