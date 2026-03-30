"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  AlertTriangle, Loader2, MessageSquare, Clock, Send, CheckCircle2,
  MinusCircle, HourglassIcon
} from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  getMyIncidentsAction,
  justifyIncidentAction,
  type Incident,
} from "@/lib/actions/incidents.actions"

const SEVERIDADES: Record<string, { label: string; color: string }> = {
  low: { label: 'Leve', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  medium: { label: 'Medio', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  high: { label: 'Grave', color: 'bg-red-100 text-red-700 border-red-200' },
}

const JUSTIFICATION_OPTIONS = [
  { value: 'desconocimiento', label: 'No sabía cómo hacerlo' },
  { value: 'olvido', label: 'Se me olvidó' },
  { value: 'externo', label: 'Causa externa' },
  { value: 'otro', label: 'Otro motivo' },
] as const

const TIPO_LABELS: Record<string, string> = {
  error: 'Error operativo',
  cash_difference: 'Diferencia de caja',
  stock_loss: 'Pérdida de stock',
  attendance: 'Asistencia',
  other: 'Otro',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Descargo pendiente', color: 'bg-red-100 text-red-700 border-red-200' },
  justified: { label: 'Descargo enviado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  awaiting_resolution: { label: 'En revisión por el dueño', color: 'bg-amber-100 text-amber-700 border-amber-200' },
}

export default function MisIncidentes() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [justifyingId, setJustifyingId] = useState<string | null>(null)
  const [justifyText, setJustifyText] = useState("")
  const [justifyType, setJustifyType] = useState<string>("otro")
  const [submitting, setSubmitting] = useState(false)

  const fetchIncidents = useCallback(async () => {
    try {
      const result = await getMyIncidentsAction()
      if (result.success) {
        setIncidents(result.incidents)
      }
    } catch (err) {
      console.error('[MisIncidentes] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  const handleJustify = async (incidentId: string) => {
    if (!justifyText.trim() || justifyText.trim().length < 5) {
      toast.error("El descargo es obligatorio (mínimo 5 caracteres)")
      return
    }
    setSubmitting(true)
    try {
      const result = await justifyIncidentAction(
        incidentId,
        justifyText,
        justifyType as any
      )
      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }
      toast.success("Descargo enviado correctamente")
      setJustifyingId(null)
      setJustifyText("")
      setJustifyType("otro")
      fetchIncidents()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return null
  }

  if (incidents.length === 0) {
    return null
  }

  // Separar por status
  const needsAction = incidents.filter(i => i.status === 'open')
  const awaitingReview = incidents.filter(i => i.status === 'awaiting_resolution' || i.status === 'justified')

  return (
    <Card className="p-5 border-2 border-red-200 bg-red-50/30">
      <h3 className="text-sm font-black text-red-700 uppercase flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4" /> Incidentes Pendientes ({incidents.length})
      </h3>

      <div className="space-y-3">
        {/* INCIDENTES QUE NECESITAN DESCARGO */}
        {needsAction.map(inc => (
          <div key={inc.id} className="bg-white border-2 border-red-200 rounded-xl p-4 space-y-3">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge className={`text-[8px] font-black ${SEVERIDADES[inc.severity]?.color || 'bg-slate-100 text-slate-600'}`}>
                  {SEVERIDADES[inc.severity]?.label || inc.severity}
                </Badge>
                <Badge className="text-[8px] font-black bg-slate-100 text-slate-600">
                  {TIPO_LABELS[inc.type] || inc.type}
                </Badge>
                {inc.xp_deducted > 0 && (
                  <Badge className="text-[8px] font-black bg-red-100 text-red-700 border-red-200 flex items-center gap-0.5">
                    <MinusCircle className="h-2.5 w-2.5" />
                    -{inc.xp_deducted} puntos
                  </Badge>
                )}
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(parseISO(inc.created_at), "dd MMM HH:mm", { locale: es })}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-800">{inc.description}</p>
            </div>

            {/* Instrucciones del dueño */}
            {inc.resolution && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Instrucciones del dueño</p>
                <p className="text-xs text-blue-800">{inc.resolution}</p>
              </div>
            )}

            {/* Banner de acción requerida */}
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <p className="text-[10px] font-black text-red-600 uppercase mb-1">
                Descargo obligatorio
              </p>
              <p className="text-xs text-red-700">
                Tenés que enviar tu descargo para que el dueño pueda evaluar este incidente.
              </p>
            </div>

            {/* Formulario de descargo */}
            {justifyingId === inc.id ? (
              <div className="space-y-3 bg-amber-50 rounded-lg p-3 border border-amber-200">
                <Label className="text-[10px] font-black text-amber-700 uppercase">
                  Tu descargo
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {JUSTIFICATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setJustifyType(opt.value)}
                      className={`text-[9px] font-bold px-2.5 py-1.5 rounded-full border transition-all ${
                        justifyType === opt.value
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Explicá qué pasó con el mayor detalle posible..."
                  value={justifyText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJustifyText(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
                <p className="text-[9px] text-amber-600">
                  Mínimo 5 caracteres. Una vez enviado, el dueño revisará tu descargo.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleJustify(inc.id)}
                    disabled={submitting}
                    className="flex-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700"
                  >
                    {submitting ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Enviar descargo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setJustifyingId(null); setJustifyText("") }}
                    className="text-[10px] font-bold text-slate-500"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[10px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                onClick={() => setJustifyingId(inc.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Escribir descargo
              </Button>
            )}
          </div>
        ))}

        {/* INCIDENTES EN REVISIÓN (ya envió descargo) */}
        {awaitingReview.map(inc => (
          <div key={inc.id} className="bg-white border-2 border-amber-200 rounded-xl p-4 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge className={`text-[8px] font-black ${SEVERIDADES[inc.severity]?.color || 'bg-slate-100 text-slate-600'}`}>
                  {SEVERIDADES[inc.severity]?.label || inc.severity}
                </Badge>
                <Badge className="text-[8px] font-black bg-slate-100 text-slate-600">
                  {TIPO_LABELS[inc.type] || inc.type}
                </Badge>
                {inc.xp_deducted > 0 && (
                  <Badge className="text-[8px] font-black bg-red-100 text-red-700 border-red-200 flex items-center gap-0.5">
                    <MinusCircle className="h-2.5 w-2.5" />
                    -{inc.xp_deducted} puntos
                  </Badge>
                )}
                <Badge className="text-[8px] font-black bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-0.5">
                  <HourglassIcon className="h-2.5 w-2.5" />
                  En revisión
                </Badge>
              </div>
              <p className="text-sm font-bold text-slate-800">{inc.description}</p>
            </div>

            {/* Descargo enviado */}
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <p className="text-[10px] font-black text-emerald-600 uppercase mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Tu descargo
              </p>
              <p className="text-xs text-emerald-800">
                {inc.employee_message || inc.justification}
              </p>
            </div>

            <p className="text-[10px] text-amber-600 flex items-center gap-1">
              <HourglassIcon className="h-3 w-3" />
              Esperando la decisión del dueño
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
