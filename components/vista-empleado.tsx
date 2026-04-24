"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  LogOut, Loader2, ShoppingCart, Target,
  Trophy, AlertTriangle, Lock, MapPin
} from "lucide-react"
import { toast } from "sonner"
import { getEmployeeDashboardContextAction, type EmployeeDashboardContext } from "@/lib/actions/user.actions"
// attendance actions se usan vía RelojControl
import CajaVentas from "@/components/caja-ventas" 
import ArqueoCaja, { CajaDiaria } from "@/components/arqueo-caja" 
import MisionesEmpleado from "@/components/misiones-empleado"
import RegistrarMovimiento from "@/components/registrar-movimientos"
import GestionVencimientos from "@/components/gestion-vencimientos" 
import WidgetServicios from "@/components/widget-servicios" 
import WidgetSube from "@/components/widget-sube"
import RelojControl from "@/components/reloj-control"
import MisIncidentes from "@/components/mis-incidentes"
import dynamic from "next/dynamic"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// Scanner de tarjeta QR del empleado (lazy — solo se carga cuando toca FICHAR).
// Cada empleado escanea SU PROPIA tarjeta; la action valida ownership server-side.
const QREmpleadoScanner = dynamic(() => import("@/components/qr-empleado-scanner"), { ssr: false })

interface UserProfile {
    id: string
    rol: "dueño" | "empleado"
    nombre: string
    xp: number 
}

interface VistaEmpleadoProps {
    onBack: () => void 
    sucursalId: string 
}

