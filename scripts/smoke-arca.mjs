/**
 * ============================================================================
 * SMOKE TEST T16-B — Validación end-to-end de @arcasdk/core contra AFIP
 * ============================================================================
 *
 * Este script existe SOLO para validar el pivote de @afipsdk/afip.js (proxy
 * pago) a @arcasdk/core (SOAP directo a AFIP) hecho el 3-may-2026.
 *
 * Qué hace:
 *   1. Lee la fila única de `arca_config` en Supabase (cert + key encriptados).
 *   2. Desencripta cert + key con AES-256-GCM (misma lógica que arca-credentials.ts).
 *   3. Construye un cliente Arca con la MISMA config que arca-cae.ts
 *      (useHttpsAgent: true, production: !isSandbox, useSoap12 default true).
 *   4. Solicita un CAE para una Factura C de $100 a Consumidor Final, fecha hoy.
 *   5. Imprime el resultado con detalle.
 *
 * Cómo correrlo:
 *   PS C:\...\App-kiosco-main> node scripts/smoke-arca.mjs
 *
 * Requiere variables de entorno (en .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (bypass RLS para leer arca_config)
 *   - MP_ENCRYPTION_KEY           (la misma que usa la app)
 *
 * Borrar el script después de cerrar T16-B (no es código de producción).
 * ============================================================================
 */

import 'dotenv/config'
import { config as dotenvConfig } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv } from 'node:crypto'
import { Arca } from '@arcasdk/core'

// Cargar .env.local explícitamente (Next.js usa este por convención)
dotenvConfig({ path: '.env.local', override: false })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ENCRYPTION_KEY_HEX = process.env.MP_ENCRYPTION_KEY

function fail(msg) {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

if (!SUPABASE_URL) fail('Falta NEXT_PUBLIC_SUPABASE_URL')
if (!SUPABASE_SERVICE_KEY) fail('Falta SUPABASE_SERVICE_ROLE_KEY')
if (!ENCRYPTION_KEY_HEX) fail('Falta MP_ENCRYPTION_KEY')
if (!/^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY_HEX)) {
  fail('MP_ENCRYPTION_KEY debe ser 64 caracteres hex')
}

function decrypt(encrypted) {
  const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex')
  const parts = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Formato de datos encriptados inválido')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(parts[2], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

async function main() {
  console.log('🔍 [1/4] Leyendo arca_config de Supabase...')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
  const { data: config, error } = await supabase
    .from('arca_config')
    .select('cuit, punto_venta, cert_encrypted, key_encrypted, is_sandbox, is_active, razon_social, condicion_iva')
    .maybeSingle()

  if (error) fail(`Error consultando arca_config: ${error.message}`)
  if (!config) fail('No hay fila en arca_config')
  if (!config.cert_encrypted || !config.key_encrypted) fail('Falta cert o key en arca_config')
  if (!config.is_active) fail('arca_config.is_active = false (ARCA desactivado)')

  console.log(`   ✓ CUIT: ${config.cuit}`)
  console.log(`   ✓ Razón social: ${config.razon_social}`)
  console.log(`   ✓ Condición IVA: ${config.condicion_iva}`)
  console.log(`   ✓ Punto de venta: ${config.punto_venta}`)
  console.log(`   ✓ Sandbox: ${config.is_sandbox ? 'SÍ (homologación)' : '⚠️  PRODUCCIÓN'}`)

  if (!config.is_sandbox) {
    fail('PROTECCIÓN: is_sandbox=false. Este script no corre contra producción.')
  }

  console.log('\n🔓 [2/4] Desencriptando cert + key...')
  let certPem, keyPem
  try {
    certPem = decrypt(config.cert_encrypted)
    keyPem = decrypt(config.key_encrypted)
  } catch (e) {
    fail(`Error desencriptando: ${e.message} (¿MP_ENCRYPTION_KEY correcta?)`)
  }
  console.log(`   ✓ Cert: ${certPem.length} caracteres (PEM)`)
  console.log(`   ✓ Key:  ${keyPem.length} caracteres (PEM)`)
  if (!certPem.includes('-----BEGIN CERTIFICATE-----')) fail('Cert no parece PEM válido')
  if (!keyPem.includes('-----BEGIN') || !keyPem.includes('PRIVATE KEY-----')) {
    fail('Key no parece PEM válido')
  }

  console.log('\n🔧 [3/4] Construyendo cliente Arca (sandbox / homologación)...')
  const arca = new Arca({
    cuit: Number(config.cuit),
    cert: certPem,
    key: keyPem,
    production: false, // forzado: este script siempre va a homologación
    useHttpsAgent: true,
    enableLogging: true, // queremos ver qué pasa
  })

  // Construir Factura C de prueba: $100, consumidor final, fecha hoy
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const fechaYYYYMMDD = `${yyyy}${mm}${dd}`

  const voucherData = {
    CantReg: 1,
    PtoVta: config.punto_venta,
    CbteTipo: 11, // Factura C (Monotributo)
    Concepto: 1,  // Productos
    DocTipo: 99,  // Consumidor final sin identificar
    DocNro: 0,
    CbteFch: fechaYYYYMMDD,
    ImpTotal: 100,
    ImpTotConc: 0,
    ImpNeto: 100,
    ImpOpEx: 0,
    ImpIVA: 0,    // Factura C no discrimina IVA
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: 5, // Consumidor Final (RG 5616/2024)
  }

  console.log('\n📤 [4/4] Pidiendo CAE a AFIP homologación (wswhomo.afip.gov.ar)...')
  console.log(`   Comprobante: Factura C, PtoVta ${config.punto_venta}, $100, fecha ${fechaYYYYMMDD}`)

  let result
  try {
    result = await arca.electronicBillingService.createNextInvoice(voucherData)
  } catch (e) {
    console.error('\n❌ AFIP rechazó el pedido:')
    console.error(`   Mensaje: ${e?.message ?? String(e)}`)
    if (e?.stack) {
      console.error('\n   Stack:')
      console.error(e.stack.split('\n').slice(0, 10).map(l => '     ' + l).join('\n'))
    }
    if (e?.response) {
      console.error('\n   Response (primeros 2000 chars):')
      console.error('     ' + JSON.stringify(e.response, null, 2).slice(0, 2000))
    }
    process.exit(2)
  }

  console.log('\n✅ ÉXITO — CAE recibido de AFIP')
  console.log(`   CAE:           ${result.cae}`)
  console.log(`   CAE vto:       ${result.caeFchVto}`)

  // Extraer cbteNumero del response anidado
  let cbteNumero = '?'
  try {
    const det = result.response?.FeDetResp?.FECAEDetResponse
    const detItem = Array.isArray(det) ? det[0] : det
    if (detItem?.CbteDesde !== undefined) cbteNumero = String(detItem.CbteDesde)
  } catch {
    /* ignore */
  }
  console.log(`   Nº comprobante: ${cbteNumero}`)
  console.log('\n🎉 Smoke OK. La cadena cert + key + @arcasdk/core + AFIP funciona.')
  console.log('   Próximo paso: T16-B Task #5 — push a main + smoke real desde la app.\n')
  process.exit(0)
}

main().catch((e) => {
  console.error('\n❌ Error inesperado:')
  console.error(e)
  process.exit(3)
})
