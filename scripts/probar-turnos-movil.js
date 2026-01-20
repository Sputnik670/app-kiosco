/**
 * Script MÓVIL para Probar Turnos
 * Versión simplificada y optimizada para usar en celular
 * 
 * INSTRUCCIONES:
 * 1. Abre la app en tu celular
 * 2. Inicia sesión como empleado
 * 3. Abre la consola del navegador (en Chrome: menú > Más herramientas > Consola)
 * 4. Copia TODO este código y pégalo
 * 5. Presiona Enter
 * 6. Usa las funciones simples
 */

// ============================================
// FUNCIONES SIMPLES PARA MÓVIL
// ============================================

// Abrir turno con $50,000
async function abrir() {
  const {data:{user}} = await supabase.auth.getUser()
  const {data:p} = await supabase.from('perfiles').select('organization_id').eq('id',user.id).single()
  const {data:s} = await supabase.from('sucursales').select('id').eq('organization_id',p.organization_id).limit(1).single()
  const {data:t} = await supabase.from('caja_diaria').insert({organization_id:p.organization_id,sucursal_id:s.id,empleado_id:user.id,monto_inicial:50000,fecha_apertura:new Date().toISOString()}).select().single()
  console.log('✅ Turno abierto:',t.id)
  return t
}

// Cerrar turno con $75,000
async function cerrar(monto=75000) {
  const {data:{user}} = await supabase.auth.getUser()
  const {data:s} = await supabase.from('sucursales').select('id').limit(1).single()
  const {data:c} = await supabase.from('caja_diaria').select('id,monto_inicial').eq('empleado_id',user.id).eq('sucursal_id',s.id).is('fecha_cierre',null).single()
  const {data:v} = await supabase.from('stock').select('cantidad,precio_venta_historico').eq('caja_diaria_id',c.id).eq('metodo_pago','efectivo').eq('tipo_movimiento','salida')
  const {data:m} = await supabase.from('movimientos_caja').select('monto,tipo').eq('caja_diaria_id',c.id)
  const ventas = v?.reduce((s,v)=>s+((v.precio_venta_historico||0)*(v.cantidad||1)),0)||0
  const ingresos = m?.filter(x=>x.tipo==='ingreso').reduce((s,x)=>s+x.monto,0)||0
  const egresos = m?.filter(x=>x.tipo==='egreso').reduce((s,x)=>s+x.monto,0)||0
  const esperado = c.monto_inicial+ventas+ingresos-egresos
  const diff = monto-esperado
  const {data:r} = await supabase.from('caja_diaria').update({monto_final:monto,diferencia:diff,fecha_cierre:new Date().toISOString()}).eq('id',c.id).select().single()
  console.log('✅ Turno cerrado. Diferencia:',diff)
  return r
}

// Ver turno activo
async function ver() {
  const {data:{user}} = await supabase.auth.getUser()
  const {data:s} = await supabase.from('sucursales').select('id').limit(1).single()
  const {data:t} = await supabase.from('caja_diaria').select('*').eq('empleado_id',user.id).eq('sucursal_id',s.id).is('fecha_cierre',null).maybeSingle()
  if(t) console.log('✅ Turno activo:',t.id,'Monto:',t.monto_inicial)
  else console.log('ℹ️ No hay turno activo')
  return t
}

console.log('📱 Funciones cargadas! Usa: abrir(), cerrar(75000), ver()')

