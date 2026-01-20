/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 MISIONES SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de misiones y rutinas (gamificación).
 * Maneja la creación de misiones únicas y plantillas recurrentes.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Lógica de recurrencia (misión única vs rutina)
 * - Obtención segura de organization_id en servidor
 *
 * ORIGEN: Refactorización de asignar-mision.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Parámetros para crear una misión o rutina
 */
export interface CreateMisionParams {
  descripcion: string
  puntos: number
  esRecurrente: boolean
  sucursalId?: string | null
  turnoId?: string | null
  empleadoId?: string
}

/**
 * Resultado de crear misión/rutina
 */
export interface CreateMisionResult {
  success: boolean
  tipo: 'mision' | 'rutina'
  error?: string
}

/**
 * Empleado disponible para asignar misiones
 */
export interface EmpleadoInfo {
  id: string
  nombre: string
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🎯 Crea una misión única o una rutina recurrente
 *
 * LÓGICA (preservada del componente original):
 * - Si esRecurrente = true: Inserta en 'plantillas_misiones' (rutina)
 * - Si esRecurrente = false: Inserta en 'misiones' (tarea única)
 *
 * RUTINAS (plantillas_misiones):
 * - Se vinculan a una sucursal (o null = global)
 * - Se activan automáticamente en cada apertura de caja
 * - Configuradas por el dueño
 *
 * MISIONES ÚNICAS (misiones):
 * - Se vinculan a un turno específico (caja_diaria_id)
 * - Se asignan a un empleado específico
 * - Se crean manualmente o desde plantillas
 *
 * @param params - Parámetros de la misión/rutina
 * @returns CreateMisionResult - Resultado de la operación
 */
export async function createMisionAction(
  params: CreateMisionParams
): Promise<CreateMisionResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Validar sesión y obtener organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        tipo: 'mision',
        error: 'No hay sesión activa',
      }
    }

    const { data: organizationId } = await supabase.rpc('get_my_org_id_v2')

    if (!organizationId) {
      return {
        success: false,
        tipo: 'mision',
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear RUTINA RECURRENTE (plantilla)
    // ───────────────────────────────────────────────────────────────────────────

    if (params.esRecurrente) {
      const { error } = await supabase.from('plantillas_misiones').insert({
        organization_id: organizationId,
        sucursal_id: params.sucursalId || null, // Si no hay sucursalId, es global
        descripcion: params.descripcion,
        puntos: params.puntos,
        activa: true,
      })

      if (error) {
        return {
          success: false,
          tipo: 'rutina',
          error: `Error creando rutina: ${error.message}`,
        }
      }

      return {
        success: true,
        tipo: 'rutina',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Crear MISIÓN ÚNICA (tarea puntual)
    // ───────────────────────────────────────────────────────────────────────────

    if (!params.empleadoId) {
      return {
        success: false,
        tipo: 'mision',
        error: 'Falta el ID del empleado para la misión',
      }
    }

    const { error } = await supabase.from('misiones').insert({
      organization_id: organizationId,
      caja_diaria_id: params.turnoId || null,
      empleado_id: params.empleadoId,
      tipo: 'manual',
      descripcion: params.descripcion,
      objetivo_unidades: 1,
      unidades_completadas: 0,
      es_completada: false,
      puntos: params.puntos,
    })

    if (error) {
      return {
        success: false,
        tipo: 'mision',
        error: `Error creando misión: ${error.message}`,
      }
    }

    return {
      success: true,
      tipo: 'mision',
    }
  } catch (error) {
    return {
      success: false,
      tipo: 'mision',
      error: error instanceof Error ? error.message : 'Error desconocido al crear misión',
    }
  }
}

/**
 * 👥 Obtiene lista de empleados disponibles para asignar misiones
 *
 * FILTRO: Solo empleados (rol = 'empleado')
 *
 * @returns Lista de empleados o error
 */
export async function getEmpleadosAction(): Promise<{
  success: boolean
  empleados: EmpleadoInfo[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .eq('rol', 'empleado')
      .order('nombre', { ascending: true })

    if (error) {
      return {
        success: false,
        empleados: [],
        error: `Error obteniendo empleados: ${error.message}`,
      }
    }

    return {
      success: true,
      empleados: (data as EmpleadoInfo[]) || [],
    }
  } catch (error) {
    return {
      success: false,
      empleados: [],
      error: error instanceof Error ? error.message : 'Error desconocido al obtener empleados',
    }
  }
}
