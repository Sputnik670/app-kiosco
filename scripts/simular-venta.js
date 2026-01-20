#!/usr/bin/env node

/**
 * 🛒 SIMULADOR DE VENTAS
 * Permite crear ventas de prueba para ver el impacto inmediato en el dashboard
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('');
console.log('🛒 SIMULADOR DE VENTAS - Dashboard en Tiempo Real');
console.log('═'.repeat(70));
console.log('');

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);
const tipo = args[0] || 'producto'; // 'producto' o 'servicio'
const monto = parseFloat(args[1]) || 100;

async function obtenerDatosBase() {
  console.log('📊 Obteniendo datos de la organización...\n');

  // Obtener primera organización disponible
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, nombre')
    .limit(1)
    .single();

  if (!orgs) {
    console.error('❌ No se encontraron organizaciones');
    console.log('   Primero crea una organización desde la app\n');
    process.exit(1);
  }

  // Obtener primera sucursal de esa organización
  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('organization_id', orgs.id)
    .limit(1)
    .single();

  if (!sucursal) {
    console.error('❌ No se encontraron sucursales');
    console.log('   Primero crea una sucursal desde la app\n');
    process.exit(1);
  }

  // Obtener caja diaria activa o más reciente
  const { data: caja } = await supabase
    .from('caja_diaria')
    .select('id, estado')
    .eq('sucursal_id', sucursal.id)
    .eq('estado', 'abierta')
    .limit(1)
    .single();

  if (!caja) {
    console.log('⚠️  No hay caja abierta, creando una para la simulación...\n');

    const { data: nuevaCaja, error: errorCaja } = await supabase
      .from('caja_diaria')
      .insert({
        organization_id: orgs.id,
        sucursal_id: sucursal.id,
        empleado_id: orgs.id, // Usar org ID como empleado temporal
        estado: 'abierta',
        monto_inicial: 1000,
        fecha_apertura: new Date().toISOString()
      })
      .select()
      .single();

    if (errorCaja) {
      console.error('❌ Error creando caja:', errorCaja.message);
      process.exit(1);
    }

    console.log(`✅ Caja creada: ${nuevaCaja.id}\n`);
    return { org: orgs, sucursal, caja: nuevaCaja };
  }

  return { org: orgs, sucursal, caja };
}

async function simularVentaProducto(org, sucursal, caja, monto) {
  console.log('🏪 Simulando VENTA DE PRODUCTO...\n');

  // Obtener o crear producto de prueba
  let { data: producto } = await supabase
    .from('productos')
    .select('id, nombre, precio_venta, costo')
    .eq('organization_id', org.id)
    .eq('nombre', 'Producto Demo')
    .limit(1)
    .single();

  if (!producto) {
    console.log('📦 Creando producto de prueba...');

    const { data: nuevoProducto, error } = await supabase
      .from('productos')
      .insert({
        organization_id: org.id,
        sucursal_id: sucursal.id,
        nombre: 'Producto Demo',
        categoria: 'Varios',
        precio_venta: monto,
        costo: monto * 0.6,
        emoji: '📦'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creando producto:', error.message);
      return null;
    }

    producto = nuevoProducto;
    console.log(`✅ Producto creado: ${producto.nombre}\n`);
  }

  // Registrar venta en tabla stock
  const { data: venta, error } = await supabase
    .from('stock')
    .insert({
      organization_id: org.id,
      sucursal_id: sucursal.id,
      producto_id: producto.id,
      caja_diaria_id: caja.id,
      tipo_movimiento: 'salida',
      estado: 'vendido',
      cantidad: 1,
      precio_venta_historico: producto.precio_venta,
      costo_unitario_historico: producto.costo,
      metodo_pago: 'efectivo',
      fecha_venta: new Date().toISOString(),
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error registrando venta:', error.message);
    return null;
  }

  console.log('✅ VENTA REGISTRADA:');
  console.log(`   ID: ${venta.id}`);
  console.log(`   Producto: ${producto.nombre}`);
  console.log(`   Monto: $${producto.precio_venta}`);
  console.log(`   Ganancia: $${producto.precio_venta - producto.costo}`);
  console.log(`   Método: ${venta.metodo_pago}`);
  console.log('');

  return venta;
}

async function simularVentaServicio(org, sucursal, caja, monto) {
  console.log('💳 Simulando VENTA DE SERVICIO...\n');

  // Obtener o crear proveedor de servicios
  let { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, nombre')
    .eq('organization_id', org.id)
    .eq('tipo_proveedor', 'servicios')
    .limit(1)
    .single();

  if (!proveedor) {
    console.log('🏢 Creando proveedor de servicios...');

    const { data: nuevoProveedor, error } = await supabase
      .from('proveedores')
      .insert({
        organization_id: org.id,
        sucursal_id: sucursal.id,
        nombre: 'Proveedor Demo Servicios',
        tipo_proveedor: 'servicios',
        saldo_actual: 10000
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creando proveedor:', error.message);
      return null;
    }

    proveedor = nuevoProveedor;
    console.log(`✅ Proveedor creado: ${proveedor.nombre}\n`);
  }

  const montoCarga = monto * 0.95; // El 95% va al proveedor
  const comision = monto * 0.05;   // El 5% es ganancia del kiosco

  // Registrar venta de servicio
  const { data: venta, error } = await supabase
    .from('ventas_servicios')
    .insert({
      organization_id: org.id,
      sucursal_id: sucursal.id,
      caja_diaria_id: caja.id,
      proveedor_id: proveedor.id,
      tipo_servicio: 'Recarga Demo',
      monto_carga: montoCarga,
      comision: comision,
      total_cobrado: monto,
      metodo_pago: 'efectivo',
      fecha_venta: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error registrando servicio:', error.message);
    return null;
  }

  console.log('✅ SERVICIO REGISTRADO:');
  console.log(`   ID: ${venta.id}`);
  console.log(`   Tipo: ${venta.tipo_servicio}`);
  console.log(`   Total cobrado: $${venta.total_cobrado}`);
  console.log(`   Monto carga: $${venta.monto_carga}`);
  console.log(`   Comisión: $${venta.comision}`);
  console.log(`   Método: ${venta.metodo_pago}`);
  console.log('');

  return venta;
}

async function verificarVistaUnificada(org, sucursal) {
  console.log('🔍 Verificando vista unificada...\n');

  const { data: ventas, error } = await supabase
    .from('reportes_ventas_unificados')
    .select('tipo_venta, descripcion, monto_total, ganancia_neta')
    .eq('organization_id', org.id)
    .eq('sucursal_id', sucursal.id)
    .order('fecha_venta', { ascending: false })
    .limit(5);

  if (error) {
    console.error('⚠️  Error consultando vista:', error.message);
    return;
  }

  if (!ventas || ventas.length === 0) {
    console.log('📭 La vista está vacía (sin ventas registradas)');
    return;
  }

  console.log('📊 ÚLTIMAS 5 VENTAS EN DASHBOARD:');
  console.log('─'.repeat(70));

  ventas.forEach((v, i) => {
    const tipo = v.tipo_venta === 'producto' ? '📦' : '💳';
    console.log(`${i + 1}. ${tipo} ${v.descripcion.padEnd(25)} | $${v.monto_total.toFixed(2).padStart(8)} | Ganancia: $${v.ganancia_neta.toFixed(2)}`);
  });

  console.log('─'.repeat(70));
  console.log('');

  const totalVentas = ventas.reduce((sum, v) => sum + v.monto_total, 0);
  const totalGanancia = ventas.reduce((sum, v) => sum + v.ganancia_neta, 0);

  console.log(`💰 Total últimas 5 ventas: $${totalVentas.toFixed(2)}`);
  console.log(`📈 Ganancia neta: $${totalGanancia.toFixed(2)}`);
  console.log('');
}

async function main() {
  try {
    const { org, sucursal, caja } = await obtenerDatosBase();

    console.log('🏢 CONTEXTO:');
    console.log(`   Organización: ${org.nombre}`);
    console.log(`   Sucursal: ${sucursal.nombre}`);
    console.log(`   Caja: ${caja.id} (${caja.estado})`);
    console.log('');
    console.log('═'.repeat(70));
    console.log('');

    let venta;
    if (tipo === 'servicio') {
      venta = await simularVentaServicio(org, sucursal, caja, monto);
    } else {
      venta = await simularVentaProducto(org, sucursal, caja, monto);
    }

    if (!venta) {
      console.error('❌ No se pudo completar la simulación');
      process.exit(1);
    }

    console.log('═'.repeat(70));
    console.log('');

    await verificarVistaUnificada(org, sucursal);

    console.log('🎯 PRÓXIMOS PASOS:');
    console.log('');
    console.log('1. Abre el dashboard en tu navegador');
    console.log('2. Verás la venta reflejada inmediatamente');
    console.log('3. Para simular más ventas:');
    console.log('   - Producto: node scripts/simular-venta.js producto 150');
    console.log('   - Servicio: node scripts/simular-venta.js servicio 200');
    console.log('');
    console.log('═'.repeat(70));
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Mostrar ayuda si se pide
if (args.includes('--help') || args.includes('-h')) {
  console.log('USO:');
  console.log('  node scripts/simular-venta.js [tipo] [monto]');
  console.log('');
  console.log('EJEMPLOS:');
  console.log('  node scripts/simular-venta.js                    # Producto de $100');
  console.log('  node scripts/simular-venta.js producto 250       # Producto de $250');
  console.log('  node scripts/simular-venta.js servicio 150       # Servicio de $150');
  console.log('');
  process.exit(0);
}

main();
