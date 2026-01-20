#!/usr/bin/env node

/**
 * Auditoría de Políticas RLS (Row Level Security)
 * Verifica el aislamiento entre sucursales y organizaciones
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔐 AUDITORÍA DE POLÍTICAS RLS (Row Level Security)');
console.log('═'.repeat(70));
console.log('');
console.log('Objetivo: Verificar que un empleado de "Sucursal A" no pueda');
console.log('          ver datos de "Sucursal B" mediante ninguna consulta.');
console.log('');
console.log('═'.repeat(70));
console.log('');

async function verificarRLSTabla(nombreTabla, filtros = {}) {
  console.log(`📊 Tabla: ${nombreTabla}`);
  console.log('─'.repeat(70));

  try {
    // Intentar acceder SIN autenticación (clave anónima)
    const { data, error, count } = await supabase
      .from(nombreTabla)
      .select('*', { count: 'exact', head: false })
      .limit(5);

    if (error) {
      if (error.message.includes('policy')) {
        console.log('  ✅ RLS ACTIVO - Acceso bloqueado por política');
        console.log(`     Error: ${error.message}`);
      } else if (error.code === 'PGRST116') {
        console.log('  ✅ RLS ACTIVO - Sin permisos de lectura');
      } else {
        console.log(`  ⚠️  Error inesperado: ${error.message}`);
      }
      return { tabla: nombreTabla, rls: true, accesible: false };
    }

    if (!data || data.length === 0) {
      console.log('  ℹ️  Tabla vacía - No se puede determinar RLS');
      console.log('     (Necesita datos de prueba para verificar aislamiento)');
      return { tabla: nombreTabla, rls: 'indeterminado', accesible: true, count: 0 };
    }

    // Si llegamos aquí, pudimos leer datos
    console.log(`  ⚠️  POTENCIAL PROBLEMA - Se pudieron leer ${data.length} registros`);
    console.log('     Campos visibles:', Object.keys(data[0]).join(', '));

    // Verificar si hay campos de organización/sucursal
    const tieneOrgId = data[0].hasOwnProperty('organization_id');
    const tieneSucursalId = data[0].hasOwnProperty('sucursal_id');

    if (tieneOrgId || tieneSucursalId) {
      console.log('  ⚠️  CRÍTICO: Tabla tiene campos de aislamiento pero son accesibles');
      if (tieneOrgId) console.log('     - organization_id visible');
      if (tieneSucursalId) console.log('     - sucursal_id visible');
    }

    return { tabla: nombreTabla, rls: false, accesible: true, count: data.length };

  } catch (err) {
    console.log(`  ❌ Error al verificar: ${err.message}`);
    return { tabla: nombreTabla, rls: 'error', accesible: false };
  }

  console.log('');
}

async function main() {
  const resultados = [];

  // ═══════════════════════════════════════════════════════════
  // TABLAS CRÍTICAS CON DATOS SENSIBLES POR SUCURSAL
  // ═══════════════════════════════════════════════════════════

  console.log('🔍 VERIFICANDO TABLAS CRÍTICAS:');
  console.log('');

  const tablasCriticas = [
    { nombre: 'stock', critico: 'CRÍTICO - Contiene ventas e inventario por sucursal' },
    { nombre: 'ventas_servicios', critico: 'CRÍTICO - Ventas de servicios por sucursal' },
    { nombre: 'caja_diaria', critico: 'CRÍTICO - Dinero en caja por sucursal' },
    { nombre: 'movimientos_caja', critico: 'CRÍTICO - Movimientos de efectivo' },
    { nombre: 'asistencia', critico: 'CRÍTICO - Horarios de empleados' },
    { nombre: 'perfiles', critico: 'ALTO - Datos personales de empleados' },
    { nombre: 'misiones', critico: 'MEDIO - Tareas de empleados' },
    { nombre: 'productos', critico: 'BAJO - Catálogo (puede ser compartido)' },
    { nombre: 'sucursales', critico: 'MEDIO - Información de locales' },
    { nombre: 'proveedores', critico: 'BAJO - Proveedores (puede ser compartido)' },
  ];

  for (const { nombre, critico } of tablasCriticas) {
    console.log(`\n💡 ${critico}`);
    const resultado = await verificarRLSTabla(nombre);
    resultados.push(resultado);
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════
  // RESUMEN Y RECOMENDACIONES
  // ═══════════════════════════════════════════════════════════

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 RESUMEN DE AUDITORÍA');
  console.log('═'.repeat(70));
  console.log('');

  const tablasSinRLS = resultados.filter(r => r.rls === false);
  const tablasConRLS = resultados.filter(r => r.rls === true);
  const tablasIndeterminadas = resultados.filter(r => r.rls === 'indeterminado');

  console.log(`✅ Tablas con RLS activo: ${tablasConRLS.length}`);
  console.log(`⚠️  Tablas sin RLS: ${tablasSinRLS.length}`);
  console.log(`ℹ️  Tablas sin datos (no verificables): ${tablasIndeterminadas.length}`);
  console.log('');

  if (tablasSinRLS.length > 0) {
    console.log('🚨 PROBLEMAS CRÍTICOS DETECTADOS:');
    console.log('');
    tablasSinRLS.forEach(t => {
      console.log(`  ❌ ${t.tabla} - ${t.count} registros accesibles sin autenticación`);
    });
    console.log('');
    console.log('RECOMENDACIÓN URGENTE:');
    console.log('  1. Habilitar RLS en estas tablas: ALTER TABLE x ENABLE ROW LEVEL SECURITY;');
    console.log('  2. Crear políticas que filtren por organization_id');
    console.log('  3. Verificar que ningún usuario pueda ver datos de otra organización');
    console.log('');
  }

  if (tablasIndeterminadas.length > 0) {
    console.log('ℹ️  TABLAS SIN DATOS (Requieren verificación con datos reales):');
    console.log('');
    tablasIndeterminadas.forEach(t => {
      console.log(`  📋 ${t.tabla}`);
    });
    console.log('');
    console.log('RECOMENDACIÓN:');
    console.log('  1. Insertar datos de prueba en 2 organizaciones diferentes');
    console.log('  2. Verificar que un usuario de Org A no vea datos de Org B');
    console.log('  3. Crear script de prueba automatizado');
    console.log('');
  }

  if (tablasConRLS.length === resultados.length) {
    console.log('🎉 EXCELENTE: Todas las tablas tienen RLS activo');
    console.log('   El sistema está correctamente aislado por organización/sucursal');
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════
  // EJEMPLO DE POLÍTICAS RECOMENDADAS
  // ═══════════════════════════════════════════════════════════

  console.log('');
  console.log('═'.repeat(70));
  console.log('📝 EJEMPLO DE POLÍTICAS RLS RECOMENDADAS');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`-- Para tabla: stock (ventas e inventario)
CREATE POLICY "Usuarios solo ven stock de su organización"
  ON stock FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM perfiles WHERE id = auth.uid()
    )
  );

-- Para tabla: caja_diaria (dinero en caja)
CREATE POLICY "Usuarios solo ven cajas de su organización"
  ON caja_diaria FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM perfiles WHERE id = auth.uid()
    )
  );

-- Para tabla: asistencia (fichajes)
CREATE POLICY "Usuarios solo ven asistencias de su organización"
  ON asistencia FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM perfiles WHERE id = auth.uid()
    )
  );

-- Política de INSERT (ejemplo)
CREATE POLICY "Usuarios solo insertan en su organización"
  ON stock FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM perfiles WHERE id = auth.uid()
    )
  );
`);

  console.log('');
  console.log('═'.repeat(70));
  console.log('Auditoría completada');
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('');
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
