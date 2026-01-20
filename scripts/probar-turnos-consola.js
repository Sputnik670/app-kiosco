/**
 * Script para usar directamente en la consola del navegador
 * 
 * INSTRUCCIONES:
 * 1. Abre la app en el navegador
 * 2. Inicia sesión como empleado
 * 3. Abre la consola (F12)
 * 4. Copia y pega este código completo
 * 5. Ejecuta las funciones según necesites
 */

// ============================================
// FUNCIONES DE PRUEBA PARA TURNOS
// ============================================

/**
 * Abre un nuevo turno de caja
 * @param {number} montoInicial - Monto inicial en efectivo (ej: 50000)
 */
async function abrirTurno(montoInicial = 50000) {
  console.log('🟢 Abriendo turno...')
  
  try {
    // Obtener datos del usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('No hay sesión activa')
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!perfil?.organization_id) {
      throw new Error('No se encontró la organización')
    }

    // Obtener sucursal (primera disponible)
    const { data: sucursal } = await supabase
      .from('sucursales')
      .select('id')
      .eq('organization_id', perfil.organization_id)
      .limit(1)
      .single()

    if (!sucursal) {
      throw new Error('No se encontró sucursal')
    }

    // Abrir turno
    const { data, error } = await supabase
      .from('caja_diaria')
      .insert({
        organization_id: perfil.organization_id,
        sucursal_id: sucursal.id,
        empleado_id: user.id,
        monto_inicial: montoInicial,
        fecha_apertura: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    console.log('✅ Turno abierto exitosamente!')
    console.log('ID del turno:', data.id)
    console.log('Monto inicial:', data.monto_inicial)
    console.log('Fecha de apertura:', data.fecha_apertura)
    
    return data
  } catch (error) {
    console.error('❌ Error al abrir turno:', error.message)
    throw error
  }
}

/**
 * Cierra un turno de caja
 * @param {string} turnoId - ID del turno a cerrar (opcional, usa el activo si no se proporciona)
 * @param {number} montoFinal - Monto final contado en efectivo
 */
async function cerrarTurno(turnoId = null, montoFinal = 50000) {
  console.log('🔴 Cerrando turno...')
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('No hay sesión activa')
    }

    // Si no se proporciona turnoId, buscar el turno activo
    let turnoIdFinal = turnoId
    if (!turnoIdFinal) {
      const { data: sucursal } = await supabase
        .from('sucursales')
        .select('id')
        .limit(1)
        .single()

      const { data: turnoActivo } = await supabase
        .from('caja_diaria')
        .select('id, monto_inicial')
        .eq('empleado_id', user.id)
        .eq('sucursal_id', sucursal?.id)
        .is('fecha_cierre', null)
        .maybeSingle()

      if (!turnoActivo) {
        throw new Error('No hay turno activo para cerrar')
      }

      turnoIdFinal = turnoActivo.id
      console.log('Usando turno activo:', turnoIdFinal)
    }

    // Obtener datos del turno
    const { data: turno } = await supabase
      .from('caja_diaria')
      .select('monto_inicial')
      .eq('id', turnoIdFinal)
      .single()

    if (!turno) {
      throw new Error('Turno no encontrado')
    }

    console.log('Monto inicial:', turno.monto_inicial)

    // Calcular ventas en efectivo
    const { data: ventas } = await supabase
      .from('stock')
      .select('cantidad, precio_venta_historico')
      .eq('caja_diaria_id', turnoIdFinal)
      .eq('metodo_pago', 'efectivo')
      .eq('tipo_movimiento', 'salida')

    const totalVentasEfectivo = ventas?.reduce(
      (sum, v) => sum + ((v.precio_venta_historico || 0) * (v.cantidad || 1)), 
      0
    ) || 0

    console.log('💰 Ventas en efectivo:', totalVentasEfectivo)

    // Calcular movimientos manuales
    const { data: movimientos } = await supabase
      .from('movimientos_caja')
      .select('monto, tipo')
      .eq('caja_diaria_id', turnoIdFinal)

    const totalIngresos = movimientos?.filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0) || 0
    
    const totalEgresos = movimientos?.filter(m => m.tipo === 'egreso')
      .reduce((sum, m) => sum + m.monto, 0) || 0

    console.log('➕ Ingresos manuales:', totalIngresos)
    console.log('➖ Egresos manuales:', totalEgresos)

    // Calcular diferencia
    const dineroEsperado = turno.monto_inicial + totalVentasEfectivo + totalIngresos - totalEgresos
    const diferencia = montoFinal - dineroEsperado

    console.log('📊 Dinero esperado:', dineroEsperado)
    console.log('📊 Diferencia:', diferencia)

    // Cerrar turno
    const { data, error } = await supabase
      .from('caja_diaria')
      .update({
        monto_final: montoFinal,
        diferencia: diferencia,
        fecha_cierre: new Date().toISOString()
      })
      .eq('id', turnoIdFinal)
      .select()
      .single()

    if (error) throw error

    console.log('✅ Turno cerrado exitosamente!')
    console.log('Fecha de cierre:', data.fecha_cierre)
    console.log('Diferencia final:', data.diferencia)

    if (Math.abs(diferencia) <= 100) {
      console.log('🏆 ¡Arqueo perfecto! (Diferencia <= $100)')
    } else {
      console.log('⚠️ Arqueo con diferencia significativa')
    }

    return data
  } catch (error) {
    console.error('❌ Error al cerrar turno:', error.message)
    throw error
  }
}

