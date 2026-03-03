"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, QrCode, DollarSign, AlertTriangle, ShoppingCart } from "lucide-react"
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
import { useRouter } from "next/navigation"
import { getQuickSnapshotAction } from "@/lib/actions/dashboard.actions"
import { getBranchesAction } from "@/lib/actions/branch.actions"
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

  const handleQRScanned = (data: { sucursal_id: string, tipo: "entrada" | "salida", sucursal_nombre?: string }) => {
    onQRScanned(data)
    toast.success(
      data.tipo === "entrada" ? "QR de entrada escaneado" : "QR de salida escaneado",
      { description: `Local: ${data.sucursal_nombre || "Sucursal"}` }
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
              Cada local tiene un QR de entrada y otro de salida. Escanea el correspondiente según tu situación.
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 rounded-lg p-2">
                <QrCode className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-blue-900 text-sm uppercase mb-1">Instrucciones</h3>
                <ul className="text-xs text-blue-800 space-y-1 font-bold">
                  <li>• Busca el QR en el local</li>
                  <li>• Escanea el QR de ENTRADA al llegar</li>
                  <li>• Escanea el QR de SALIDA al terminar</li>
                  <li>• No puedes elegir el local manualmente</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setShowScanner(true)}
            className="w-full h-16 text-lg font-black rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg"
          >
            <QrCode className="mr-2 h-5 w-5" />
            Escanear QR del Local
          </Button>
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

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [sucursalId, setSucursalId] = useState<string | null>(null)
  const [hasBranches, setHasBranches] = useState<boolean | null>(null)
  const router = useRouter()

  const fetchProfile = async (userId: string, shouldValidate: boolean = false) => {
    setLoading(true)
    try {
        logger.debug('page', 'fetchProfile iniciando', { userId })

        // Schema V2: Obtener datos desde memberships (única fuente de verdad)
        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('user_id, organization_id, branch_id, role, display_name, email')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle()

        if (membershipError) {
            logger.error('page', 'Error de BD al obtener membership', membershipError as unknown as Error, { userId })
            throw membershipError
        }

        // Si no hay membership, el usuario necesita completar setup
        if (!membership) {
            logger.debug('page', 'No tiene membership, mostrando setup', { userId })
            setHasProfile(false)
            setUserProfile(null)
            if (shouldValidate) {
                throw new Error('Profile not ready yet')
            }
            return
        }

        // Mapear role de BD a rol de UI (owner → dueño, employee → empleado)
        const rolUI = membership.role === 'owner' ? 'dueño' : 'empleado'

        setUserProfile({
            id: membership.user_id,
            nombre: membership.display_name,
            rol: rolUI as 'dueño' | 'empleado',
            organization_id: membership.organization_id
        })
        setHasProfile(true)

        // Para dueños, verificar si ya tienen sucursales
        if (membership.role === 'owner') {
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
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        if (session?.user) fetchProfile(session.user.id)
        else setLoading(false)
    })

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
        const { data: asistencia } = await supabase
          .from('asistencia')
          .select('sucursal_id')
          .eq('empleado_id', session.user.id)
          .is('salida', null)
          .maybeSingle()

        if (asistencia?.sucursal_id) {
          setSucursalId(asistencia.sucursal_id)
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
