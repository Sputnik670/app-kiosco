#!/usr/bin/env node
/**
 * Verifica los datos de un usuario específico en todas las tablas relevantes
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Email del usuario a verificar (cambiar según necesidad)
const EMAIL_TO_CHECK = process.argv[2] || 'ramiro.ira92@gmail.com';

async function checkUserData() {
  console.log('🔍 VERIFICANDO DATOS DE USUARIO');
  console.log('═'.repeat(60));
  console.log(`Email: ${EMAIL_TO_CHECK}`);
  console.log('');

  // 1. Buscar en auth.users (via admin API)
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.log('❌ Error accediendo auth.users:', authError.message);
  } else {
    const user = authUsers.users.find(u => u.email?.toLowerCase() === EMAIL_TO_CHECK.toLowerCase());
    if (user) {
      console.log('✅ AUTH.USERS:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Creado: ${user.created_at}`);
      console.log(`   Confirmado: ${user.email_confirmed_at ? 'Sí' : 'No'}`);

      const userId = user.id;

      // 2. Verificar perfiles
      console.log('');
      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (perfilError) {
        console.log('❌ PERFILES:', perfilError.message);
      } else {
        console.log('✅ PERFILES:');
        console.log(`   ID: ${perfil.id}`);
        console.log(`   Nombre: ${perfil.nombre}`);
        console.log(`   Email: ${perfil.email}`);
        console.log(`   Sucursal ID: ${perfil.sucursal_id}`);
        console.log(`   Columnas: ${Object.keys(perfil).join(', ')}`);
      }

      // 3. Verificar user_organization_roles
      console.log('');
      const { data: roles, error: rolesError } = await supabase
        .from('user_organization_roles')
        .select('*')
        .eq('user_id', userId);

      if (rolesError) {
        console.log('❌ USER_ORGANIZATION_ROLES:', rolesError.message);
      } else if (roles.length === 0) {
        console.log('⚠️ USER_ORGANIZATION_ROLES: No tiene registros');
      } else {
        console.log('✅ USER_ORGANIZATION_ROLES:');
        roles.forEach((r, i) => {
          console.log(`   [${i}] Role: ${r.role}, Org: ${r.organization_id}, Active: ${r.is_active}`);
        });
      }

      // 4. Verificar organizations
      console.log('');
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', userId);

      if (orgsError) {
        console.log('❌ ORGANIZATIONS:', orgsError.message);
      } else if (orgs.length === 0) {
        console.log('⚠️ ORGANIZATIONS: No es owner de ninguna');
      } else {
        console.log('✅ ORGANIZATIONS (como owner):');
        orgs.forEach((o, i) => {
          console.log(`   [${i}] ID: ${o.id}, Nombre: ${o.nombre}`);
        });
      }

    } else {
      console.log(`❌ Usuario con email ${EMAIL_TO_CHECK} no encontrado en auth.users`);
    }
  }

  console.log('');
  console.log('═'.repeat(60));
}

checkUserData().catch(console.error);
