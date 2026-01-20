#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInsert() {
  console.log('\n🧪 TEST: Insertando registro de prueba en ventas_servicios\n');

  // Obtener IDs reales para FK
  console.log('1. Obteniendo IDs para FK...');
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
  const { data: sucursal } = await supabase.from('sucursales').select('id').limit(1).single();

  if (!org || !sucursal) {
    console.error('❌ No hay organizations o sucursales para probar');
    return;
  }

  console.log('2. Insertando registro de prueba...\n');

  const testData = {
    organization_id: org.id,
    sucursal_id: sucursal.id,
    caja_diaria_id: null, // Probar si acepta NULL
    proveedor_id: null,
    tipo_servicio: 'TEST',
    monto_carga: 100,
    comision: 10,
    total_cobrado: 110,
    metodo_pago: 'efectivo'
  };

  const { data, error } = await supabase
    .from('ventas_servicios')
    .insert(testData)
    .select();

  if (error) {
    console.error('❌ ERROR AL INSERTAR:');
    console.error('   Mensaje:', error.message);
    console.error('   Código:', error.code);
    console.error('   Detalles:', error.details);
    console.error('   Hint:', error.hint);
    console.error('\n💡 Esto indica qué columnas faltan o están mal\n');
  } else {
    console.log('✅ INSERT EXITOSO!\n');
    console.log('📋 COLUMNAS REALES DE ventas_servicios:\n');
    Object.keys(data[0]).sort().forEach(col => {
      console.log(`  - ${col}: ${typeof data[0][col]} = ${JSON.stringify(data[0][col])?.substring(0, 50)}`);
    });

    // Limpiar
    console.log('\n🗑️  Limpiando registro de prueba...');
    await supabase.from('ventas_servicios').delete().eq('id', data[0].id);
    console.log('✓ Limpiado\n');
  }
}

testInsert().catch(console.error);
