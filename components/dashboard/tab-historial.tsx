"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ShoppingCart, Smartphone, Star, Loader2,
  PackageX, Trash2, AlertTriangle,
  Users, CheckCircle2, XCircle, Clock
} from "lucide-react"
import { format, parseISO, differenceInMinutes } from "date-fns"
import { es } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import type { TabBaseProps } from "@/types/dashboard.types"

type HistorialSection = "movimientos" | "inventario" | "equipo"

interface SaleRecord {
  id: string
  type: 'product' | 'service'
  description: string
  emoji: string | null
  total: number
  date: string
  paymentMethod: string
  quantity: number
}

interface ExpiredRecord {
  id: string
  productName: string
  emoji: string | null
  quantity: number
  expirationDate: string
  status: string // 'damaged' = mermado, 'available' = pendiente
  valueAtRisk: number
}

interface EmployeeRecord {
  userId: string
  name: string
  totalShifts: number
  totalAttendance: number
  avgHoursPerShift: number
  missionsCompleted: number
  missionsTotal: number
  cashDifferences: number // total de diferencias de caja
}

interface ProductRanking {
  name: string
  emoji: string | null
  totalSold: number
  totalRevenue: number
}

export function TabHistorial({
  sucursalId,
  organizationId,
  formatMoney,
}: TabBaseProps) {
  const [section, setSection] = useState<HistorialSection>("movimientos")
  const [loading, setLoading] = useState(true)

  // Movimientos
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [ranking, setRanking] = useState<ProductRanking[]>([])

  // Inventario resuelto
  const [expiredItems, setExpiredItems] = useState<ExpiredRecord[]>([])

  // Equipo
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])

  // ─── Fetch Movimientos ───────────────────────────────────────────────
  const fetchMovimientos = useCallback(async () => {
    if (!sucursalId) return
    setLoading(true)

    try {
      // Ventas de productos (últimas 100)
      const { data: salesData } = await supabase
        .from("sales")
        .select("id, total, payment_method, created_at, sale_items(quantity, unit_price, products(name, emoji))")
        .eq("branch_id", sucursalId)
        .order("created_at", { ascending: false })
        .limit(100)

      const productSales: SaleRecord[] = (salesData || []).map((s) => {
        const items = s.sale_items as unknown as Array<{
          quantity: number; unit_price: number; products: { name: string; emoji?: string } | null
        }> | null
        const firstItem = items && items.length > 0 ? items[0] : null
        return {
          id: s.id,
          type: 'product' as const,
          description: firstItem?.products?.name || 'Producto',
          emoji: firstItem?.products?.emoji || null,
          total: Number(s.total) || 0,
          date: s.created_at,
          paymentMethod: s.payment_method || 'cash',
          quantity: items ? items.reduce((sum, i) => sum + (i.quantity || 0), 0) : 0,
        }
      })

      // Ventas de servicios (últimas 100)
      const { data: svcData } = await supabase
        .from("service_sales")
        .select("id, service_type, total_collected, payment_method, created_at, amount_charged, commission")
        .eq("branch_id", sucursalId)
        .order("created_at", { ascending: false })
        .limit(100)

      const serviceSales: SaleRecord[] = (svcData || []).map((s) => ({
        id: s.id,
        type: 'service' as const,
        description: s.service_type || 'Servicio',
        emoji: null,
        total: Number(s.total_collected) || 0,
        date: s.created_at,
        paymentMethod: s.payment_method || 'cash',
        quantity: 1,
      }))

      // Combinar y ordenar por fecha
      const allSales = [...productSales, ...serviceSales]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setSales(allSales)

      // Ranking de productos más vendidos
      const productCounts: Record<string, ProductRanking> = {}
      ;(salesData || []).forEach((s) => {
        const items = s.sale_items as unknown as Array<{
          quantity: number; unit_price: number; products: { name: string; emoji?: string } | null
        }> | null
        ;(items || []).forEach((item) => {
          const name = item.products?.name || 'Desconocido'
          if (!productCounts[name]) {
            productCounts[name] = { name, emoji: item.products?.emoji || null, totalSold: 0, totalRevenue: 0 }
          }
          productCounts[name].totalSold += item.quantity || 0
          productCounts[name].totalRevenue += (item.quantity || 0) * (item.unit_price || 0)
        })
      })

      const rankingList = Object.values(productCounts)
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 10)
      setRanking(rankingList)
    } catch (err) {
      console.error('[Historial] Error cargando movimientos:', err)
    } finally {
      setLoading(false)
    }
  }, [sucursalId])

  // ─── Fetch Inventario Resuelto ─────────────────────────────────────────
  const fetchInventario = useCallback(async () => {
    if (!sucursalId) return
    setLoading(true)

    try {
      // Lotes mermados (damaged) + vencidos aún disponibles
      const { data } = await supabase
        .from("stock_batches")
        .select("id, quantity, expiration_date, status, product_id, unit_cost, products(name, emoji, sale_price)")
        .eq("branch_id", sucursalId)
        .not("expiration_date", "is", null)
        .in("status", ["damaged", "available"])
        .order("expiration_date", { ascending: false })
        .limit(100)

      const items: ExpiredRecord[] = (data || [])
        .filter(d => {
          // Solo los que realmente vencieron o fueron mermados
          if (d.status === 'damaged') return true
          if (d.expiration_date && new Date(d.expiration_date) < new Date()) return true
          return false
        })
        .map(d => {
          const product = d.products as unknown as { name: string; emoji?: string; sale_price?: number } | null
          return {
            id: d.id,
            productName: product?.name || 'Producto',
            emoji: product?.emoji || null,
            quantity: Number(d.quantity) || 0,
            expirationDate: d.expiration_date || '',
            status: d.status || 'available',
            valueAtRisk: (Number(d.quantity) || 0) * (Number(product?.sale_price) || Number(d.unit_cost) || 0),
          }
        })

      setExpiredItems(items)
    } catch (err) {
      console.error('[Historial] Error cargando inventario:', err)
    } finally {
      setLoading(false)
    }
  }, [sucursalId])

  // ─── Fetch Equipo ───────────────────────────────────────────────────────
  const fetchEquipo = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)

    try {
      // Obtener empleados de la organización
      const { data: members } = await supabase
        .from("memberships")
        .select("user_id, display_name, role")
        .eq("organization_id", organizationId)
        .eq("is_active", true)

      if (!members || members.length === 0) {
        setEmployees([])
        setLoading(false)
        return
      }

      const employeeRecords: EmployeeRecord[] = []

      for (const member of members) {
        // Asistencias
        const { data: attendance } = await supabase
          .from("attendance")
          .select("id, check_in, check_out")
          .eq("user_id", member.user_id)
          .eq("branch_id", sucursalId)
          .order("check_in", { ascending: false })
          .limit(50)

        const totalAttendance = attendance?.length || 0
        let totalMinutes = 0
        ;(attendance || []).forEach(a => {
          if (a.check_in && a.check_out) {
            totalMinutes += differenceInMinutes(parseISO(a.check_out), parseISO(a.check_in))
          }
        })
        const completedShifts = (attendance || []).filter(a => a.check_out).length
        const avgHours = completedShifts > 0 ? totalMinutes / completedShifts / 60 : 0

        // Turnos de caja
        const { data: cashRegisters } = await supabase
          .from("cash_registers")
          .select("id, opening_amount, closing_amount")
          .eq("opened_by", member.user_id)
          .eq("branch_id", sucursalId)
          .eq("is_open", false)
          .limit(50)

        const totalShifts = cashRegisters?.length || 0

        // Diferencias de caja (simplificado: suma de |closing - opening|)
        let cashDiff = 0
        ;(cashRegisters || []).forEach(cr => {
          if (cr.closing_amount !== null && cr.opening_amount !== null) {
            // Solo contar si hay diferencia significativa
            const diff = Math.abs(Number(cr.closing_amount) - Number(cr.opening_amount))
            if (diff > 100) cashDiff += diff
          }
        })

        // Misiones
        const { data: missions } = await supabase
          .from("missions")
          .select("id, is_completed")
          .in("cash_register_id", (cashRegisters || []).map(c => c.id))

        const missionsTotal = missions?.length || 0
        const missionsCompleted = (missions || []).filter(m => m.is_completed).length

        employeeRecords.push({
          userId: member.user_id,
          name: member.display_name || 'Empleado',
          totalShifts,
          totalAttendance,
          avgHoursPerShift: Math.round(avgHours * 10) / 10,
          missionsCompleted,
          missionsTotal,
          cashDifferences: cashDiff,
        })
      }

      setEmployees(employeeRecords)
    } catch (err) {
      console.error('[Historial] Error cargando equipo:', err)
    } finally {
      setLoading(false)
    }
  }, [sucursalId, organizationId])

  // ─── Effect: cargar datos según sección ──────────────────────────────
  useEffect(() => {
    if (section === "movimientos") fetchMovimientos()
    else if (section === "inventario") fetchInventario()
    else if (section === "equipo") fetchEquipo()
  }, [section, fetchMovimientos, fetchInventario, fetchEquipo])

  // ─── Helpers ──────────────────────────────────────────────────────────
  const paymentLabel = (method: string) => {
    const map: Record<string, string> = {
      cash: '💵', card: '💳', transfer: '🏦', wallet: '📱',
    }
    return map[method] || '💵'
  }

  const starRating = (index: number, total: number) => {
    if (total === 0) return 0
    // Top 1 = 5 stars, top 2 = 4, etc.
    if (index === 0) return 5
    if (index === 1) return 4
    if (index <= 3) return 3
    if (index <= 6) return 2
    return 1
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {([
          { id: "movimientos", label: "Movimientos", icon: ShoppingCart },
          { id: "inventario", label: "Inventario", icon: PackageX },
          { id: "equipo", label: "Equipo", icon: Users },
        ] as const).map(t => (
          <Button
            key={t.id}
            variant={section === t.id ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs font-bold flex-1"
            onClick={() => setSection(t.id)}
          >
            <t.icon className="mr-1 h-3.5 w-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

      {/* ═══ MOVIMIENTOS ═══ */}
      {!loading && section === "movimientos" && (
        <div className="space-y-4">
          {/* Ranking */}
          {ranking.length > 0 && (
            <Card className="p-4 border-2 border-yellow-200 bg-yellow-50/50">
              <h4 className="text-[11px] font-black text-yellow-700 uppercase mb-3 flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> Ranking de Productos
              </h4>
              <div className="space-y-2">
                {ranking.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg w-7 text-center font-black text-slate-400">{i + 1}</span>
                      <span className="text-lg">{p.emoji || '📦'}</span>
                      <div>
                        <p className="text-sm font-bold leading-tight">{p.name}</p>
                        <p className="text-[10px] text-slate-500">{p.totalSold} vendidos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: starRating(i, ranking.length) }).map((_, si) => (
                        <Star key={si} className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      ))}
                      {Array.from({ length: 5 - starRating(i, ranking.length) }).map((_, si) => (
                        <Star key={si} className="h-3 w-3 text-slate-200" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Lista de ventas */}
          <Card className="border-2">
            <div className="p-4 border-b">
              <h4 className="text-[11px] font-black text-slate-600 uppercase">
                Últimas Ventas ({sales.length})
              </h4>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {sales.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">Sin ventas registradas</p>
              )}
              {sales.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">
                      {s.type === 'service' ? <Smartphone className="h-5 w-5 text-indigo-500" /> : (s.emoji || '📦')}
                    </span>
                    <div>
                      <p className="text-sm font-bold leading-tight">
                        {s.description}
                        {s.quantity > 1 && <span className="text-slate-400 font-normal"> ×{s.quantity}</span>}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {format(parseISO(s.date), "dd MMM HH:mm", { locale: es })} · {paymentLabel(s.paymentMethod)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-slate-800">{formatMoney(s.total)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ INVENTARIO RESUELTO ═══ */}
      {!loading && section === "inventario" && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 border-2 border-red-200 bg-red-50/50">
              <p className="text-[10px] font-black text-red-600 uppercase">Mermados</p>
              <p className="text-2xl font-black text-slate-800">
                {expiredItems.filter(e => e.status === 'damaged').length}
              </p>
              <p className="text-[9px] text-red-400">lotes descartados</p>
            </Card>
            <Card className="p-4 border-2 border-orange-200 bg-orange-50/50">
              <p className="text-[10px] font-black text-orange-600 uppercase">Capital Perdido</p>
              <p className="text-2xl font-black text-slate-800">
                {formatMoney(expiredItems.filter(e => e.status === 'damaged').reduce((s, e) => s + e.valueAtRisk, 0))}
              </p>
              <p className="text-[9px] text-orange-400">en productos mermados</p>
            </Card>
          </div>

          {/* Lista */}
          <Card className="border-2">
            <div className="p-4 border-b">
              <h4 className="text-[11px] font-black text-slate-600 uppercase">
                Registro de Vencimientos y Mermas
              </h4>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {expiredItems.length === 0 && (
                <div className="p-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Sin registros de mermas o vencimientos</p>
                </div>
              )}
              {expiredItems.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{item.emoji || '📦'}</span>
                    <div>
                      <p className="text-sm font-bold leading-tight">{item.productName}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.quantity} u. · venció {item.expirationDate ? format(parseISO(item.expirationDate), 'dd/MM/yyyy') : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">{formatMoney(item.valueAtRisk)}</p>
                    <Badge className={`text-[8px] ${item.status === 'damaged' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                      {item.status === 'damaged' ? 'MERMADO' : 'PENDIENTE'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ EQUIPO ═══ */}
      {!loading && section === "equipo" && (
        <div className="space-y-3">
          {employees.length === 0 && (
            <Card className="p-8 text-center border-2">
              <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sin registros de empleados</p>
            </Card>
          )}
          {employees.map((emp) => {
            const missionRate = emp.missionsTotal > 0
              ? Math.round((emp.missionsCompleted / emp.missionsTotal) * 100)
              : 0
            return (
              <Card key={emp.userId} className="p-4 border-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-black text-slate-800">{emp.name}</h4>
                  <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                    {emp.totalShifts} turnos
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Asistencia */}
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <p className="text-[9px] font-black text-slate-500 uppercase">Asistencia</p>
                    </div>
                    <p className="text-lg font-black text-slate-800">{emp.totalAttendance}</p>
                    <p className="text-[9px] text-slate-400">
                      fichajes · {emp.avgHoursPerShift}h promedio
                    </p>
                  </div>

                  {/* Misiones */}
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <p className="text-[9px] font-black text-slate-500 uppercase">Misiones</p>
                    </div>
                    <p className="text-lg font-black text-slate-800">
                      {emp.missionsCompleted}/{emp.missionsTotal}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {missionRate}% cumplimiento
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
