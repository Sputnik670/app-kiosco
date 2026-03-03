"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Store, Package, ShoppingCart, Users, Check, ArrowRight, Sparkles } from "lucide-react"
import { toast } from "sonner"
import GestionSucursales from "@/components/gestion-sucursales"
import { seedDefaultProductsAction } from "@/lib/actions/seed-default-products"
import { cn } from "@/lib/utils"

interface OnboardingWizardProps {
  organizationId: string
  userId: string
  onComplete: () => void
}

const STEPS = [
  {
    id: "sucursal",
    title: "Crea tu primer local",
    description: "Registra la ubicacion de tu kiosco para empezar a operar.",
    icon: Store,
  },
  {
    id: "catalogo",
    title: "Carga tu catalogo",
    description: "Agrega productos con un clic o hazlo despues manualmente.",
    icon: Package,
  },
  {
    id: "listo",
    title: "Todo listo",
    description: "Tu kiosco esta configurado. Ya podes empezar a vender.",
    icon: ShoppingCart,
  },
] as const

type StepId = (typeof STEPS)[number]["id"]

export default function OnboardingWizard({ organizationId, userId, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepId>("sucursal")
  const [branchCreated, setBranchCreated] = useState(false)
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const handleBranchCreated = () => {
    setBranchCreated(true)
    toast.success("Local creado", { description: "Ahora carga tu catalogo de productos." })
    setCurrentStep("catalogo")
  }

  const handleLoadDefaultProducts = async () => {
    setLoadingCatalog(true)
    try {
      const result = await seedDefaultProductsAction()
      if (result.success) {
        setCatalogLoaded(true)
        toast.success("Catalogo cargado", {
          description: `Se agregaron ${result.count ?? 0} productos de kiosco.`,
        })
        setCurrentStep("listo")
      } else {
        toast.error("Error al cargar productos", { description: result.error })
      }
    } catch {
      toast.error("Error inesperado al cargar catalogo")
    } finally {
      setLoadingCatalog(false)
    }
  }

  const handleSkipCatalog = () => {
    setCurrentStep("listo")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="w-full max-w-2xl space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 px-4">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-black transition-all",
                  i < currentStepIndex
                    ? "bg-green-500 text-white"
                    : i === currentStepIndex
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                      : "bg-slate-200 text-slate-400"
                )}
              >
                {i < currentStepIndex ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 sm:w-16 transition-all",
                    i < currentStepIndex ? "bg-green-500" : "bg-slate-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <Card className="shadow-2xl border-0 rounded-[2rem] overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 p-6 text-white text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <h1 className="text-xl font-black uppercase tracking-tight">Configuracion Inicial</h1>
            </div>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">
              Paso {currentStepIndex + 1} de {STEPS.length}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {/* Step: Sucursal */}
            {currentStep === "sucursal" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 mb-2">
                    <Store className="h-7 w-7 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                    {STEPS[0].title}
                  </h2>
                  <p className="text-sm text-slate-500">{STEPS[0].description}</p>
                </div>

                <GestionSucursales onUpdate={handleBranchCreated} />
              </div>
            )}

            {/* Step: Catalogo */}
            {currentStep === "catalogo" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 mb-2">
                    <Package className="h-7 w-7 text-green-600" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                    {STEPS[1].title}
                  </h2>
                  <p className="text-sm text-slate-500">{STEPS[1].description}</p>
                </div>

                <div className="grid gap-4">
                  <button
                    onClick={handleLoadDefaultProducts}
                    disabled={loadingCatalog}
                    className="w-full p-6 rounded-2xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                        {loadingCatalog ? (
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        ) : (
                          <Package className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-black text-green-800 uppercase text-sm">
                          Cargar productos de kiosco
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">
                          +130 productos tipicos (bebidas, snacks, golosinas, etc.)
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-green-400 ml-auto group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  <button
                    onClick={handleSkipCatalog}
                    disabled={loadingCatalog}
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 transition-all text-center"
                  >
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Omitir — Lo hago despues manualmente
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Step: Listo */}
            {currentStep === "listo" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-3">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-2">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                    {STEPS[2].title}
                  </h2>
                  <p className="text-sm text-slate-500">{STEPS[2].description}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    <p className="text-sm font-bold text-green-800">Local registrado</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border",
                    catalogLoaded ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
                  )}>
                    <Check className={cn("h-4 w-4 shrink-0", catalogLoaded ? "text-green-600" : "text-slate-400")} />
                    <p className={cn("text-sm font-bold", catalogLoaded ? "text-green-800" : "text-slate-500")}>
                      {catalogLoaded ? "Catalogo cargado" : "Catalogo pendiente (podras cargarlo luego)"}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={onComplete}
                  className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
                >
                  Comenzar a operar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
