#!/usr/bin/env node

/**
 * Script de Verificación de Estructura de Base de Datos
 * Verifica existencia de tablas, vistas y funciones RPC críticas
 */

require('dotenv').config(); // Lee .env (no .env.local)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('   Verifica que .env tenga:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔍 VERIFICACIÓN DE ESTRUCTURA DE BASE DE DATOS');
console.log('═'.repeat(60));
console.log('');

async function verificarTabla(nombre) {
  try {
    const { data, error, count } = await supabase
      .from(nombre)
      .select('*', { count: 'exact', head: true })
      .limit(0);

    if (error) {
      // Si el error es por RLS, la tabla existe pero no tenemos acceso
      if (error.message.includes('policy') || error.code === 'PGRST116') {
        console.log(`  ⚠️  ${nombre.padEnd(30)} - Existe (sin acceso por RLS)`);
        return { existe: true, accesible: false, count: null };
      }
      console.log(`  ❌ ${nombre.padEnd(30)} - NO EXISTE`);
      return { existe: false, accesible: false, count: null };
    }

    console.log(`  ✅ ${nombre.padEnd(30)} - Existe (${count || 0} registros)`);
    return { existe: true, accesible: true, count };
  } catch (err) {
    console.log(`  ❌ ${nombre.padEnd(30)} - Error: ${err.message}`);
    return { existe: false, accesible: false, count: null };
  }
}

async function verificarVista(nombre) {
  return verificarTabla(nombre); // Las vistas se verifican igual que tablas
}

async function verificarFuncionRPC(nombre, params = {}) {
  try {
    const { data, error } = await supabase.rpc(nombre, params);

    if (error) {
      // Si el error es "function does not exist", no existe
      if (error.message.includes('does not exist') || error.code === '42883') {
        console.log(`  ❌ ${nombre.padEnd(30)} - NO EXISTE`);
        return { existe: false, ejecutable: false };
      }
      // Otros errores pueden significar que existe pero faltan params
      console.log(`  ⚠️  ${nombre.padEnd(30)} - Existe (error al ejecutar: ${error.message})`);
      return { existe: true, ejecutable: false, error: error.message };
    }

    console.log(`  ✅ ${nombre.padEnd(30)} - Existe y funciona`);
    return { existe: true, ejecutable: true, data };
  } catch (err) {
    console.log(`  ❌ ${nombre.padEnd(30)} - Error: ${err.message}`);
    return { existe: false, ejecutable: false };
  }
}

async function obtenerEsquemaTabla(nombre) {
  try {
    // Intentar hacer una query que retorne la estructura
    const { data, error } = await supabase
      .from(nombre)
      .select('*')
      .limit(1);

    if (error) return null;

    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }

    // Si no hay datos, intentar obtener estructura de tipos
    return null;
  } catch (err) {
    return null;
  }
}

