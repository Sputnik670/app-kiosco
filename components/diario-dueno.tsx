"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import {
  BookOpen, Plus, Pin, PinOff, Trash2, Pencil, X,
  Loader2, Search, ChevronDown, ChevronUp, Save
} from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  createNoteAction,
  getNotesAction,
  getNotesByDateAction,
  getNoteDatesAction,
  updateNoteAction,
  deleteNoteAction,
  toggleNotePinAction,
  type OwnerNote,
} from "@/lib/actions/notes.actions"

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-slate-100 text-slate-600' },
  { value: 'precios', label: 'Precios', color: 'bg-violet-100 text-violet-700' },
  { value: 'proveedores', label: 'Proveedores', color: 'bg-blue-100 text-blue-700' },
  { value: 'empleados', label: 'Empleados', color: 'bg-amber-100 text-amber-700' },
  { value: 'sucursales', label: 'Sucursales', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'finanzas', label: 'Finanzas', color: 'bg-green-100 text-green-700' },
  { value: 'idea', label: 'Idea', color: 'bg-pink-100 text-pink-700' },
]

function getCategoryStyle(cat: string) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0]
}

export default function DiarioDueno() {
  // Estado principal
  const [notes, setNotes] = useState<OwnerNote[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [datesWithNotes, setDatesWithNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  // Estado de búsqueda
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")

  // Estado del formulario
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<OwnerNote | null>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formCategory, setFormCategory] = useState("general")
  const [submitting, setSubmitting] = useState(false)

  // Cargar notas del día seleccionado
  const fetchNotesForDate = useCallback(async (date: Date) => {
    setLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getNotesByDateAction(dateStr)
      if (result.success) {
        setNotes(result.notes)
      }
    } catch (err) {
      console.error('[Diario] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar todas las notas (modo lista con filtros)
  const fetchAllNotes = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getNotesAction({
        category: filterCategory,
        search: searchQuery || undefined,
      })
      if (result.success) {
        setNotes(result.notes)
      }
    } catch (err) {
      console.error('[Diario] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, searchQuery])

  // Cargar fechas con notas para marcar en el calendario
  const fetchDatesWithNotes = useCallback(async (date: Date) => {
    try {
      const result = await getNoteDatesAction(date.getMonth() + 1, date.getFullYear())
      if (result.success) {
        setDatesWithNotes(result.dates)
      }
    } catch (err) {
      console.error('[Diario] Error fechas:', err)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchNotesForDate(selectedDate)
      fetchDatesWithNotes(selectedDate)
    } else {
      fetchAllNotes()
    }
  }, [viewMode, selectedDate, fetchNotesForDate, fetchAllNotes, fetchDatesWithNotes])

  // Handlers
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
    }
  }

  const handleMonthChange = (date: Date) => {
    fetchDatesWithNotes(date)
  }

  const resetForm = () => {
    setFormTitle("")
    setFormContent("")
    setFormCategory("general")
    setEditingNote(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!formContent.trim()) {
      toast.error("Escribí algo en la nota")
      return
    }

    setSubmitting(true)
    try {
      if (editingNote) {
        const result = await updateNoteAction({
          id: editingNote.id,
          title: formTitle,
          content: formContent,
          category: formCategory,
        })
        if (!result.success) {
          toast.error("Error", { description: result.error })
          return
        }
        toast.success("Nota actualizada")
      } else {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const result = await createNoteAction({
          noteDate: dateStr,
          title: formTitle,
          content: formContent,
          category: formCategory,
        })
        if (!result.success) {
          toast.error("Error", { description: result.error })
          return
        }
        toast.success("Nota guardada")
      }

      resetForm()
      if (viewMode === 'calendar') {
        fetchNotesForDate(selectedDate)
        fetchDatesWithNotes(selectedDate)
      } else {
        fetchAllNotes()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error("Error", { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    try {
      const result = await deleteNoteAction(noteId)
      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }
      toast.success("Nota eliminada")
      if (viewMode === 'calendar') {
        fetchNotesForDate(selectedDate)
        fetchDatesWithNotes(selectedDate)
      } else {
        fetchAllNotes()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error("Error", { description: msg })
    }
  }

  const handleTogglePin = async (note: OwnerNote) => {
    try {
      const result = await toggleNotePinAction(note.id, !note.pinned)
      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }
      if (viewMode === 'calendar') {
        fetchNotesForDate(selectedDate)
      } else {
        fetchAllNotes()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error("Error", { description: msg })
    }
  }

  const startEditing = (note: OwnerNote) => {
    setEditingNote(note)
    setFormTitle(note.title || "")
    setFormContent(note.content)
    setFormCategory(note.category)
    setShowForm(true)
  }

  // Modifiers para el calendario — marcar días con notas
  const modifiers = {
    hasNotes: datesWithNotes.map(d => parseISO(d)),
  }
  const modifiersStyles = {
    hasNotes: {
      fontWeight: 900,
      textDecoration: 'underline',
      textDecorationColor: '#6366f1',
      textUnderlineOffset: '3px',
    } as React.CSSProperties,
  }

  return (
    <Card className="p-5 border-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" /> Mi Diario
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('calendar')}
            className={`text-[9px] font-bold px-3 py-1.5 rounded-full border transition-all ${
              viewMode === 'calendar'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Calendario
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`text-[9px] font-bold px-3 py-1.5 rounded-full border transition-all ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Todo
          </button>
        </div>
      </div>

      {/* Calendario */}
      {viewMode === 'calendar' && (
        <div className="mb-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
            locale={es}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-xl border-2 mx-auto"
          />
          <p className="text-center text-xs font-bold text-slate-500 mt-2">
            {format(selectedDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
      )}

      {/* Búsqueda y filtros (modo lista) */}
      {viewMode === 'list' && (
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar en notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setFilterCategory('all')}
              className={`text-[8px] font-bold px-2 py-1 rounded-full border transition-all ${
                filterCategory === 'all'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              Todas
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`text-[8px] font-bold px-2 py-1 rounded-full border transition-all ${
                  filterCategory === cat.value
                    ? 'bg-slate-800 text-white border-slate-800'
                    : `${cat.color} border-transparent`
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botón agregar nota */}
      {!showForm && (
        <Button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nueva nota {viewMode === 'calendar' ? `— ${format(selectedDate, "dd/MM")}` : ''}
        </Button>
      )}

      {/* Formulario de nota */}
      {showForm && (
        <div className="bg-indigo-50 rounded-xl p-4 border-2 border-indigo-200 mb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black text-indigo-700 uppercase">
              {editingNote ? 'Editar nota' : 'Nueva nota'}
            </Label>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <Input
            placeholder="Título (opcional)"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="text-sm font-bold"
          />

          <Textarea
            placeholder="Escribí tu nota... decisiones, cambios, recordatorios..."
            value={formContent}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormContent(e.target.value)}
            rows={3}
            className="text-sm"
          />

          <div>
            <Label className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 block">Categoría</Label>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setFormCategory(cat.value)}
                  className={`text-[9px] font-bold px-2.5 py-1.5 rounded-full border transition-all ${
                    formCategory === cat.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : `${cat.color} border-transparent hover:ring-1 hover:ring-indigo-300`
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={submitting || !formContent.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs"
            size="sm"
          >
            {submitting ? (
              <Loader2 className="animate-spin h-4 w-4 mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {editingNote ? 'Guardar cambios' : 'Guardar nota'}
          </Button>
        </div>
      )}

      {/* Lista de notas */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="h-10 w-10 text-slate-200 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">
            {viewMode === 'calendar'
              ? `Sin notas para ${format(selectedDate, "d 'de' MMMM", { locale: es })}`
              : 'Sin notas encontradas'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              showDate={viewMode === 'list'}
              onEdit={() => startEditing(note)}
              onDelete={() => handleDelete(note.id)}
              onTogglePin={() => handleTogglePin(note)}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: NoteCard
// ───────────────────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  showDate,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: OwnerNote
  showDate: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const catStyle = getCategoryStyle(note.category)
  const isLong = note.content.length > 120

  return (
    <div className={`bg-white border-2 rounded-xl p-3.5 transition-all ${note.pinned ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          {note.title && (
            <p className="text-sm font-black text-slate-800 truncate">{note.title}</p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <Badge className={`text-[8px] font-bold border-0 ${catStyle.color}`}>
              {catStyle.label}
            </Badge>
            {note.pinned && (
              <Pin className="h-3 w-3 text-indigo-500 fill-indigo-500" />
            )}
            {showDate && (
              <span className="text-[10px] text-slate-400 font-bold">
                {format(parseISO(note.note_date), "dd/MM/yyyy")}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-0.5 shrink-0">
          <button
            onClick={onTogglePin}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
            title={note.pinned ? 'Desfijar' : 'Fijar'}
          >
            {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
        {isLong && !expanded ? note.content.slice(0, 120) + '...' : note.content}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5 mt-1 hover:underline"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}

      {/* Timestamp */}
      <p className="text-[9px] text-slate-300 mt-1.5">
        {format(parseISO(note.created_at), "HH:mm", { locale: es })}
        {note.updated_at !== note.created_at && ' (editada)'}
      </p>
    </div>
  )
}
