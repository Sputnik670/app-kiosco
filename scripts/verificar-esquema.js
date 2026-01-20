#!/usr/bin/env node

/**
 * Script para verificar el esquema de la base de datos en Supabase
 * Compara las tablas existentes con el esquema esperado
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Faltan credenciales de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tablas esperadas según el esquema (14 tablas - alfabéticamente ordenadas)
const TABLAS_ESPERADAS = [
  'asistencia',           // Fichaje de empleados (entrada/salida)
  'caja_diaria',          // Cajas de turnos
  'compras',              // Compras a proveedores
  'historial_precios',    // Histórico de cambios de precio
  'misiones',             // Gamificación (misiones activas)
  'movimientos_caja',     // Movimientos de dinero en caja
  'organizations',        // Empresas/Organizaciones
  'pending_invites',      // Invitaciones pendientes de empleados
  'perfiles',             // Usuarios (dueños y empleados)
  'plantillas_misiones',  // Templates de misiones
  'productos',            // Catálogo de productos
  'proveedores',          // Proveedores
  'stock',                // Movimientos de inventario
  'sucursales'            // Locales/Sucursales
];

async function verificarTabla(nombreTabla) {
  try {
    const { error } = await supabase
      .from(nombreTabla)
      .select('*')
      .limit(0); // Solo verificar estructura, no datos

    return { nombre: nombreTabla, existe: !error, error: error?.message };
  } catch (err) {
    return { nombre: nombreTabla, existe: false, error: err.message };
  }
}

async function main() {
  console.log('🔍 Verificando esquema de Supabase');
  console.log('─'.repeat(60));
  console.log('');

  const resultados = await Promise.all(
    TABLAS_ESPERADAS.map(tabla => verificarTabla(tabla))
  );

  console.log('📊 ESTADO DE LAS TABLAS\n');

  const existentes = resultados.filter(r => r.existe);
  const faltantes = resultados.filter(r => !r.existe);

  console.log(`✅ Tablas existentes: ${existentes.length}/${TABLAS_ESPERADAS.length}\n`);
  existentes.forEach(r => {
    console.log(`   ✓ ${r.nombre}`);
  });

  if (faltantes.length > 0) {
    console.log(`\n❌ Tablas faltantes: ${faltantes.length}\n`);
    faltantes.forEach(r => {
      console.log(`   ✗ ${r.nombre}`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });

    console.log('\n⚠️  ACCIÓN REQUERIDA:');
    console.log('   Las siguientes tablas faltan en la base de datos.');
    console.log('   Necesitas ejecutar el script SQL del esquema:\n');
    console.log('   1. Abre Supabase Dashboard: https://supabase.com/dashboard');
    console.log('   2. Ve a SQL Editor');
    console.log('   3. Ejecuta el archivo: supabase-schema.sql');
    console.log('   4. Ejecuta las migraciones en: supabase-migrations/\n');
  } else {
    console.log('\n✅ Todas las tablas esperadas existen');
  }

  // Verificar campos específicos importantes
  console.log('\n\n🔍 Verificando campos críticos');
  console.log('─'.repeat(60));

  // Verificar campos QR en sucursales
  if (existentes.find(r => r.nombre === 'sucursales')) {
    const { data: sucursalTest, error: sucError } = await supabase
      .from('sucursales')
      .select('id, nombre, qr_entrada_url, qr_salida_url')
      .limit(0);

    if (sucError && sucError.message.includes('qr_entrada_url')) {
      console.log('\n❌ Tabla sucursales:');
      console.log('   Falta columna: qr_entrada_url');
      console.log('   Falta columna: qr_salida_url');
      console.log('   📝 Ejecutar: supabase-migrations/agregar_qr_fichaje_sucursales.sql');
    } else {
      console.log('\n✅ Tabla sucursales: Campos QR presentes');
    }
  }

  // Verificar vista view_productos_con_stock
  console.log('\n🔍 Verificando vistas SQL');
  const { error: vistaError } = await supabase
    .from('view_productos_con_stock')
    .select('*')
    .limit(0);

  if (vistaError) {
    console.log('❌ Vista view_productos_con_stock: NO EXISTE');
    console.log('   📝 Ejecutar la sección de vistas en: supabase-schema.sql');
  } else {
    console.log('✅ Vista view_productos_con_stock: Existe');
  }

  console.log('\n\n📋 RESUMEN');
  console.log('─'.repeat(60));
  console.log(`Total de tablas esperadas: ${TABLAS_ESPERADAS.length}`);
  console.log(`Tablas existentes: ${existentes.length}`);
  console.log(`Tablas faltantes: ${faltantes.length}`);
  console.log('');

  if (faltantes.length === 0) {
    console.log('🎉 El esquema está completo y listo para usar');
  } else {
    console.log('⚠️  El esquema está incompleto. Ejecuta los scripts SQL necesarios.');
  }
}

main();
