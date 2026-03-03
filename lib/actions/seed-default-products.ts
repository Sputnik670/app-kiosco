'use server'

import { createClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/actions/auth-helpers'

/**
 * Carga el catálogo default de ~130 productos típicos de kiosco argentino.
 * Invoca la función seed_default_products(org_id) de Supabase.
 * Solo el owner puede ejecutar esto.
 */
export async function seedDefaultProductsAction(): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  try {
    const { supabase } = await verifyAuth()

    // Obtener org_id del usuario
    const { data: orgId, error: orgError } = await supabase.rpc('get_my_org_id')

    if (orgError || !orgId) {
      return { success: false, error: 'No se pudo obtener la organización' }
    }

    // Verificar que no haya productos ya cargados (evitar duplicados)
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    if (count && count > 10) {
      return { success: false, error: 'Ya hay productos cargados. El catálogo default solo se aplica a organizaciones nuevas.' }
    }

    // Invocar la función de seed
    const { data, error } = await supabase.rpc('seed_default_products', {
      target_org_id: orgId,
    })

    if (error) {
      return { success: false, error: `Error al cargar productos: ${error.message}` }
    }

    return { success: true, count: data || 0 }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
