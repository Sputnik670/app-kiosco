// types/quagga2.d.ts
// Type declarations para @ericblade/quagga2
// Cubre solo la API que usamos (init, start, stop, onDetected, decodeSingle)

declare module "@ericblade/quagga2" {
  interface QuaggaConfig {
    inputStream?: {
      type?: "LiveStream" | "ImageStream"
      constraints?: MediaTrackConstraints
      target?: HTMLElement | null
    }
    decoder?: {
      readers?: string[]
      debug?: boolean
    }
    locator?: {
      patchSize?: "x-small" | "small" | "medium" | "large" | "x-large"
      halfSample?: boolean
    }
    frequency?: number
    locate?: boolean
    numOfWorkers?: number
    src?: string
  }

  interface CodeResult {
    code: string | null
    format: string
    start: number
    end: number
    codeset: number
    startInfo: { error: number; code: number; start: number; end: number }
    decodedCodes: Array<{ error?: number; code: number; start: number; end: number }>
  }

  interface QuaggaResult {
    codeResult?: CodeResult
    line?: Array<{ x: number; y: number }>
    angle?: number
    pattern?: number[]
    box?: Array<[number, number]>
    boxes?: Array<Array<[number, number]>>
  }

  interface QuaggaStatic {
    init(config: QuaggaConfig, callback: (err: unknown) => void): void
    start(): void
    stop(): void
    onDetected(callback: (result: QuaggaResult) => void): void
    offDetected(callback: (result: QuaggaResult) => void): void
    decodeSingle(config: QuaggaConfig, callback: (result: QuaggaResult) => void): void
    onProcessed(callback: (result: QuaggaResult | null) => void): void
    offProcessed(callback: (result: QuaggaResult | null) => void): void
  }

  const Quagga: QuaggaStatic
  export default Quagga
}
