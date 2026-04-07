"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Loader2, X, AlertCircle } from "lucide-react"

// --- Scanner unificado: ZBar WASM (web-wasm-barcode-reader) ---
// Antes usaba html5-qrcode que crasheaba dentro de Radix Dialog
// (CSS transforms distorsionan getBoundingClientRect).
// ZBar WASM + createPortal evita ese problema completamente.
// Misma implementación probada que funciona en crear-producto.tsx.

function loadWasmScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).Module !== "undefined" && (window as any).Module.calledRun) {
      resolve()
      return
    }
    if (document.getElementById("zbar-wasm-script")) {
      const check = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).Module?.calledRun) { clearInterval(check); resolve() }
      }, 100)
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
      return
    }
    const script = document.createElement("script")
    script.id = "zbar-wasm-script"
    script.src = "/a.out.js"
    script.onload = () => {
      const check = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).Module?.calledRun) { clearInterval(check); resolve() }
      }, 50)
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
    }
    script.onerror = () => reject(new Error("No se pudo cargar el motor de escaneo"))
    document.head.appendChild(script)
  })
}

interface BarcodeScannerProps {
  onResult: (code: string) => void
  onClose: () => void
  scannerId?: string // mantenido por compatibilidad, ya no se usa
}

export function BarcodeScanner({
  onResult,
  onClose,
}: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const onResultRef = useRef(onResult)
  const foundRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)

  useEffect(() => { onResultRef.current = onResult }, [onResult])

  // Bloquear scroll del body mientras el scanner está abierto
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      if (cancelled || !containerRef.current) return

      try {
        // 1. Cargar WASM
        await loadWasmScript()
        if (cancelled) return

        // 2. Import dinámico de la librería
        const { BarcodeScanner: ZBarScanner } = await import("web-wasm-barcode-reader")
        if (cancelled) return

        // 3. Crear scanner
        const scanner = new ZBarScanner({
          container: containerRef.current,
          onDetect: (result: { data: string }) => {
            if (foundRef.current) return
            foundRef.current = true
            if (navigator.vibrate) navigator.vibrate(100)
            scanner.stop()
            onResultRef.current(result.data)
          },
          onError: (err: Error) => {
            if (!cancelled) {
              console.error("ZBar scanner error:", err)
              setError(err.message || "Error del lector de códigos")
              setLoading(false)
            }
          },
          scanInterval: 120,
          beepOnDetect: false,
          facingMode: "environment",
          scanRegion: { width: 0.85, height: 0.30 },
        })
        scannerRef.current = scanner

        // 4. Iniciar
        await scanner.start()
        if (!cancelled) setLoading(false)

      } catch (err) {
        console.error("Scanner init error:", err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo iniciar el lector")
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (scannerRef.current?.isRunning) {
        scannerRef.current.stop()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const overlay = (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#000" }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 text-white gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-[10px] font-bold uppercase">Iniciando Lector...</p>
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="font-bold uppercase text-sm">Error de Cámara</p>
          <p className="text-xs text-slate-400">{error}</p>
          <Button onClick={onClose} variant="destructive" className="w-full max-w-xs">Cerrar</Button>
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
        />
      )}
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 100000 }}>
        <Button variant="destructive" className="rounded-full px-10 shadow-xl font-bold uppercase text-[10px]" onClick={onClose}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
