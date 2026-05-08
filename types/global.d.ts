/**
 * ============================================================================
 * DECLARACIONES GLOBALES PARA APIS NO ESTANDAR DEL BROWSER
 * ============================================================================
 *
 * Tipa APIs que TypeScript no incluye por default porque son no estandar o
 * propietarias. Reemplaza los "(window as any)" / "(navigator as any)" que
 * habia regados por todo el codigo.
 *
 * Ultima actualizacion: 8 de mayo de 2026 (Bloque 4 cat B).
 * ============================================================================
 */

export {}

declare global {
  interface Window {
    /**
     * BarcodeDetector API (Web Platform Incubator).
     * Disponible en Chrome 83+, Edge 83+, Safari iOS 17+.
     * No disponible en Firefox.
     * Spec: https://wicg.github.io/shape-detection-api/
     */
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): {
        detect(source: ImageBitmapSource): Promise<Array<{
          rawValue: string
          format: string
          boundingBox: DOMRectReadOnly
        }>>
      }
      getSupportedFormats(): Promise<string[]>
    }

    /**
     * Modulo Emscripten WASM cargado por public/a.out.js
     * (web-wasm-barcode-reader). Se inicializa cuando calledRun = true.
     */
    Module?: {
      calledRun?: boolean
      [key: string]: unknown
    }
  }

  interface Navigator {
    /**
     * Solo Safari iOS: indica si la PWA esta corriendo en modo standalone
     * (instalada en home screen). No estandar — ver navigator.standalone
     * docs en MDN.
     */
    standalone?: boolean
  }
}
