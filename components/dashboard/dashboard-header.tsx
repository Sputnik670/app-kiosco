"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, MapPin, Settings, Sparkles, DollarSign, Package, TrendingUp, Users, ShieldCheck, Wrench } from "lucide-react"
import GestionSucursales from "@/components/gestion-sucursales"
import { CapitalBadges } from "@/components/capital-badges"
import { ThemeToggle } from "@/components/theme-toggle"
import type { DashboardTab } from "@/types/dashboard.types"

interface DashboardHeaderProps {
  sucursales: { id: string; nombre: string }[]
  currentSucursalId: string
  organizationId: string
  activeTab: DashboardTab
  onSucursalChange: (id: string) => void
  onTabChange: (tab: DashboardTab) => void
  onBack: () => void
  onSucursalesUpdate: () => void
  formatMoney: (amount: number | null) => string
}

const TABS = [
  { id: "ventas", label: "Ventas", icon: DollarSign },
  { id: "analisis", label: "Análisis", icon: TrendingUp },
  { id: "stock", label: "Stock", icon: Package },
  { id: "proveedores", label: "Proveedores", icon: Users },
  { id: "equipo", label: "Control Empleados", icon: ShieldCheck },
  { id: "ajustes", label: "Ajustes", icon: Wrench },
] as const

export function DashboardHeader({
  sucursales,
  currentSucursalId,
  organizationId,
  activeTab,
  onSucursalChange,
  onTabChange,
  onBack,
  onSucursalesUpdate,
  formatMoney,
}: DashboardHeaderProps) {
  return (
    <div className="bg-slate-900 text-white p-6 rounded-b-[3rem] shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 border border-white/10 backdrop-blur-md">
            <MapPin className="h-3.5 w-3.5 text-blue-400" />
            <Select value={currentSucursalId} onValueChange={onSucursalChange}>
              <SelectTrigger className="h-7 w-[150px] border-0 bg-transparent p-0 text-xs font-bold focus:ring-0">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ThemeToggle className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/20 text-white" />
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/20"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Configuración de Sucursales</DialogTitle>
              </DialogHeader>
              <GestionSucursales onUpdate={onSucursalesUpdate} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 uppercase">
            Torre de Control <Sparkles className="h-5 w-5 text-yellow-400" />
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            Panel Administrativo Global
          </p>
        </div>
        <CapitalBadges organizationId={organizationId} formatMoney={formatMoney} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-8 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((t) => (
          <Button
            key={t.id}
            onClick={() => onTabChange(t.id as DashboardTab)}
            variant={activeTab === t.id ? "secondary" : "ghost"}
            size="sm"
            className="rounded-full text-xs font-bold whitespace-nowrap"
          >
            <t.icon className="mr-1.5 h-3.5 w-3.5" /> {t.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
