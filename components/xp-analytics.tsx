'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart3,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  getXpSummaryAction,
  type XpSummaryRow,
} from '@/lib/actions/xp.actions'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RENDIMIENTO DEL EQUIPO — Vista del dueño
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Tabla de rendimiento con filtro por período (hoy, semana, mes).
 * Muestra por empleado: puntos ganados, perdidos, balance,
 * cantidad de incidentes, diferencia de caja acumulada.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

type Period = 'today' | 'week' | 'month'

interface XpAnalyticsProps {
  branchId?: string
}

export default function XpAnalytics({ branchId }: XpAnalyticsProps) {
  const [summary, setSummary] = useState<XpSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('week')

  const getDateRange = (p: Period): { from: string; to: string } => {
    const now = new Date()
    const to = now.toISOString()

    switch (p) {
      case 'today':
        return {
          from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          to,
        }
      case 'week':
        return {
          from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
          to,
        }
      case 'month':
        return {
          from: startOfMonth(now).toISOString(),
          to,
        }
    }
  }

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const range = getDateRange(period)
      const result = await getXpSummaryAction({
        dateFrom: range.from,
        dateTo: range.to,
        branchId,
      })
      if (result.success) {
        // Ordenar por balance descendente
        setSummary(result.summary.sort((a, b) => b.xp_balance - a.xp_balance))
      }
    } catch (err) {
      console.error('[XpAnalytics] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [period, branchId])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const periodLabel = (p: Period) => {
    switch (p) {
      case 'today': return 'Hoy'
      case 'week': return 'Esta semana'
      case 'month': return 'Este mes'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + selector de período */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          Rendimiento del equipo
        </h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <Calendar className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : summary.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <p className="text-sm text-slate-500">Sin datos para {periodLabel(period).toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summary.map((row, index) => (
            <Card key={row.user_id} className="p-4 border-2">
              <div className="flex items-start justify-between">
                {/* Info del empleado */}
                <div className="flex items-center gap-3">
                  <span className={`font-black text-lg w-6 text-center ${
                    index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-gray-300'
                  }`}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-sm">{row.display_name}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {/* Puntos ganados */}
                      {row.xp_gained > 0 && (
                        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <TrendingUp className="h-2.5 w-2.5" />
                          +{row.xp_gained}
                        </span>
                      )}
                      {/* Puntos perdidos */}
                      {row.xp_lost < 0 && (
                        <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <TrendingDown className="h-2.5 w-2.5" />
                          {row.xp_lost}
                        </span>
                      )}
                      {/* Incidentes */}
                      {row.incident_count > 0 && (
                        <span className="text-[9px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {row.incident_count} incid.
                          {row.incidents_resolved > 0 && (
                            <span className="text-emerald-600">({row.incidents_resolved} resuelt.)</span>
                          )}
                        </span>
                      )}
                      {/* Diferencia de caja */}
                      {row.total_variance > 200 && (
                        <span className="text-[9px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                          Caja: ${row.total_variance.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Balance */}
                <div className="text-right">
                  <p className={`text-lg font-black ${
                    row.xp_balance > 0 ? 'text-emerald-600' : row.xp_balance < 0 ? 'text-red-600' : 'text-slate-400'
                  }`}>
                    {row.xp_balance > 0 ? '+' : ''}{row.xp_balance}
                  </p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Balance</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
