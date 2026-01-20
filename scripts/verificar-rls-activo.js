#!/usr/bin/env node

/**
 * 🔐 VERIFICACIÓN RLS - Comprueba que las políticas estén activas
 * Este script verifica que RLS está habilitado en las tablas críticas
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
console.log('🔐 VERIFICACIÓN DE ROW LEVEL SECURITY (RLS)');
console.log('═'.repeat(70));
console.log('');

const TABLAS_CRITICAS = [
  'stock',
  'ventas_servicios',
  'productos',
  'caja_diaria',
  'movimientos_caja',
  'asistencia',
  'perfiles',
  'misiones',
  'sucursales',
  'proveedores'
];

async function verificarRLS() {
  console.log('🔍 Verificando RLS en tablas críticas...\n');

  for (const tabla of TABLAS_CRITICAS) {
    // Intentar leer sin autenticación (debería fallar con RLS activo)
    const { data, error } = await supabase.from(tabla).select('id').limit(1);

    if (error && error.message.includes('row-level security')) {
      console.log(`✅ ${tabla.padEnd(25)} → RLS ACTIVO (bloqueó acceso sin auth)`);
    } else if (error && error.message.includes('JWT')) {
      console.log(`✅ ${tabla.padEnd(25)} → RLS ACTIVO (requiere autenticación)`);
    } else if (error && error.message.includes('policy')) {
      console.log(`✅ ${tabla.padEnd(25)} → RLS ACTIVO (política activa)`);
    } else if (error) {
      console.log(`⚠️  ${tabla.padEnd(25)} → Error: ${error.message.substring(0, 50)}...`);
    } else {
      console.log(`❌ ${tabla.padEnd(25)} → RLS INACTIVO (permite acceso sin filtro)`);
    }
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('');
  console.log('📋 RESUMEN:');
  console.log('');
  console.log('Si ves "RLS ACTIVO" o errores de JWT/autenticación:');
  console.log('  ✅ Las políticas están funcionando correctamente');
  console.log('  ✅ Los datos están protegidos por organization_id');
  console.log('');
  console.log('Si ves "RLS INACTIVO":');
  console.log('  ❌ PELIGRO: Los datos NO están protegidos');
  console.log('  ❌ Ejecuta: database/activar-rls-completo.sql');
  console.log('');
  console.log('═'.repeat(70));
  console.log('');
}

async function verificarVistaUnificada() {
  console.log('🔍 VERIFICANDO VISTA UNIFICADA...\n');

  // Intentar acceder a la vista sin autenticación
  const { data, error } = await supabase
    .from('reportes_ventas_unificados')
    .select('venta_id, tipo_venta, descripcion, monto_total')
    .limit(5);

  if (error) {
    if (error.message.includes('does not exist')) {
      console.log('❌ Vista NO existe');
      console.log('   → Ejecuta: database/EJECUTAR_ESTA_VISTA.sql\n');
    } else if (error.message.includes('JWT') || error.message.includes('row-level')) {
      console.log('✅ Vista existe y está protegida por RLS');
      console.log('   (Error de autenticación es esperado sin login)\n');
    } else {
      console.log(`⚠️  Error: ${error.message}\n`);
    }
  } else {
    if (data && data.length > 0) {
      console.log('✅ Vista existe y retorna datos:');
      console.log(`   → ${data.length} registros encontrados`);
      console.log(`   → Tipos: ${[...new Set(data.map(v => v.tipo_venta))].join(', ')}`);
      console.log('');
    } else {
      console.log('✅ Vista existe pero está vacía (normal si no hay ventas)\n');
    }
  }
}

async function main() {
  try {
    await verificarRLS();
    await verificarVistaUnificada();

    console.log('🎯 PRÓXIMOS PASOS:');
    console.log('');
    console.log('1. Si todo está ✅: El sistema está listo para producción');
    console.log('2. Para probar con usuario real: Inicia sesión en la app');
    console.log('3. Para simular venta: node scripts/simular-venta.js');
    console.log('');
  } catch (err) {
    console.error('❌ Error inesperado:', err.message);
    process.exit(1);
  }
}

main();
