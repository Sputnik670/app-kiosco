"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, QrCode, DollarSign, AlertTriangle, ShoppingCart, CheckCircle } from "lucide-react"
import DashboardDueno from "@/components/dashboard-dueno"
import VistaEmpleado from "@/components/vista-empleado"
import AuthForm from "@/components/auth-form"
import ProfileSetup from "@/components/profile-setup"
import SeleccionarSucursal from "@/components/seleccionar-sucursal"
import OnboardingWizard from "@/components/onboarding-wizard"
import QRFichajeScanner from "@/components/qr-fichaje-scanner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { getQuickSnapshotAction } from "@/lib/actions/dashboard.actions"
import { getBranchesAction } from "@/lib/actions/branch.actions"
import { toggleAttendanceAction, getActiveBranchAction } from "@/lib/actions/attendance.actions"
import { getCurrentUserAction } from "@/lib/actions/auth.actions"
import { logger } from "@/lib/logging"
import type { QuickSnapshot } from "@/types/dashboard.types"
import type { Session } from "@supabase/supabase-js"

interface UserProfile {
    id: string
    rol: "dueño" | "empleado"
    nombre: string
    organization_id: string
}

function EscanearQRFichaje({ onQRScanned }: { onQRScanned: (data: { sucursal_id: string }) => void }) {
  const [showScanner, setShowScanner] = useState(false)
  const [manualUrl, setManualUrl] = useState("")
  const [showManual, setShowManual] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [fichajeMsg, setFichajeMsg] = useState("")

  // Unificado: escanear QR = fichar entrada + entrar al panel
  const registrarEntradaYEntrar = async (sucursalId: string) => {
    setProcesando(true)
    setFichajeMsg("Registrando entrada...")

    try {
      const result = await toggleAttendanceAction(sucursalId)

      if (result.success && result.action === 'entrada') {
        setFichajeMsg("Entrada registrada. Abriendo panel...")
        toast.success("Entrada registrada")
      } else if (result.success && result.action === 'salida') {
        // Si escaneó y ya tenía entrada, se registra salida
        setFichajeMsg("Salida registrada.")
        toast.info("Salida registrada")
      } else if (!result.success) {
        // Si falla (ya tiene fichaje activo, etc), entrar igual al panel
        console.warn("Fichaje automático:", result.error)
      }

      // Siempre entrar al panel (el empleado ya se autenticó con el QR)
      setTimeout(() => {
        onQRScanned({ sucursal_id: sucursalId })
      }, 500)
    } catch (err) {
      console.error("Error en fichaje automático:", err)
      // Entrar al panel de todas formas
      onQRScanned({ sucursal_id: sucursalId })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleQRScanned = (data: any) => {
    if (data?.sucursal_id) {
      registrarEntradaYEntrar(data.sucursal_id)
    }
  }

  const handleManualUrl = () => {
    try {
      const url = new URL(manualUrl, window.location.origin)
      const sucursalId = url.searchParams.get('sucursal_id')

      if (sucursalId) {
        registrarEntradaYEntrar(sucursalId)
      } else {
        toast.error("URL inválida", { description: "Debe contener sucursal_id" })
      }
    } catch {
      toast.error("URL inválida", { description: "Pega la URL completa del QR de fichaje" })
    }
  }

  // Estado procesando: mostrar pantalla de carga
  if (procesando) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Card className="w-full max-w-md shadow-2xl border-0 rounded-[2.5rem] overflow-hidden p-12">
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              {fichajeMsg.includes("Registrada") || fichajeMsg.includes("registrada") ? (
                <CheckCircle className="h-12 w-12 text-green-600" />
              ) : (
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">{fichajeMsg}</h2>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-md shadow-2xl border-0 rounded-[2.5rem] overflow-hidden">
        <div className="bg-slate-900 p-8 text-white text-center">
          <div className="bg-blue-500 p-3 rounded-2xl shadow-lg shadow-blue-500/20 inline-block mb-4">
            <QrCode className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic mb-2">Kiosco 24hs</h1>
          <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.4em]">Sistema de Fichaje</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              Escanea el QR del Local
            </h2>
            <p className="text-sm font-medium text-slate-400">
              Al escanear el QR, se registra tu entrada y se abre el panel de ventas automáticamente.
            </p>
          </div>

          <Button
            onClick={() => setShowScanner(true)}
            className="w-full h-16 text-lg font-black rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg"
          >
            <QrCode className="mr-2 h-5 w-5" />
            Escanear QR del Local
          </Button>

          {/* Fallback: pegar URL manualmente */}
          <div className="border-t-2 border-dashed border-slate-200 pt-4">
            <button
              onClick={() => setShowManual(!showManual)}
              className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showManual ? "Ocultar" : "¿La cámara no funciona? Pega el link del QR"}
            </button>
            {showManual && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-slate-500 text-center">
                  Pedile al dueño que te copie el link del QR y pegalo acá:
                </p>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://app-kiosco-chi.vercel.app/fichaje?..."
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-mono"
                />
                <Button
                  onClick={handleManualUrl}
                  disabled={!manualUrl.trim()}
                  variant="outline"
                  className="w-full h-12 font-black rounded-xl"
                >
                  Fichar con Link
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <QRFichajeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onQRScanned={handleQRScanned}
      />
    </div>
  )
}

function QuickKPISnapshot({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<QuickSnapshot | null>(null)

  useEffect(() => {
    getQuickSnapshotAction(organizationId).then(setSnapshot)
  }, [organizationId])

  if (!snapshot?.success) return null

  const formatMoney = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <Card className="p-3 text-center border-green-200 bg-green-50">
        <DollarSign className="h-5 w-5 mx-auto text-green-600 mb-1" />
        <p className="text-xs font-bold text-green-800 uppercase">Ventas hoy</p>
        <p className="text-lg font-black text-green-700">{formatMoney(snapshot.ventasHoy)}</p>
        <p className="text-[10px] text-green-600">{snapshot.cantVentas} ventas</p>
      </Card>
      <Card className="p-3 text-center border-blue-200 bg-blue-50">
        <ShoppingCart className="h-5 w-5 mx-auto text-blue-600 mb-1" />
        <p className="text-xs font-bold text-blue-800 uppercase">Operaciones</p>
        <p className="text-lg font-black text-blue-700">{snapshot.cantVentas}</p>
        <p className="text-[10px] text-blue-600">transacciones</p>
      </Card>
      <Card className={`p-3 text-center ${snapshot.productosStockBajo > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
        <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${snapshot.productosStockBajo > 0 ? "text-red-600" : "text-slate-400"}`} />
        <p className={`text-xs font-bold uppercase ${snapshot.productosStockBajo > 0 ? "text-red-800" : "text-slate-600"}`}>Stock bajo</p>
        <p className={`text-lg font-black ${snapshot.productosStockBajo > 0 ? "text-red-700" : "text-slate-500"}`}>{snapshot.productosStockBajo}</p>
        <p className={`text-[10px] ${snapshot.productosStockBajo > 0 ? "text-red-600" : "text-slate-400"}`}>productos</p>
      </Card>
    </div>
  )
}

function AppRouter({ userProfile, onLogout, sucursalId }: { userProfile: UserProfile, onLogout: () => void, sucursalId: string }) {
    if (userProfile.rol === "dueño") {
        return <DashboardDueno onBack={onLogout} sucursalId={sucursalId} />
    }
    if (userProfile.rol === "empleado") {
        return <VistaEmpleado onBack={onLogout} sucursalId={sucursalId} />
    }
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="p-6 text-center">
                <p className="text-xl font-bold text-destructive">Error de Rol</p>
                <Button onClick={onLogout} className="mt-4" variant="destructive">Cerrar Sesión</Button>
            </Card>
        </div>
    )
}

function HomePageInner() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [sucursalId, setSucursalId] = useState<string | null>(null)
  const [hasBranches, setHasBranches] = useState<boolean | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get("invite_token")

  const fetchProfile = async (userId: string, shouldValidate: boolean = false) => {
    setLoading(true)
    try {
        logger.debug('page', 'fetchProfile iniciando', { userId })

        // Usar server action en vez de browser client directo para consistencia
        const result = await getCurrentUserAction()

        // Si no hay membership, el usuario necesita completar setup
        if (!result.success || !result.user) {
            logger.debug('page', 'No tiene membership, mostrando setup', { userId })
            setHasProfile(false)
            setUserProfile(null)
            if (shouldValidate) {
                throw new Error('Profile not ready yet')
            }
            return
        }

        // Mapear role de BD a rol de UI (owner → dueño, employee → empleado)
        const rolUI = result.user.role === 'owner' ? 'dueño' : 'empleado'

        setUserProfile({
            id: result.user.id,
            nombre: result.user.display_name,
            rol: rolUI as 'dueño' | 'empleado',
            organization_id: result.user.organization_id
        })
        setHasProfile(true)

        // Para dueños, verificar si ya tienen sucursales
        if (result.user.role === 'owner') {
            const branchResult = await getBranchesAction()
            setHasBranches(branchResult.success && (branchResult.branches?.length ?? 0) > 0)
        }

        logger.info('page', 'Perfil cargado', { userId, rol: rolUI })

    } catch (error: unknown) {
        logger.error('page', 'Error en fetchProfile', error instanceof Error ? error : undefined, { userId })
        if (!shouldValidate) {
            toast.error('Error cargando perfil')
        }
        setHasProfile(false)
        throw error
    } finally {
        setLoading(false)
    }
  }

  // 1. Manejo de Sesión
  useEffect(() => {
    // ─── FIX 2026-04-22: Consumir tokens del hash (implicit flow) ───────────
    // Supabase manda invites/recovery con tokens en el hash (#access_token=...),
    // pero @supabase/ssr NO los procesa automáticamente (solo PKCE ?code=).
    // Consumimos el hash manualmente para establecer la sesión.
    const consumeAuthHash = async (): Promise<void> => {
      if (typeof window === 'undefined') return
      const hash = window.location.hash
      if (!hash.includes('access_token=')) return

      const hashParams = new URLSearchParams(hash.substring(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      const type = hashParams.get('type') // invite | recovery | magiclink

      if (!access_token || !refresh_token) return

      try {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) {
          logger.error('page', 'Error estableciendo sesión desde hash', error)
          return
        }
        // Limpiar hash pero preservar query string (invite_token, etc.)
        window.history.replaceState({}, '', window.location.pathname + window.location.search)

        // Recovery puro (olvidé contraseña): redirigir al form de set-password
        if (type === 'recovery') {
          router.replace('/auth/set-password')
        }
      } catch (err) {
        logger.error('page', 'Excepción en setSession desde hash', err instanceof Error ? err : undefined)
      }
    }

    const init = async () => {
      await consumeAuthHash()
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setLoading(false)
        setUserProfile(null)
        setHasProfile(false)
        setSucursalId(null)
        setHasBranches(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Lógica de Sincronización de Sucursal (URL y Asistencia Activa)
  useEffect(() => {
    const sincronizarSucursal = async () => {
      if (!session || !userProfile) return

      // Prioridad 1: URL (viene de redirección de fichaje)
      const urlParams = new URLSearchParams(window.location.search)
      const idFromUrl = urlParams.get('sucursal_id')

      if (idFromUrl) {
        setSucursalId(idFromUrl)
        window.history.replaceState({}, '', '/') // Limpiar URL limpia
        return
      }

      // Prioridad 2: Asistencia activa en DB (si es empleado y no hay ID seleccionado)
      if (userProfile.rol === "empleado" && !sucursalId) {
        const activeBranch = await getActiveBranchAction()
        if (activeBranch.success && activeBranch.branchId) {
          setSucursalId(activeBranch.branchId)
        }
      }
    }

    sincronizarSucursal()
  }, [session, userProfile])

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setSucursalId(null)
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  )

  if (!session) return <AuthForm />

  if (session && !hasProfile) {
    return (
        <ProfileSetup
            user={session.user}
            inviteToken={inviteToken}
            onProfileCreated={async (result) => {
              try {
                logger.info('page', 'Perfil creado, cargando membership...')
                await fetchProfile(session.user.id);
              } catch (error) {
                logger.error('page', 'Error al cargar perfil post-setup', error instanceof Error ? error : undefined)
                toast.error("Error al cargar perfil", {
                  description: "Por favor recarga la página"
                });
              }
            }}
        />
    )
  }

  if (session && userProfile) {
    if (!sucursalId) {
        if (userProfile.rol === "empleado") {
            return <EscanearQRFichaje onQRScanned={(data) => setSucursalId(data.sucursal_id)} />
        }

        // Dueño sin sucursales → Onboarding Wizard
        if (hasBranches === false) {
            return (
              <OnboardingWizard
                organizationId={userProfile.organization_id}
                userId={userProfile.id}
                onComplete={() => {
                  // Recargar perfil para detectar nuevas sucursales
                  fetchProfile(userProfile.id)
                }}
              />
            )
        }

        // Dueño con sucursales → Selector de sucursal (KPIs se ven DENTRO del dashboard, no antes)
        return (
            <SeleccionarSucursal
                organizationId={userProfile.organization_id}
                userId={userProfile.id}
                userRol={userProfile.rol}
                onSelect={(id) => setSucursalId(id)}
            />
        )
    }

    return <AppRouter userProfile={userProfile} onLogout={handleLogout} sucursalId={sucursalId} />
  }

  return null
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <HomePageInner />
    </Suspense>
  )
}
