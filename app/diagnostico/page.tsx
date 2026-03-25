// app/diagnostico/page.tsx
// Diagnóstico v2: foco en verificar imagen capturada + Quagga2 LiveStream real
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
  const [phase, setPhase] = useState<"idle" | "capture" | "quagga-live" | "native-live" | "wasm-live" | "html5qr-live" | "done">("idle")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const quaggaContainerRef = useRef<HTMLDivElement>(null)
  const html5qrContainerRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5ScannerRef = useRef<any>(null)

  function log(msg: string, type: LogEntry["type"] = "info") {
    setLogs(prev => [...prev, { time: ts(), msg, type }])
  }

  // === TEST 1: Capturar imagen y mostrarla ===
  async function testCaptura() {
    setLogs([])
    setCapturedImage(null)
    setPhase("capture")

    log("=== TEST CAPTURA DE IMAGEN ===")
    log(`UA: ${navigator.userAgent.slice(0, 80)}...`)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      log("Cámara OK", "ok")

      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      log(`Resolución: ${settings.width}x${settings.height}, ${settings.frameRate}fps`, "ok")

      const video = videoRef.current!
      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      await video.play()

      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0) return resolve()
        video.onloadedmetadata = () => resolve()
      })

      log(`Video element: ${video.videoWidth}x${video.videoHeight}`)

      // Esperar 2 seg para que la cámara enfoque
      log("Esperando 2s para que la cámara enfoque...")
      await new Promise(r => setTimeout(r, 2000))

      // Capturar frame
      const canvas = canvasRef.current!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(video, 0, 0)

      // Mostrar la imagen capturada
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
      setCapturedImage(dataUrl)
      log(`Imagen capturada: ${canvas.width}x${canvas.height}`, "ok")
      log("↓ Verificá abajo que el barcode sea visible en la imagen ↓", "warn")

      // Test rápido de Quagga2 decodeSingle con diferentes configuraciones
      log("=== QUAGGA2 decodeSingle (3 configuraciones) ===")
      const Quagga = (await import("@ericblade/quagga2")).default
      log("Quagga2 importado OK", "ok")

      const configs = [
        { name: "medium+halfSample", patchSize: "medium" as const, halfSample: true },
        { name: "large+fullRes", patchSize: "large" as const, halfSample: false },
        { name: "x-large+fullRes", patchSize: "x-large" as const, halfSample: false },
      ]

      for (const cfg of configs) {
        try {
          const result = await new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000)
            Quagga.decodeSingle(
              {
                src: dataUrl,
                numOfWorkers: 0,
                decoder: { readers: ["ean_reader", "ean_8_reader", "code_128_reader", "upc_reader", "upc_e_reader"] },
                locate: true,
                locator: { patchSize: cfg.patchSize, halfSample: cfg.halfSample },
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (r: any) => { clearTimeout(timeout); resolve(r?.codeResult?.code || null) }
            )
          })
          if (result) {
            log(`${cfg.name}: DETECTÓ → ${result}`, "ok")
          } else {
            log(`${cfg.name}: no detectó`, "warn")
          }
        } catch (e) {
          log(`${cfg.name}: error (${e})`, "error")
        }
      }

      // Capturar 3 frames más con delay
      log("=== 3 FRAMES ADICIONALES ===")
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1500))
        ctx.drawImage(video, 0, 0)
        const frameUrl = canvas.toDataURL("image/jpeg", 0.9)

        const result = await new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 5000)
          Quagga.decodeSingle(
            {
              src: frameUrl,
              numOfWorkers: 0,
              decoder: { readers: ["ean_reader", "ean_8_reader", "code_128_reader", "upc_reader", "upc_e_reader"] },
              locate: true,
              locator: { patchSize: "large", halfSample: false },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any) => { clearTimeout(timeout); resolve(r?.codeResult?.code || null) }
          )
        })
        if (result) {
          log(`Frame ${i + 1}: DETECTÓ → ${result}`, "ok")
          break
        } else {
          log(`Frame ${i + 1}: no detectó`, "warn")
        }
      }

      // Cleanup
      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null

    } catch (e) {
      log(`Error: ${e}`, "error")
    }

    log("=== CAPTURA COMPLETA ===")
    setPhase("done")
  }

  // === TEST 2: Quagga2 LiveStream (modo real como en el scanner) ===
  async function testQuaggaLive() {
    setLogs([])
    setCapturedImage(null)
    setPhase("quagga-live")

    log("=== QUAGGA2 LIVESTREAM TEST ===")
    log("Iniciando cámara con Quagga2 LiveStream...")
    log("Tenés 15 segundos para apuntar al barcode.")

    try {
      const Quagga = (await import("@ericblade/quagga2")).default
      log("Quagga2 importado OK", "ok")

      const container = quaggaContainerRef.current
      if (!container) { log("Container no encontrado", "error"); setPhase("done"); return }

      let detected = false

      await new Promise<void>((resolve, reject) => {
        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              constraints: {
                facingMode: "environment",
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
              },
              target: container,
            },
            decoder: {
              readers: ["ean_reader", "ean_8_reader", "code_128_reader", "upc_reader", "upc_e_reader"],
            },
            locator: { patchSize: "large", halfSample: false },
            frequency: 10,
            locate: true,
          },
          (err: unknown) => {
            if (err) {
              log(`Init error: ${err}`, "error")
              reject(err)
              return
            }
            log("Quagga2 LiveStream inicializado OK", "ok")
            Quagga.start()
            log("Escaneando... apuntá el barcode a la cámara", "info")
            resolve()
          }
        )
      })

      // onProcessed: log cada 20 frames
      let processedCount = 0
      Quagga.onProcessed(() => {
        processedCount++
        if (processedCount % 20 === 0) {
          log(`Procesados: ${processedCount} frames...`, "info")
        }
      })

      // onDetected
      Quagga.onDetected((result) => {
        if (detected) return
        const code = result?.codeResult?.code
        if (!code) return
        detected = true
        log(`LIVESTREAM DETECTÓ: ${code} (format: ${result?.codeResult?.format})`, "ok")
      })

      // Esperar 15 seg
      await new Promise(r => setTimeout(r, 15000))
      log(`Total frames procesados: ${processedCount}`)

      if (!detected) {
        log("LiveStream NO detectó ningún barcode en 15 segundos", "error")
      }

      Quagga.stop()
      log("Quagga2 detenido", "info")

    } catch (e) {
      log(`Error LiveStream: ${e}`, "error")
    }

    log("=== LIVESTREAM TEST COMPLETO ===")
    setPhase("done")
  }

  // === TEST 3: BarcodeDetector nativo (15 seg) ===
  async function testNativeLive() {
    setLogs([])
    setCapturedImage(null)
    setPhase("native-live")

    log("=== BARCODE DETECTOR NATIVO TEST ===")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BarcodeDetectorClass = (window as any).BarcodeDetector
    if (!BarcodeDetectorClass) {
      log("BarcodeDetector NO disponible en este browser", "error")
      log("Tu browser no soporta la API nativa. Usarás Quagga2 como fallback.", "warn")
      setPhase("done")
      return
    }

    try {
      const formats = await BarcodeDetectorClass.getSupportedFormats()
      log(`Formatos soportados: ${formats.join(", ")}`, "ok")

      const needed = ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"]
      const available = needed.filter((f: string) => formats.includes(f))
      log(`Formatos barcode disponibles: ${available.join(", ") || "NINGUNO"}`, available.length > 0 ? "ok" : "error")

      if (available.length === 0) {
        log("No hay formatos de barcode 1D soportados", "error")
        setPhase("done")
        return
      }

      const detector = new BarcodeDetectorClass({ formats: available })
      log("Detector creado OK", "ok")

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      log("Cámara OK", "ok")

      const video = videoRef.current!
      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      video.style.display = "block"
      await video.play()
      log("Video playing, escaneando 15 segundos...", "info")

      let detected = false
      let frameCount = 0
      const startTime = Date.now()

      while (Date.now() - startTime < 15000 && !detected) {
        try {
          if (video.readyState >= 2) {
            frameCount++
            const barcodes = await detector.detect(video)
            if (barcodes.length > 0) {
              detected = true
              const bc = barcodes[0]
              log(`NATIVO DETECTÓ: ${bc.rawValue} (format: ${bc.format})`, "ok")
              if (barcodes.length > 1) {
                log(`(${barcodes.length} barcodes en total)`, "info")
              }
            }
            if (frameCount % 30 === 0) {
              log(`Procesados: ${frameCount} frames...`, "info")
            }
          }
        } catch {
          // detect() puede fallar en algunos frames
        }
        await new Promise(r => setTimeout(r, 50)) // ~20fps
      }

      log(`Total frames procesados: ${frameCount}`)
      if (!detected) {
        log("Nativo NO detectó ningún barcode en 15 segundos", "error")
      }

      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
      video.style.display = "none"

    } catch (e) {
      log(`Error: ${e}`, "error")
    }

    log("=== NATIVO TEST COMPLETO ===")
    setPhase("done")
  }

  // === TEST 4: barcode-detector polyfill WASM (15 seg) ===
  async function testWasmLive() {
    setLogs([])
    setCapturedImage(null)
    setPhase("wasm-live")

    log("=== BARCODE-DETECTOR WASM POLYFILL TEST ===")
    log("Importando ZXing C++ WASM polyfill...")

    try {
      // "barcode-detector/pure" = ponyfill WASM puro, NO usa API nativa del browser
      const { BarcodeDetector: WasmDetector } = await import("barcode-detector/pure")
      log("Ponyfill WASM puro importado OK", "ok")

      const formats = await WasmDetector.getSupportedFormats()
      log(`Formatos soportados: ${formats.join(", ")}`, "ok")

      const needed = ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] as const
      const available = needed.filter(f => formats.includes(f))
      log(`Formatos barcode 1D: ${available.join(", ") || "NINGUNO"}`, available.length > 0 ? "ok" : "error")

      if (available.length === 0) {
        log("No hay formatos de barcode 1D en el polyfill", "error")
        setPhase("done")
        return
      }

      const detector = new WasmDetector({ formats: [...available] })
      log("Detector WASM creado OK", "ok")

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      log("Cámara OK", "ok")

      const video = videoRef.current!
      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      video.style.display = "block"
      await video.play()
      log("Video playing, escaneando 15 segundos...", "info")

      let detected = false
      let frameCount = 0
      let errorCount = 0
      const startTime = Date.now()

      while (Date.now() - startTime < 15000 && !detected) {
        try {
          if (video.readyState >= 2) {
            frameCount++
            const barcodes = await detector.detect(video)
            if (barcodes.length > 0) {
              detected = true
              const bc = barcodes[0]
              log(`WASM DETECTÓ: ${bc.rawValue} (format: ${bc.format})`, "ok")
              if (barcodes.length > 1) {
                log(`(${barcodes.length} barcodes en total)`, "info")
              }
            }
            if (frameCount % 30 === 0) {
              log(`Procesados: ${frameCount} frames...${errorCount > 0 ? ` (${errorCount} errores)` : ""}`, "info")
            }
          }
        } catch (e) {
          errorCount++
          if (errorCount <= 3) {
            log(`detect() error #${errorCount}: ${e}`, "warn")
          }
        }
        await new Promise(r => setTimeout(r, 100)) // ~10fps
      }

      log(`Total frames procesados: ${frameCount}${errorCount > 0 ? `, ${errorCount} errores` : ""}`)
      if (!detected) {
        log("WASM NO detectó ningún barcode en 15 segundos", "error")
      }

      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
      video.style.display = "none"

    } catch (e) {
      log(`Error importando/iniciando WASM: ${e}`, "error")
      log("Esto puede pasar en algunos browsers. El scanner usará Quagga2 como fallback.", "warn")
    }

    log("=== WASM TEST COMPLETO ===")
    setPhase("done")
  }

  // === TEST 5: html5-qrcode (ZXing JS puro, sin BarcodeDetector nativo) ===
  async function testHtml5Qr() {
    setLogs([])
    setCapturedImage(null)
    setPhase("html5qr-live")

    log("=== HTML5-QRCODE (ZXing JS) TEST ===")
    log("Importando html5-qrcode...")

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
      log("html5-qrcode importado OK", "ok")

      const containerId = "diag-html5qr"
      const container = document.getElementById(containerId)
      if (!container) { log("Container no encontrado", "error"); setPhase("done"); return }

      const scanner = new Html5Qrcode(containerId, {
        useBarCodeDetectorIfSupported: false, // FORZAR ZXing JS puro
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      })
      html5ScannerRef.current = scanner
      log("Scanner creado (ZXing JS, sin API nativa)", "ok")

      let detected = false
      const startTime = Date.now()

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.7778,
          disableFlip: true,
        },
        (decodedText, result) => {
          if (detected) return
          detected = true
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          log(`HTML5-QRCODE DETECTÓ: ${decodedText} (format: ${result?.result?.format?.formatName || "?"}) en ${elapsed}s`, "ok")
        },
        () => {} // ignorar failures normales
      )

      log("Scanner iniciado, escaneando 20 segundos...", "info")

      // Esperar hasta detección o timeout
      const checkInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        if (elapsed % 5 === 0 && elapsed > 0 && !detected) {
          log(`${elapsed}s transcurridos...`, "info")
        }
      }, 1000)

      await new Promise(r => setTimeout(r, 20000))
      clearInterval(checkInterval)

      if (!detected) {
        log("html5-qrcode NO detectó ningún barcode en 20 segundos", "error")
      }

      try {
        if (scanner.isScanning) {
          await scanner.stop()
          scanner.clear()
        }
      } catch { /* ok */ }
      html5ScannerRef.current = null

    } catch (e) {
      log(`Error: ${e}`, "error")
    }

    log("=== HTML5-QRCODE TEST COMPLETO ===")
    setPhase("done")
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (html5ScannerRef.current?.isScanning) {
        html5ScannerRef.current.stop().catch(() => {})
      }
      import("@ericblade/quagga2").then(m => m.default.stop()).catch(() => {})
    }
  }, [])

  const colorMap = { info: "#94a3b8", ok: "#4ade80", error: "#f87171", warn: "#fbbf24" }

  return (
    <div style={{ background: "#0f172a", color: "white", minHeight: "100vh", padding: 16, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 16, fontWeight: "bold", marginBottom: 4 }}>DIAGNÓSTICO v3</h1>
      <p style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>
        5 tests. Corré primero el TEST 5 (html5-qrcode).
      </p>

      {phase === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={testCaptura}
            style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: "bold" }}
          >
            TEST 1: CAPTURA + DECODE
          </button>
          <button
            onClick={testQuaggaLive}
            style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: "bold" }}
          >
            TEST 2: QUAGGA2 LIVESTREAM (15s)
          </button>
          <button
            onClick={testNativeLive}
            style={{ background: "#059669", color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: "bold" }}
          >
            TEST 3: BARCODE DETECTOR NATIVO (15s)
          </button>
          <button
            onClick={testWasmLive}
            style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: "bold" }}
          >
            TEST 4: WASM POLYFILL ZXing (15s)
          </button>
          <button
            onClick={testHtml5Qr}
            style={{ background: "#f59e0b", color: "black", border: "none", borderRadius: 8, padding: "14px 24px", fontSize: 15, fontWeight: "bold" }}
          >
            ★ TEST 5: HTML5-QRCODE ZXing JS (20s)
          </button>
        </div>
      )}

      {/* Video para test de captura */}
      <video
        ref={videoRef}
        playsInline muted
        style={{
          width: "100%", maxHeight: 180, objectFit: "cover",
          borderRadius: 8, marginTop: 12, background: "#1e293b",
          display: (phase === "capture" || phase === "native-live" || phase === "wasm-live") ? "block" : "none",
        }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Container para Quagga2 LiveStream */}
      <div
        ref={quaggaContainerRef}
        style={{
          width: "100%", height: 300, borderRadius: 8, marginTop: 12,
          background: "#1e293b", overflow: "hidden", position: "relative",
          display: phase === "quagga-live" ? "block" : "none",
        }}
      />

      {/* Container para html5-qrcode */}
      <div
        id="diag-html5qr"
        style={{
          width: "100%", height: 300, borderRadius: 8, marginTop: 12,
          background: "#1e293b", overflow: "hidden", position: "relative",
          display: phase === "html5qr-live" ? "block" : "none",
        }}
      />

      {/* Imagen capturada */}
      {capturedImage && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11, color: "#fbbf24", marginBottom: 4 }}>IMAGEN CAPTURADA (¿se ve el barcode?):</p>
          <img src={capturedImage} alt="Frame capturado" style={{ width: "100%", borderRadius: 8, border: "2px solid #fbbf24" }} />
        </div>
      )}

      {/* Log output */}
      <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, maxHeight: "40vh", overflowY: "auto", background: "#020617", borderRadius: 8, padding: 8 }}>
        {logs.map((l, i) => (
          <div key={i} style={{ color: colorMap[l.type] }}>
            <span style={{ color: "#475569" }}>{l.time}</span> {l.msg}
          </div>
        ))}
        {(phase !== "idle" && phase !== "done") && <div style={{ color: "#3b82f6" }}>▊ ejecutando...</div>}
      </div>

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          <button
            onClick={() => {
              const text = logs.map(l => `[${l.type.toUpperCase()}] ${l.time} ${l.msg}`).join("\n")
              navigator.clipboard.writeText(text).then(() => alert("Copiado al portapapeles"))
            }}
            style={{ background: "#059669", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: "bold" }}
          >
            COPIAR RESULTADOS
          </button>
          <button
            onClick={() => { setPhase("idle"); setLogs([]); setCapturedImage(null) }}
            style={{ background: "#475569", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: "bold" }}
          >
            VOLVER A EMPEZAR
          </button>
        </div>
      )}
    </div>
  )
}