/**
 * Obtiene el turno activo del empleado actual
 */
async function obtenerTurnoActivo() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('No hay sesión activa')
    }

    const { data: sucursal } = await supabase
      .from('sucursales')
      .select('id')
      .limit(1)
      .single()

    const { data, error } = await supabase
      .from('caja_diaria')
      .select('*')
      .eq('empleado_id', user.id)
      .eq('sucursal_id', sucursal?.id)
      .is('fecha_cierre', null)
      .maybeSingle()

    if (error) throw error

    if (data) {
      console.log('✅ Turno activo encontrado:')
      console.log('ID:', data.id)
      console.log('Monto inicial:', data.monto_inicial)
      console.log('Fecha de apertura:', data.fecha_apertura)
    } else {
      console.log('ℹ️ No hay turno activo')
    }

    return data
  } catch (error) {
    console.error('❌ Error:', error.message)
    return null
  }
}

/**
 * Lista los últimos turnos del empleado actual
 */
async function listarTurnos(limit = 10) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('No hay sesión activa')
    }

    const { data, error } = await supabase
      .from('caja_diaria')
      .select('*')
      .eq('empleado_id', user.id)
      .order('fecha_apertura', { ascending: false })
      .limit(limit)

    if (error) throw error

    console.log(`📋 Últimos ${data?.length || 0} turnos:`)
    data?.forEach((turno, index) => {
      console.log(`${index + 1}. ID: ${turno.id}`)
      console.log(`   Apertura: ${turno.fecha_apertura}`)
      console.log(`   Cierre: ${turno.fecha_cierre || 'Pendiente'}`)
      console.log(`   Monto inicial: $${turno.monto_inicial}`)
      console.log(`   Monto final: ${turno.monto_final ? '$' + turno.monto_final : 'N/A'}`)
      console.log(`   Diferencia: ${turno.diferencia !== null ? '$' + turno.diferencia : 'N/A'}`)
      console.log('')
    })

    return data || []
  } catch (error) {
    console.error('❌ Error:', error.message)
    return []
  }
}

// ============================================
// EJEMPLOS DE USO
// ============================================

console.log(`
╔════════════════════════════════════════╗
║   FUNCIONES DE PRUEBA PARA TURNOS      ║
╚════════════════════════════════════════╝

Funciones disponibles:
1. abrirTurno(montoInicial)     - Abre un nuevo turno
2. cerrarTurno(turnoId, monto)  - Cierra un turno
3. obtenerTurnoActivo()          - Obtiene el turno activo
4. listarTurnos(limit)           - Lista los últimos turnos

Ejemplos:
  await abrirTurno(50000)
  await cerrarTurno(null, 75000)
  await obtenerTurnoActivo()
  await listarTurnos(5)
`)

