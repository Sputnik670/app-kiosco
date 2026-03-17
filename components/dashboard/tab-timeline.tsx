"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Loader2, ChevronLeft, ChevronRight,
  Plus, Save, X, Pin, PinOff, Pencil, Trash2
} from "lucide-react"
import { toast } from "sonner"
import { format, parseISO, addDays, subDays } from "date-fns"
import { es } from "date-fns/locale"
import {
  getTimelineAction,
  getActiveDatesAction,
  type TimelineEvent,
  type TimelineEventType,
  type GetTimelineResult,
} from "@/lib/actions/timeline.actions"
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
  toggleNotePinAction,
  type OwnerNote,
} from "@/lib/actions/notes.actions"

// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────

const EVENT_FILTERS: { type: TimelineEventType; label: string; color: string }[] = [
  { type: 'venta', label: 'Ventas', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { type: 'servicio', label: 'Servicios', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { type: 'compra', label: 'Compras', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { type: 'compra_servicio', label: 'Crédito', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { type: 'movimiento_caja', label: 'Caja', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { type: 'cambio_precio', label: 'Precios', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { type: 'incidente', label: 'Incidentes', color: 'bg-red-100 text-red-700 border-red-200' },
  { type: 'nota', label: 'Notas', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
]

const NOTE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'precios', label: 'Precios' },
  { value: 'proveedores', label: 'Proveedores' },
  { value: 'empleados', label: 'Empleados' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'idea', label: 'Idea' },
]

// ───────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────

export function TabTimeline({ formatMoney }: { formatMoney: (n: number) => string }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [activeDates, setActiveDates] = useState<string[]>([])

  // Timeline data
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [summary, setSummary] = useState<GetTimelineResult['summary']>({
    totalVentas: 0, totalServicios: 0, totalCompras: 0, totalMovimientos: 0,
  })

  // Filtros activos (null = todos)
  const [activeFilters, setActiveFilters] = useState<Set<TimelineEventType> | null>(null)

  // Nota form
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [noteCategory, setNoteCategory] = useState("general")
  const [submitting, setSubmitting] = useState(false)

  // ─── Fetch timeline ─────────────────────────────────────────────────

  const fetchTimeline = useCallback(async (retries = 2) => {
    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const filters = activeFilters ? [...activeFilters] : undefined
      const result = await getTimelineAction(dateStr, undefined, filters)
      if (result.success) {
        setEvents(result.events)
        setSummary(result.summary)
      } else {
        console.error('[Timeline] Error:', result.error)
      }
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1500))
        return fetchTimeline(retries - 1)
      }
      console.error('[Timeline] Error tras reintentos:', err)
      toast.error("Error cargando historial")
    } finally {
      setLoading(false)
    }
  }, [selectedDate, activeFilters])

  const fetchActiveDates = useCallback(async (date: Date) => {
    try {
      const result = await getActiveDatesAction(date.getMonth() + 1, date.getFullYear())
      if (result.success) {
        setActiveDates(result.dates)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  useEffect(() => {
    fetchActiveDates(selectedDate)
  }, [selectedDate, fetchActiveDates])

  // ─── Navigation ─────────────────────────────────────────────────────

  const goToPrevDay = () => setSelectedDate(prev => subDays(prev, 1))
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1))
  const goToToday = () => setSelectedDate(new Date())

  // ─── Filtros ────────────────────────────────────────────────────────

  const toggleFilter = (type: TimelineEventType) => {
    setActiveFilters(prev => {
      if (!prev) {
        // Activar solo este filtro
        return new Set([type])
      }
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
        return next.size === 0 ? null : next
      }
      next.add(type)
      return next.size === EVENT_FILTERS.length ? null : next
    })
  }

  const clearFilters = () => setActiveFilters(null)

  // ─── Notas ──────────────────────────────────────────────────────────

  const resetNoteForm = () => {
    setShowNoteForm(false)
    setEditingNoteId(null)
    setNoteTitle("")
    setNoteContent("")
    setNoteCategory("general")
  }

  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      toast.error("Escribí algo en la nota")
      return
    }
    setSubmitting(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      let result
      if (editingNoteId) {
        result = await updateNoteAction({
          id: editingNoteId,
          title: noteTitle,
          content: noteContent,
          category: noteCategory,
        })
      } else {
        result = await createNoteAction({
          noteDate: dateStr,
          title: noteTitle,
          content: noteContent,
          category: noteCategory,
        })
      }
      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }
      toast.success(editingNoteId ? "Nota actualizada" : "Nota guardada")
      resetNoteForm()
      fetchTimeline()
    } catch (err: unknown) {
      toast.error("Error", { description: err instanceof Error ? err.message : 'Error desconocido' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const result = await deleteNoteAction(noteId)
      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }
      toast.success("Nota eliminada")
      fetchTimeline()
    } catch { /* silent */ }
  }

  const handleTogglePin = async (noteId: string, currentPinned: boolean) => {
    try {
      await toggleNotePinAction(noteId, !currentPinned)
      fetchTimeline()
    } catch { /* silent */ }
  }

  const startEditNote = (event: TimelineEvent) => {
    setEditingNoteId(event.id)
    setNoteTitle(event.title === 'Nota' ? '' : event.title)
    setNoteContent((event.metadata?.fullContent as string) || event.description || '')
    setNoteCategory((event.metadata?.category as string) || 'general')
    setShowNoteForm(true)
  }

  // ─── Calendar modifiers ─────────────────────────────────────────────

  const modifiers = { hasActivity: activeDates.map(d => parseISO(d)) }
  const modifiersStyles = {
    hasActivity: {
      fontWeight: 900,
      textDecoration: 'underline',
      textDecorationColor: '#6366f1',
      textUnderlineOffset: '3px',
    } as React.CSSProperties,
  }

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  // ─── Totales del día ────────────────────────────────────────────────
  const netDay = summary.totalVentas + summary.totalServicios - summary.totalCompras

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* ═══ NAVEGACIÓN DE FECHA ═══ */}
      <Card className="p-3 border-2">
        <div className="flex items-center justify-between">
          <button onClick={goToPrevDay} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>

          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="text-center flex-1 px-2"
          >
            <p className="text-lg font-black text-slate-800">
              {format(selectedDate, "d 'de' MMMM", { locale: es })}
            </p>
            <p className="text-xs text-slate-400 font-bold uppercase">
              {format(selectedDate, "EEEE yyyy", { locale: es })}
              {isToday && ' · HOY'}
            </p>
          </button>

          <button onClick={goToNextDay} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {!isToday && (
          <button
            onClick={goToToday}
            className="w-full mt-2 text-xs font-bold text-indigo-600 hover:underline"
          >
            Ir a hoy
          </button>
        )}

        {showCalendar && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setShowCalendar(false) } }}
              onMonthChange={fetchActiveDates}
              locale={es}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-xl border-2 mx-auto"
            />
          </div>
        )}
      </Card>

      {/* ═══ RESUMEN DEL DÍA ═══ */}
      {!loading && events.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 border-2 border-emerald-200 bg-emerald-50/50 text-center">
            <p className="text-xs font-black text-emerald-600 uppercase">Ingresos</p>
            <p className="text-sm font-black text-slate-800">
              {formatMoney(summary.totalVentas + summary.totalServicios)}
            </p>
          </Card>
          <Card className="p-3 border-2 border-orange-200 bg-orange-50/50 text-center">
            <p className="text-xs font-black text-orange-600 uppercase">Compras</p>
            <p className="text-sm font-black text-slate-800">
              {formatMoney(summary.totalCompras)}
            </p>
          </Card>
          <Card className={`p-3 border-2 text-center ${netDay >= 0 ? 'border-blue-200 bg-blue-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <p className={`text-xs font-black uppercase ${netDay >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Neto</p>
            <p className="text-sm font-black text-slate-800">
              {formatMoney(netDay)}
            </p>
          </Card>
        </div>
      )}

      {/* ═══ FILTROS ═══ */}
      <div className="flex gap-1 flex-wrap items-center">
        <button
          onClick={clearFilters}
          className={`text-xs font-bold px-2.5 py-1.5 rounded-full border transition-all ${
            !activeFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'
          }`}
        >
          Todo
        </button>
        {EVENT_FILTERS.map(f => {
          const isActive = activeFilters?.has(f.type)
          return (
            <button
              key={f.type}
              onClick={() => toggleFilter(f.type)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-full border transition-all ${
                isActive ? 'bg-slate-800 text-white border-slate-800' : `${f.color}`
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ═══ BOTÓN NUEVA NOTA ═══ */}
      {!showNoteForm && (
        <Button
          onClick={() => { resetNoteForm(); setShowNoteForm(true) }}
          variant="outline"
          className="w-full font-bold text-xs border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar nota — {format(selectedDate, "dd/MM")}
        </Button>
      )}

      {/* ═══ FORMULARIO DE NOTA ═══ */}
      {showNoteForm && (
        <Card className="p-4 border-2 border-indigo-200 bg-indigo-50/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black text-indigo-700 uppercase">
              {editingNoteId ? 'Editar nota' : 'Nueva nota'}
            </Label>
            <button onClick={resetNoteForm} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <Input
            placeholder="Título (opcional)"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="text-sm font-bold"
          />

          <Textarea
            placeholder="Decisiones, cambios, recordatorios..."
            value={noteContent}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteContent(e.target.value)}
            rows={3}
            className="text-sm"
          />

          <div className="flex gap-1 flex-wrap">
            {NOTE_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setNoteCategory(cat.value)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-full border transition-all ${
                  noteCategory === cat.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleSaveNote}
            disabled={submitting || !noteContent.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
            size="sm"
          >
            {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {editingNoteId ? 'Guardar cambios' : 'Guardar nota'}
          </Button>
        </Card>
      )}

      {/* ═══ TIMELINE ═══ */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center border-2 border-dashed">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm font-bold text-slate-400">
            Sin actividad el {format(selectedDate, "d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Navegá a otro día o agregá una nota
          </p>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {events.map((event) => (
            <TimelineCard
              key={`${event.type}-${event.id}`}
              event={event}
              formatMoney={formatMoney}
              onEdit={event.type === 'nota' ? () => startEditNote(event) : undefined}
              onDelete={event.type === 'nota' ? () => handleDeleteNote(event.id) : undefined}
              onTogglePin={event.type === 'nota'
                ? () => handleTogglePin(event.id, !!(event.metadata?.pinned))
                : undefined
              }
            />
          ))}
          <p className="text-center text-xs text-slate-300 pt-2">
            {events.length} eventos
          </p>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: TimelineCard
// ───────────────────────────────────────────────────────────────────────────────

function TimelineCard({
  event,
  formatMoney,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  event: TimelineEvent
  formatMoney: (n: number) => string
  onEdit?: () => void
  onDelete?: () => void
  onTogglePin?: () => void
}) {
  const time = format(parseISO(event.timestamp), "HH:mm")
  const isNote = event.type === 'nota'
  const isPinned = !!(event.metadata?.pinned)

  const typeColor: Record<TimelineEventType, string> = {
    venta: 'border-l-emerald-400',
    servicio: 'border-l-blue-400',
    compra: 'border-l-orange-400',
    compra_servicio: 'border-l-violet-400',
    movimiento_caja: 'border-l-yellow-400',
    cambio_precio: 'border-l-pink-400',
    incidente: 'border-l-red-400',
    nota: 'border-l-indigo-400',
  }

  return (
    <div className={`bg-white border-2 rounded-lg px-3 py-2.5 border-l-4 ${typeColor[event.type]} ${isPinned ? 'bg-indigo-50/30 border-indigo-200' : 'border-slate-100'} transition-all`}>
      <div className="flex items-start gap-2.5">
        {/* Emoji */}
        <span className="text-lg shrink-0 mt-0.5">{event.emoji}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-tight truncate">{event.title}</p>
              {event.description && (
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                  {event.description}
                </p>
              )}
            </div>

            {/* Amount */}
            {event.amount !== null && (
              <p className={`text-sm font-black shrink-0 ${
                event.amount > 0 ? 'text-emerald-600' : event.amount < 0 ? 'text-red-500' : 'text-slate-500'
              }`}>
                {event.amount > 0 ? '+' : ''}{formatMoney(event.amount)}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-300 font-bold">{time}</span>

            {/* Note actions */}
            {isNote && (
              <div className="flex gap-1">
                {onTogglePin && (
                  <button onClick={onTogglePin} className="p-2 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 min-h-[36px] min-w-[36px] flex items-center justify-center">
                    {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                )}
                {onEdit && (
                  <button onClick={onEdit} className="p-2 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button onClick={onDelete} className="p-2 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
