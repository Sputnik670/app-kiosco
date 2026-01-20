#!/usr/bin/env node
/**
 * Ejecuta el SQL de saneamiento directamente en Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Falta configuración de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function executeSanitization() {
  console.log('🔧 EJECUTANDO SANEAMIENTO DE BASE DE DATOS');
  console.log('═'.repeat(60));

  // Las funciones se crean una por una para evitar problemas con transacciones largas

  const functions = [
    // 1. get_my_org_id_v2
    {
      name: 'get_my_org_id_v2',
      sql: `
        DROP FUNCTION IF EXISTS public.get_my_org_id_v2() CASCADE;
        CREATE OR REPLACE FUNCTION public.get_my_org_id_v2()
        RETURNS UUID
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
          SELECT organization_id
          FROM public.user_organization_roles
          WHERE user_id = auth.uid()
            AND is_active = true
          ORDER BY
            CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END,
            created_at ASC
          LIMIT 1;
        $$;
        GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO authenticated;
        GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO anon;
      `
    },
    // 2. create_organization_v2
    {
      name: 'create_organization_v2',
      sql: `
        DROP FUNCTION IF EXISTS public.create_organization_v2(UUID, TEXT) CASCADE;
        CREATE OR REPLACE FUNCTION public.create_organization_v2(
          p_owner_id UUID,
          p_org_name TEXT DEFAULT 'Mi Negocio'
        )
        RETURNS UUID
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          v_org_id UUID;
        BEGIN
          INSERT INTO public.organizations (nombre, owner_id)
          VALUES (COALESCE(NULLIF(TRIM(p_org_name), ''), 'Mi Negocio'), p_owner_id)
          RETURNING id INTO v_org_id;
          RETURN v_org_id;
        END;
        $$;
        GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO anon;
      `
    },
    // 3. assign_user_role_v2
    {
      name: 'assign_user_role_v2',
      sql: `
        DROP FUNCTION IF EXISTS public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) CASCADE;
        CREATE OR REPLACE FUNCTION public.assign_user_role_v2(
          p_user_id UUID,
          p_organization_id UUID,
          p_role TEXT DEFAULT 'employee',
          p_sucursal_id UUID DEFAULT NULL,
          p_invited_by UUID DEFAULT NULL
        )
        RETURNS UUID
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          v_role_id UUID;
        BEGIN
          IF p_role NOT IN ('owner', 'admin', 'manager', 'employee') THEN
            RAISE EXCEPTION 'Rol inválido: %', p_role;
          END IF;
          INSERT INTO public.user_organization_roles (
            user_id, organization_id, role, sucursal_id, invited_by,
            invited_at, joined_at, is_active
          ) VALUES (
            p_user_id, p_organization_id, p_role, p_sucursal_id, p_invited_by,
            CASE WHEN p_invited_by IS NOT NULL THEN NOW() ELSE NULL END,
            NOW(), true
          )
          ON CONFLICT (user_id, organization_id) DO UPDATE SET
            role = EXCLUDED.role,
            sucursal_id = EXCLUDED.sucursal_id,
            is_active = true,
            updated_at = NOW()
          RETURNING id INTO v_role_id;
          RETURN v_role_id;
        END;
        $$;
        GRANT EXECUTE ON FUNCTION public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) TO authenticated;
      `
    },
    // 4. create_initial_setup_v2
    {
      name: 'create_initial_setup_v2',
      sql: `
        DROP FUNCTION IF EXISTS public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) CASCADE;
        CREATE OR REPLACE FUNCTION public.create_initial_setup_v2(
          p_user_id UUID,
          p_org_name TEXT,
          p_profile_name TEXT,
          p_email TEXT
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          v_org_id UUID;
          v_sucursal_id UUID;
          v_role_id UUID;
        BEGIN
          -- Crear Organización
          v_org_id := public.create_organization_v2(p_user_id, p_org_name);

          -- Crear Sucursal inicial
          INSERT INTO public.sucursales (organization_id, nombre)
          VALUES (v_org_id, 'Casa Matriz')
          RETURNING id INTO v_sucursal_id;

          -- Asignar rol owner
          v_role_id := public.assign_user_role_v2(p_user_id, v_org_id, 'owner', NULL, NULL);

          -- Crear perfil
          INSERT INTO public.perfiles (id, nombre, email, sucursal_id, rol, organization_id)
          VALUES (p_user_id, p_profile_name, p_email, v_sucursal_id, 'dueño', v_org_id)
          ON CONFLICT (id) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            email = EXCLUDED.email,
            sucursal_id = EXCLUDED.sucursal_id,
            rol = EXCLUDED.rol,
            organization_id = EXCLUDED.organization_id,
            updated_at = NOW();

          RETURN jsonb_build_object(
            'organization', jsonb_build_object('id', v_org_id),
            'sucursal', jsonb_build_object('id', v_sucursal_id),
            'role', jsonb_build_object('id', v_role_id, 'role', 'owner')
          );
        END;
        $$;
        GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;
      `
    },
    // 5. complete_employee_setup_v2
    {
      name: 'complete_employee_setup_v2',
      sql: `
        DROP FUNCTION IF EXISTS public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) CASCADE;
        CREATE OR REPLACE FUNCTION public.complete_employee_setup_v2(
          p_user_id UUID,
          p_profile_name TEXT,
          p_email TEXT,
          p_invite_token TEXT DEFAULT NULL
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          v_invite RECORD;
          v_role_id UUID;
        BEGIN
          SELECT * INTO v_invite
          FROM public.pending_invites
          WHERE (
            (p_invite_token IS NOT NULL AND token = p_invite_token)
            OR (p_invite_token IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(p_email)))
          )
          AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;

          IF v_invite IS NULL THEN
            RAISE EXCEPTION 'No se encontró invitación válida';
          END IF;

          v_role_id := public.assign_user_role_v2(
            p_user_id, v_invite.organization_id, 'employee', v_invite.sucursal_id, NULL
          );

          INSERT INTO public.perfiles (id, nombre, email, sucursal_id, rol, organization_id)
          VALUES (p_user_id, p_profile_name, p_email, v_invite.sucursal_id, 'empleado', v_invite.organization_id)
          ON CONFLICT (id) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            email = EXCLUDED.email,
            sucursal_id = EXCLUDED.sucursal_id,
            rol = EXCLUDED.rol,
            organization_id = EXCLUDED.organization_id,
            updated_at = NOW();

          DELETE FROM public.pending_invites WHERE id = v_invite.id;

          RETURN jsonb_build_object(
            'role', jsonb_build_object('id', v_role_id, 'role', 'employee'),
            'perfil', jsonb_build_object('id', p_user_id)
          );
        END;
        $$;
        GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;
      `
    },
    // 6. get_my_role
    {
      name: 'get_my_role',
      sql: `
        DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
        CREATE OR REPLACE FUNCTION public.get_my_role()
        RETURNS TEXT
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
          SELECT role
          FROM public.user_organization_roles
          WHERE user_id = auth.uid() AND is_active = true
          ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
          LIMIT 1;
        $$;
        GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
      `
    },
    // 7. es_owner
    {
      name: 'es_owner',
      sql: `
        DROP FUNCTION IF EXISTS public.es_owner() CASCADE;
        CREATE OR REPLACE FUNCTION public.es_owner()
        RETURNS BOOLEAN
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
          SELECT EXISTS (
            SELECT 1 FROM public.user_organization_roles
            WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
          );
        $$;
        GRANT EXECUTE ON FUNCTION public.es_owner() TO authenticated;
      `
    },
    // 8. get_my_sucursal_id_v2
    {
      name: 'get_my_sucursal_id_v2',
      sql: `
        DROP FUNCTION IF EXISTS public.get_my_sucursal_id_v2() CASCADE;
        CREATE OR REPLACE FUNCTION public.get_my_sucursal_id_v2()
        RETURNS UUID
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
          SELECT sucursal_id
          FROM public.user_organization_roles
          WHERE user_id = auth.uid() AND is_active = true
          ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
          LIMIT 1;
        $$;
        GRANT EXECUTE ON FUNCTION public.get_my_sucursal_id_v2() TO authenticated;
      `
    }
  ];

  // Ejecutar cada función usando fetch a la API de Supabase
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];

  if (!projectRef) {
    console.error('❌ No se pudo extraer el project ref de la URL');
    process.exit(1);
  }

  console.log(`📦 Project: ${projectRef}`);
  console.log('');

  for (const fn of functions) {
    process.stdout.write(`   ${fn.name}... `);

    try {
      // Usar la API REST de Supabase para ejecutar SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: fn.sql })
      });

      if (!response.ok) {
        // La función exec_sql no existe, intentar otro método
        throw new Error('exec_sql not available');
      }

      console.log('✅');
    } catch (err) {
      // Método alternativo: usar el SQL Editor de Supabase Dashboard
      console.log('⚠️ (requiere ejecución manual)');
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('');
  console.log('📋 INSTRUCCIONES:');
  console.log('   Las funciones deben ejecutarse en el SQL Editor de Supabase.');
  console.log('   Copia el contenido de:');
  console.log('   supabase/migrations/20260113_complete_sanitization.sql');
  console.log('');
  console.log('   O ejecuta: npx supabase db push (requiere Docker)');
  console.log('');

  // Verificar estado después
  console.log('🔍 Verificando estado actual...');

  const testFunctions = [
    'get_my_org_id_v2',
    'create_initial_setup_v2',
    'complete_employee_setup_v2',
    'get_my_role',
    'es_owner'
  ];

  for (const fn of testFunctions) {
    const { error } = await supabase.rpc(fn);
    const status = error?.code === 'PGRST202' ? '❌ NO existe' : '✅ existe';
    console.log(`   ${fn}: ${status}`);
  }
}

executeSanitization().catch(console.error);
