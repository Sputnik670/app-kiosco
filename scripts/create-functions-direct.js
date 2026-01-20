#!/usr/bin/env node
/**
 * Crea funciones usando pg directamente via connection string
 * Este script intenta usar la Management API de Supabase
 */

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extraer project ref
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];

async function createFunctions() {
  console.log('🔧 CREANDO FUNCIONES VIA SUPABASE MANAGEMENT API');
  console.log('═'.repeat(60));
  console.log(`Project: ${projectRef}`);
  console.log('');

  // Las funciones SQL individuales
  const sqlStatements = [
    // 1. get_my_org_id_v2
    `
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
    `,
    `GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO authenticated;`,
    `GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO anon;`,

    // 2. create_organization_v2
    `
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
    `,
    `GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO authenticated;`,
    `GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO anon;`,

    // 3. assign_user_role_v2
    `
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
    `,
    `GRANT EXECUTE ON FUNCTION public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) TO authenticated;`,

    // 4. create_initial_setup_v2
    `
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
      v_org_id := public.create_organization_v2(p_user_id, p_org_name);

      INSERT INTO public.sucursales (organization_id, nombre)
      VALUES (v_org_id, 'Casa Matriz')
      RETURNING id INTO v_sucursal_id;

      v_role_id := public.assign_user_role_v2(p_user_id, v_org_id, 'owner', NULL, NULL);

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
    `,
    `GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;`,
    `GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;`,

    // 5. complete_employee_setup_v2
    `
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
    `,
    `GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;`,
    `GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;`,

    // 6. get_my_role
    `
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
    `,
    `GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;`,

    // 7. es_owner
    `
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
    `,
    `GRANT EXECUTE ON FUNCTION public.es_owner() TO authenticated;`,

    // 8. get_my_sucursal_id_v2
    `
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
    `,
    `GRANT EXECUTE ON FUNCTION public.get_my_sucursal_id_v2() TO authenticated;`
  ];

  // Generar archivo SQL combinado para copiar/pegar
  const combinedSql = sqlStatements.join('\n\n');

  console.log('📄 SQL PARA EJECUTAR EN SUPABASE DASHBOARD:');
  console.log('═'.repeat(60));
  console.log('');
  console.log('Ve a: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  console.log('');
  console.log('Copia y pega el siguiente SQL:');
  console.log('');
  console.log('─'.repeat(60));
  console.log(combinedSql);
  console.log('─'.repeat(60));

  // También guardar en archivo
  const fs = require('fs');
  fs.writeFileSync('EXECUTE_THIS_SQL.sql', combinedSql);
  console.log('');
  console.log('✅ SQL guardado en: EXECUTE_THIS_SQL.sql');
}

createFunctions().catch(console.error);
