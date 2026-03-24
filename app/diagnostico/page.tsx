// app/diagnostico/page.tsx
// Página temporal de diagnóstico para testear barcode scanning en dispositivo real.
// BORRAR después de resolver el problema del scanner.

"use client"

import { useState, useRef, useEffect } from "react"

interface LogEntry {
  time: string
  msg: string
  type: "info" | "ok" | "error" | "warn"
}

function ts() {
  return new Date().toLocaleTimeString("es-AR", { hour12: false })
}

export default function DiagnosticoPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle")
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function log(msg: string, type: LogEntry["type"] = "info") {
    setLogs(prev => [...prev, { time: ts(), msg, type }])
  }

  async function runDiagnostico() {
    setLogs([])
    setPhase("running")

    // 1. Device Info
    log("=== DEVICE INFO ===")
    log(`UserAgent: ${navigator.userAgent}`)
    log(`Platform: ${navigator.platform}`)
    log(`Screen: ${screen.width}x${screen.height} @${devicePixelRatio}x`)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    log(`iOS detectado: ${isIOS}`, isIOS ? "warn" : "info")

    // 2. API Availability
    log("=== APIS DISPONIBLES ===")
    log(`navigator.mediaDevices: ${!!navigator.mediaDevices}`, navigator.mediaDevices ? "ok" : "error")
    const hasGUM = typeof navigator.mediaDevices?.getUserMedia === "function"
    log(`getUserMedia: ${hasGUM}`, hasGUM ? "ok" : "error")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any
    log(`BarcodeDetector nativo: ${!!g.BarcodeDetector}`, g.BarcodeDetector ? "ok" : "warn")

    if (g.BarcodeDetector) {
      try {
        const formats = await g.BarcodeDetector.getSupportedFormats()
        log(`  Formatos soportados: ${formats.join(", ")}`, "ok")
      } catch (e) {
        log(`  getSupportedFormats error: ${e}`, "error")
      }
    }

    // 3. Camera Test
    log("=== TEST CÁMARA ===")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      log("Cámara obtenida OK", "ok")

      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      log(`Resolución real: ${settings.width}x${settings.height}`, "ok")
      log(`FacingMode: ${settings.facingMode || "no reportado"}`)
      log(`FrameRate: ${settings.frameRate}`)

      const video = videoRef.current!
      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      await video.play()

      // Esperar que el video tenga dimensiones
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0) return resolve()
        video.onloadedmetadata = () => resolve()
      })
      log(`Video element: ${video.videoWidth}x${video.videoHeight}`, "ok")

      // 4. Canvas capture test
      log("=== TEST CANVAS CAPTURE ===")
      const canvas = canvasRef.current!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const nonZeroPixels = imageData.data.filter((_, i) => i % 4 === 0 && imageData.data[i] > 0).length
      log(`Canvas capturado: ${canvas.width}x${canvas.height}`, "ok")
      log(`Pixeles no-negro: ${nonZeroPixels}/${canvas.width * canvas.height} (${((nonZeroPixels / (canvas.width * canvas.height)) * 100).toFixed(1)}%)`, nonZeroPixels > 1000 ? "ok" : "error")

      // 5. Test decoders
      log("=== TEST DECODERS ===")

      // 5a. Nativo
      if (g.BarcodeDetector) {
        log("Probando BarcodeDetector nativo con canvas...")
        try {
          const detector = new g.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] })
          const t0 = performance.now()
          const results = await detector.detect(canvas)
          const dt = (performance.now() - t0).toFixed(0)
          if (results.length > 0) {
            log(`NATIVO DETECTÓ: ${results[0].rawValue} (${results[0].format}) en ${dt}ms`, "ok")
          } else {
            log(`Nativo: 0 resultados (${dt}ms) — no detectó barcode en este frame`, "warn")
          }
        } catch (e) {
          log(`Nativo error: ${e}`, "error")
        }
      }

      // 5b. html5-qrcode (scanFile con imagen del canvas)
      log("Probando html5-qrcode con imagen del canvas...")
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
        log("html5-qrcode importado OK", "ok")

        // Convertir canvas a File para scanFile
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), "image/png"))
        const file = new File([blob], "frame.png", { type: "image/png" })
        log(`Imagen generada: ${(file.size / 1024).toFixed(1)}KB`)

        const formats = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ]
        log(`Formatos: EAN_13=${Html5QrcodeSupportedFormats.EAN_13}, EAN_8=${Html5QrcodeSupportedFormats.EAN_8}, CODE_128=${Html5QrcodeSupportedFormats.CODE_128}, UPC_A=${Html5QrcodeSupportedFormats.UPC_A}, UPC_E=${Html5QrcodeSupportedFormats.UPC_E}`)

        const scanner = new Html5Qrcode("diag-scanner-temp", { formatsToSupport: formats, verbose: false })

        try {
          const t0 = performance.now()
          const result = await scanner.scanFile(file, false)
          const dt = (performance.now() - t0).toFixed(0)
          log(`HTML5-QRCODE DETECTÓ: ${result} en ${dt}ms`, "ok")
        } catch (scanErr) {
          log(`html5-qrcode scanFile: no detectó barcode (${scanErr})`, "warn")
        }

        // Probar sin formatos restrictivos
        log("Probando html5-qrcode SIN filtro de formatos...")
        const scanner2 = new Html5Qrcode("diag-scanner-temp2", { verbose: false })
        try {
          const t0 = performance.now()
          const result = await scanner2.scanFile(file, false)
          const dt = (performance.now() - t0).toFixed(0)
          log(`HTML5-QRCODE (sin filtro) DETECTÓ: ${result} en ${dt}ms`, "ok")
        } catch (scanErr) {
          log(`html5-qrcode sin filtro: no detectó (${scanErr})`, "warn")
        }
      } catch (e) {
        log(`html5-qrcode import error: ${e}`, "error")
      }

      // 5c. barcode-detector polyfill
      log("Probando barcode-detector/pure (WASM polyfill)...")
      try {
        const { BarcodeDetector: BD } = await import("barcode-detector/pure")
        log("barcode-detector/pure importado OK", "ok")
        const detector = new BD({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] })

        // Test con canvas
        const t0 = performance.now()
        const results = await detector.detect(canvas)
        const dt = (performance.now() - t0).toFixed(0)
        if (results.length > 0) {
          log(`WASM DETECTÓ (canvas): ${results[0].rawValue} (${results[0].format}) en ${dt}ms`, "ok")
        } else {
          log(`WASM con canvas: 0 resultados (${dt}ms)`, "warn")
        }

        // Test con ImageData
        log("Probando WASM con ImageData directo...")
        const t1 = performance.now()
        const results2 = await detector.detect(imageData)
        const dt1 = (performance.now() - t1).toFixed(0)
        if (results2.length > 0) {
          log(`WASM DETECTÓ (ImageData): ${results2[0].rawValue} en ${dt1}ms`, "ok")
        } else {
          log(`WASM con ImageData: 0 resultados (${dt1}ms)`, "warn")
        }
      } catch (e) {
        log(`barcode-detector/pure error: ${e}`, "error")
      }

      // 6. Scan continuo (5 intentos con delay)
      log("=== SCAN CONTINUO (5 frames, 1 seg entre cada uno) ===")
      log("Apuntá el barcode a la cámara y esperá...")
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1000))
        ctx.drawImage(video, 0, 0)

        // Probar html5-qrcode scanFile
        try {
          const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), "image/png"))
          const file = new File([blob], `frame${i}.png`, { type: "image/png" })
          const { Html5Qrcode } = await import("html5-qrcode")
          const sc = new Html5Qrcode(`diag-cont-${i}`, { verbose: false })
          const result = await sc.scanFile(file, false)
          log(`Frame ${i + 1}: ENCONTRADO → ${result}`, "ok")
          break // Salir si encontramos algo
        } catch {
          log(`Frame ${i + 1}: no detectado`, "warn")
        }
      }

      // Cleanup
      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null

    } catch (camErr) {
      log(`Error de cámara: ${camErr}`, "error")
    }

    log("=== DIAGNÓSTICO COMPLETO ===")
    setPhase("done")
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const colorMap = { info: "#94a3b8", ok: "#4ade80", error: "#f87171", warn: "#fbbf24" }

  return (
    <div style={{ background: "#0f172a", color: "white", minHeight: "100vh", padding: 16, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>DIAGNÓSTICO BARCODE SCANNER</h1>
      <p style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>
        Abrí esta página desde el celular donde falla el scanner.
      </p>

      {phase === "idle" && (
        <button
          onClick={runDiagnostico}
          style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: "bold", width: "100%" }}
        >
          INICIAR DIAGNÓSTICO
        </button>
      )}

      {/* Video preview (pequeño) */}
      <video ref={videoRef} playsInline muted style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginTop: 12, background: "#1e293b" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Contenedores invisibles para html5-qrcode scanFile */}
      <div id="diag-scanner-temp" style={{ display: "none" }} />
      <div id="diag-scanner-temp2" style={{ display: "none" }} />
      {[0,1,2,3,4].map(i => <div key={i} id={`diag-cont-${i}`} style={{ display: "none" }} />)}

      {/* Log output */}
      <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, maxHeight: "60vh", overflowY: "auto", background: "#020617", borderRadius: 8, padding: 8 }}>
        {logs.map((l, i) => (
          <div key={i} style={{ color: colorMap[l.type] }}>
            <span style={{ color: "#475569" }}>{l.time}</span> {l.msg}
          </div>
        ))}
        {phase === "running" && <div style={{ color: "#3b82f6", animation: "pulse 1s infinite" }}>▊</div>}
      </div>

      {phase === "done" && (
        <button
          onClick={() => {
            const text = logs.map(l => `[${l.type.toUpperCase()}] ${l.time} ${l.msg}`).join("\n")
            navigator.clipboard.writeText(text).then(() => alert("Copiado al portapapeles"))
          }}
          style={{ marginTop: 12, background: "#059669", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: "bold", width: "100%" }}
        >
          COPIAR RESULTADOS
        </button>
      )}
    </div>
  )
}
