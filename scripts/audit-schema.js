#!/usr/bin/env node
/**
 * Script de Auditoría de Esquema - Usa Supabase Management API
 * Ejecuta queries SQL directas para inspeccionar el estado real de la BD
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function auditSchema() {
  console.log('🔍 AUDITORÍA DE ESQUEMA SUPABASE');
  console.log('═'.repeat(60));

  // 1. Auditar columnas de perfiles
  console.log('\n📋 TABLA: perfiles');
  console.log('─'.repeat(40));

  const { data: perfilesColumns, error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'perfiles'
      ORDER BY ordinal_position;
    `
  });

  if (e1) {
    // Fallback: intentar seleccionar una fila para ver las columnas
    console.log('   (Usando método alternativo - SELECT *)');
    const { data, error } = await supabase.from('perfiles').select('*').limit(1);
    if (data && data.length > 0) {
      console.log('   Columnas detectadas:', Object.keys(data[0]).join(', '));
    } else if (error) {
      console.log('   Error:', error.message);
    } else {
      console.log('   Tabla vacía o sin acceso');
    }
  } else {
    perfilesColumns?.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
  }

  // 2. Auditar columnas de organizations
  console.log('\n📋 TABLA: organizations');
  console.log('─'.repeat(40));

  const { data: orgData } = await supabase.from('organizations').select('*').limit(1);
  if (orgData && orgData.length > 0) {
    console.log('   Columnas:', Object.keys(orgData[0]).join(', '));
  }

  // 3. Auditar user_organization_roles
  console.log('\n📋 TABLA: user_organization_roles');
  console.log('─'.repeat(40));

  const { data: rolesData } = await supabase.from('user_organization_roles').select('*').limit(1);
  if (rolesData && rolesData.length > 0) {
    console.log('   Columnas:', Object.keys(rolesData[0]).join(', '));
  } else {
    // Verificar si la tabla existe
    const { count } = await supabase.from('user_organization_roles').select('*', { count: 'exact', head: true });
    console.log('   Tabla existe, registros:', count ?? 0);
  }

  // 4. Listar funciones relevantes
  console.log('\n🔧 FUNCIONES SQL RELEVANTES');
  console.log('─'.repeat(40));

  const functionsToCheck = [
    'get_my_org_id',
    'get_my_org_id_v2',
    'get_my_role',
    'get_my_role_v2',
    'es_owner',
    'es_owner_v2',
    'es_dueno',
    'es_dueno_v2',
    'create_initial_setup',
    'create_initial_setup_v2',
    'assign_user_role',
    'assign_user_role_v2',
    'complete_employee_setup',
    'complete_employee_setup_v2',
    'get_user_org_context',
    'get_user_org_context_v2'
  ];

  for (const fn of functionsToCheck) {
    const { data, error } = await supabase.rpc(fn);
    const status = error ? `❌ ${error.code || 'error'}` : '✅ existe';
    console.log(`   ${fn}: ${status}`);
  }

  // 5. Verificar RLS en tablas principales
  console.log('\n🔒 ESTADO RLS');
  console.log('─'.repeat(40));

  const tables = ['perfiles', 'organizations', 'sucursales', 'productos', 'ventas', 'user_organization_roles'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(0);
    const status = error ? `⚠️ ${error.code}` : '✅ accesible';
    console.log(`   ${table}: ${status}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Auditoría completada');
}

auditSchema().catch(console.error);
