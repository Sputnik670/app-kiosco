#!/usr/bin/env node
/**
 * Verificación completa del estado de la BD
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyAll() {
  console.log('🔍 VERIFICACIÓN COMPLETA');
  console.log('═'.repeat(60));

  // 1. Verificar funciones V2
  console.log('\n📋 1. FUNCIONES V2');
  const functions = ['create_initial_setup_v2', 'complete_employee_setup_v2', 'assign_user_role_v2'];

  for (const fn of functions) {
    const { error } = await supabase.rpc(fn, {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_org_name: 'test',
      p_profile_name: 'test',
      p_email: 'test@test.com'
    });

    if (error?.code === 'PGRST202') {
      console.log(`   ${fn}: ❌ NO EXISTE`);
    } else {
      console.log(`   ${fn}: ✅ Existe`);
    }
  }

  // 2. Verificar políticas RLS
  console.log('\n📋 2. POLÍTICAS RLS');

  // Query directa para ver políticas
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('*');

  // Como no podemos acceder a pg_policies directamente, verificamos de otra forma
  // Verificamos si podemos ejecutar una función que nos diga las políticas

  console.log('   Ejecuta este SQL para verificar:');
  console.log(`
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('perfiles', 'user_organization_roles');
  `);

  // 3. Verificar datos del usuario
  console.log('\n📋 3. DATOS DEL USUARIO ramiro.ira92@gmail.com');

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const user = authUsers?.users?.find(u => u.email === 'ramiro.ira92@gmail.com');

  if (user) {
    console.log(`   User ID: ${user.id}`);

    // Perfil
    const { data: perfil, error: pe } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .single();
    console.log(`   Perfil: ${perfil ? '✅ Existe' : '❌ ' + pe?.message}`);

    // Role
    const { data: role, error: re } = await supabase
      .from('user_organization_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    console.log(`   Role: ${role ? '✅ ' + role.role : '❌ ' + re?.message}`);
    console.log(`   Org ID: ${role?.organization_id || 'N/A'}`);
  }

  // 4. Test de login simulado
  console.log('\n📋 4. SIMULACIÓN DE LECTURA POST-LOGIN');
  console.log('   (Con service key - debería funcionar)');

  if (user) {
    const { data: p, error: pe } = await supabase
      .from('perfiles')
      .select('id, nombre, email, sucursal_id')
      .eq('id', user.id)
      .single();

    const { data: r, error: re } = await supabase
      .from('user_organization_roles')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    console.log(`   Perfil query: ${p ? '✅' : '❌ ' + pe?.message}`);
    console.log(`   Role query: ${r ? '✅ ' + r.role : '❌ ' + re?.message}`);

    if (p && r) {
      console.log('\n   ✅ Las queries funcionan con service key');
      console.log('   Si falla en browser, el problema es RLS con auth.uid()');
    }
  }

  console.log('\n' + '═'.repeat(60));
}

verifyAll().catch(console.error);
