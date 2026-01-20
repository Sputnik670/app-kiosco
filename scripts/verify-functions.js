#!/usr/bin/env node
/**
 * Verifica que las funciones SQL V2 existen y funcionan
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verify() {
  console.log('🔍 VERIFICACIÓN DE FUNCIONES V2');
  console.log('═'.repeat(60));
  console.log('');

  // Funciones sin parámetros - se pueden llamar directamente
  const noParamFunctions = [
    'get_my_org_id',
    'get_my_org_id_v2',
    'get_my_role',
    'get_my_role_v2',
    'es_owner',
    'es_owner_v2',
    'es_dueno',
    'get_my_sucursal_id_v2',
    'get_user_org_context_v2'
  ];

  console.log('📋 Funciones sin parámetros:');
  for (const fn of noParamFunctions) {
    const { data, error } = await supabase.rpc(fn);
    if (error?.code === 'PGRST202') {
      console.log(`   ${fn}: ❌ NO EXISTE`);
    } else if (error) {
      // Error de ejecución pero la función existe
      console.log(`   ${fn}: ✅ existe (${error.code || 'null result'})`);
    } else {
      console.log(`   ${fn}: ✅ existe (retorna: ${data === null ? 'null' : typeof data})`);
    }
  }

  // Funciones con parámetros - verificar existencia via información de error
  console.log('');
  console.log('📋 Funciones con parámetros (verificando existencia):');

  const paramFunctions = [
    { name: 'create_organization_v2', params: { p_owner_id: '00000000-0000-0000-0000-000000000000', p_org_name: 'test' } },
    { name: 'assign_user_role_v2', params: { p_user_id: '00000000-0000-0000-0000-000000000000', p_organization_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'create_initial_setup_v2', params: { p_user_id: '00000000-0000-0000-0000-000000000000', p_org_name: 'test', p_profile_name: 'test', p_email: 'test@test.com' } },
    { name: 'complete_employee_setup_v2', params: { p_user_id: '00000000-0000-0000-0000-000000000000', p_profile_name: 'test', p_email: 'test@test.com' } },
  ];

  for (const fn of paramFunctions) {
    const { data, error } = await supabase.rpc(fn.name, fn.params);
    if (error?.code === 'PGRST202') {
      console.log(`   ${fn.name}: ❌ NO EXISTE`);
    } else if (error?.code === '23503' || error?.code === '23505' || error?.code === 'P0001') {
      // FK violation o unique constraint o raise exception = la función existe y se ejecuta
      console.log(`   ${fn.name}: ✅ EXISTE (error de datos esperado: ${error.code})`);
    } else if (error) {
      console.log(`   ${fn.name}: ✅ EXISTE (error: ${error.code} - ${error.message?.substring(0, 50)})`);
    } else {
      console.log(`   ${fn.name}: ✅ EXISTE y ejecutó correctamente`);
    }
  }

  console.log('');
  console.log('═'.repeat(60));
}

verify().catch(console.error);
