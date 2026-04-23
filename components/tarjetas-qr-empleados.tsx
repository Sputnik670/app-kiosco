"use client"

/**
 * TARJETAS QR DE EMPLEADOS — Panel del dueño
 *
 * Reemplaza el flujo viejo (generar-qr-fichaje.tsx) donde el QR era por sucursal.
 * Ahora cada empleado (membership) tiene su propio qr_code UUID único y esta
 * pantalla permite al dueño imprimir/descargar la tarjeta de cada uno.
 *
 * FLUJO DE FICHAJE:
 * 1. El dueño imprime la tarjeta acá y se la entrega al empleado.
 * 2. Cuando el empleado llega al kiosco, el dueño/manager abre el scanner de
 *    fichaje en la app del kiosco y escanea la tarjeta.
 * 3. El servidor identifica al empleado por el qr_code, abre o cierra turno.
 *
 * SEGURIDAD:
 * - Solo owners ven los QRs (son credenciales). La action lo enforce.
 * - El QR por sí solo no hace nada: requiere ser escaneado desde una sesión
 *   autenticada de owner/manager en el kiosco.
 */

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import { Download, Printer, Loader2, User, Info } from "lucide-react"
import { toast } from "sonner"
import { listEmployeeQRCardsAction } from "@/lib/actions/attendance.actions"

interface EmployeeCard {
  user_id: string
  display_name: string
  qr_code: string
  role: "owner" | "admin" | "employee"
  is_active: boolean
}

