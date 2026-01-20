/**
 * Script de Prueba para Abrir y Cerrar Turnos
 * 
 * Uso:
 * 1. Configura las variables al inicio del archivo
 * 2. Ejecuta: npx ts-node scripts/probar-turnos.ts
 * 
 * O desde la consola del navegador en la app:
 * Copia y pega las funciones directamente
 */

import { createClient } from '@supabase/supabase-js'

// ⚙️ CONFIGURACIÓN - Reemplaza con tus valores
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'TU_SUPABASE_URL'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'TU_SUPABASE_ANON_KEY'

// IDs de prueba - Reemplaza con valores reales
const ORGANIZATION_ID = 'uuid-de-organizacion'
const SUCURSAL_ID = 'uuid-de-sucursal'
const EMPLEADO_ID = 'uuid-de-empleado'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Abre un nuevo turno de caja
 */
export async function abrirTurno(montoInicial: number = 50000) {
  console.log('🟢 Abriendo turno...')
  console.log('Monto inicial:', montoInicial)

  try {
    const { data, error } = await supabase
      .from('caja_diaria')
      .insert({
        organization_id: ORGANIZATION_ID,
        sucursal_id: SUCURSAL_ID,
        empleado_id: EMPLEADO_ID,
        monto_inicial: montoInicial,
        fecha_apertura: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error al abrir turno:', error)
      throw error
    }

    console.log('✅ Turno abierto exitosamente!')
    console.log('ID del turno:', data.id)
    console.log('Fecha de apertura:', data.fecha_apertura)
    
    return data
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  }
}

/**
 * Cierra un turno de caja
 */
export async function cerrarTurno(turnoId: string, montoFinal: number) {
  console.log('🔴 Cerrando turno...')
  console.log('ID del turno:', turnoId)
  console.log('Monto final declarado:', montoFinal)

  try {
    // 1. Obtener datos del turno
    const { data: turno, error: errorTurno } = await supabase
      .from('caja_diaria')
      .select('monto_inicial, empleado_id')
      .eq('id', turnoId)
      .single()

    if (errorTurno || !turno) {
      throw new Error('Turno no encontrado')
    }

    console.log('Monto inicial del turno:', turno.monto_inicial)

    // 2. Calcular ventas en efectivo
    const { data: ventas, error: errorVentas } = await supabase
      .from('stock')
      .select('cantidad, precio_venta_historico')
      .eq('caja_diaria_id', turnoId)
      .eq('metodo_pago', 'efectivo')
      .eq('tipo_movimiento', 'salida')

    if (errorVentas) {
      console.warn('⚠️ Error al obtener ventas:', errorVentas)
    }

    const totalVentasEfectivo = ventas?.reduce(
      (sum, v) => sum + ((v.precio_venta_historico || 0) * (v.cantidad || 1)), 
      0
    ) || 0

    console.log('💰 Ventas en efectivo:', totalVentasEfectivo)

    // 3. Calcular movimientos manuales
    const { data: movimientos, error: errorMovimientos } = await supabase
      .from('movimientos_caja')
      .select('monto, tipo')
      .eq('caja_diaria_id', turnoId)

    if (errorMovimientos) {
      console.warn('⚠️ Error al obtener movimientos:', errorMovimientos)
    }

    const totalIngresos = movimientos?.filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0) || 0
    
    const totalEgresos = movimientos?.filter(m => m.tipo === 'egreso')
      .reduce((sum, m) => sum + m.monto, 0) || 0

    console.log('➕ Ingresos manuales:', totalIngresos)
    console.log('➖ Egresos manuales:', totalEgresos)

    // 4. Calcular dinero esperado
    const dineroEsperado = turno.monto_inicial + totalVentasEfectivo + totalIngresos - totalEgresos
    const diferencia = montoFinal - dineroEsperado

    console.log('📊 Dinero esperado:', dineroEsperado)
    console.log('📊 Diferencia:', diferencia)

    // 5. Cerrar turno
    const { data, error } = await supabase
      .from('caja_diaria')
      .update({
        monto_final: montoFinal,
        diferencia: diferencia,
        fecha_cierre: new Date().toISOString()
      })
      .eq('id', turnoId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error al cerrar turno:', error)
      throw error
    }

    console.log('✅ Turno cerrado exitosamente!')
    console.log('Fecha de cierre:', data.fecha_cierre)
    console.log('Diferencia final:', data.diferencia)

    // 6. Verificar si el arqueo fue exitoso (diferencia <= 100)
    if (Math.abs(diferencia) <= 100) {
      console.log('🏆 ¡Arqueo perfecto! (Diferencia <= $100)')
    } else {
      console.log('⚠️ Arqueo con diferencia significativa')
    }

    return data
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  }
}

/**
 * Obtiene el turno activo de un empleado
 */
export async function obtenerTurnoActivo(empleadoId: string, sucursalId: string) {
  const { data, error } = await supabase
    .from('caja_diaria')
    .select('*')
    .eq('empleado_id', empleadoId)
    .eq('sucursal_id', sucursalId)
    .is('fecha_cierre', null)
    .maybeSingle()

  if (error) {
    console.error('❌ Error al obtener turno activo:', error)
    return null
  }

  return data
}

/**
 * Lista todos los turnos de un empleado
 */
export async function listarTurnos(empleadoId: string, limit: number = 10) {
  const { data, error } = await supabase
    .from('caja_diaria')
    .select('*')
    .eq('empleado_id', empleadoId)
    .order('fecha_apertura', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Error al listar turnos:', error)
    return []
  }

  return data || []
}

/**
 * Ejemplo de uso completo
 */
async function ejemploCompleto() {
  console.log('🧪 Ejemplo completo de apertura y cierre de turno\n')

  try {
    // 1. Abrir turno
    const turno = await abrirTurno(50000)
    const turnoId = turno.id

    console.log('\n--- Esperando 2 segundos ---\n')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 2. Simular algunas operaciones (opcional)
    // Aquí podrías agregar ventas, movimientos, etc.

    // 3. Cerrar turno
    // Simulamos que contamos $75,000 (asumiendo $25,000 en ventas)
    await cerrarTurno(turnoId, 75000)

    console.log('\n✅ Proceso completo finalizado!')
  } catch (error) {
    console.error('\n❌ Error en el proceso:', error)
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  ejemploCompleto()
}