async function main() {
  const resultados = {
    tablas: {},
    vistas: {},
    funciones: {}
  };

  // ═══════════════════════════════════════════════════════════
  // VERIFICAR TABLAS CRÍTICAS
  // ═══════════════════════════════════════════════════════════
  console.log('📊 TABLAS CRÍTICAS:');
  console.log('');

  const tablasCriticas = [
    'ventas_servicios',  // ← TABLA EN CUESTIÓN
    'stock',
    'productos',
    'caja_diaria',
    'movimientos_caja',
    'perfiles',
    'sucursales',
    'asistencia',
    'misiones',
    'proveedores',
    'compras',
    'historial_precios',
    'plantillas_misiones',
    'organizations'
  ];

  for (const tabla of tablasCriticas) {
    resultados.tablas[tabla] = await verificarTabla(tabla);
  }

  // ═══════════════════════════════════════════════════════════
  // VERIFICAR VISTAS SQL
  // ═══════════════════════════════════════════════════════════
  console.log('');
  console.log('👁️  VISTAS SQL:');
  console.log('');

  const vistasCriticas = [
    'view_productos_con_stock',  // ← VISTA CRÍTICA PARA VENTAS
    'vista_ventas_recientes',
    'vista_productos_bajo_stock',
    'vista_empleados_por_sucursal'
  ];

  for (const vista of vistasCriticas) {
    resultados.vistas[vista] = await verificarVista(vista);
  }

  // ═══════════════════════════════════════════════════════════
  // VERIFICAR FUNCIONES RPC
  // ═══════════════════════════════════════════════════════════
  console.log('');
  console.log('⚙️  FUNCIONES RPC:');
  console.log('');

  const funcionesCriticas = [
    'procesar_venta',  // ← FUNCIÓN CRÍTICA PARA VENTAS
    'calcular_horas_trabajadas',
    'verificar_stock_disponible',
    'incrementar_saldo_proveedor',
    'descontar_saldo_proveedor'
  ];

  for (const funcion of funcionesCriticas) {
    resultados.funciones[funcion] = await verificarFuncionRPC(funcion);
  }

  // ═══════════════════════════════════════════════════════════
  // OBTENER ESQUEMA DE TABLA CRÍTICA
  // ═══════════════════════════════════════════════════════════
  console.log('');
  console.log('🔍 ANÁLISIS DETALLADO:');
  console.log('');

  if (resultados.tablas['ventas_servicios']?.existe) {
    console.log('📋 Esquema de ventas_servicios:');
    const esquema = await obtenerEsquemaTabla('ventas_servicios');
    if (esquema) {
      console.log('   Columnas detectadas:');
      esquema.forEach(col => console.log(`     - ${col}`));
    } else {
      console.log('   ⚠️  No se pudo obtener esquema (tabla vacía o sin acceso)');
    }
    console.log('');
  }

  if (resultados.vistas['view_productos_con_stock']?.existe) {
    console.log('📋 Esquema de view_productos_con_stock:');
    const esquema = await obtenerEsquemaTabla('view_productos_con_stock');
    if (esquema) {
      console.log('   Columnas detectadas:');
      esquema.forEach(col => console.log(`     - ${col}`));
    }
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════
  console.log('');
  console.log('═'.repeat(60));
  console.log('📊 RESUMEN:');
  console.log('');

  const tablasExistentes = Object.values(resultados.tablas).filter(r => r.existe).length;
  const vistasExistentes = Object.values(resultados.vistas).filter(r => r.existe).length;
  const funcionesExistentes = Object.values(resultados.funciones).filter(r => r.existe).length;

  console.log(`  Tablas verificadas: ${tablasExistentes}/${tablasCriticas.length}`);
  console.log(`  Vistas verificadas: ${vistasExistentes}/${vistasCriticas.length}`);
  console.log(`  Funciones verificadas: ${funcionesExistentes}/${funcionesCriticas.length}`);
  console.log('');

  // Identificar problemas críticos
  const problemas = [];

  if (!resultados.tablas['ventas_servicios']?.existe) {
    problemas.push('⚠️  CRÍTICO: Tabla ventas_servicios NO existe pero se usa en código');
  }

  if (!resultados.vistas['view_productos_con_stock']?.existe) {
    problemas.push('🔴 CRÍTICO: Vista view_productos_con_stock NO existe - ventas NO funcionarán');
  }

  if (!resultados.funciones['procesar_venta']?.existe) {
    problemas.push('🔴 CRÍTICO: Función procesar_venta NO existe - ventas NO funcionarán');
  }

  if (problemas.length > 0) {
    console.log('🚨 PROBLEMAS DETECTADOS:');
    console.log('');
    problemas.forEach(p => console.log(`  ${p}`));
    console.log('');
  } else {
    console.log('✅ Todas las estructuras críticas existen correctamente');
    console.log('');
  }

  console.log('═'.repeat(60));

  // Retornar JSON para análisis programático
  return resultados;
}

main().catch(err => {
  console.error('');
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
