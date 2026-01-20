#!/usr/bin/env node
/**
 * Simula una lectura como usuario autenticado para verificar RLS
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Crear cliente con anon key (como lo hace el frontend)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const USER_ID = '16ea5a15-9dff-4263-8ed0-d2d2eb61389b';

async function testRLSRead() {
  console.log('🔍 TEST DE LECTURA RLS (como anon/sin auth)');
  console.log('═'.repeat(60));
  console.log('');

  // Test 1: Leer perfiles
  console.log('📋 Test 1: Leer perfiles');
  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('id, nombre, email, sucursal_id')
    .eq('id', USER_ID)
    .single();

  if (perfilError) {
    console.log('   ❌ Error:', perfilError.message, `(code: ${perfilError.code})`);
  } else {
    console.log('   ✅ Perfil leído:', perfil?.nombre);
  }

  // Test 2: Leer user_organization_roles
  console.log('');
  console.log('📋 Test 2: Leer user_organization_roles');
  const { data: roles, error: rolesError } = await supabase
    .from('user_organization_roles')
    .select('role, organization_id')
    .eq('user_id', USER_ID)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (rolesError) {
    console.log('   ❌ Error:', rolesError.message, `(code: ${rolesError.code})`);
    console.log('');
    console.log('   ⚠️ PROBLEMA DETECTADO: RLS impide leer user_organization_roles');
    console.log('   La política RLS probablemente requiere que auth.uid() = user_id');
    console.log('   Pero estamos leyendo sin estar autenticados.');
  } else {
    console.log('   ✅ Role leído:', roles?.role, 'Org:', roles?.organization_id);
  }

  console.log('');
  console.log('═'.repeat(60));
}

testRLSRead().catch(console.error);