export default function VistaEmpleado({ onBack, sucursalId }: VistaEmpleadoProps) {
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<"caja" | "misiones" | "vencimientos">("caja")
    const [turnoActivo, setTurnoActivo] = useState<CajaDiaria | null>(null)
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [sucursalNombre, setSucursalNombre] = useState("")
    const [organizationId, setOrganizationId] = useState("")
    const [isClockedIn, setIsClockedIn] = useState(false) 
    const [refreshKey, setRefreshKey] = useState(0)
    const [fichajeScannerOpen, setFichajeScannerOpen] = useState(false)

    const fetchContexto = useCallback(async () => {
        try {
            const result = await getEmployeeDashboardContextAction(sucursalId)

            if (!result.success) {
                toast.error("Error de conexión", { description: result.error })
                return
            }

            if (result.context) {
                // Mapear datos del contexto al estado local
                setUserProfile(result.context.profile as UserProfile | null)
                setSucursalNombre(result.context.branchName)
                setOrganizationId(result.context.organizationId)
                setIsClockedIn(result.context.isClockedIn)
                setTurnoActivo(result.context.activeShift as CajaDiaria | null)
            }
        } catch (error: any) {
            console.error('[VistaEmpleado] Excepción:', error)
            toast.error("Error de conexión con la sucursal", {
                description: error?.message || "Intentá recargar la página",
                duration: 5000,
            })
        } finally {
            setLoading(false)
        }
    }, [sucursalId])

    useEffect(() => {
        fetchContexto()
    }, [fetchContexto, refreshKey])

    const handleDataUpdated = () => setRefreshKey(prev => prev + 1)

    // --- Lógica de Gamificación ---
    const XP_PER_LEVEL = 3000
    const currentXP = userProfile?.xp || 0
    const level = Math.floor(currentXP / XP_PER_LEVEL) + 1
    const progressPercent = Math.min(((currentXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100, 100)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Conectando al Kiosco...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <div className="bg-slate-900 text-white p-6 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Trophy className="h-24 w-24 rotate-12 text-yellow-400" />
                </div>

                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h1 className="text-2xl font-black mb-1 uppercase tracking-tighter">{userProfile?.nombre || "Operador"}</h1>
                        <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-blue-400" />
                            <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">{sucursalNombre}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
                
                <div className="mt-8 relative z-10">
                    <div className="flex justify-between items-center mb-2">
                        <Badge className="bg-blue-600 text-white font-black text-[9px] px-2 py-0.5 border-0">LVL {level}</Badge>
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{currentXP} XP</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5 bg-white/10" />
                </div>
            </div>

            <div className="p-4 space-y-4 -mt-6">

                
                {/* RelojControl + scanner QR: el empleado toca el botón y escanea su
                    propia tarjeta para abrir o cerrar turno. La app valida que el QR
                    corresponde a su membership (anti-fraude). */}
                <div className="relative z-20">
                    {/* key={refreshKey}: al cerrar el scanner con éxito, handleDataUpdated
                        incrementa refreshKey y React remonta RelojControl, que vuelve a
                        leer el estado de fichaje. Sin esto, "Fuera de Servicio" queda
                        pegado aunque el turno ya esté abierto. */}
                    <RelojControl
                        key={refreshKey}
                        sucursalId={sucursalId}
                        sucursalNombre={sucursalNombre}
                        organizationId={organizationId}
                        onActionComplete={handleDataUpdated}
                        onScanQR={() => setFichajeScannerOpen(true)}
                    />
                </div>

                {/* Incidentes pendientes — siempre visibles si hay */}
                <MisIncidentes />

                {!isClockedIn ? (
                    <Card className="p-12 border-2 border-dashed border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col items-center text-center space-y-4 rounded-[2.5rem]">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center shadow-inner border-2">
                            <Lock className="h-10 w-10 text-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-black text-slate-400 uppercase text-sm tracking-tight">Interfaz Bloqueada</h3>
                            <p className="text-xs text-slate-400 font-bold px-6 leading-relaxed">
                                DEBES FICHAR TU ENTRADA PARA DESBLOQUEAR EL PANEL DE VENTAS Y EL CONTROL DE STOCK.
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-4">
                        {!turnoActivo && (
                            <ArqueoCaja 
                                onCajaAbierta={handleDataUpdated}
                                onCajaCerrada={handleDataUpdated}
                                turnoActivo={turnoActivo}
                                sucursalId={sucursalId} 
                            />
                        )}

                        {turnoActivo && (
                            <>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {([
                                        {id: "caja", label: "Ventas", icon: ShoppingCart},
                                        {id: "misiones", label: "Misiones", icon: Target},
                                        {id: "vencimientos", label: "Alertas", icon: AlertTriangle}
                                    ] as const).map(tab => (
                                        <Button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)} 
                                            variant={activeTab === tab.id ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "whitespace-nowrap rounded-full font-black text-xs uppercase tracking-widest h-10 px-5 border-2 transition-all",
                                                activeTab === tab.id ? "bg-slate-900 border-slate-900 shadow-lg" : "bg-white border-slate-100 text-slate-400"
                                            )}
                                        >
                                            <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
                                        </Button>
                                    ))}
                                </div>
                                
                                <div className="space-y-6 pb-20">
                                    {activeTab === "caja" && (
                                        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                                            <CajaVentas
                                                turnoId={turnoActivo.id}
                                                empleadoNombre={userProfile?.nombre || "Operador"}
                                                sucursalId={sucursalId}
                                                organizationId={organizationId}
                                                vendedorId={userProfile?.id}
                                            />
                                            
                                            {/* ═══════════════════════════════════════════════════════════════════ */}
                                            {/* 🔧 FIX APLICADO: Pasar turnoId y sucursalId a los widgets         */}
                                            {/* ═══════════════════════════════════════════════════════════════════ */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <WidgetSube 
                                                    turnoId={turnoActivo.id} 
                                                    sucursalId={sucursalId} 
                                                    onVentaRegistrada={handleDataUpdated} 
                                                />
                                                <WidgetServicios 
                                                    turnoId={turnoActivo.id} 
                                                    sucursalId={sucursalId} 
                                                    onVentaRegistrada={handleDataUpdated} 
                                                />
                                            </div>

                                            <RegistrarMovimiento 
                                                cajaId={turnoActivo.id} 
                                                onMovimientoRegistrado={handleDataUpdated} 
                                            />
                                            
                                            <div className="pt-10 border-t-2 border-dashed border-slate-200 mt-6">
                                                <ArqueoCaja 
                                                    onCajaAbierta={handleDataUpdated}
                                                    onCajaCerrada={handleDataUpdated}
                                                    turnoActivo={turnoActivo}
                                                    sucursalId={sucursalId}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {activeTab === "misiones" && (
                                        <MisionesEmpleado 
                                            turnoId={turnoActivo.id}
                                            empleadoId={userProfile?.id || ""} 
                                            sucursalId={sucursalId}
                                            onMisionesUpdated={handleDataUpdated}
                                            key={`misiones-${refreshKey}`}
                                        />
                                    )}
                                    
                                    {activeTab === "vencimientos" && (
                                        <GestionVencimientos 
                                            turnoId={turnoActivo.id}
                                            empleadoId={userProfile?.id || ""}
                                            onAccionRealizada={handleDataUpdated}
                                            sucursalId={sucursalId}
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Scanner de tarjeta QR del empleado. Se monta cuando se toca FICHAR.
                 showHoursOnExit={false}: al empleado no le mostramos sus horas
                 trabajadas (eso lo ve el dueño en sus reportes). */}
            {fichajeScannerOpen && (
                <QREmpleadoScanner
                    isOpen={fichajeScannerOpen}
                    onClose={() => setFichajeScannerOpen(false)}
                    branchId={sucursalId}
                    showHoursOnExit={false}
                    onResult={(result) => {
                        if (result.success) {
                            handleDataUpdated()
                        }
                    }}
                />
            )}
        </div>
    )
}
