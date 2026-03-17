/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📓 OWNER NOTES / DIARY SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Diario del dueño: notas con fecha, categoría y búsqueda.
 * Solo el dueño puede crear/editar/eliminar notas de su organización.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { verifyOwner } from '@/lib/actions/auth-helpers'
import { createNoteSchema, updateNoteSchema, getZodError, idSchema } from '@/lib/validations'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface OwnerNote {
  id: string
  organization_id: string
  branch_id: string | null
  author_id: string
  note_date: string
  title: string | null
  content: string
  category: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface CreateNoteParams {
  noteDate: string // 'YYYY-MM-DD'
  title?: string
  content: string
  category?: string
  branchId?: string
  pinned?: boolean
}

export interface UpdateNoteParams {
  id: string
  title?: string
  content?: string
  category?: string
  noteDate?: string
  pinned?: boolean
}

// ───────────────────────────────────────────────────────────────────────────────
// CREAR NOTA
// ───────────────────────────────────────────────────────────────────────────────

export async function createNoteAction(params: CreateNoteParams) {
  try {
    const parsed = createNoteSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase, user, orgId } = await verifyOwner()

    const { data, error } = await supabase.from('owner_notes').insert({
      organization_id: orgId,
      author_id: user.id,
      note_date: params.noteDate,
      title: params.title || null,
      content: params.content,
      category: params.category || 'general',
      branch_id: params.branchId || null,
      pinned: params.pinned || false,
    }).select('id').single()

    if (error) {
      return { success: false, error: `Error creando nota: ${error.message}` }
    }

    return { success: true, noteId: data.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// OBTENER NOTAS (por rango de fechas)
// ───────────────────────────────────────────────────────────────────────────────

export async function getNotesAction(filters?: {
  startDate?: string
  endDate?: string
  category?: string
  search?: string
}): Promise<{ success: boolean; notes: OwnerNote[]; error?: string }> {
  try {
    const { supabase, orgId } = await verifyOwner()

    let query = supabase
      .from('owner_notes')
      .select('*')
      .eq('organization_id', orgId)
      .order('note_date', { ascending: false })
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    if (filters?.startDate) {
      query = query.gte('note_date', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('note_date', filters.endDate)
    }
    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }
    if (filters?.search) {
      query = query.or(`content.ilike.%${filters.search}%,title.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, notes: [], error: error.message }
    }

    return { success: true, notes: (data || []) as OwnerNote[] }
  } catch (error) {
    return { success: false, notes: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// OBTENER NOTAS DE UN DÍA ESPECÍFICO
// ───────────────────────────────────────────────────────────────────────────────

export async function getNotesByDateAction(date: string): Promise<{ success: boolean; notes: OwnerNote[]; error?: string }> {
  try {
    const { supabase, orgId } = await verifyOwner()

    const { data, error } = await supabase
      .from('owner_notes')
      .select('*')
      .eq('organization_id', orgId)
      .eq('note_date', date)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, notes: [], error: error.message }
    }

    return { success: true, notes: (data || []) as OwnerNote[] }
  } catch (error) {
    return { success: false, notes: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// OBTENER FECHAS CON NOTAS (para marcar en calendario)
// ───────────────────────────────────────────────────────────────────────────────

export async function getNoteDatesAction(month: number, year: number): Promise<{ success: boolean; dates: string[]; error?: string }> {
  try {
    const { supabase, orgId } = await verifyOwner()

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const { data, error } = await supabase
      .from('owner_notes')
      .select('note_date')
      .eq('organization_id', orgId)
      .gte('note_date', startDate)
      .lt('note_date', endDate)

    if (error) {
      return { success: false, dates: [], error: error.message }
    }

    // Unique dates
    const uniqueDates = [...new Set((data || []).map((d: { note_date: string }) => d.note_date))]
    return { success: true, dates: uniqueDates }
  } catch (error) {
    return { success: false, dates: [], error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR NOTA
// ───────────────────────────────────────────────────────────────────────────────

export async function updateNoteAction(params: UpdateNoteParams) {
  try {
    const parsed = updateNoteSchema.safeParse(params)
    if (!parsed.success) {
      return { success: false, error: getZodError(parsed) }
    }

    const { supabase } = await verifyOwner()

    const updateData: Record<string, unknown> = {}
    if (params.title !== undefined) updateData.title = params.title || null
    if (params.content !== undefined) updateData.content = params.content
    if (params.category !== undefined) updateData.category = params.category
    if (params.noteDate !== undefined) updateData.note_date = params.noteDate
    if (params.pinned !== undefined) updateData.pinned = params.pinned

    const { error } = await supabase
      .from('owner_notes')
      .update(updateData)
      .eq('id', params.id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// ELIMINAR NOTA
// ───────────────────────────────────────────────────────────────────────────────

export async function deleteNoteAction(noteId: string) {
  try {
    const parsed = idSchema.safeParse(noteId)
    if (!parsed.success) {
      return { success: false, error: 'ID de nota inválido' }
    }

    const { supabase } = await verifyOwner()

    const { error } = await supabase
      .from('owner_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// TOGGLE PIN
// ───────────────────────────────────────────────────────────────────────────────

export async function toggleNotePinAction(noteId: string, pinned: boolean) {
  try {
    const parsed = idSchema.safeParse(noteId)
    if (!parsed.success) {
      return { success: false, error: 'ID de nota inválido' }
    }

    const { supabase } = await verifyOwner()

    const { error } = await supabase
      .from('owner_notes')
      .update({ pinned })
      .eq('id', noteId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
