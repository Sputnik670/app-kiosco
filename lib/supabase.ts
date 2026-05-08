import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null
let serverClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  // En el browser, usar createBrowserClient para manejo de cookies
  if (typeof window !== 'undefined') {
    if (!browserClient) {
      browserClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
    return browserClient
  }

  // En el servidor (build/SSR), usar cliente basico
  if (!serverClient) {
    serverClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return serverClient
}

// Proxy para que cada acceso a supabase.* llame a getSupabaseClient()
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient()
    // NOTA (2026-05-08): cast a Record<string | symbol, unknown> en lugar
    // del "as any" legacy. El prop de un Proxy es string | symbol y los
    // miembros publicos de SupabaseClient estan tipados con keys especificas,
    // por eso el acceso dinamico requiere un cast generico (mas estricto que
    // any pero suficientemente abierto para Proxy).
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    // Si es funcion, bindear al cliente para preservar this.
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return value
  }
})
