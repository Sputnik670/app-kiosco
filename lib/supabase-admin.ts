import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Admin de Supabase (service_role key)
 *
 * SOLO para operaciones server-side que requieren bypass de RLS:
 * - Invitar usuarios (admin.inviteUserByEmail)
 * - Crear usuarios (admin.createUser)
 * - Eliminar usuarios (admin.deleteUser)
 *
 * ⚠️ NUNCA exponer al cliente. Solo usar en Server Actions / Route Handlers.
 * ⚠️ Requiere SUPABASE_SERVICE_ROLE_KEY en variables de entorno.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
