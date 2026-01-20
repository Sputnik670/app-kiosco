/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 💰 CAJA SERVER ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Server Actions para gestión de caja diaria (arqueo).
 * Incluye lógica crítica de dinero, auditoría y gamificación.
 *
 * PATRÓN:
 * - Server Actions (Next.js 14+)
 * - Auditoría completa de efectivo
 * - Gamificación automática (XP + misiones)
 * - Validación de precisión de arqueo
 *
 * ORIGEN: Refactorización de arqueo-caja.tsx
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import { format, addDays } from 'date-fns'

// ───────────────────────────────────────────────────────────────────────────────
// TIPOS
// ───────────────────────────────────────────────────────────────────────────────

export interface AbrirCajaResult {
  success: boolean
  cajaId?: string
  error?: string
}

export interface CerrarCajaResult {
  success: boolean
  exitoArqueo: boolean
  dineroEsperado: number
  montoDeclarado: number
  desvio: number
  detalles?: {
    montoInicial: number
    totalVentasEfectivo: number
    totalIngresosExtra: number
    totalGastos: number
  }
  error?: string
}

// ───────────────────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🎯 Genera misiones automáticas al abrir caja
 *
 * LÓGICA (preservada del componente original):
 * 1. Misión de vencimientos (si hay stock crítico)
 * 2. Misión de arqueo de cierre (siempre)
 * 3. Misiones desde plantillas (configuradas por el dueño)
 */
