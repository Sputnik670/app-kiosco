#!/usr/bin/env node

/**
 * Script para eliminar tablas huérfanas de versiones antiguas
 * SOLO elimina tablas que NO están en el esquema oficial
 * Hace backup antes de eliminar si hay datos
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Faltan credenciales de Supabase');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tablas huérfanas a eliminar (de versiones antiguas)
const TABLAS_HUERFANAS = [
  {
    nombre: 'asistencias',
    razon: 'Duplicada - ahora se usa "asistencia" (singular)',
    reemplazo: 'asistencia'
  },
  {
    nombre: 'codigos_qr_sucursales',
    razon: 'Obsoleta - ahora se usa qr_entrada_url/qr_salida_url en sucursales',
    reemplazo: 'sucursales.qr_entrada_url'
  },
  {
    nombre: 'actividades_empleados',
    razon: 'No se usa en el código actual',
    reemplazo: 'ninguno'
  },
  {
    nombre: 'tareas_empleados',
    razon: 'No se usa en el código actual',
    reemplazo: 'ninguno'
  },
  {
    nombre: 'alertas_vencimientos',
    razon: 'No se usa en el código actual',
    reemplazo: 'ninguno'
  },
  {
    nombre: 'metricas_diarias',
    razon: 'No se usa en el código actual',
    reemplazo: 'ninguno'
  },
  {
    nombre: 'ventas',
    razon: 'Obsoleta - ahora se usa stock con tipo_movimiento="salida"',
    reemplazo: 'stock'
  }
];

// NO tocar estas (son vistas, no tablas)
const VISTAS_VALIDAS = [
  'view_productos_con_stock',
  'vista_asistencias_hoy',
  'vista_empleados_por_sucursal',
  'vista_metricas_por_sucursal',
  'vista_resumen_empleados',
  'vista_top_vendedores_mes'
];

async function verificarDatos(nombreTabla) {
  try {
    const { count, error } = await supabase
      .from(nombreTabla)
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Si la tabla no existe, count será null
      return { existe: false, registros: 0, error: error.message };
    }

    return { existe: true, registros: count || 0 };
  } catch (err) {
    return { existe: false, registros: 0, error: err.message };
  }
}

async function main() {
  console.log('🔍 ANÁLISIS DE TABLAS HUÉRFANAS');
  console.log('═'.repeat(70));
  console.log('');

  console.log('⚠️  IMPORTANTE: Este script SOLO analiza. NO elimina nada automáticamente.\n');
  console.log('📋 Tablas a verificar:\n');

  const resultados = [];

  for (const tabla of TABLAS_HUERFANAS) {
    console.log(`Verificando: ${tabla.nombre}...`);
    const { existe, registros, error } = await verificarDatos(tabla.nombre);

    resultados.push({
      ...tabla,
      existe,
      registros,
      error
    });

    if (!existe) {
      console.log(`   ✅ NO EXISTE (ya fue eliminada o nunca existió)\n`);
    } else if (registros === 0) {
      console.log(`   ⚠️  EXISTE pero está VACÍA (0 registros)\n`);
    } else {
      console.log(`   🔴 EXISTE y tiene ${registros} REGISTROS\n`);
    }
  }

  console.log('═'.repeat(70));
  console.log('\n📊 RESUMEN:\n');

  const existentes = resultados.filter(r => r.existe);
  const conDatos = resultados.filter(r => r.existe && r.registros > 0);
  const vacias = resultados.filter(r => r.existe && r.registros === 0);

  console.log(`Total de tablas huérfanas verificadas: ${TABLAS_HUERFANAS.length}`);
  console.log(`Tablas que existen: ${existentes.length}`);
  console.log(`Tablas con datos: ${conDatos.length}`);
  console.log(`Tablas vacías: ${vacias.length}\n`);

  if (conDatos.length > 0) {
    console.log('🔴 TABLAS CON DATOS (requieren atención):\n');
    conDatos.forEach(t => {
      console.log(`   • ${t.nombre} - ${t.registros} registros`);
      console.log(`     Razón: ${t.razon}`);
      console.log(`     Reemplazo: ${t.reemplazo}`);
      console.log('');
    });

    console.log('⚠️  ACCIÓN REQUERIDA:');
    console.log('   Antes de eliminar estas tablas, debes:');
    console.log('   1. Revisar los datos manualmente en Supabase Dashboard');
    console.log('   2. Hacer backup si hay datos importantes');
    console.log('   3. Migrar los datos a las tablas nuevas si es necesario\n');
  }

  if (vacias.length > 0) {
    console.log('✅ TABLAS VACÍAS (seguras para eliminar):\n');
    vacias.forEach(t => {
      console.log(`   • ${t.nombre}`);
      console.log(`     Razón: ${t.razon}`);
      console.log('');
    });

    console.log('📝 SCRIPT SQL PARA ELIMINAR TABLAS VACÍAS:\n');
    console.log('```sql');
    console.log('-- EJECUTA ESTO EN SUPABASE SQL EDITOR');
    console.log('-- (solo elimina tablas vacías)\n');
    vacias.forEach(t => {
      console.log(`DROP TABLE IF EXISTS public.${t.nombre} CASCADE;`);
      console.log(`COMMENT ON DROP: '${t.razon}';`);
    });
    console.log('```\n');
  }

  if (existentes.length === 0) {
    console.log('🎉 ¡EXCELENTE! No hay tablas huérfanas en tu base de datos.\n');
  }

  console.log('═'.repeat(70));
  console.log('\n🛡️  VISTAS VÁLIDAS (NO TOCAR):\n');
  VISTAS_VALIDAS.forEach(v => console.log(`   • ${v}`));
  console.log('\nEstas son vistas SQL, NO tablas. No las elimines.\n');
}

main();
