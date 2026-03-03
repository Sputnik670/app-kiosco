/**
 * ===============================================================================
 * SYNC STATUS COMPONENT - Indicador de estado de sincronización offline
 * ===============================================================================
 *
 * Muestra un indicador flotante del estado de sincronización de ventas offline.
 * Incluye:
 * - Badge con contador de ventas pendientes
 * - Estado de sincronización (idle, syncing, error)
 * - Lista expandible de ventas pendientes
 * - Botón para forzar sincronización
 *
 * ===============================================================================
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { Cloud, CloudOff, Loader2, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { offlineDB, type VentaPendiente } from "@/lib/offline/indexed-db"
import type { SyncStatus } from "@/types/app.types"

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface SyncStatusProps {
  /** Estado actual de sincronización */
  syncStatus: SyncStatus
  /** Cantidad de ventas pendientes */
  pendingCount: number
  /** Si está offline */
  isOffline: boolean
  /** Callback para forzar sincronización */
  onForceSyncNow?: () => Promise<void>
  /** Callback para reintentar ventas fallidas */
  onRetryFailed?: () => Promise<void>
  /** Posición del componente */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  /** Clase CSS adicional */
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function SyncStatusIndicator({
  syncStatus,
  pendingCount,
  isOffline,
  onForceSyncNow,
  onRetryFailed,
  position = "bottom-right",
  className,
}: SyncStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [pendingVentas, setPendingVentas] = useState<VentaPendiente[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  // Cargar ventas pendientes cuando se expande
  useEffect(() => {
    if (isExpanded && pendingCount > 0) {
      loadPendingVentas()
    }
  }, [isExpanded, pendingCount])

  const loadPendingVentas = useCallback(async () => {
    try {
      const ventas = await offlineDB.getAllVentasPendientes()
      setPendingVentas(ventas)
    } catch (error) {
      console.error("Error cargando ventas pendientes:", error)
    }
  }, [])

  const handleForceSyncNow = async () => {
    if (!onForceSyncNow || isSyncing) return
    setIsSyncing(true)
    try {
      await onForceSyncNow()
      await loadPendingVentas()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleRetryFailed = async () => {
    if (!onRetryFailed || isSyncing) return
    setIsSyncing(true)
    try {
      await onRetryFailed()
      await loadPendingVentas()
    } finally {
      setIsSyncing(false)
    }
  }

  // No mostrar si está online y no hay pendientes
  if (!isOffline && pendingCount === 0 && syncStatus === "idle") {
    return null
  }

  // Determinar estilo según estado
  const getStatusStyle = () => {
    if (isOffline) return { bg: "bg-orange-500", text: "text-white", icon: CloudOff }
    if (syncStatus === "syncing") return { bg: "bg-blue-500", text: "text-white", icon: Loader2 }
    if (syncStatus === "error") return { bg: "bg-red-500", text: "text-white", icon: AlertTriangle }
    if (pendingCount > 0) return { bg: "bg-amber-500", text: "text-white", icon: Cloud }
    return { bg: "bg-emerald-500", text: "text-white", icon: CheckCircle2 }
  }

  const statusStyle = getStatusStyle()
  const StatusIcon = statusStyle.icon

  // Posición del componente
  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  }

  // Contar ventas fallidas
  const failedCount = pendingVentas.filter((v) => v.estado === "failed").length

  return (
    <div className={cn("fixed z-50", positionClasses[position], className)}>
      <Card className={cn("shadow-lg border-0 overflow-hidden", statusStyle.bg)}>
        {/* Header - siempre visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center gap-2 px-4 py-3 transition-all",
            statusStyle.text
          )}
        >
          <StatusIcon
            className={cn("h-5 w-5", syncStatus === "syncing" && "animate-spin")}
          />

          <span className="font-semibold text-sm">
            {isOffline ? "SIN CONEXIÓN" : syncStatus === "syncing" ? "SINCRONIZANDO..." : pendingCount > 0 ? "VENTAS PENDIENTES" : "SINCRONIZADO"}
          </span>

          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-auto bg-white/20 text-white border-0">
              {pendingCount}
            </Badge>
          )}

          {pendingCount > 0 && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 ml-1" />
            ) : (
              <ChevronUp className="h-4 w-4 ml-1" />
            )
          )}
        </button>

        {/* Panel expandido */}
        {isExpanded && pendingCount > 0 && (
          <div className="bg-white p-4 space-y-3">
            {/* Lista de ventas pendientes */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {pendingVentas.map((venta) => (
                <div
                  key={venta.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-xs",
                    venta.estado === "failed" ? "bg-red-50" : "bg-slate-50"
                  )}
                >
                  <div>
                    <p className="font-semibold text-slate-700">
                      ${venta.monto_total.toLocaleString("es-AR")}
                    </p>
                    <p className="text-slate-500">
                      {venta.items.length} items • {new Date(venta.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      venta.estado === "pending" && "border-amber-300 text-amber-600",
                      venta.estado === "syncing" && "border-blue-300 text-blue-600",
                      venta.estado === "failed" && "border-red-300 text-red-600"
                    )}
                  >
                    {venta.estado === "pending" && "Pendiente"}
                    {venta.estado === "syncing" && "Sincronizando"}
                    {venta.estado === "failed" && `Fallido (${venta.intentos})`}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-2 border-t">
              {!isOffline && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={handleForceSyncNow}
                  disabled={isSyncing || syncStatus === "syncing"}
                >
                  <RefreshCw className={cn("h-3 w-3 mr-1", isSyncing && "animate-spin")} />
                  Sincronizar
                </Button>
              )}

              {failedCount > 0 && !isOffline && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleRetryFailed}
                  disabled={isSyncing || syncStatus === "syncing"}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Reintentar ({failedCount})
                </Button>
              )}
            </div>

            {isOffline && (
              <p className="text-xs text-center text-slate-500 italic">
                Se sincronizará automáticamente al recuperar conexión
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE COMPACTO (para usar en headers)
// ─────────────────────────────────────────────────────────────────────────────

interface SyncBadgeProps {
  syncStatus: SyncStatus
  pendingCount: number
  isOffline: boolean
  className?: string
}

export function SyncBadge({ syncStatus, pendingCount, isOffline, className }: SyncBadgeProps) {
  if (!isOffline && pendingCount === 0 && syncStatus === "idle") {
    return null
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px] font-bold",
        isOffline && "border-orange-300 bg-orange-50 text-orange-600",
        !isOffline && syncStatus === "syncing" && "border-blue-300 bg-blue-50 text-blue-600",
        !isOffline && syncStatus === "error" && "border-red-300 bg-red-50 text-red-600",
        !isOffline && syncStatus === "idle" && pendingCount > 0 && "border-amber-300 bg-amber-50 text-amber-600",
        className
      )}
    >
      {isOffline ? (
        <>
          <CloudOff className="h-3 w-3" />
          OFFLINE
        </>
      ) : syncStatus === "syncing" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          SYNC...
        </>
      ) : pendingCount > 0 ? (
        <>
          <Cloud className="h-3 w-3" />
          {pendingCount} PEND.
        </>
      ) : null}
    </Badge>
  )
}

export default SyncStatusIndicator
