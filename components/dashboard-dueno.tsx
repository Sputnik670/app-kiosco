"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { getOwnerStatsAction, getInventoryCriticalAction, type BusinessMetrics } from "@/lib/actions/dashboard.actions"
import { updateProductAction, deleteProductAction } from "@/lib/actions/product.actions"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, AlertTriangle, TrendingUp, Package, Search, Plus, 
  Loader2, DollarSign,  
  Calendar as CalendarIcon, 
  Eye, ShoppingBag, Clock, 
  Pencil, Trash2, History, ChevronDown, 
  Users, Sparkles, Printer, Briefcase, Receipt, ArrowDownRight, QrCode, MapPin, Settings, ChevronRight, Smartphone
} from "lucide-react" 
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts" 
import CrearProducto from "@/components/crear-producto"
import { AgregarStock } from "@/components/agregar-stock"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DateRange } from "react-day-picker"
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns" 
import { es } from "date-fns/locale" 
import AsignarMision from "@/components/asignar-mision" 
import { toast } from "sonner" 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import GestionProveedores from "@/components/gestion-proveedores"
import ControlSaldoProveedor from "@/components/control-saldo-proveedor"
import { InvitarEmpleado } from "@/components/invitar-empleado"
import { generarTicketPDF } from "@/lib/generar-ticket"
import HappyHour from "@/components/happy-hour"
import TeamRanking from "@/components/team-ranking"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import GestionSucursales from "@/components/gestion-sucursales"
import GenerarQRFichaje from "@/components/generar-qr-fichaje"
import RegistrarMovimiento from "@/components/registrar-movimientos"
import { CapitalBadges } from "@/components/capital-badges"

const UMBRAL_STOCK_BAJO = 5 
const UMBRAL_SALDO_BAJO = 10000 

interface DashboardDuenoProps {
  onBack: () => void
  sucursalId: string 
}

interface MetricaStock {
  capital: number
  unidades: number
  criticos: any[]
}

interface Producto {
    id: string
    nombre: string
    categoria: string | null
    precio_venta: number
    costo: number
    emoji: string | null
    codigo_barras?: string | null
    stock_disponible?: number
}

interface HistorialPrecio {
    fecha_cambio: string;
    precio_venta_anterior: number;
    precio_venta_nuevo: number;
    costo_anterior: number;
    costo_nuevo: number;
    perfiles?: { nombre: string };
}

