'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { updatePasswordAction } from '@/lib/actions/auth.actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

/**
 * /auth/set-password
 *
 * Página donde el empleado re-invitado establece su contraseña.
 * Llega acá después de hacer click en el link de recovery que
 * le envió el dueño.
 *
 * FLUJO:
 * 1. Supabase procesa el token de recovery automáticamente
 *    (el usuario ya está autenticado al llegar acá)
 * 2. El empleado escribe su contraseña nueva
 * 3. Se llama supabase.auth.updateUser({ password })
 * 4. Se redirige al dashboard
 */
export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  // Verificar que el usuario esté autenticado (el recovery link lo autentica)
  useEffect(() => {
    // ─── FIX 2026-04-22: Consumir tokens del hash (implicit flow) ───────────
    // Supabase manda el recovery link con tokens en el hash (#access_token=...),
    // pero @supabase/ssr NO los procesa automáticamente (solo PKCE ?code=).
    // Sin este consumer, getUser() devuelve null y el listener PASSWORD_RECOVERY
    // nunca se dispara → el usuario ve "Link expirado o inválido".
    const consumeAuthHash = async (): Promise<void> => {
      if (typeof window === 'undefined') return
      const hash = window.location.hash
      if (!hash.includes('access_token=')) return

      const hashParams = new URLSearchParams(hash.substring(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')

      if (!access_token || !refresh_token) return

      try {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) {
          console.error('[set-password] Error estableciendo sesión desde hash:', error)
          return
        }
        // Limpiar hash de la URL (la sesión ya quedó establecida)
        window.history.replaceState({}, '', window.location.pathname + window.location.search)
      } catch (err) {
        console.error('[set-password] Excepción en setSession desde hash:', err)
      }
    }

    // ─── FIX 2026-04-22 (v2): Procesar ?code= de PKCE flow ────────────────
    // En la práctica Supabase manda el recovery link con ?code=... (PKCE),
    // no con #access_token=... (implicit). Hay que canjear el code por sesión
    // con exchangeCodeForSession(). Requiere que el browser tenga el
    // code_verifier guardado (cookies/localStorage), o sea: debe ser el
    // mismo browser donde se pidió el reset. Si se abre en incógnito o en
    // otro dispositivo, el canje falla con PKCE grant flow error.
    const consumePkceCode = async (): Promise<void> => {
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (!code) return

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('[set-password] Error canjeando code PKCE:', error)
          return
        }
        // Limpiar ?code= de la URL
        url.searchParams.delete('code')
        const newSearch = url.searchParams.toString()
        window.history.replaceState(
          {},
          '',
          url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash
        )
      } catch (err) {
        console.error('[set-password] Excepción canjeando code:', err)
      }
    }

    const init = async () => {
      await consumeAuthHash()
      await consumePkceCode()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setAuthenticated(true)
      }
      setChecking(false)
    }
    init()

    // Escuchar el evento PASSWORD_RECOVERY que Supabase emite al procesar el link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthenticated(true)
        setChecking(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const result = await updatePasswordAction(password)

      if (!result.success) {
        toast.error('Error al establecer contraseña', { description: result.error })
        setLoading(false)
        return
      }

      toast.success('Contraseña guardada', {
        description: 'Entrando al sistema...',
      })

      // FIX 2026-04-22: usar window.location.href en vez de router.push para
      // forzar full reload. Tras updateUser() Supabase rota el refresh token
      // y router.push puede leer cookies stale, dejando al user en limbo.
      // NO llamamos setLoading(false) acá: mantenemos el spinner del botón
      // mientras se ejecuta el redirect para evitar "flash" del form.
      setTimeout(() => {
        window.location.href = '/'
      }, 800)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado'
      toast.error('Error inesperado', { description: message })
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-sm p-6 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-black uppercase">Link expirado o inválido</h1>
          <p className="text-sm text-slate-500">
            Este link ya fue usado o expiró. Pedile al dueño que te envíe uno nuevo.
          </p>
          <Button onClick={() => router.push('/signup')} variant="outline" className="w-full">
            Ir al inicio
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">Crear contraseña</h1>
          <p className="text-sm text-slate-500">
            Elegí una contraseña para poder entrar todos los días sin necesitar un link nuevo.
          </p>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Nueva contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-300" />
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="pl-10 h-12 rounded-xl border-2 font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Repetir contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-300" />
              <Input
                type="password"
                placeholder="Repetí la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="pl-10 h-12 rounded-xl border-2 font-bold"
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[10px] text-red-500 font-bold ml-1">Las contraseñas no coinciden</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl font-black uppercase tracking-widest"
            disabled={loading || password.length < 8 || password !== confirmPassword}
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Guardar contraseña
              </>
            )}
          </Button>
        </form>

        <p className="text-[10px] text-center text-slate-400 font-bold">
          Después de crear tu contraseña vas a poder entrar siempre desde la pantalla de login con tu email y contraseña.
        </p>
      </Card>
    </div>
  )
}
