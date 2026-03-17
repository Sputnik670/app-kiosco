/**
 * Loading skeleton para la ruta principal
 * Se muestra instantáneamente mientras el server component carga datos
 * Elimina la pantalla blanca durante cold starts de Vercel
 */
import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header skeleton */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-8 w-8 bg-slate-200 rounded-full animate-pulse" />
      </div>

      {/* Branch selector skeleton */}
      <div className="px-4 py-3">
        <div className="h-12 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-20 bg-slate-200 rounded-lg animate-pulse flex-shrink-0" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="px-4 py-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="h-3 w-16 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-400">Cargando...</span>
        </div>
      </div>
    </div>
  )
}