async function generarMisiones(
  cajaId: string,
  empleadoId: string,
  organizationId: string,
  sucursalId: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const hoy = new Date()
    const fechaLimite = format(addDays(hoy, 10), 'yyyy-MM-dd')

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 1: Consultar stock crítico (próximo a vencer)
    // ─────────────────────────────────────────────────────────────────────────

    const { data: stockCritico } = await supabase
      .from('stock')
      .select('cantidad')
      .eq('sucursal_id', sucursalId)
      .eq('tipo_movimiento', 'entrada')
      .eq('estado', 'disponible')
      .lt('fecha_vencimiento', fechaLimite)

    const totalUnidadesRiesgo = (stockCritico as Array<{ cantidad: number }> | null)?.reduce(
      (acc, curr) => acc + (curr.cantidad || 0),
      0
    ) || 0

    const misionesABulkInsert = []

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear misión de vencimientos (si hay unidades críticas)
    // ─────────────────────────────────────────────────────────────────────────

    if (totalUnidadesRiesgo > 0) {
      misionesABulkInsert.push({
        organization_id: organizationId,
        empleado_id: empleadoId,
        caja_diaria_id: cajaId,
        tipo: 'vencimiento',
        descripcion: `Rotación Preventiva: Colocar al frente ${totalUnidadesRiesgo} unidades próximas a vencer.`,
        objetivo_unidades: totalUnidadesRiesgo,
        unidades_completadas: 0,
        es_completada: false,
        puntos: 30,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 3: Crear misión de arqueo de cierre (siempre)
    // ─────────────────────────────────────────────────────────────────────────

    misionesABulkInsert.push({
      organization_id: organizationId,
      empleado_id: empleadoId,
      caja_diaria_id: cajaId,
      tipo: 'arqueo_cierre',
      descripcion: 'Realizar el cierre de caja con precisión total.',
      objetivo_unidades: 1,
      unidades_completadas: 0,
      es_completada: false,
      puntos: 20,
    })

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 4: Agregar plantillas de misiones configuradas
    // ─────────────────────────────────────────────────────────────────────────

    const { data: plantillas } = await supabase
      .from('plantillas_misiones')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('activa', true)
      .or(`sucursal_id.is.null,sucursal_id.eq.${sucursalId}`)

    if (plantillas) {
      plantillas.forEach((p) => {
        misionesABulkInsert.push({
          organization_id: organizationId,
          empleado_id: empleadoId,
          caja_diaria_id: cajaId,
          tipo: 'manual',
          descripcion: p.descripcion,
          objetivo_unidades: 1,
          unidades_completadas: 0,
          es_completada: false,
          puntos: p.puntos,
        })
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PASO 5: Insertar todas las misiones en bulk
    // ─────────────────────────────────────────────────────────────────────────

    if (misionesABulkInsert.length > 0) {
      await (supabase.from('misiones') as any).insert(misionesABulkInsert)
    }
  } catch (error) {
    console.error('Error generando misiones:', error)
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// SERVER ACTIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * 🔓 Abre una nueva caja diaria y genera misiones automáticas
 *
 * FLUJO:
 * 1. Valida sesión y organización
 * 2. Crea registro en caja_diaria
 * 3. Genera misiones automáticas (vencimientos + arqueo + plantillas)
 *
 * @param montoInicial - Monto base de cambio al inicio del turno
 * @param sucursalId - ID de la sucursal
 * @returns AbrirCajaResult - Resultado con ID de caja o error
 */
export async function abrirCajaAction(
  montoInicial: number,
  sucursalId: string
): Promise<AbrirCajaResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: Validar sesión y obtener organización
    // ───────────────────────────────────────────────────────────────────────────

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        success: false,
        error: 'No hay sesión activa',
      }
    }

    const { data: orgId } = await supabase.rpc('get_my_org_id_v2')

    if (!orgId) {
      return {
        success: false,
        error: 'No se encontró tu organización. Por favor, cierra sesión e inicia de nuevo.',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: Crear registro de caja diaria
    // ───────────────────────────────────────────────────────────────────────────

    const { data: caja, error: cajaError } = await supabase
      .from('caja_diaria')
      .insert({
        organization_id: orgId,
        sucursal_id: sucursalId,
        monto_inicial: montoInicial,
        empleado_id: user.id,
        fecha_apertura: new Date().toISOString(),
      })
      .select()
      .single()

    if (cajaError || !caja) {
      return {
        success: false,
        error: 'Error al crear la caja diaria',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: Generar misiones automáticas
    // ───────────────────────────────────────────────────────────────────────────

    await generarMisiones(caja.id, user.id, orgId, sucursalId)

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO EXITOSO
    // ───────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      cajaId: caja.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al abrir caja',
    }
  }
}

/**
 * 🔒 Cierra la caja diaria con auditoría completa y gamificación
 *
 * FLUJO CRÍTICO (preservado exactamente del componente original):
 * 1. Calcula ventas en efectivo desde vista unificada (productos + servicios)
 * 2. Calcula movimientos manuales (excluyendo ventas para evitar duplicación)
 * 3. Aplica fórmula: (Base + Ventas + Ingresos) - Gastos = Esperado
 * 4. Valida precisión del arqueo (tolerancia ±$100)
 * 5. Si es preciso: Completa misión + Otorga XP + Confetti
 * 6. Guarda cierre con diferencia
 *
 * @param cajaId - ID de la caja a cerrar
 * @param montoDeclarado - Efectivo físico contado por el empleado
 * @returns CerrarCajaResult - Resultado con auditoría completa
 *
 * ⚠️ IMPORTANTE: NO MODIFICAR LA LÓGICA DE CÁLCULO
 * Esta fórmula fue validada para manejar correctamente servicios virtuales (SUBE)
 */
export async function cerrarCajaAction(
  cajaId: string,
  montoDeclarado: number
): Promise<CerrarCajaResult> {
  try {
    const supabase = await createClient()

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 0: Obtener datos de la caja
    // ───────────────────────────────────────────────────────────────────────────

    const { data: caja } = await supabase
      .from('caja_diaria')
      .select('id, monto_inicial, empleado_id, organization_id')
      .eq('id', cajaId)
      .single<{
        id: string
        monto_inicial: number
        empleado_id: string
        organization_id: string
      }>()

    if (!caja) {
      return {
        success: false,
        exitoArqueo: false,
        dineroEsperado: 0,
        montoDeclarado: 0,
        desvio: 0,
        error: 'No se encontró la caja',
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 1: CALCULAR VENTAS EN EFECTIVO (Vista: reportes_ventas_unificados)
    // ───────────────────────────────────────────────────────────────────────────
    // 🆕 USANDO VISTA UNIFICADA: Productos físicos + Servicios virtuales en 1 query
    // ⚠️ IMPORTANTE: monto_total YA incluye todo lo cobrado al cliente
    //    - Para producto físico: monto_total = precio × cantidad
    //    - Para SUBE: monto_total = total_cobrado (monto_carga + comision)
    //    Ejemplo SUBE: Cliente paga $2,050 → monto_total = 2050

    const { data: ventasData } = await (supabase as any)
      .from('reportes_ventas_unificados')
      .select('monto_total, unidades_vendidas')
      .eq('caja_diaria_id', cajaId)
      .eq('metodo_pago', 'efectivo')

    const totalVentasEfectivo = ventasData?.reduce((sum: number, item: any) => {
      return sum + Number(item.monto_total || 0)
    }, 0) || 0

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 2: CALCULAR MOVIMIENTOS MANUALES (Tabla: movimientos_caja)
    // ───────────────────────────────────────────────────────────────────────────
    // Solo queremos movimientos MANUALES (cambio chico, gastos varios)
    // ⚠️ CRÍTICO: Excluir categoria='ventas' para no duplicar lo calculado arriba

    const { data: movimientosData } = await supabase
      .from('movimientos_caja')
      .select('monto, tipo, categoria, descripcion')
      .eq('caja_diaria_id', cajaId)
      .neq('categoria', 'ventas') // <--- FILTRO ESENCIAL: Sin esto, duplicamos ventas

    const totalIngresosExtra = movimientosData?.filter((m) => m.tipo === 'ingreso')
      .reduce((sum, item) => sum + Number(item.monto), 0) || 0

    const totalGastos = movimientosData?.filter((m) => m.tipo === 'egreso')
      .reduce((sum, item) => sum + Number(item.monto), 0) || 0

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 3: ECUACIÓN FINAL DEL EFECTIVO ESPERADO
    // ───────────────────────────────────────────────────────────────────────────
    // 🧮 Fórmula: (Base Inicial + Ventas Efectivo + Ingresos Manuales) - Gastos
    //
    // 📊 Ejemplo con SUBE:
    // - Monto inicial: $10,000
    // - Venta producto: +$500 (efectivo)
    // - Venta SUBE: +$2,050 (efectivo) ← Cliente entrega $2,050 físicos
    // - Total esperado: $10,000 + $500 + $2,050 = $12,550
    //
    // ⚠️ NUNCA restamos costo_unitario_historico (costo virtual de la carga)
    //    porque ese dinero NO sale físicamente de la caja

    const dineroEsperado =
      Number(caja.monto_inicial) + totalVentasEfectivo + totalIngresosExtra - totalGastos

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 4: CALCULAR DIFERENCIA Y VALIDAR PRECISIÓN
    // ───────────────────────────────────────────────────────────────────────────

    const desvio = montoDeclarado - dineroEsperado
    const exitoArqueo = Math.abs(desvio) <= 100 // Tolerancia de $100

    // 📋 LOG DE AUDITORÍA (para debugging)
    console.log('═══════════════════════════════════════════════════════════')
    console.log('📊 AUDITORÍA DE CIERRE DE CAJA (VISTA UNIFICADA)')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('💰 Monto Inicial:', Number(caja.monto_inicial))
    console.log('🛒 Ventas en Efectivo (Productos + Servicios):', totalVentasEfectivo)
    console.log(
      '   └─ Detalle ventas:',
      ventasData?.map((v: any) => ({
        monto_total: v.monto_total,
        unidades: v.unidades_vendidas,
      }))
    )
    console.log('➕ Ingresos Manuales:', totalIngresosExtra)
    console.log('➖ Gastos:', totalGastos)
    console.log('🎯 Efectivo Esperado:', dineroEsperado)
    console.log('💵 Efectivo Declarado:', montoDeclarado)
    console.log('📊 Diferencia:', desvio)
    console.log('✅ Precisión:', exitoArqueo ? 'APROBADO' : 'DESVÍO')
    console.log('═══════════════════════════════════════════════════════════')

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 5: GAMIFICACIÓN - COMPLETAR MISIÓN Y OTORGAR XP
    // ───────────────────────────────────────────────────────────────────────────

    if (exitoArqueo) {
      // Completar misión de arqueo
      await supabase
        .from('misiones')
        .update({ es_completada: true, unidades_completadas: 1 })
        .eq('caja_diaria_id', cajaId)
        .eq('tipo', 'arqueo_cierre')

      // Otorgar XP al empleado
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('xp')
        .eq('id', caja.empleado_id)
        .single<{ xp: number | null }>()

      if (perfil && perfil.xp !== null) {
        await supabase
          .from('perfiles')
          .update({ xp: perfil.xp + 20 })
          .eq('id', caja.empleado_id)
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // PASO 6: GUARDAR CIERRE EN BASE DE DATOS
    // ───────────────────────────────────────────────────────────────────────────

    await supabase
      .from('caja_diaria')
      .update({
        monto_final: montoDeclarado,
        diferencia: desvio,
        fecha_cierre: new Date().toISOString(),
      })
      .eq('id', cajaId)

    // ───────────────────────────────────────────────────────────────────────────
    // RETORNO CON AUDITORÍA COMPLETA
    // ───────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      exitoArqueo,
      dineroEsperado,
      montoDeclarado,
      desvio,
      detalles: {
        montoInicial: Number(caja.monto_inicial),
        totalVentasEfectivo,
        totalIngresosExtra,
        totalGastos,
      },
    }
  } catch (error) {
    console.error('❌ Error en cierre de caja:', error)
    return {
      success: false,
      exitoArqueo: false,
      dineroEsperado: 0,
      montoDeclarado: 0,
      desvio: 0,
      error: error instanceof Error ? error.message : 'Error desconocido al cerrar caja',
    }
  }
}
