"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, UserCheck, Users, X, MapPin } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  getStaffManagementDataAction,
  inviteEmployeeAction,
  cancelInviteAction,
  removeEmployeeAction
} from "@/lib/actions/auth.actions"

interface Invite {
  id: string
  email: string
  created_at: string
  branch: { name: string } | null
}

interface Employee {
  id: string
  display_name: string
  email: string | null
  role: string
  branch_id: string | null
  branch: { name: string } | null
}

export function InvitarEmpleado() {
  const [email, setEmail] = useState("")
  const [selectedBranch, setSelectedBranch] = useState<string>("")
  const [branches, setBranches] = useState<{id: string, name: string}[]>([])
  const [loading, setLoading] = useState(false)
  const [invites, setInvites] = useState<Invite[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const cargarDatos = useCallback(async () => {
    const result = await getStaffManagementDataAction()

    if (!result.success) {
      toast.error("Error al cargar datos", { description: result.error })
      return
    }

    setBranches(result.branches)
    setInvites(result.invites)
    setEmployees(result.employees)
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    try {
      const result = await inviteEmployeeAction(email, selectedBranch)

      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }

      toast.success("Invitación enviada", { description: result.message })
      setEmail("")
      cargarDatos()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const borrarInvite = async (id: string) => {
    const result = await cancelInviteAction(id)

    if (!result.success) {
      toast.error("Error", { description: result.error })
      return
    }

    toast.info(result.message)
    cargarDatos()
  }

  const desvincularEmpleado = async (id: string, nombre: string) => {
    if (!confirm(`⚠️ ¿Quitar acceso a ${nombre}? El usuario no podrá operar más.`)) return

    const result = await removeEmployeeAction(id)

    if (!result.success) {
      toast.error("Error al desvincular", { description: result.error })
      return
    }

    toast.success(result.message)
    cargarDatos()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
        {/* PANEL IZQUIERDO: INVITACIÓN */}
        <Card className="p-8 border-2 shadow-xl rounded-[2rem] bg-white h-fit">
            <div className="flex items-center gap-4 mb-8">
                <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <UserCheck className="h-7 w-7" />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Alta de nuevo colaborador</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contratación Directa</p>
                </div>
            </div>

            <form onSubmit={handleInvite} className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Email del Colaborador</Label>
                    <Input
                        placeholder="ejemplo@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-14 font-bold rounded-2xl border-2 focus:ring-blue-500"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Sucursal de Trabajo (Base)</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                        <SelectTrigger className="h-14 rounded-2xl border-2 font-bold">
                            <SelectValue placeholder="-- SELECCIONAR KIOSCO --" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl font-bold">
                            {branches.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name.toUpperCase()}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-blue-100 transition-all active:scale-95">
                    {loading ? <Loader2 className="animate-spin" /> : "ENVIAR INVITACIÓN MAGIC LINK"}
                </Button>
            </form>

            {invites.length > 0 && (
                <div className="mt-10 space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 border-b-2 border-dashed pb-3 tracking-widest">Pendientes de Registro ({invites.length})</h3>
                    {invites.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-white shadow-sm">
                            <div>
                                <span className="text-xs font-black text-slate-700 block">{inv.email}</span>
                                <span className="text-[9px] font-bold text-blue-500 uppercase flex items-center gap-1">
                                    <MapPin className="h-2 w-2"/> {inv.branch?.name || 'General'}
                                </span>
                            </div>
                            <Button size="icon" variant="ghost" className="h-10 w-10 text-red-400 hover:bg-red-50 rounded-full" onClick={() => borrarInvite(inv.id)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Card>

        {/* PANEL DERECHO: EQUIPO ACTIVO */}
        <Card className="p-8 border-2 shadow-xl rounded-[2rem] bg-white h-fit">
            <div className="flex items-center gap-4 mb-8">
                <div className="h-14 w-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                    <Users className="h-7 w-7" />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Staff Operativo</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gestión de RRHH</p>
                </div>
            </div>

            <div className="space-y-4">
                {employees.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">No hay empleados registrados</p>
                    </div>
                ) : employees.map((emp) => (
                    <div key={emp.id} className="group flex items-center justify-between p-5 bg-white border-2 hover:border-emerald-500 transition-all rounded-[1.5rem] shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-sm uppercase">
                                {emp.display_name?.charAt(0) || 'E'}
                            </div>
                            <div>
                                <p className="font-black text-sm uppercase text-slate-800 leading-tight">{emp.display_name || 'Sin nombre'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-[9px] font-black bg-blue-50 text-blue-600 border-0">{emp.branch?.name?.toUpperCase()}</Badge>
                                    <span className="text-[10px] font-bold text-slate-300">{emp.email}</span>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 text-red-500 font-black text-[10px] uppercase hover:bg-red-50 rounded-xl transition-all"
                            onClick={() => desvincularEmpleado(emp.id, emp.display_name)}
                        >
                            Dar de Baja
                        </Button>
                    </div>
                ))}
            </div>
        </Card>
    </div>
  )
}
