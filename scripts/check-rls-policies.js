#!/usr/bin/env node
/**
 * Verifica las políticas RLS de las tablas críticas
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkRLSPolicies() {
  console.log('🔍 VERIFICANDO POLÍTICAS RLS');
  console.log('═'.repeat(60));
  console.log('');

  // Query para obtener políticas RLS
  const { data, error } = await supabase.rpc('get_policies_info');

  if (error && error.code === 'PGRST202') {
    console.log('Función get_policies_info no existe. Consultando manualmente...');
    console.log('');
    console.log('Ejecuta este SQL en Supabase Dashboard para ver las políticas:');
    console.log('');
    console.log(`
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('perfiles', 'user_organization_roles', 'organizations', 'sucursales')
ORDER BY tablename, policyname;
    `);
    return;
  }

  console.log('Políticas:', data);
}

// Test adicional: verificar si RLS está habilitado
async function checkRLSEnabled() {
  console.log('');
  console.log('📋 Verificando si RLS está habilitado...');
  console.log('');
  console.log('Ejecuta este SQL en Supabase Dashboard:');
  console.log(`
SELECT
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN ('perfiles', 'user_organization_roles', 'organizations', 'sucursales')
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  `);
}

checkRLSPolicies().then(checkRLSEnabled).catch(console.error);
