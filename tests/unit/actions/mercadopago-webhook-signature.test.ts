/**
 * Tests P0: lib/mercadopago/webhook-signature.ts
 *
 * Verifica el algoritmo HMAC-SHA256 que valida los webhooks de Mercado Pago.
 *
 * Estos tests son DETERMINISTICOS — usan crypto del nodo (no se mockea)
 * para computar el HMAC con un secret fijo y verificar que la funcion
 * `verifyMercadoPagoSignature` lo acepta. Si el algoritmo se rompe (por ej.
 * cambio del separador, lowercase mal aplicado, hex vs base64) los tests
 * fallan inmediatamente.
 *
 * IMPORTANTE: si en prod el HMAC esta fallando pero estos tests pasan,
 * el bug NO esta en el algoritmo — esta en los inputs (dataId, requestId,
 * secret, timestamp). Ver `app/api/mercadopago/webhook/route.ts` para
 * como se construyen esos inputs.
 *
 * Template oficial de MP:
 *   `id:${dataId};request-id:${requestId};ts:${timestamp};`
 */
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  parseSignatureHeader,
  verifyMercadoPagoSignature,
  buildSignatureTemplate,
} from '@/lib/mercadopago/webhook-signature'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Computa el HMAC-SHA256 esperado para un set de inputs. Replica exactamente
 * el algoritmo del template oficial de MP. Si ESTA implementacion difiere
 * de `verifyMercadoPagoSignature`, hay un bug en alguno de los dos lados.
 */
function computeExpectedHmac(
  timestamp: number,
  requestId: string,
  dataId: string,
  secret: string
): string {
  const template = `id:${dataId};request-id:${requestId};ts:${timestamp};`
  return crypto.createHmac('sha256', secret).update(template).digest('hex')
}

// ─── Test fixtures ───────────────────────────────────────────────────────────

const FAKE_SECRET = 'a-very-fake-secret-just-for-tests-1234567890'
const FAKE_DATA_ID = 'abc123def456'
const FAKE_REQUEST_ID = 'req_xyz_789'
const FAKE_TIMESTAMP = 1714000000 // segundos (unix epoch fijo)

// ─── Tests: parseSignatureHeader ─────────────────────────────────────────────

describe('parseSignatureHeader', () => {
  it('parsea un header valido con formato ts=...,v1=...', () => {
    const result = parseSignatureHeader('ts=1234567890,v1=abc123def')
    expect(result).toEqual({ ts: 1234567890, v1: 'abc123def' })
  })

  it('parsea un header con orden invertido (v1 primero)', () => {
    const result = parseSignatureHeader('v1=abc123,ts=999')
    expect(result).toEqual({ ts: 999, v1: 'abc123' })
  })

  it('devuelve null si falta ts', () => {
    expect(parseSignatureHeader('v1=abc123')).toBeNull()
  })

  it('devuelve null si falta v1', () => {
    expect(parseSignatureHeader('ts=1234')).toBeNull()
  })

  it('devuelve null si ts no es numerico', () => {
    expect(parseSignatureHeader('ts=notanumber,v1=abc')).toBeNull()
  })

  it('devuelve null si v1 esta vacio', () => {
    expect(parseSignatureHeader('ts=1234,v1=')).toBeNull()
  })

  it('devuelve null si el header esta vacio', () => {
    expect(parseSignatureHeader('')).toBeNull()
  })

  it('ignora partes extras del header (forward-compat)', () => {
    const result = parseSignatureHeader('ts=1234,v1=abc,extra=foo')
    expect(result).toEqual({ ts: 1234, v1: 'abc' })
  })
})

// ─── Tests: buildSignatureTemplate ───────────────────────────────────────────

describe('buildSignatureTemplate', () => {
  it('arma el template con el formato oficial de MP', () => {
    const template = buildSignatureTemplate(1714000000, 'req_xyz', 'abc123')
    expect(template).toBe('id:abc123;request-id:req_xyz;ts:1714000000;')
  })

  it('mantiene el punto y coma final (MP exige el trailing semicolon)', () => {
    const template = buildSignatureTemplate(1, 'r', 'd')
    expect(template.endsWith(';')).toBe(true)
  })

  it('NO modifica el case del dataId (la normalizacion es responsabilidad del caller)', () => {
    // Si MP pasa el dataId en MAYUSCULAS y no lo lowercaseamos antes,
    // este template lo conserva tal cual.
    const template = buildSignatureTemplate(1, 'r', 'ABCDEF')
    expect(template).toContain('id:ABCDEF;')
  })
})

