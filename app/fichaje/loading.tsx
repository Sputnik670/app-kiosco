/**
 * Loading skeleton para la ruta de fichaje (empleados)
 * Mobile-first: el empleado ficha desde el celular
 */
import { Loader2 } from "lucide-react"

export default function FichajeLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      {/* Logo placeholder */}
      <div className="h-16 w-16 bg-slate-800 rounded-2xl animate-pulse mb-6" />

      {/* Title */}
      <div className="h-6 w-48 bg-slate-800 rounded animate-pulse mb-2" />
      <div className="h-4 w-32 bg-slate-800 rounded animate-pulse mb-8" />

      {/* QR scan area placeholder */}
      <div className="w-64 h-64 bg-slate-900 rounded-2xl border-2 border-slate-700 animate-pulse flex items-center justify-center mb-6">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>

      {/* Button placeholder */}
      <div className="h-12 w-48 bg-slate-800 rounded-xl animate-pulse" />
    </div>
  )
}