// Este panel solo lista e imprime tarjetas. El fichaje se realiza desde la vista
// del empleado (vista-empleado.tsx → RelojControl → scanner de su propia tarjeta).
export default function TarjetasQREmpleados() {
  const [employees, setEmployees] = useState<EmployeeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargarEmpleados = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listEmployeeQRCardsAction()
    if (result.success && result.employees) {
      setEmployees(result.employees)
    } else {
      setError(result.error || "Error al cargar empleados")
      toast.error("Error al cargar empleados", { description: result.error })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    cargarEmpleados()
  }, [cargarEmpleados])

  const descargarTarjeta = (emp: EmployeeCard) => {
    // Usamos el QRCodeCanvas oculto (alta resolución) en lugar del SVG visible.
    // Evita el flujo SVG → Blob → Image que es frágil en navegadores móviles
    // (especialmente iOS Safari) cuando el SVG no trae xmlns al serializar.
    const qrCanvas = document.querySelector(
      `#qr-canvas-${emp.user_id}`
    ) as HTMLCanvasElement | null
    if (!qrCanvas) {
      toast.error("No se encontró el código QR", {
        description: "Recargá la pestaña Equipo y volvé a intentar",
      })
      return
    }

    try {
      // Tarjeta de 600x900 (proporción tarjeta + nombre arriba, QR al medio, pie)
      const W = 600
      const H = 900
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        toast.error("Navegador no soporta canvas")
        return
      }

      // Fondo blanco
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, W, H)

      // Borde
      ctx.strokeStyle = "#1e293b"
      ctx.lineWidth = 4
      ctx.strokeRect(8, 8, W - 16, H - 16)

      // Encabezado
      ctx.fillStyle = "#1e293b"
      ctx.font = "bold 36px system-ui, -apple-system, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("KioscoApp", W / 2, 80)

      ctx.font = "bold 22px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "#64748b"
      ctx.fillText("TARJETA DE FICHAJE", W / 2, 120)

      // Nombre
      ctx.fillStyle = "#0f172a"
      ctx.font = "bold 40px system-ui, -apple-system, sans-serif"
      ctx.fillText(emp.display_name, W / 2, 200)

      // Rol
      ctx.font = "24px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "#475569"
      ctx.fillText(labelRol(emp.role), W / 2, 240)

      // QR directo desde el canvas oculto (sin async Image loading)
      const qrSize = 400
      const qrX = (W - qrSize) / 2
      const qrY = 280
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

      // Pie
      ctx.font = "18px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "#64748b"
      ctx.fillText("Presentá esta tarjeta al iniciar tu turno", W / 2, H - 60)
      ctx.font = "14px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "#94a3b8"
      ctx.fillText(`ID: ${emp.qr_code.slice(0, 8)}…${emp.qr_code.slice(-4)}`, W / 2, H - 35)

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Error al generar imagen")
          return
        }
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = downloadUrl
        link.download = `tarjeta-fichaje-${emp.display_name.replace(/\s+/g, "-").toLowerCase()}.png`

        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          window.open(downloadUrl, "_blank")
          toast.info("Tarjeta abierta", { description: "Guardá la imagen desde ahí" })
        } else {
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          toast.success(`Tarjeta de ${emp.display_name} descargada`)
        }

        // Dar tiempo al download antes de revocar
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      }, "image/png")
    } catch (err) {
      console.error("Error descargando tarjeta:", err)
      toast.error("Error al descargar tarjeta", {
        description: err instanceof Error ? err.message : "Error desconocido",
      })
    }
  }

  const imprimirTarjetas = () => {
    // Abre una ventana nueva con las tarjetas en formato imprimible (una por hoja A4)
    const w = window.open("", "_blank", "width=800,height=1000")
    if (!w) {
      toast.error("El navegador bloqueó la ventana de impresión")
      return
    }

    const cardsHtml = employees
      .map((emp) => {
        // Serializar el SVG actual del DOM
        const svgEl = document.querySelector(`#qr-empleado-${emp.user_id}`) as SVGSVGElement | null
        const svgStr = svgEl ? new XMLSerializer().serializeToString(svgEl) : ""
        return `
          <div class="card">
            <div class="header">
              <div class="title">KioscoApp</div>
              <div class="subtitle">TARJETA DE FICHAJE</div>
            </div>
            <div class="name">${escapeHtml(emp.display_name)}</div>
            <div class="role">${escapeHtml(labelRol(emp.role))}</div>
            <div class="qr">${svgStr}</div>
            <div class="footer">Presentá esta tarjeta al iniciar tu turno</div>
            <div class="id">ID: ${emp.qr_code.slice(0, 8)}…${emp.qr_code.slice(-4)}</div>
          </div>
        `
      })
      .join("")

    w.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Tarjetas de fichaje — KioscoApp</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
            .card {
              page-break-after: always;
              border: 3px solid #1e293b;
              border-radius: 16px;
              padding: 32px;
              margin: 24px auto;
              width: 480px;
              text-align: center;
              background: white;
            }
            .card:last-child { page-break-after: auto; }
            .header { margin-bottom: 24px; }
            .title { font-size: 28px; font-weight: 900; }
            .subtitle { font-size: 14px; font-weight: 700; letter-spacing: 2px; color: #64748b; margin-top: 4px; }
            .name { font-size: 32px; font-weight: 900; margin: 24px 0 4px; }
            .role { font-size: 16px; color: #475569; margin-bottom: 24px; }
            .qr svg { width: 320px; height: 320px; display: block; margin: 0 auto; }
            .footer { font-size: 14px; color: #64748b; margin-top: 24px; }
            .id { font-size: 10px; color: #94a3b8; margin-top: 8px; font-family: monospace; }
            @media print {
              body { margin: 0; }
              .card { margin: 0; border-radius: 0; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
            }
          </style>
        </head>
        <body>
          ${cardsHtml}
          <script>
            window.onload = () => { setTimeout(() => window.print(), 300); };
          </script>
        </body>
      </html>
    `)
    w.document.close()
  }

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-3 text-sm text-slate-500">Cargando empleados…</span>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <p className="text-sm text-red-700 font-bold">{error}</p>
        <Button onClick={cargarEmpleados} variant="outline" className="mt-3">
          Reintentar
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header informativo — el fichaje se hace desde la vista del empleado */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-black text-blue-900 text-sm uppercase">Tarjetas QR del equipo</h3>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              Imprimí la tarjeta de cada empleado y dejala en el local. Cada empleado
              escanea su propia tarjeta desde la app tocando <strong>Escanear QR Entrada</strong>{" "}
              al llegar y <strong>Escanear QR Salida</strong> al irse. Una tarjeta solo funciona
              para su dueño.
            </p>
          </div>
        </div>
      </Card>

      {/* Acciones globales */}
      <div className="flex gap-2">
        <Button onClick={imprimirTarjetas} variant="outline" className="flex-1">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir todas ({employees.length})
        </Button>
      </div>

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {employees.map((emp) => (
          <Card key={emp.user_id} className="p-4 border-2">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-slate-500" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm truncate">{emp.display_name}</p>
                <p className="text-xs text-slate-500 uppercase">{labelRol(emp.role)}</p>
              </div>
            </div>

            <div className="flex justify-center bg-white p-3 rounded-lg border border-slate-100 mb-3">
              <QRCodeSVG
                id={`qr-empleado-${emp.user_id}`}
                value={emp.qr_code}
                size={180}
                level="H"
                marginSize={4}
              />
            </div>

            {/* Canvas oculto de alta resolución usado por descargarTarjeta().
                Se renderiza fuera de pantalla pero sigue siendo un HTMLCanvasElement
                real que podemos pasar a ctx.drawImage sin serialización de SVG. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
              <QRCodeCanvas
                id={`qr-canvas-${emp.user_id}`}
                value={emp.qr_code}
                size={400}
                level="H"
                marginSize={4}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => descargarTarjeta(emp)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Download className="h-3 w-3 mr-1" />
                <span className="text-xs">Descargar</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Aviso legal/operativo */}
      <Card className="p-3 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>Importante:</strong> la tarjeta QR es una credencial. Si un empleado deja
            la organización, desactivalo desde Empleados: su tarjeta deja de funcionar
            automáticamente.
          </p>
        </div>
      </Card>
    </div>
  )
}

function labelRol(r: "owner" | "admin" | "employee"): string {
  if (r === "owner") return "Dueño"
  if (r === "admin") return "Administrador"
  return "Empleado"
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