// ─── Tests: verifyMercadoPagoSignature ───────────────────────────────────────

describe('verifyMercadoPagoSignature', () => {
  it('acepta una firma valida computada con el mismo secret e inputs', () => {
    const expectedV1 = computeExpectedHmac(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET
    )

    const result = verifyMercadoPagoSignature(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET,
      expectedV1
    )

    expect(result).toBe(true)
  })

  it('rechaza una firma con secret distinto (mismo input)', () => {
    const expectedV1 = computeExpectedHmac(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      'OTRO-secret-distinto'
    )

    const result = verifyMercadoPagoSignature(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET, // secret correcto pero la firma se computo con otro
      expectedV1
    )

    expect(result).toBe(false)
  })

  it('rechaza si el dataId difiere (caso lowercase mal aplicado)', () => {
    const expectedV1 = computeExpectedHmac(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID.toUpperCase(), // MP firmo con uppercase
      FAKE_SECRET
    )

    const result = verifyMercadoPagoSignature(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID, // nosotros pasamos lowercase
      FAKE_SECRET,
      expectedV1
    )

    expect(result).toBe(false)
  })

  it('rechaza si el requestId difiere', () => {
    const expectedV1 = computeExpectedHmac(
      FAKE_TIMESTAMP,
      'otro-request-id',
      FAKE_DATA_ID,
      FAKE_SECRET
    )

    const result = verifyMercadoPagoSignature(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET,
      expectedV1
    )

    expect(result).toBe(false)
  })

  it('rechaza si el timestamp difiere', () => {
    const expectedV1 = computeExpectedHmac(
      FAKE_TIMESTAMP + 1,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET
    )

    const result = verifyMercadoPagoSignature(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET,
      expectedV1
    )

    expect(result).toBe(false)
  })

  it('rechaza un v1 con longitud incorrecta sin lanzar excepcion', () => {
    const result = verifyMercadoPagoSignature(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET,
      'abc' // demasiado corto para ser un sha256 hex
    )

    expect(result).toBe(false)
  })

  it('rechaza un v1 con caracteres no-hex sin lanzar excepcion', () => {
    // Buffer.from('zzz...', 'hex') puede tirar warning o devolver buffer vacio
    // segun la version de node — la funcion debe atrapar y devolver false.
    const garbage = 'z'.repeat(64)
    const result = verifyMercadoPagoSignature(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET,
      garbage
    )

    expect(result).toBe(false)
  })

  it('produce resultados determinist­icos (mismo input = mismo HMAC)', () => {
    const v1a = computeExpectedHmac(FAKE_TIMESTAMP, FAKE_REQUEST_ID, FAKE_DATA_ID, FAKE_SECRET)
    const v1b = computeExpectedHmac(FAKE_TIMESTAMP, FAKE_REQUEST_ID, FAKE_DATA_ID, FAKE_SECRET)
    expect(v1a).toBe(v1b)
    expect(v1a).toHaveLength(64) // sha256 = 32 bytes = 64 hex chars
  })
})

// ─── Tests: round-trip parse + verify ────────────────────────────────────────

describe('round-trip parseSignatureHeader → verifyMercadoPagoSignature', () => {
  it('una firma generada y empaquetada en x-signature se valida correctamente', () => {
    // Simulamos lo que MP haria del lado del servidor:
    // 1. Computa el HMAC con el template oficial.
    // 2. Lo empaqueta como `ts=...,v1=...` en el header x-signature.
    // 3. Nosotros lo parseamos y verificamos.

    const expectedV1 = computeExpectedHmac(
      FAKE_TIMESTAMP,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET
    )
    const xSignatureHeader = `ts=${FAKE_TIMESTAMP},v1=${expectedV1}`

    const parsed = parseSignatureHeader(xSignatureHeader)
    expect(parsed).not.toBeNull()
    expect(parsed!.ts).toBe(FAKE_TIMESTAMP)
    expect(parsed!.v1).toBe(expectedV1)

    const isValid = verifyMercadoPagoSignature(
      parsed!.ts,
      FAKE_REQUEST_ID,
      FAKE_DATA_ID,
      FAKE_SECRET,
      parsed!.v1
    )
    expect(isValid).toBe(true)
  })
})
