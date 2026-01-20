#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debug() {
  const USER_ID = '16ea5a15-9dff-4263-8ed0-d2d2eb61389b';

  console.log('🔍 DEBUG: user_organization_roles');
  console.log('═'.repeat(50));

  // Query sin filtros
  const { data: all, error: allErr } = await supabase
    .from('user_organization_roles')
    .select('*')
    .eq('user_id', USER_ID);

  console.log('\n📋 Todos los registros para el usuario:');
  if (allErr) {
    console.log('Error:', allErr.message);
  } else if (all.length === 0) {
    console.log('⚠️ NO HAY REGISTROS');
  } else {
    all.forEach((r, i) => {
      console.log(`[${i}]`, JSON.stringify(r, null, 2));
    });
  }

  // Query con is_active
  console.log('\n📋 Registros con is_active=true:');
  const { data: active, error: activeErr } = await supabase
    .from('user_organization_roles')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('is_active', true);

  if (activeErr) {
    console.log('Error:', activeErr.message);
  } else if (active.length === 0) {
    console.log('⚠️ NO HAY REGISTROS ACTIVOS');
  } else {
    active.forEach((r, i) => {
      console.log(`[${i}]`, JSON.stringify(r, null, 2));
    });
  }

  // Contar total de registros en la tabla
  console.log('\n📋 Total de registros en la tabla:');
  const { count } = await supabase
    .from('user_organization_roles')
    .select('*', { count: 'exact', head: true });
  console.log('Total:', count);
}

debug().catch(console.error);
