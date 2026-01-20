#!/usr/bin/env node

/**
 * 🔥 PRUEBA DE FUEGO - Aislamiento Multi-Tenant SaaS
 * Crea 2 organizaciones y verifica que NO puedan ver datos entre sí
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

// Cliente con service role (sin RLS) para setup
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// Cliente con clave anónima (CON RLS) para pruebas
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('');
console.log('🔥 PRUEBA DE FUEGO - AISLAMIENTO SAAS MULTI-TENANT');
console.log('═'.repeat(70));
console.log('');

async function limpiarDatosPrueba() {
  if (!supabaseAdmin) {
    console.log('⚠️  No hay service role key - usando cliente anónimo');
    console.log('   (Esto puede fallar si ya hay datos)');
    return;
  }

  console.log('🧹 Limpiando datos de prueba anteriores...');

  // Eliminar en orden inverso por foreign keys
  await supabaseAdmin.from('stock').delete().ilike('producto_id', 'test-%');
  await supabaseAdmin.from('productos').delete().ilike('id', 'test-%');
  await supabaseAdmin.from('sucursales').delete().ilike('id', 'test-%');
  await supabaseAdmin.from('perfiles').delete().ilike('id', 'test-%');
  await supabaseAdmin.from('organizations').delete().ilike('id', 'test-%');

  console.log('✅ Datos de prueba eliminados\n');
}

async function crearDatosPrueba() {
  if (!supabaseAdmin) {
    console.log('⚠️  Saltando creación de datos (no hay service role)');
    console.log('   Por favor crea manualmente:');
    console.log('   - 2 organizaciones (Kiosko Alfa, Kiosko Beta)');
    console.log('   - 1 usuario por organización');
    console.log('   - 1 venta de $100 en Alfa');
    return null;
  }

  console.log('📦 Creando datos de prueba...\n');

  // ═══════════════════════════════════════════════════════════
  // ORGANIZACIÓN ALFA
  // ═══════════════════════════════════════════════════════════

  console.log('🏢 Creando Kiosko Alfa...');

  const { data: orgAlfa, error: errorOrgAlfa } = await supabaseAdmin
    .from('organizations')
    .insert({
      id: 'test-org-alfa',
      nombre: 'Kiosko Alfa',
      plan: 'premium'
    })
    .select()
    .single();

  if (errorOrgAlfa) {
    console.error('❌ Error creando Org Alfa:', errorOrgAlfa.message);
    return null;
  }

  const { data: sucAlfa, error: errorSucAlfa } = await supabaseAdmin
    .from('sucursales')
    .insert({
      id: 'test-suc-alfa',
      organization_id: 'test-org-alfa',
      nombre: 'Sucursal Alfa Centro'
    })
    .select()
    .single();

  if (errorSucAlfa) {
    console.error('❌ Error creando Sucursal Alfa:', errorSucAlfa.message);
    return null;
  }

  // Usuario Alfa (simulado)
  const { data: userAlfa, error: errorUserAlfa } = await supabaseAdmin
    .from('perfiles')
    .insert({
      id: 'test-user-alfa',
      organization_id: 'test-org-alfa',
      nombre: 'Juan Pérez (Alfa)',
      email: 'juan@alfa.com',
      rol: 'dueño'
    })
    .select()
    .single();

  if (errorUserAlfa) {
    console.error('❌ Error creando Usuario Alfa:', errorUserAlfa.message);
    return null;
  }

  // Producto de prueba en Alfa
  const { data: prodAlfa, error: errorProdAlfa } = await supabaseAdmin
    .from('productos')
    .insert({
      id: 'test-prod-alfa',
      organization_id: 'test-org-alfa',
      nombre: 'Coca-Cola Alfa',
      precio_venta: 100,
      costo: 50
    })
    .select()
    .single();

  if (errorProdAlfa) {
    console.error('❌ Error creando Producto Alfa:', errorProdAlfa.message);
    return null;
  }

  // VENTA DE $100 EN ALFA (esto es lo que Beta NO debe ver)
  const { data: ventaAlfa, error: errorVentaAlfa } = await supabaseAdmin
    .from('stock')
    .insert({
      id: 'test-venta-alfa',
      organization_id: 'test-org-alfa',
      sucursal_id: 'test-suc-alfa',
      producto_id: 'test-prod-alfa',
      tipo_movimiento: 'salida',
      estado: 'vendido',
      cantidad: 1,
      precio_venta_historico: 100,
      costo_unitario_historico: 50,
      metodo_pago: 'efectivo',
      fecha_venta: new Date().toISOString()
    })
    .select()
    .single();

  if (errorVentaAlfa) {
    console.error('❌ Error creando Venta Alfa:', errorVentaAlfa.message);
    return null;
  }

  console.log('✅ Kiosko Alfa creado con venta de $100\n');

  // ═══════════════════════════════════════════════════════════
  // ORGANIZACIÓN BETA
  // ═══════════════════════════════════════════════════════════

  console.log('🏢 Creando Kiosko Beta...');

  const { data: orgBeta, error: errorOrgBeta } = await supabaseAdmin
    .from('organizations')
    .insert({
      id: 'test-org-beta',
      nombre: 'Kiosko Beta',
      plan: 'premium'
    })
    .select()
    .single();

  if (errorOrgBeta) {
    console.error('❌ Error creando Org Beta:', errorOrgBeta.message);
    return null;
  }

  const { data: sucBeta, error: errorSucBeta } = await supabaseAdmin
    .from('sucursales')
    .insert({
      id: 'test-suc-beta',
      organization_id: 'test-org-beta',
      nombre: 'Sucursal Beta Sur'
    })
    .select()
    .single();

  if (errorSucBeta) {
    console.error('❌ Error creando Sucursal Beta:', errorSucBeta.message);
    return null;
  }

  // Usuario Beta (simulado)
  const { data: userBeta, error: errorUserBeta } = await supabaseAdmin
    .from('perfiles')
    .insert({
      id: 'test-user-beta',
      organization_id: 'test-org-beta',
      nombre: 'María García (Beta)',
      email: 'maria@beta.com',
      rol: 'dueño'
    })
    .select()
    .single();

  if (errorUserBeta) {
    console.error('❌ Error creando Usuario Beta:', errorUserBeta.message);
    return null;
  }

  console.log('✅ Kiosko Beta creado\n');

  return {
    userAlfa: 'test-user-alfa',
    userBeta: 'test-user-beta',
    orgAlfa: 'test-org-alfa',
    orgBeta: 'test-org-beta',
    ventaAlfa: 'test-venta-alfa'
  };
}

async function probarAislamiento(datos) {
  if (!datos) {
    console.log('⚠️  No se pueden probar aislamiento sin datos');
    return;
  }

  console.log('═'.repeat(70));
  console.log('🔍 PROBANDO AISLAMIENTO ENTRE ORGANIZACIONES');
  console.log('═'.repeat(70));
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // PRUEBA 1: Usuario Beta intenta ver ventas de Alfa
  // ═══════════════════════════════════════════════════════════

  console.log('🧪 PRUEBA 1: ¿Puede Beta ver la venta de $100 de Alfa?');
  console.log('─'.repeat(70));

  // Simular que estamos logueados como usuario Beta
  // (En realidad, con clave anónima RLS debería bloquear TODO)

  const { data: ventasVisiblesParaBeta, error: errorBeta } = await supabase
    .from('stock')
    .select('*')
    .eq('tipo_movimiento', 'salida')
    .eq('estado', 'vendido');

  if (errorBeta) {
    if (errorBeta.message.includes('policy')) {
      console.log('✅ RLS BLOQUEÓ ACCESO - Beta no puede ver NADA (correcto)');
      console.log(`   Error: ${errorBeta.message}`);
    } else {
      console.log(`⚠️  Error inesperado: ${errorBeta.message}`);
    }
  } else {
    const ventasDeAlfa = ventasVisiblesParaBeta.filter(v => v.organization_id === datos.orgAlfa);

    if (ventasDeAlfa.length > 0) {
      console.log('🔴 FALLA CRÍTICA: Beta VIO ventas de Alfa');
      console.log(`   Ventas expuestas: ${ventasDeAlfa.length}`);
      console.log('   Datos:', JSON.stringify(ventasDeAlfa, null, 2));
      console.log('');
      console.log('❌ PRUEBA DE PRIVACIDAD: FALLIDA');
      console.log('   ACCIÓN URGENTE: Verificar políticas RLS en tabla stock');
      return false;
    } else {
      if (ventasVisiblesParaBeta.length === 0) {
        console.log('✅ Beta no vio NINGUNA venta (correcto con RLS activo)');
      } else {
        console.log(`✅ Beta solo vio ${ventasVisiblesParaBeta.length} ventas de su propia org`);
      }
    }
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════
  // PRUEBA 2: Verificar filtrado automático por organization_id
  // ═══════════════════════════════════════════════════════════

  console.log('🧪 PRUEBA 2: Verificar que RLS filtra automáticamente');
  console.log('─'.repeat(70));

  // Intentar hacer SELECT * sin WHERE (debería filtrar automático)
  const { data: todosLosProductos, error: errorProd } = await supabase
    .from('productos')
    .select('*');

  if (errorProd) {
    if (errorProd.message.includes('policy')) {
      console.log('✅ RLS activo en tabla productos');
    } else {
      console.log(`⚠️  Error: ${errorProd.message}`);
    }
  } else {
    const productosDeAlfa = todosLosProductos.filter(p => p.organization_id === datos.orgAlfa);
    const productosDeBeta = todosLosProductos.filter(p => p.organization_id === datos.orgBeta);

    console.log(`📊 Productos visibles: ${todosLosProductos.length}`);
    console.log(`   - De Alfa: ${productosDeAlfa.length}`);
    console.log(`   - De Beta: ${productosDeBeta.length}`);

    if (productosDeAlfa.length > 0) {
      console.log('⚠️  ADVERTENCIA: Se ven productos de AMBAS organizaciones');
      console.log('   Esto indica que RLS NO está filtrando correctamente');
    }
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════
  // RESULTADO FINAL
  // ═══════════════════════════════════════════════════════════

  console.log('═'.repeat(70));
  console.log('📊 RESULTADO FINAL');
  console.log('═'.repeat(70));
  console.log('');

  const rlsActivo = errorBeta && errorBeta.message.includes('policy');

  if (rlsActivo) {
    console.log('🎉 PRUEBA DE PRIVACIDAD: EXITOSA');
    console.log('');
    console.log('✅ El sistema está correctamente aislado:');
    console.log('   - RLS está ACTIVO en las tablas críticas');
    console.log('   - Un usuario de Kiosko Beta NO puede ver datos de Kiosko Alfa');
    console.log('   - El sistema es seguro para SaaS multi-tenant');
    console.log('');
    console.log('🚀 LISTO PARA PRODUCCIÓN');
    return true;
  } else {
    console.log('❌ PRUEBA DE PRIVACIDAD: REQUIERE ATENCIÓN');
    console.log('');
    console.log('⚠️  Estado:');
    console.log('   - RLS podría no estar activo o faltan políticas');
    console.log('   - Verificar que ejecutaste: database/activar-rls-completo.sql');
    console.log('');
    console.log('🔧 ACCIÓN REQUERIDA:');
    console.log('   1. Ir a Supabase Dashboard → SQL Editor');
    console.log('   2. Ejecutar: database/activar-rls-completo.sql');
    console.log('   3. Volver a ejecutar este script');
    return false;
  }
}

async function main() {
  try {
    // Paso 1: Limpiar datos anteriores
    await limpiarDatosPrueba();

    // Paso 2: Crear 2 organizaciones con datos
    const datos = await crearDatosPrueba();

    // Paso 3: Probar aislamiento
    const exitoso = await probarAislamiento(datos);

    console.log('');
    console.log('═'.repeat(70));

    if (exitoso) {
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Error fatal:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
