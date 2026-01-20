#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkSchema() {
  console.log('🔍 Verificando esquema de perfiles...\n');

  // Intentar insertar un registro con todas las columnas posibles para ver cuáles existen
  const testId = '00000000-0000-0000-0000-000000000001';

  // Test 1: Sin rol ni organization_id
  const { error: e1 } = await supabase.from('perfiles').upsert({
    id: testId,
    nombre: 'TEST',
    email: 'test@test.com',
    sucursal_id: null
  }, { onConflict: 'id' });

  console.log('Test sin rol/org_id:', e1 ? `❌ ${e1.message}` : '✅ OK');

  // Test 2: Con rol
  const { error: e2 } = await supabase.from('perfiles').upsert({
    id: testId,
    nombre: 'TEST',
    email: 'test@test.com',
    rol: 'dueño'
  }, { onConflict: 'id' });

  console.log('Test con rol:', e2 ? `❌ ${e2.message}` : '✅ OK');

  // Test 3: Con organization_id
  const { error: e3 } = await supabase.from('perfiles').upsert({
    id: testId,
    nombre: 'TEST',
    email: 'test@test.com',
    organization_id: '00000000-0000-0000-0000-000000000002'
  }, { onConflict: 'id' });

  console.log('Test con organization_id:', e3 ? `❌ ${e3.message}` : '✅ OK');

  // Limpiar
  await supabase.from('perfiles').delete().eq('id', testId);

  // Obtener un registro real para ver columnas
  const { data } = await supabase.from('perfiles').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('\n📋 Columnas existentes:', Object.keys(data[0]).join(', '));
  } else {
    console.log('\n📋 Tabla perfiles está vacía');
  }
}

checkSchema().catch(console.error);
