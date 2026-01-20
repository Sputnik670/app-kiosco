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

  // En el servidor (build/SSR), usar cliente básico
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
    const value = (client as any)[prop]
    // Si es una función, bindearla al cliente
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})
