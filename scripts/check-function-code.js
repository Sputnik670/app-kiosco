#!/usr/bin/env node
/**
 * Verifica el código fuente de las funciones SQL para detectar
 * si usan columnas que ya no existen (rol, organization_id en perfiles)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkFunctions() {
  console.log('🔍 VERIFICANDO CÓDIGO DE FUNCIONES SQL');
  console.log('═'.repeat(60));
  console.log('');

  // Query para obtener el código fuente de las funciones
  const { data, error } = await supabase.rpc('get_function_definitions', {});

  if (error && error.code === 'PGRST202') {
    // La función no existe, usar query directa via REST no es posible
    // Vamos a intentar crear una función temporal
    console.log('⚠️ No se puede inspeccionar el código directamente.');
    console.log('');
    console.log('📋 SOLUCIÓN: Ejecuta este SQL en Supabase Dashboard:');
    console.log('');
    console.log(`
SELECT
  proname as function_name,
  CASE
    WHEN prosrc LIKE '%perfiles%rol%' THEN '❌ USA rol EN perfiles'
    WHEN prosrc LIKE '%perfiles%organization_id%' THEN '❌ USA organization_id EN perfiles'
    ELSE '✅ OK'
  END as status,
  CASE
    WHEN prosrc LIKE '%perfiles%rol%' OR prosrc LIKE '%perfiles%organization_id%'
    THEN 'NECESITA ACTUALIZACIÓN'
    ELSE 'Correcto'
  END as action
FROM pg_proc
WHERE proname IN (
  'create_initial_setup_v2',
  'complete_employee_setup_v2',
  'assign_user_role_v2'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `);
    return;
  }

  console.log('Funciones verificadas');
}

// Test directo: intentar crear un usuario de prueba
async function testCreateSetup() {
  console.log('');
  console.log('🧪 TEST DIRECTO: create_initial_setup_v2');
  console.log('-'.repeat(40));

  // Crear un UUID de prueba que no existe
  const testUserId = '11111111-1111-1111-1111-111111111111';

  const { data, error } = await supabase.rpc('create_initial_setup_v2', {
    p_user_id: testUserId,
    p_org_name: 'Test Org',
    p_profile_name: 'Test User',
    p_email: 'test@example.com'
  });

  if (error) {
    console.log('Error:', error.message);

    if (error.message.includes('rol')) {
      console.log('');
      console.log('❌ LA FUNCIÓN TODAVÍA USA "rol" - NECESITA ACTUALIZACIÓN');
      console.log('');
      console.log('👉 Ejecuta FIX_FUNCTIONS_NO_ROL.sql en Supabase Dashboard');
    } else if (error.message.includes('organization_id')) {
      console.log('');
      console.log('❌ LA FUNCIÓN TODAVÍA USA "organization_id" - NECESITA ACTUALIZACIÓN');
      console.log('');
      console.log('👉 Ejecuta FIX_FUNCTIONS_NO_ROL.sql en Supabase Dashboard');
    } else if (error.code === '23503') {
      console.log('');
      console.log('✅ La función ejecuta correctamente (FK error es esperado con UUID falso)');
    } else {
      console.log('');
      console.log('⚠️ Error inesperado:', error.code);
    }
  } else {
    console.log('✅ Función ejecutó correctamente');
    console.log('Resultado:', JSON.stringify(data, null, 2));

    // Limpiar datos de prueba
    await supabase.from('perfiles').delete().eq('id', testUserId);
    await supabase.from('user_organization_roles').delete().eq('user_id', testUserId);
    // Las organizaciones y sucursales quedarán huérfanas, pero no importa para el test
  }
}

checkFunctions().then(() => testCreateSetup()).catch(console.error);
