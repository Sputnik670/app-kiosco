"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, User as UserIcon, Store, Check, Lock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  checkInvitationAction,
  completeProfileSetupAction
} from "@/lib/actions/auth.actions"
import type { User } from "@supabase/supabase-js"

interface ProfileSetupProps {
  user: User
  inviteToken?: string | null
  onProfileCreated: (result: { role: "dueño" | "empleado"; data?: Record<string, unknown> }) => void
}

export default function ProfileSetup({ user, inviteToken: propToken, onProfileCreated }: ProfileSetupProps) {
  const [selectedRole, setSelectedRole] = useState<"dueño" | "empleado" | null>(null)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(user?.email?.split('@')[0] || "Usuario")
  const [password, setPassword] = useState("")
  const [checkingInvitation, setCheckingInvitation] = useState(true)
  const [invitacionData, setInvitacionData] = useState<{ organization_id: string; branch_id: string | null; token: string } | null>(null)

  // ──────────────────────────────────────────────────────────────────────────
  // 1. VERIFICACIÓN DE INVITACIÓN (REFACTORIZADO)
  // Detecta invitación por 3 vías: propToken (URL), user_metadata, o email
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkInvitation = async () => {
      if (!user?.email) {
        setCheckingInvitation(false)
        return
      }

      try {
        // Extraer invite_token del user_metadata (Supabase lo guarda al aceptar invite)
        // Esto cubre el caso donde el usuario fue invitado, cerró el browser,
        // y vuelve a entrar — el token ya no está en la URL pero sí en metadata
        const metadataToken = user.user_metadata?.invite_token as string | undefined
        const tokenToCheck = propToken || metadataToken || undefined

        const result = await checkInvitationAction(user.email, tokenToCheck)

        if (!result.success) {
          console.error("Error buscando invitación:", result.error)
          setCheckingInvitation(false)
          return
        }

        if (result.invitation) {
          // Pre-configurar como empleado
          setSelectedRole('empleado')
          setInvitacionData({
            organization_id: result.invitation.organization_id,
            branch_id: result.invitation.branch_id,
            token: result.invitation.token
          })
          toast.info("Invitación detectada", { description: "Tu cuenta será vinculada a la organización." })
        }
      } catch (error) {
        console.error("Error verificando invitación:", error)
      } finally {
        setCheckingInvitation(false)
      }
    }

    checkInvitation()
  }, [user, propToken])

  // ──────────────────────────────────────────────────────────────────────────
  // 2. GUARDADO DE PERFIL (REFACTORIZADO)
  // ──────────────────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    // Validaciones
    if (!selectedRole) {
      toast.error("Selección Requerida", { description: "Por favor, selecciona tu rol." })
      return
    }
    if (!name.trim()) {
      toast.error("Nombre requerido")
      return
    }
    if (password && password.length < 8) {
      toast.error("La contraseña es muy corta", { description: "Debe tener al menos 8 caracteres." })
      return
    }

    setLoading(true)

    try {
      // ✅ PASO 1: Establecer contraseña en Supabase Auth (SOLO si el usuario la ingresó)
      // Usuarios que se registraron con email+contraseña ya la tienen configurada.
      // Solo quienes entraron por Magic Link (empleados invitados) necesitan crear una.
      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: password
        })

        if (pwdError) throw pwdError
      }

      // ✅ PASO 2: Completar configuración de perfil (SERVER ACTION)
      const result = await completeProfileSetupAction({
        userId: user.id,
        email: user.email ?? "",
        name: name.trim(),
        role: selectedRole,
        inviteToken: invitacionData?.token || propToken || undefined
      })

      if (!result.success) {
        toast.error("Error", { description: result.error })
        return
      }

      if (result.role) {
        toast.success("¡Cuenta configurada!", { description: result.message || "Ya tienes acceso y contraseña." })
        // Pass the entire result including data from RPC
        onProfileCreated({ role: result.role!, data: result.data as unknown as Record<string, unknown> })
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se pudo completar el registro."
      toast.error("Error", { description: message })
    } finally {
      setLoading(false)
    }
  }

  if (checkingInvitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 bg-white/50 backdrop-blur-sm p-6 rounded-[2rem] shadow-xl border border-white/20">

        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Completar Perfil</h1>
          <p className="text-slate-500 text-xs font-medium px-4">Último paso: elegí tu nombre y tu rol para empezar.</p>
        </div>

        <div className="space-y-4">
          {/* Input Nombre */}
          <div className="space-y-1.5">
            <label htmlFor="user-name" className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nombre</label>
            <input
              id="user-name"
              type="text"
              placeholder="Tu nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-12 w-full rounded-xl border-2 bg-white px-4 font-bold focus:border-primary focus:outline-none transition-all"
            />
          </div>

          {/* Input Contraseña — Solo para usuarios que entraron por Magic Link (no tienen contraseña aún) */}
          {invitacionData && (
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Crear Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-300" />
                <input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-12 w-full rounded-xl border-2 bg-white pl-10 pr-4 font-bold focus:border-primary focus:outline-none transition-all"
                />
              </div>
              <p className="text-[9px] text-slate-400 font-bold ml-1">
                ⚠️ La usarás para entrar al kiosco mañana.
              </p>
            </div>
          )}
        </div>

        {/* Selector de Roles */}
        <div className="space-y-3 pt-2">
          {!invitacionData && (
            <Card
              className={cn(
                "p-4 cursor-pointer border-2 transition-all rounded-xl",
                selectedRole === "dueño" ? "border-primary bg-primary/5" : "hover:border-slate-300 bg-white"
              )}
              onClick={() => setSelectedRole("dueño")}
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg"><Store className="h-5 w-5 text-primary" /></div>
                <div>
                  <h2 className="font-bold text-xs uppercase">Soy Dueño</h2>
                  <p className="text-[9px] text-slate-400">Crear nueva organización</p>
                </div>
                {selectedRole === "dueño" && <Check className="ml-auto h-4 w-4 text-primary"/>}
              </div>
            </Card>
          )}

          <Card
            className={cn(
              "p-4 cursor-pointer border-2 transition-all rounded-xl",
              selectedRole === "empleado" ? "border-slate-800 bg-slate-50" : "hover:border-slate-300 bg-white"
            )}
            onClick={() => setSelectedRole("empleado")}
          >
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-2 rounded-lg"><UserIcon className="h-5 w-5 text-white" /></div>
              <div>
                <h2 className="font-bold text-xs uppercase">Soy Empleado</h2>
                <p className="text-[9px] text-slate-400">Tengo una invitación</p>
              </div>
              {selectedRole === "empleado" && <Check className="ml-auto h-4 w-4 text-slate-800"/>}
            </div>
          </Card>
        </div>

        <Button
          onClick={handleSaveProfile}
          className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
          disabled={loading || !selectedRole}
        >
          {loading ? <Loader2 className="animate-spin" /> : "GUARDAR Y ENTRAR"}
        </Button>
      </div>
    </div>
  )
}