interface VentaJoin {
    id: string
    fecha_venta: string
    metodo_pago: string
    precio_venta_historico?: number
    costo_unitario_historico?: number
    notas?: string | null
    cantidad: number 
    productos: { nombre: string; precio_venta: number; emoji: string } | null 
    caja_diaria_id?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 NUEVA INTERFAZ: Ventas unificadas (vista reportes_ventas_unificados)
// ═══════════════════════════════════════════════════════════════════════════
interface VentaUnificada {
    venta_id: string
    organization_id: string
    sucursal_id: string
    caja_diaria_id: string | null
    fecha_venta: string
    tipo_venta: 'producto' | 'servicio'
    descripcion: string
    icono: string | null
    referencia_id: string
    unidades_vendidas: number
    precio_unitario: number
    monto_total: number
    costo_unitario: number
    ganancia_neta: number
    metodo_pago: string
    notas: string | null
    timestamp_original: string
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFAZ LEGACY: Ventas de servicios (se mantiene para compatibilidad)
// ═══════════════════════════════════════════════════════════════════════════
interface VentaServicio {
    id: string
    fecha_venta: string
    metodo_pago: string
    tipo_servicio: string
    monto_carga: number
    comision: number
    total_cobrado: number
    notas?: string | null
    caja_diaria_id?: string
}

interface PaymentBreakdown {
  efectivo: number
  tarjeta: number
  transferencia: number
  otro: number
  billetera_virtual: number
}

interface TurnoAudit {
  id: string
  fecha_apertura: string
  fecha_cierre: string | null
  monto_inicial: number
  monto_final: number | null
  empleado_id: string
  sucursal_id: string
  perfiles: { nombre: string } | null 
  misiones: any[]
  movimientos_caja: any[]
}

interface AsistenciaRecord {
    id: string
    entrada: string
    salida: string | null
    empleado_id: string
    perfiles: { nombre: string } | null
    sucursal_id: string
}

export default function DashboardDueno({ onBack, sucursalId }: DashboardDuenoProps) {
  const [currentSucursalId, setCurrentSucursalId] = useState(sucursalId)
  const [organizationId, setOrganizationId] = useState<string>("")
  const [sucursales, setSucursales] = useState<{id: string, nombre: string}[]>([])

  const [activeTab, setActiveTab] = useState<"alerts" | "inventory" | "catalog" | "sales" | "finance" | "supervision" | "suppliers" | "team">("sales")
  const [supervisionTab, setSupervisionTab] = useState<"cajas" | "asistencia">("cajas")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 7)),
    to: endOfDay(new Date()),
  })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const [productos, setProductos] = useState<Producto[]>([])
  const [capitalEnRiesgo, setCapitalEnRiesgo] = useState<MetricaStock>({ capital: 0, unidades: 0, criticos: [] })
  const [ventasRecientes, setVentasRecientes] = useState<VentaJoin[]>([])
  const [totalVendido, setTotalVendido] = useState(0)
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({
      efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0, billetera_virtual: 0 
  })
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 NUEVOS ESTADOS: Ventas unificadas (Productos + Servicios)
  // ═══════════════════════════════════════════════════════════════════════════
  const [ventasUnificadas, setVentasUnificadas] = useState<VentaUnificada[]>([])

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADOS LEGACY: Ventas de servicios (se mantendrán hasta migración completa)
  // ═══════════════════════════════════════════════════════════════════════════
  const [ventasServicios, setVentasServicios] = useState<VentaServicio[]>([])
  const [totalServiciosVendido, setTotalServiciosVendido] = useState(0)
  const [paymentBreakdownServicios, setPaymentBreakdownServicios] = useState<PaymentBreakdown>({
      efectivo: 0, tarjeta: 0, transferencia: 0, otro: 0, billetera_virtual: 0
  })

  const [topProductos, setTopProductos] = useState<{name: string, count: number}[]>([])
  const [turnosAudit, setTurnosAudit] = useState<TurnoAudit[]>([])
  const [asistencias, setAsistencias] = useState<AsistenciaRecord[]>([])
  const [expandedTurnoId, setExpandedTurnoId] = useState<string | null>(null)
  const [expandedAsistenciaId, setExpandedAsistenciaId] = useState<string | null>(null)
  const [sugerencias, setSugerencias] = useState<any[]>([])

  // 🆕 NUEVO ESTADO: Business Metrics desde servidor
  const [biMetrics, setBiMetrics] = useState<BusinessMetrics>({
    bruto: 0, neta: 0, margen: 0, blanco: 0, negro: 0, ROI: 0
  })

  const [editingProduct, setEditingProduct] = useState<Producto | null>(null)
  const [managingStockId, setManagingStockId] = useState<string | null>(null)
  const [stockBatchList, setStockBatchList] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [showSalesDetail, setShowSalesDetail] = useState(false)
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false)
  const [historyData, setHistoryData] = useState<HistorialPrecio[]>([])

  const formatMoney = (amount: number | null) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount || 0)

  const fetchContext = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return
    const { data: perfil } = await supabase.from('perfiles').select('organization_id').eq('id', user.id).single()
    if(!perfil?.organization_id) return
    setOrganizationId(perfil.organization_id)

    const { data } = await supabase.from('sucursales').select('id, nombre').eq('organization_id', perfil.organization_id).order('created_at')
    if(data) setSucursales(data)
  }, [])

  useEffect(() => { fetchContext() }, [fetchContext])

  const fetchData = useCallback(async () => {
    if (!currentSucursalId || !organizationId) return

    // ═══════════════════════════════════════════════════════════════════════════
    // 🆕 NUEVA ARQUITECTURA: Acciones del servidor
    // ═══════════════════════════════════════════════════════════════════════════

    // PASO 1: Obtener estadísticas financieras (reemplaza 80+ líneas de cálculos)
    const statsResult = await getOwnerStatsAction(
      currentSucursalId,
      dateRange?.from?.toISOString() || '',
      dateRange?.to?.toISOString() || ''
    )

    if (statsResult.success) {
      setTotalVendido(statsResult.totalVendido)
      setPaymentBreakdown(statsResult.paymentBreakdown)
      setTopProductos(statsResult.topProductos)
      setBiMetrics(statsResult.businessMetrics)
    }

    // PASO 2: Obtener inventario crítico (reemplaza 90+ líneas de consultas)
    const inventoryResult = await getInventoryCriticalAction(currentSucursalId, organizationId)

    if (inventoryResult.success) {
      setSugerencias(inventoryResult.stockBajo)
      setCapitalEnRiesgo(inventoryResult.capitalEnRiesgo)
    }

    // PASO 3: Obtener lista completa de productos (necesario para catálogo)
    const { data: cat } = await supabase.from('productos').select('*').eq('organization_id', organizationId).order('nombre')
    const { data: stk } = await supabase.from('view_productos_con_stock').select('id, stock_disponible').eq('sucursal_id', currentSucursalId)

    if (cat) {
      const fusion = cat.map(p => ({ ...p, stock_disponible: stk?.find(s => s.id === p.id)?.stock_disponible || 0 }))
      setProductos(fusion)
    }

    // PASO 4: Obtener ventas unificadas (necesario para gráfico)
    let vuQ = (supabase as any).from('reportes_ventas_unificados').select('*').eq('sucursal_id', currentSucursalId)
    if (dateRange?.from) vuQ = vuQ.gte('fecha_venta', dateRange.from.toISOString())
    if (dateRange?.to) vuQ = vuQ.lte('fecha_venta', dateRange.to.toISOString())

    const { data: vuData } = await vuQ.order('fecha_venta', { ascending: false })
    if (vuData) {
      setVentasUnificadas(vuData)

      // Separar productos y servicios desde vista unificada
      const ventasProductos = vuData.filter((v: any) => v.tipo_venta === 'producto')
      const ventasDeServicios = vuData.filter((v: any) => v.tipo_venta === 'servicio')

      setVentasRecientes(ventasProductos as unknown as VentaJoin[])
      setVentasServicios(ventasDeServicios as unknown as VentaServicio[])

      // Calcular totales y breakdown de servicios (legacy UI)
      let totalServicios = 0
      const breakdownServicios: PaymentBreakdown = {
        efectivo: 0, tarjeta: 0, transferencia: 0, billetera_virtual: 0, otro: 0
      }

      ventasDeServicios.forEach((v: any) => {
        totalServicios += v.monto_total || 0
        const metodo = (v.metodo_pago || 'efectivo') as keyof PaymentBreakdown
        if (breakdownServicios.hasOwnProperty(metodo)) {
          breakdownServicios[metodo] += v.monto_total || 0
        } else {
          breakdownServicios.otro += v.monto_total || 0
        }
      })

      setTotalServiciosVendido(totalServicios)
      setPaymentBreakdownServicios(breakdownServicios)
    }

    // PASO 5: Obtener turnos de auditoría (necesario para supervisión)
    let cQ = supabase.from('caja_diaria').select(`*, perfiles(nombre), misiones(*), movimientos_caja(*)`).eq('sucursal_id', currentSucursalId)
    if (dateRange?.from) cQ = cQ.gte('fecha_apertura', dateRange.from.toISOString())
    if (dateRange?.to) cQ = cQ.lte('fecha_apertura', dateRange.to.toISOString())
    const { data: cData } = await cQ.order('fecha_apertura', { ascending: false }).returns<TurnoAudit[]>()
    setTurnosAudit(cData || [])

    // PASO 6: Obtener asistencias (necesario para supervisión)
    let aQ = supabase.from('asistencia').select('*, perfiles(nombre)').eq('sucursal_id', currentSucursalId)
    if (dateRange?.from) aQ = aQ.gte('entrada', dateRange.from.toISOString())
    if (dateRange?.to) aQ = aQ.lte('entrada', dateRange.to.toISOString())
    const { data: aData } = await aQ.order('entrada', { ascending: false }).limit(50)
    if (aData) setAsistencias(aData as unknown as AsistenciaRecord[])
  }, [currentSucursalId, organizationId, dateRange])

  useEffect(() => { setLoading(true); fetchData().finally(() => setLoading(false)) }, [fetchData])

  // ───────────────────────────────────────────────────────────────────────────
  // biMetrics ahora viene del servidor (getOwnerStatsAction) ✅
  // Eliminado useMemo redundante que calculaba bruto, neta, margen, blanco, negro
  // ───────────────────────────────────────────────────────────────────────────

  const matrizRentabilidad = useMemo(() => {
    const stars: any[] = [], bones: any[] = []
    productos.forEach(p => {
        const sales = ventasRecientes.filter(v => v.productos?.nombre === p.nombre).reduce((acc, curr) => acc + (curr.cantidad || 1), 0)
        const marg = p.costo > 0 ? ((p.precio_venta - p.costo) / p.costo) * 100 : 0
        if (sales > 5 && marg > 40) stars.push({ ...p, sales, marg: marg.toFixed(0) })
        else if (sales === 0) bones.push(p)
    })
    return { stars: stars.sort((a,b) => b.sales - a.sales), bones: bones.slice(0, 10) }
  }, [ventasRecientes, productos])

  const chartData = useMemo(() => {
    const map: Record<string, number> = {}
    ventasRecientes.slice().reverse().forEach(v => {
        const k = format(parseISO(v.fecha_venta), 'dd/MM')
        map[k] = (map[k] || 0) + (v.precio_venta_historico || v.productos?.precio_venta || 0) * (v.cantidad || 1)
    })
    return Object.entries(map).map(([fecha, total]) => ({ fecha, total }))
  }, [ventasRecientes])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from) return "Filtro de Fecha"
    const from = format(dateRange.from, 'dd/MM', { locale: es })
    if (!dateRange.to || format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) return `Día: ${from}`
    const to = format(dateRange.to, 'dd/MM', { locale: es })
    return `${from} - ${to}`
  }, [dateRange])

  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    setActionLoading(true)
    try {
        const result = await updateProductAction(editingProduct.id, {
            nombre: editingProduct.nombre,
            precio_venta: editingProduct.precio_venta,
            costo: editingProduct.costo,
            categoria: editingProduct.categoria || '',
            emoji: editingProduct.emoji ?? undefined,
            codigo_barras: editingProduct.codigo_barras ?? undefined,
        })

        if (!result.success) {
            toast.error(result.error || 'Error al actualizar producto')
            return
        }

        toast.success("Producto actualizado")
        setEditingProduct(null)
        fetchData()
    } catch (e: any) {
        toast.error(e.message)
    } finally {
        setActionLoading(false)
    }
  }

  const loadPriceHistory = async (pid: string) => {
    setLoading(true)
    const { data } = await supabase.from('historial_precios').select('*, perfiles(nombre)').eq('producto_id', pid).order('fecha_cambio', { ascending: false })
    setHistoryData(data as any || [])
    setShowPriceHistoryModal(true); setLoading(false)
  }

  const loadStockBatches = async (pid: string) => {
    setManagingStockId(pid)
    const { data } = await supabase.from('stock').select('*').eq('producto_id', pid).eq('tipo_movimiento', 'entrada').eq('sucursal_id', currentSucursalId).order('created_at', { ascending: false })
    setStockBatchList(data || [])
  }

  const handlePrintTurno = (t: TurnoAudit) => {
    const vT = ventasRecientes.filter(v => {
        const fV = parseISO(v.fecha_venta); 
        const fA = parseISO(t.fecha_apertura); 
        const fC = t.fecha_cierre ? parseISO(t.fecha_cierre) : new Date()
        return fV >= fA && fV <= fC
    })
    
    const totE = vT.filter(v => v.metodo_pago === 'efectivo').reduce((acc, curr) => acc + (curr.precio_venta_historico || curr.productos?.precio_venta || 0) * (curr.cantidad || 1), 0)
    const movimientosReales = t.movimientos_caja?.filter(m => m.categoria !== 'ventas') || []
    const gast = movimientosReales.filter(m => m.tipo === 'egreso').reduce((a,b) => a + b.monto, 0)
    const extra = movimientosReales.filter(m => m.tipo === 'ingreso').reduce((a,b) => a + b.monto, 0)
    const esp = t.monto_inicial + totE + extra - gast

    generarTicketPDF({
        empleado: t.perfiles?.nombre || "Empleado", 
        fechaApertura: format(parseISO(t.fecha_apertura), 'dd/MM/yyyy HH:mm'),
        fechaCierre: t.fecha_cierre ? format(parseISO(t.fecha_cierre), 'dd/MM/yyyy HH:mm') : null,
        montoInicial: t.monto_inicial,
        totalVentasEfectivo: totE,
        totalIngresos: extra,
        totalGastos: gast,
        cajaEsperada: esp,
        cajaReal: t.monto_final,
        diferencia: t.monto_final !== null ? t.monto_final - esp : null,
        gastos: movimientosReales
    })
    toast.success("Ticket generado")
  }

  const inventarioFiltrado = productos.filter(p => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || p.codigo_barras?.includes(searchQuery))

  // ═══════════════════════════════════════════════════════════════════════════
  // ✨ NOTA: totalVendido YA incluye productos + servicios desde vista unificada
  // Ya no es necesario sumar totalServiciosVendido por separado
  // ═══════════════════════════════════════════════════════════════════════════
  const totalGeneral = totalVendido  // Viene de ventasUnificadas (productos + servicios)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-900 text-white p-6 rounded-b-[3rem] shadow-2xl">
        <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/10"><ArrowLeft className="h-6 w-6" /></Button>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 border border-white/10 backdrop-blur-md">
                    <MapPin className="h-3.5 w-3.5 text-blue-400" />
                    <Select value={currentSucursalId} onValueChange={setCurrentSucursalId}>
                        <SelectTrigger className="h-7 w-[150px] border-0 bg-transparent p-0 text-xs font-bold focus:ring-0">
                            <SelectValue placeholder="Sucursal" />
                        </SelectTrigger>
                        <SelectContent>
                            {sucursales.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Dialog>
                    <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/20"><Settings className="h-4 w-4" /></Button></DialogTrigger>
                    <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Configuración de Sucursales</DialogTitle></DialogHeader><GestionSucursales onUpdate={fetchContext} /></DialogContent>
                </Dialog>
            </div>
        </div>
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 uppercase">Torre de Control <Sparkles className="h-5 w-5 text-yellow-400" /></h1>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Panel Administrativo Global</p>
            </div>
            <CapitalBadges
                organizationId={organizationId}
                formatMoney={formatMoney}
            />
        </div>
        <div className="flex gap-2 mt-8 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "sales", label: "Caja y Ventas", icon: DollarSign },
            { id: "inventory", label: "Stock", icon: Package },
            { id: "finance", label: "Panel de Utilidades", icon: TrendingUp },
            { id: "supervision", label: "Supervisión 360°", icon: Eye },
            { id: "catalog", label: "Alta de Catálogo", icon: Plus },
            { id: "suppliers", label: "Proveedores", icon: Users },
            { id: "team", label: "Mi Equipo", icon: Briefcase },
            { id: "alerts", label: "Advertencias de Stock", icon: AlertTriangle },
          ].map(t => (
            <Button key={t.id} onClick={() => setActiveTab(t.id as any)} variant={activeTab === t.id ? "secondary" : "ghost"} size="sm" className="rounded-full text-xs font-bold whitespace-nowrap"><t.icon className="mr-1.5 h-3.5 w-3.5" /> {t.label}</Button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {["sales", "supervision", "finance"].includes(activeTab) && (
            <Popover>
                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start h-14 border-2 shadow-sm bg-white font-black text-slate-700"><CalendarIcon className="mr-2 h-5 w-5 text-primary" /> {dateRangeLabel.toUpperCase()}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center"><Calendar mode="range" selected={dateRange} onSelect={r => { setDateRange(r); if(r?.to) setIsCalendarOpen(false) }} locale={es} /></PopoverContent>
            </Popover>
        )}

        {activeTab === "sales" && (
            <div className="space-y-4">
                {/* ═══════════════════════════════════════════════════════════════════════════
                    🆕 CARD PRINCIPAL: Total General (productos + servicios)
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <Card className="p-8 bg-gradient-to-br from-blue-600 to-indigo-800 text-white border-0 shadow-xl relative overflow-hidden">
                    <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">Facturación Total Sucursal</p>
                    <h2 className="text-5xl font-black">{formatMoney(totalGeneral)}</h2>
                    <div className="flex justify-between items-center mt-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/10 rounded-xl px-3 py-1.5">
                                <p className="text-[9px] text-blue-200 uppercase font-bold">Productos</p>
                                <p className="text-lg font-black">{formatMoney(totalVendido)}</p>
                            </div>
                            <div className="bg-indigo-700/50 rounded-xl px-3 py-1.5">
                                <p className="text-[9px] text-indigo-200 uppercase font-bold">Servicios</p>
                                <p className="text-lg font-black">{formatMoney(totalServiciosVendido)}</p>
                            </div>
                        </div>
                        <Button variant="secondary" size="sm" className="font-black text-[10px]" onClick={() => setShowSalesDetail(true)}>AUDITAR</Button>
                    </div>
                </Card>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    🆕 SECCIÓN: Productos Físicos
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-600" />
                        <h3 className="text-sm font-black text-slate-700 uppercase">Productos Físicos</h3>
                        <Badge variant="outline" className="text-[9px]">{ventasRecientes.length} ventas</Badge>
                    </div>
                    <Card className="p-5 border-2 shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Ingresos por Método de Pago</h4>
                        <div className="space-y-3">
                            {Object.entries(paymentBreakdown).map(([k, v]) => v > 0 && (
                                <div key={k}>
                                    <div className="flex justify-between text-xs font-black mb-1 uppercase">
                                        <span className="text-slate-600">{k.replace('_', ' ')}</span>
                                        <span className="font-mono">{formatMoney(v)}</span>
                                    </div>
                                    <Progress value={(v/totalVendido)*100} className="h-1.5 bg-slate-100" />
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    🆕 SECCIÓN: Servicios Virtuales
                    ═══════════════════════════════════════════════════════════════════════════ */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-sm font-black text-indigo-700 uppercase">Servicios Virtuales</h3>
                        <Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-700">{ventasServicios.length} cargas</Badge>
                    </div>
                    <Card className="p-5 border-2 border-indigo-100 bg-indigo-50/30 shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-indigo-600 mb-4 tracking-widest">Ingresos por Método de Pago</h4>
                        <div className="space-y-3">
                            {Object.entries(paymentBreakdownServicios).map(([k, v]) => v > 0 && (
                                <div key={k}>
                                    <div className="flex justify-between text-xs font-black mb-1 uppercase">
                                        <span className="text-indigo-700">{k.replace('_', ' ')}</span>
                                        <span className="font-mono text-indigo-900">{formatMoney(v)}</span>
                                    </div>
                                    <Progress value={(v/totalServiciosVendido)*100} className="h-1.5 bg-indigo-100" />
                                </div>
                            ))}
                            {totalServiciosVendido === 0 && (
                                <p className="text-xs text-indigo-400 italic text-center py-2">Sin ventas de servicios en este período</p>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Gráfico de evolución (solo productos por ahora) */}
                <Card className="p-5 border-2 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Evolución Diaria</h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="total" fill="oklch(0.6 0.2 250)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        )}

        {activeTab === "alerts" && (
            <div className="space-y-6 animate-in fade-in">
                <HappyHour criticos={capitalEnRiesgo.criticos} onDiscountApplied={fetchData} />
                <div className="grid grid-cols-2 gap-4">
                    <Card className="p-5 border-2 border-orange-200 bg-orange-50/50 shadow-sm">
                        <p className="text-[11px] font-black text-orange-600 uppercase mb-2">Riesgo Vencimiento</p>
                        <h3 className="text-3xl font-black text-slate-800">{formatMoney(capitalEnRiesgo.capital)}</h3>
                        <p className="text-[10px] font-bold text-orange-400 uppercase mt-2">{capitalEnRiesgo.unidades} UNIDADES CRÍTICAS</p>
                    </Card>
                    <Card className="p-5 border-2 border-red-200 bg-red-50/50 shadow-sm">
                        <p className="text-[11px] font-black text-red-600 uppercase mb-2">Stock Insuficiente</p>
                        <h3 className="text-3xl font-black text-slate-800">{productos.filter(p => (p.stock_disponible || 0) <= UMBRAL_STOCK_BAJO && p.categoria !== "Servicios").length}</h3>
                        <p className="text-[10px] font-bold text-red-400 uppercase mt-2">PRODUCTOS CRÍTICOS</p>
                    </Card>
                </div>
            </div>
        )}

        {activeTab === "supervision" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex bg-white p-1.5 rounded-2xl w-full max-w-sm mx-auto shadow-md border-2">
                    <button onClick={() => setSupervisionTab("cajas")} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", supervisionTab === "cajas" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600")}>Cierres de Caja</button>
                    <button onClick={() => setSupervisionTab("asistencia")} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", supervisionTab === "asistencia" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600")}>Asistencia</button>
                </div>

                {supervisionTab === "cajas" ? (
                    <div className="space-y-4">
                        {turnosAudit.map(t => {
                            const isOpen = !t.fecha_cierre; const isExpanded = expandedTurnoId === t.id
                            const totalGastosTurno = t.movimientos_caja?.filter(m => m.tipo === 'egreso' && m.categoria !== 'ventas').reduce((acc, m) => acc + m.monto, 0) || 0

                            return (
                                <Card key={t.id} className={cn("border-2 overflow-hidden transition-all rounded-2xl", isOpen ? "border-blue-400" : "border-slate-200")}>
                                    <div className="p-5 flex justify-between items-center bg-white cursor-pointer" onClick={() => setExpandedTurnoId(isExpanded ? null : t.id)}>
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-white text-lg">{t.perfiles?.nombre?.charAt(0)}</div>
                                            <div><p className="font-black text-sm text-slate-800 uppercase tracking-tight">{t.perfiles?.nombre || 'Empleado'}</p><p className="text-[11px] font-bold text-slate-400">{format(parseISO(t.fecha_apertura), 'dd MMM • HH:mm')} hs</p></div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {totalGastosTurno > 0 && <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[9px] font-black">-{formatMoney(totalGastosTurno)}</Badge>}
                                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-primary" onClick={(e) => { e.stopPropagation(); handlePrintTurno(t); }}><Printer className="h-5 w-5" /></Button>
                                            {isOpen ? <Badge className="bg-blue-600 animate-pulse text-[9px] h-4">EN CURSO</Badge> : <ChevronDown className={cn("h-5 w-5 text-slate-300 transition-transform", isExpanded && "rotate-180")} />}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="p-6 bg-slate-50 border-t-2 border-dashed space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-white rounded-2xl border shadow-sm text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Efectivo Final</p><p className="text-2xl font-black text-slate-900">{t.monto_final ? formatMoney(t.monto_final) : '---'}</p></div>
                                                <div className="p-4 bg-white rounded-2xl border shadow-sm text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Misiones</p><p className="text-2xl font-black text-slate-900">{t.misiones?.filter(m => m.es_completada).length} / {t.misiones?.length}</p></div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="h-3 w-3" /> Detalle de Productos Vendidos</h4>
                                                {ventasRecientes.filter(v => v.caja_diaria_id === t.id).length > 0 ? (
                                                    <div className="space-y-2">
                                                        {ventasRecientes.filter(v => v.caja_diaria_id === t.id).map((v) => (
                                                            <div key={v.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm">{v.productos?.emoji}</span>
                                                                    <p className="text-[10px] font-black text-slate-700 uppercase">{v.productos?.nombre}</p>
                                                                    <Badge variant="outline" className="text-[9px] py-0 h-4">{v.cantidad}u</Badge>
                                                                </div>
                                                                <p className="text-[11px] font-mono font-bold text-slate-600">{formatMoney((v.precio_venta_historico || v.productos?.precio_venta || 0) * v.cantidad)}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-[10px] italic text-slate-400 text-center py-2">Sin ventas registradas en este turno</p>}
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ArrowDownRight className="h-3 w-3" /> Otros Movimientos (Manuales)</h4>
                                                {t.movimientos_caja?.filter(m => m.categoria !== 'ventas').length > 0 ? (
                                                    <div className="space-y-2">
                                                        {t.movimientos_caja.filter(m => m.categoria !== 'ventas').map((m) => (
                                                            <div key={m.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                                                                <div>
                                                                    <p className="text-[11px] font-black text-slate-800 uppercase">{m.descripcion}</p>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{m.categoria} • {format(parseISO(m.created_at), 'HH:mm')} hs</p>
                                                                </div>
                                                                <span className={cn("font-black text-sm", m.tipo === 'egreso' ? "text-red-600" : "text-emerald-600")}>
                                                                    {m.tipo === 'egreso' ? '-' : '+'}{formatMoney(m.monto)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-[10px] italic text-slate-400 text-center py-2">Sin movimientos manuales en este turno</p>}
                                            </div>

                                            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {isOpen && <AsignarMision turnoId={t.id} empleadoId={t.empleado_id} sucursalId={currentSucursalId} onMisionCreated={fetchData} />}
                                                <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                                    <h4 className="text-[10px] font-black text-slate-900 uppercase mb-4">Ajuste de Caja (Dueño)</h4>
                                                    <RegistrarMovimiento cajaId={t.id} onMovimientoRegistrado={fetchData} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {asistencias.map((asist) => {
                             const hEntrada = parseISO(asist.entrada)
                             const hSalida = asist.salida ? parseISO(asist.salida) : null
                             const isExpanded = expandedAsistenciaId === asist.id
                             
                             const duracionMs = hSalida ? hSalida.getTime() - hEntrada.getTime() : null
                             const duracionHoras = duracionMs ? Math.floor(duracionMs / (1000 * 60 * 60)) : null
                             const duracionMinutos = duracionMs ? Math.floor((duracionMs % (1000 * 60 * 60)) / (1000 * 60)) : null
                             
                             return (
                                 <Card key={asist.id} className={cn("border-2 overflow-hidden transition-all rounded-2xl", !asist.salida ? "border-emerald-400" : "border-slate-200")}>
                                    <div className="p-5 flex justify-between items-center bg-white cursor-pointer" onClick={() => setExpandedAsistenciaId(isExpanded ? null : asist.id)}>
                                        <div className="flex items-center gap-4">
                                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center font-black text-white text-lg", asist.salida ? "bg-slate-400 shadow-inner" : "bg-emerald-500 animate-pulse shadow-lg shadow-emerald-200")}>{asist.perfiles?.nombre?.charAt(0)}</div>
                                            <div>
                                                <p className="font-black text-sm uppercase text-slate-800 leading-none mb-1">{asist.perfiles?.nombre}</p>
                                                <p className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase">{format(hEntrada, 'dd MMMM yyyy', {locale: es})}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {!asist.salida && <Badge className="bg-emerald-600 animate-pulse text-[9px] h-4">ACTIVO</Badge>}
                                            <ChevronDown className={cn("h-5 w-5 text-slate-300 transition-transform", isExpanded && "rotate-180")} />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-6 bg-slate-50 border-t-2 border-dashed space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-white rounded-2xl border shadow-sm">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Entrada</p>
                                                    <p className="text-2xl font-black text-emerald-600">{format(hEntrada, 'HH:mm')}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold mt-1">{format(hEntrada, 'dd/MM/yyyy')}</p>
                                                </div>
                                                <div className="p-4 bg-white rounded-2xl border shadow-sm">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Salida</p>
                                                    {hSalida ? (
                                                        <>
                                                            <p className="text-2xl font-black text-red-600">{format(hSalida, 'HH:mm')}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold mt-1">{format(hSalida, 'dd/MM/yyyy')}</p>
                                                        </>
                                                    ) : (
                                                        <p className="text-2xl font-black text-slate-300">---</p>
                                                    )}
                                                </div>
                                            </div>
                                            {duracionHoras !== null && duracionMinutos !== null && (
                                                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-100">
                                                    <p className="text-[10px] font-black text-blue-600 uppercase mb-2 text-center">Duración Total</p>
                                                    <p className="text-3xl font-black text-center text-blue-900">
                                                        {duracionHoras}h {duracionMinutos}m
                                                    </p>
                                                </div>
                                            )}
                                            <div className="text-center">
                                                <Badge variant={asist.salida ? "outline" : "default"} className={cn("font-mono font-bold border-2 text-sm px-4 py-2", !asist.salida && "bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm")}>
                                                    {asist.salida ? "Jornada Finalizada" : "EN CURSO"}
                                                </Badge>
                                            </div>
                                        </div>
                                    )}
                                 </Card>
                             )
                        })}
                    </div>
                )}
            </div>
        )}

        {activeTab === "finance" && (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-5 bg-emerald-50 border-2 border-emerald-200">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">Utilidad Neta Est.</p>
                        <h3 className="text-3xl font-black text-emerald-900">{formatMoney(biMetrics.neta)}</h3>
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 w-fit px-2 py-0.5 rounded"><TrendingUp className="h-3 w-3" /> ROI: {biMetrics.margen.toFixed(1)}%</div>
                    </Card>
                    <Card className="p-5 bg-blue-50 border-2 border-blue-200"><p className="text-[10px] font-black text-blue-600 uppercase mb-2">Ventas Blanco</p><h3 className="text-3xl font-black text-blue-900">{formatMoney(biMetrics.blanco)}</h3></Card>
                    <Card className="p-5 bg-slate-100 border-2 border-slate-300"><p className="text-[10px] font-black text-slate-500 uppercase mb-2">Ventas Efectivo</p><h3 className="text-3xl font-black text-slate-700">{formatMoney(biMetrics.negro)}</h3></Card>
                </div>
            </div>
        )}

        {activeTab === "inventory" && (
            <div className="space-y-4 animate-in fade-in">
                <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" /><Input placeholder="FILTRAR STOCK LOCAL..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-12 h-16 text-sm font-bold shadow-inner border-2 rounded-2xl" /></div>
                {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div> : (
                    <div className="grid gap-4">{inventarioFiltrado.map(item => (<Card key={item.id} className="p-5 border-2 shadow-sm hover:border-primary/40 rounded-2xl group"><div className="flex justify-between items-start mb-5"><div className="flex gap-4"><div className="text-4xl bg-slate-100 p-3 rounded-2xl">{item.emoji}</div><div><h4 className="font-black text-slate-800 uppercase text-sm">{item.nombre}</h4><p className="text-[10px] text-slate-400 font-black uppercase mt-1">{item.categoria}</p><div className="flex items-center gap-3 mt-3"><Badge className="bg-slate-900 text-white text-[11px] font-black px-3 shadow-md">${item.precio_venta}</Badge><button onClick={() => loadPriceHistory(item.id)} className="text-[10px] font-black text-primary uppercase"><History className="h-3 w-3 inline mr-1"/> Historial</button></div></div></div><div className="text-right"><p className={cn("text-3xl font-black tabular-nums", item.stock_disponible! <= UMBRAL_STOCK_BAJO ? "text-red-500" : "text-emerald-500")}>{item.stock_disponible}</p><button onClick={() => loadStockBatches(item.id)} className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 justify-end font-bold">Lotes <ChevronRight className="h-3 w-3"/></button></div></div><div className="flex gap-2"><AgregarStock producto={item} sucursalId={currentSucursalId} onStockAdded={fetchData} /><Button variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={() => setEditingProduct(item)}><Pencil className="h-4 w-4" /></Button></div></Card>))}</div>
                )}
            </div>
        )}
        
        {activeTab === "catalog" && <CrearProducto sucursalId={currentSucursalId} onProductCreated={() => { setActiveTab("inventory"); fetchData(); }} />}
        {activeTab === "suppliers" && <div className="space-y-6 animate-in fade-in"><ControlSaldoProveedor /><GestionProveedores sucursalId={currentSucursalId} organizationId={organizationId} /></div>}
        {activeTab === "team" && (
            <div className="space-y-6 animate-in fade-in">
                <TeamRanking />
                <InvitarEmpleado />
                <Card className="p-6 border-2">
                    <h3 className="text-lg font-black text-slate-800 uppercase mb-4 flex items-center gap-2"><QrCode className="h-5 w-5 text-blue-600" /> Generar QR de Fichaje</h3>
                    <p className="text-sm text-slate-600 mb-4">Genera códigos QR para que tus empleados puedan fichar entrada y salida escaneando el código del local.</p>
                    <GenerarQRFichaje />
                </Card>
            </div>
        )}
      </div>

      <Dialog open={!!editingProduct} onOpenChange={o => !o && setEditingProduct(null)}>
        <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader><DialogTitle className="font-black uppercase flex items-center gap-2"><Pencil className="h-5 w-5 text-primary"/> Editar Catálogo</DialogTitle></DialogHeader>
            {editingProduct && (
                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-4 gap-3"><div className="col-span-1"><Label className="text-[10px] font-black uppercase">Icono</Label><Input value={editingProduct.emoji ?? ""} onChange={e => setEditingProduct({...editingProduct, emoji: e.target.value})} className="text-center text-3xl h-16 rounded-2xl bg-slate-50" /></div><div className="col-span-3"><Label className="text-[10px] font-black uppercase">Nombre</Label><Input value={editingProduct.nombre} onChange={e => setEditingProduct({...editingProduct, nombre: e.target.value})} className="h-16 font-bold rounded-2xl" /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label className="text-[10px] font-black uppercase text-slate-400">Costo</Label><Input type="number" value={editingProduct.costo} onChange={e => setEditingProduct({...editingProduct, costo: parseFloat(e.target.value)})} className="rounded-xl h-12" /></div><div><Label className="text-[10px] font-black uppercase text-primary">Precio</Label><Input type="number" value={editingProduct.precio_venta} onChange={e => setEditingProduct({...editingProduct, precio_venta: parseFloat(e.target.value)})} className="border-primary/40 font-black h-12 rounded-xl text-lg" /></div></div>
                    <Button onClick={handleUpdateProduct} disabled={actionLoading} className="w-full h-14 font-black text-lg rounded-2xl shadow-lg">{actionLoading ? <Loader2 className="animate-spin"/> : "GUARDAR CAMBIOS"}</Button>
                    <Button variant="ghost" className="w-full text-red-500 text-[10px] font-black" onClick={async () => { if(confirm("¿Eliminar?")){ const result = await deleteProductAction(editingProduct.id); if (result.success) { toast.success("Producto eliminado"); fetchData(); setEditingProduct(null); } else { toast.error(result.error || 'Error al eliminar producto'); } } }}>ELIMINAR PRODUCTO</Button>
                </div>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPriceHistoryModal} onOpenChange={setShowPriceHistoryModal}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-3xl">
            <DialogHeader><DialogTitle className="font-black uppercase tracking-tighter flex items-center gap-2"><Clock className="h-5 w-5 text-primary"/> Historial Precios</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-4">
                {historyData.map((h, i) => (
                    <div key={i} className="p-4 border-l-4 border-primary bg-slate-50 rounded-xl relative"><div className="flex justify-between items-start mb-3"><p className="font-black text-slate-900 text-xs uppercase">{format(parseISO(h.fecha_cambio), 'dd MMM yyyy')}</p><p className="text-[9px] font-black text-slate-400">{format(parseISO(h.fecha_cambio), 'HH:mm')} HS</p></div><div className="grid grid-cols-2 gap-6"><div><p className="text-[9px] font-black uppercase">Venta</p><p className="text-lg font-black text-primary">{formatMoney(h.precio_venta_nuevo)}</p></div><div><p className="text-[9px] font-black uppercase">Costo</p><p className="text-lg font-black text-slate-900">{formatMoney(h.costo_nuevo)}</p></div></div><div className="mt-3 pt-3 border-t flex items-center gap-1.5"><span className="text-[9px] font-black text-slate-400 uppercase">Autor: {h.perfiles?.nombre || 'Admin'}</span></div></div>
                ))}
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!managingStockId} onOpenChange={o => !o && setManagingStockId(null)}>
        <DialogContent className="rounded-3xl">
            <DialogHeader><DialogTitle className="font-black uppercase flex items-center gap-2"><History className="h-5 w-5 text-orange-500"/> Lotes Locales</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 mt-4">
                {stockBatchList.map(b => (
                    <div key={b.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-orange-200"><div className="space-y-1"><p className="font-black text-xs">CANT: {b.cantidad} u.</p><p className="text-[10px] font-bold text-slate-400 uppercase">Ingreso: {format(parseISO(b.created_at), 'dd/MM/yy HH:mm')} hs</p></div><Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-50 rounded-full" onClick={async () => { if(confirm("¿Eliminar lote?")){ await supabase.from('stock').delete().eq('id', b.id); fetchData(); setManagingStockId(null); } }}><Trash2 className="h-5 w-5"/></Button></div>
                ))}
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSalesDetail} onOpenChange={setShowSalesDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl">
            <DialogHeader className="border-b pb-4"><DialogTitle className="font-black uppercase tracking-widest text-slate-800 flex items-center gap-2"><Receipt className="h-6 w-6 text-primary"/> Libro de Ventas</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto pr-3 space-y-3 mt-6">
                {ventasRecientes.map(v => (
                    <div key={v.id} className="flex justify-between items-center p-4 bg-white border-2 rounded-2xl shadow-sm"><div className="flex items-center gap-4"><span className="text-3xl bg-slate-100 w-12 h-12 flex items-center justify-center rounded-xl">{v.productos?.emoji}</span><div><p className="font-black uppercase text-slate-800 text-sm leading-none mb-1">{v.productos?.nombre}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{format(parseISO(v.fecha_venta), 'HH:mm')} hs • {v.metodo_pago?.replace('_',' ')}</p>{v.notas && <p className="text-[10px] font-black text-indigo-600 mt-1 italic tracking-tighter">💬 {v.notas}</p>}</div></div><div className="text-right"><p className="font-black text-emerald-600 text-lg leading-none mb-0.5">{formatMoney((v.precio_venta_historico || v.productos?.precio_venta || 0) * (v.cantidad || 1))}</p><p className="text-[10px] font-black text-slate-400 uppercase">{v.cantidad || 1} U.</p></div></div>
                ))}
            </div>
            <DialogFooter className="border-t pt-4"><Button variant="outline" className="w-full font-black text-[11px] h-12 rounded-2xl uppercase tracking-widest" onClick={() => setShowSalesDetail(false)}>Cerrar Auditoría</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}