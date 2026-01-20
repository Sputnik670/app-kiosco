#!/usr/bin/env node

/**
 * Script para conectarse a Supabase y explorar la base de datos
 * Uso: node scripts/conectar-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Faltan credenciales de Supabase en .env.local');
  process.exit(1);
}

// Crear cliente
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('🔌 Conectando a Supabase...');
  console.log(`📍 URL: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Test 1: Verificar conexión
    console.log('🧪 Test 1: Verificando conexión...');
    const { data: testData, error: testError } = await supabase
      .from('organizations')
      .select('id, nombre')
      .limit(1);

    if (testError) {
      console.error('❌ Error de conexión:', testError.message);
      return;
    }

    console.log('✅ Conexión exitosa\n');

    // Test 2: Listar organizaciones
    console.log('📊 Test 2: Organizaciones en la base de datos');
    console.log('─'.repeat(60));
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, nombre, created_at')
      .order('created_at', { ascending: false });

    if (orgsError) {
      console.error('❌ Error:', orgsError.message);
    } else {
      console.log(`Total: ${orgs.length} organizaciones\n`);
      orgs.forEach((org, i) => {
        console.log(`${i + 1}. ${org.nombre || '(Sin nombre)'}`);
        console.log(`   ID: ${org.id}`);
        console.log(`   Creado: ${new Date(org.created_at).toLocaleString('es-AR')}`);
        console.log('');
      });
    }

    // Test 3: Contar sucursales
    console.log('🏪 Test 3: Sucursales');
    console.log('─'.repeat(60));
    const { data: sucursales, error: sucError } = await supabase
      .from('sucursales')
      .select('id, nombre, organization_id, qr_entrada_url, qr_salida_url');

    if (sucError) {
      console.error('❌ Error:', sucError.message);
    } else {
      console.log(`Total: ${sucursales.length} sucursales\n`);

      // Agrupar por organización
      const porOrg = {};
      sucursales.forEach(s => {
        if (!porOrg[s.organization_id]) {
          porOrg[s.organization_id] = [];
        }
        porOrg[s.organization_id].push(s);
      });

      Object.keys(porOrg).forEach(orgId => {
        const org = orgs.find(o => o.id === orgId);
        console.log(`\n📍 ${org?.nombre || 'Organización sin nombre'}`);
        porOrg[orgId].forEach(s => {
          console.log(`   • ${s.nombre}`);
          console.log(`     QR Entrada: ${s.qr_entrada_url ? '✅' : '❌'}`);
          console.log(`     QR Salida: ${s.qr_salida_url ? '✅' : '❌'}`);
        });
      });
    }

    // Test 4: Contar perfiles (usuarios)
    console.log('\n\n👥 Test 4: Perfiles de Usuario');
    console.log('─'.repeat(60));
    const { data: perfiles, error: perfError } = await supabase
      .from('perfiles')
      .select('id, nombre, email, rol, organization_id');

    if (perfError) {
      console.error('❌ Error:', perfError.message);
    } else {
      console.log(`Total: ${perfiles.length} usuarios\n`);

      const duenos = perfiles.filter(p => p.rol === 'dueño');
      const empleados = perfiles.filter(p => p.rol === 'empleado');

      console.log(`🔑 Dueños: ${duenos.length}`);
      duenos.forEach(d => {
        console.log(`   • ${d.nombre || d.email || 'Sin nombre'} (${d.email || 'Sin email'})`);
      });

      console.log(`\n👤 Empleados: ${empleados.length}`);
      empleados.forEach(e => {
        console.log(`   • ${e.nombre || e.email || 'Sin nombre'} (${e.email || 'Sin email'})`);
      });
    }

    // Test 5: Registros de asistencia (últimos 10)
    console.log('\n\n⏰ Test 5: Registros de Asistencia (últimos 10)');
    console.log('─'.repeat(60));
    const { data: asistencias, error: asistError } = await supabase
      .from('asistencia')
      .select(`
        id,
        entrada,
        salida,
        empleado_id,
        sucursal_id,
        sucursales(nombre),
        perfiles(nombre, email)
      `)
      .order('entrada', { ascending: false })
      .limit(10);

    if (asistError) {
      console.error('❌ Error:', asistError.message);
    } else if (!asistencias || asistencias.length === 0) {
      console.log('📭 No hay registros de asistencia aún');
    } else {
      console.log(`Total mostrados: ${asistencias.length}\n`);
      asistencias.forEach((a, i) => {
        const sucursal = a.sucursales?.nombre || 'Sucursal eliminada';
        const empleado = a.perfiles?.nombre || a.perfiles?.email || 'Empleado eliminado';
        const entrada = new Date(a.entrada).toLocaleString('es-AR');
        const salida = a.salida ? new Date(a.salida).toLocaleString('es-AR') : '⏳ En curso';

        console.log(`${i + 1}. ${empleado} - ${sucursal}`);
        console.log(`   📥 Entrada: ${entrada}`);
        console.log(`   📤 Salida:  ${salida}`);
        console.log('');
      });
    }

    // Test 6: Productos (primeros 5)
    console.log('\n📦 Test 6: Productos (primeros 5)');
    console.log('─'.repeat(60));
    const { data: productos, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, costo, codigo_barras, emoji')
      .limit(5);

    if (prodError) {
      console.error('❌ Error:', prodError.message);
    } else if (!productos || productos.length === 0) {
      console.log('📭 No hay productos registrados aún');
    } else {
      productos.forEach((p, i) => {
        console.log(`${i + 1}. ${p.emoji || '📦'} ${p.nombre}`);
        console.log(`   Precio: $${p.precio_venta || 0} | Costo: $${p.costo || 0}`);
        console.log(`   Código barras: ${p.codigo_barras || 'Sin código'}`);
        console.log('');
      });
    }

    // Test 7: Cajas diarias (últimas 5)
    console.log('\n💰 Test 7: Cajas Diarias (últimas 5)');
    console.log('─'.repeat(60));
    const { data: cajas, error: cajasError } = await supabase
      .from('caja_diaria')
      .select(`
        id,
        fecha_apertura,
        fecha_cierre,
        monto_inicial,
        monto_final,
        estado,
        sucursales(nombre),
        perfiles(nombre, email)
      `)
      .order('fecha_apertura', { ascending: false })
      .limit(5);

    if (cajasError) {
      console.error('❌ Error:', cajasError.message);
    } else if (!cajas || cajas.length === 0) {
      console.log('📭 No hay cajas diarias registradas aún');
    } else {
      cajas.forEach((c, i) => {
        const sucursal = c.sucursales?.nombre || 'Sucursal eliminada';
        const empleado = c.perfiles?.nombre || c.perfiles?.email || 'Empleado eliminado';
        const apertura = new Date(c.fecha_apertura).toLocaleString('es-AR');
        const cierre = c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString('es-AR') : '⏳ Abierta';
        const estado = c.estado === 'abierta' ? '🟢 Abierta' : '🔴 Cerrada';

        console.log(`${i + 1}. ${empleado} - ${sucursal}`);
        console.log(`   Estado: ${estado}`);
        console.log(`   Apertura: ${apertura}`);
        console.log(`   Cierre: ${cierre}`);
        console.log(`   Monto inicial: $${c.monto_inicial || 0}`);
        console.log(`   Monto final: $${c.monto_final || 0}`);
        console.log('');
      });
    }

    console.log('\n✅ Conexión completada exitosamente');

  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    console.error(error);
  }
}

main();
