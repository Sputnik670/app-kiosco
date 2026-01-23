"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, QrCode } from "lucide-react"
import DashboardDueno from "@/components/dashboard-dueno"
import VistaEmpleado from "@/components/vista-empleado"
import AuthForm from "@/components/auth-form"
import ProfileSetup from "@/components/profile-setup"
import SeleccionarSucursal from "@/components/seleccionar-sucursal"
import QRFichajeScanner from "@/components/qr-fichaje-scanner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

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
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [sucursalId, setSucursalId] = useState<string | null>(null)
  const router = useRouter()

  const fetchProfile = async (userId: string, shouldValidate: boolean = false) => {
    setLoading(true)
    try {
        console.log('[fetchProfile] Iniciando para userId:', userId)

        // 1. Obtener perfil básico
        const { data: perfil, error: perfilError } = await supabase
            .from('perfiles')
            .select('id, nombre, email, sucursal_id')
            .eq('id', userId)
            .single()

        console.log('[fetchProfile] Perfil:', perfil, 'Error:', perfilError)

        if (perfilError) {
            if (perfilError.code === 'PGRST116') {
                // No tiene perfil, mostrar setup
                console.log('[fetchProfile] No tiene perfil, mostrando setup')
                setHasProfile(false)
                setUserProfile(null)
                if (shouldValidate) {
                    throw new Error('Profile not ready yet')
                }
                return
            }
            throw perfilError
        }

        // 2. Obtener rol y organization_id desde user_organization_roles
        // Nota: Usamos array y tomamos el primero porque puede haber múltiples orgs
        const { data: rolesArray, error: roleError } = await supabase
            .from('user_organization_roles')
            .select('role, organization_id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)

        console.log('[fetchProfile] RolesArray:', rolesArray, 'Error:', roleError)

        const roleData = rolesArray?.[0]

        // Si no hay rol asignado, el usuario necesita completar setup
        if (roleError || !roleData) {
            console.log('[fetchProfile] No tiene rol asignado, mostrando setup')
            setHasProfile(false)
            setUserProfile(null)
            if (shouldValidate) {
                throw new Error('Profile not ready yet')
            }
            return
        }

        // Mapear role de BD a rol de UI
        const rolUI = roleData.role === 'owner' ? 'dueño' : 'empleado'
        console.log('[fetchProfile] Rol mapeado:', rolUI)

        setUserProfile({
            id: perfil.id,
            nombre: perfil.nombre,
            rol: rolUI as 'dueño' | 'empleado',
            organization_id: roleData.organization_id || ''
        })
        setHasProfile(true)
        console.log('[fetchProfile] Perfil cargado exitosamente')

    } catch (error: unknown) {
        console.error("[fetchProfile] Error:", error)
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
                if (result.data) {
                  // Use the data returned from the RPC - no need to re-fetch!
                  const isOwner = result.role === 'dueño';
                  const rpcData = result.data;

                  // Map RPC data structure to our state
                  const organizationId = isOwner
                    ? rpcData.organization?.id
                    : rpcData.role?.organization_id;

                  const sucursalId = isOwner
                    ? rpcData.sucursal?.id
                    : rpcData.role?.sucursal_id;

                  const perfilData = rpcData.perfil;

                  if (perfilData && organizationId) {
                    setUserProfile({
                      id: perfilData.id,
                      rol: result.role, // Use the role from result ('dueño' or 'empleado')
                      nombre: perfilData.nombre,
                      organization_id: organizationId,
                    });
                    setHasProfile(true);

                    // Set sucursalId to skip selection screen and go directly to dashboard
                    if (sucursalId) {
                      setSucursalId(sucursalId);
                    }

                    // State update will trigger re-render and show dashboard
                  } else {
                    // Fallback: data structure unexpected, fetch profile
                    console.warn('[ProfileSetup] Incomplete RPC data, falling back to fetchProfile');
                    await fetchProfile(session.user.id);
                  }
                } else {
                  // Fallback: no data returned, fetch profile
                  console.warn('[ProfileSetup] No RPC data returned, falling back to fetchProfile');
                  await fetchProfile(session.user.id);
                }
              } catch (error) {
                console.error('[ProfileSetup] Error processing profile:', error);
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