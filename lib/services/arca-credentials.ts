/**
 * ============================================================================
 * ARCA CREDENTIALS — Lectura y desencripción de cert + key por organización
 * ============================================================================
 *
 * Helper compartido para leer las credenciales fiscales encriptadas de una
 * organización y desencriptarlas en memoria, listas para pasar a la capa de
 * comunicación con AFIP (lib/services/arca-cae.ts).
 *
 * Centraliza el algoritmo AES-256-GCM que antes estaba duplicado en:
 * - arca.actions.ts (privado)
 * - mercadopago.actions.ts (privado, mismo MP_ENCRYPTION_KEY)
 *
 * El secret MP_ENCRYPTION_KEY es compartido a propósito — un solo secret
 * por env evita rotación quirúrgica por feature. Si alguna vez se separa,
 * agregar ARCA_ENCRYPTION_KEY como override y dejar MP_ENCRYPTION_KEY como
 * fallback histórico.
 *
 * NO es 'use server' — invocable solo desde server actions que validan auth.
 * ============================================================================
 */

import { createClient } from '@/lib/supabase-server'
import { createDecipheriv } from 'crypto'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'

export interface ArcaCredentials {
  certPem: string
  keyPem: string
  isSandbox: boolean
  cuit: string
  puntoVenta: number
}

export interface DecryptArcaCredentialsResult {
  success: boolean
  credentials?: ArcaCredentials
  error?: string
}

/**
 * Lee y desencripta las credenciales ARCA de una organización.
 * Retorna error claro si falta config, falta certificado o falla la desencripción.
 */
export async function decryptArcaCredentials(
  organizationId: string
): Promise<DecryptArcaCredentialsResult> {
  try {
    const supabase = await createClient()

    const { data: config, error } = await supabase
      .from('arca_config')
      .select('cuit, punto_venta, cert_encrypted, key_encrypted, is_sandbox, is_active')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error) {
      return { success: false, error: 'Error consultando configuración ARCA' }
    }
    if (!config) {
      return { success: false, error: 'No hay configuración ARCA para esta organización' }
    }
    if (!config.cert_encrypted || !config.key_encrypted) {
      return { success: false, error: 'Falta el certificado digital. Subilo en Ajustes → ARCA' }
    }
    if (!config.is_active) {
      return { success: false, error: 'ARCA está desactivado para esta organización' }
    }

    let certPem: string
    let keyPem: string
    try {
      certPem = decrypt(config.cert_encrypted)
      keyPem = decrypt(config.key_encrypted)
    } catch {
      return { success: false, error: 'Error desencriptando certificado (clave de encriptación inválida)' }
    }

    return {
      success: true,
      credentials: {
        certPem,
        keyPem,
        isSandbox: config.is_sandbox ?? true,
        cuit: config.cuit,
        puntoVenta: config.punto_venta,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ----------------------------------------------------------------------------
// FUNCIÓN INTERNA
// ----------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.MP_ENCRYPTION_KEY
  if (!keyEnv) throw new Error('MP_ENCRYPTION_KEY no está configurada')
  if (!/^[0-9a-f]{64}$/i.test(keyEnv)) {
    throw new Error('MP_ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales')
  }
  return Buffer.from(keyEnv, 'hex')
}

function decrypt(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Formato de datos encriptados inválido')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(parts[2], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
