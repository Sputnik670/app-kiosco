import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Read version once at module level to avoid repeated file reads
const APP_VERSION = process.env.npm_package_version ?? '0.1.0'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const start = Date.now()

  let supabaseStatus: 'connected' | 'error' = 'error'
  let dbLatencyMs: number | null = null

  try {
    const supabase = await createClient()
    const dbStart = Date.now()
    // Lightweight auth check to verify Supabase connectivity
    // This avoids querying any user data and works without RLS concerns
    const { error } = await supabase.auth.getSession()
    dbLatencyMs = Date.now() - dbStart

    if (!error) {
      supabaseStatus = 'connected'
    }
  } catch {
    // Supabase unreachable; status stays 'error'
  }

  const responseTimeMs = Date.now() - start

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      supabase: supabaseStatus,
      uptime: process.uptime(),
      responseTimeMs,
      dbLatencyMs,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
