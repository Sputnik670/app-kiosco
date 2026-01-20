-- ============================================================================
-- EJECUTAR AHORA - SQL DEFINITIVO PARA PLANETAZEGA
-- ============================================================================
-- Este SQL corrige todas las funciones para que NO usen columnas
-- 'rol' ni 'organization_id' en la tabla perfiles (ya que no existen)
-- ============================================================================
-- Ejecutar en: https://supabase.com/dashboard/project/cwuzcdzjkmgodgtkekbd/sql/new
-- ============================================================================

-- 1. DROP + CREATE de create_initial_setup_v2
-- ============================================================================
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
  -- 1. Crear Organizacion con owner_id
  INSERT INTO public.organizations (nombre, owner_id)
  VALUES (COALESCE(NULLIF(TRIM(p_org_name), ''), 'Mi Negocio'), p_user_id)
  RETURNING id INTO v_org_id;

  -- 2. Crear Sucursal inicial
  INSERT INTO public.sucursales (organization_id, nombre)
  VALUES (v_org_id, 'Casa Matriz')
  RETURNING id INTO v_sucursal_id;

  -- 3. Asignar rol owner en user_organization_roles
  INSERT INTO public.user_organization_roles (
    user_id, organization_id, role, sucursal_id, is_active, joined_at
  ) VALUES (
    p_user_id, v_org_id, 'owner', NULL, true, NOW()
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE SET
    role = 'owner',
    is_active = true,
    updated_at = NOW()
  RETURNING id INTO v_role_id;

  -- 4. Crear perfil SOLO con campos que existen (SIN rol, SIN organization_id)
  INSERT INTO public.perfiles (id, nombre, email, sucursal_id)
  VALUES (p_user_id, p_profile_name, p_email, v_sucursal_id)
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    sucursal_id = EXCLUDED.sucursal_id,
    updated_at = NOW();

  -- 5. Resultado
  RETURN jsonb_build_object(
    'organization', jsonb_build_object('id', v_org_id, 'nombre', COALESCE(NULLIF(TRIM(p_org_name), ''), 'Mi Negocio')),
    'sucursal', jsonb_build_object('id', v_sucursal_id, 'nombre', 'Casa Matriz'),
    'role', jsonb_build_object('id', v_role_id, 'role', 'owner'),
    'perfil', jsonb_build_object('id', p_user_id, 'nombre', p_profile_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;

-- 2. DROP + CREATE de complete_employee_setup_v2
-- ============================================================================
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
  -- Buscar invitacion valida
  SELECT * INTO v_invite
  FROM public.pending_invites
  WHERE (
    (p_invite_token IS NOT NULL AND token::TEXT = p_invite_token)
    OR (p_invite_token IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(p_email)))
  )
  AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'No se encontro invitacion valida para este usuario';
  END IF;

  -- Asignar rol employee en user_organization_roles
  INSERT INTO public.user_organization_roles (
    user_id, organization_id, role, sucursal_id, is_active, joined_at
  ) VALUES (
    p_user_id, v_invite.organization_id, 'employee', v_invite.sucursal_id, true, NOW()
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE SET
    role = 'employee',
    sucursal_id = EXCLUDED.sucursal_id,
    is_active = true,
    updated_at = NOW()
  RETURNING id INTO v_role_id;

  -- Crear perfil SOLO con campos que existen (SIN rol, SIN organization_id)
  INSERT INTO public.perfiles (id, nombre, email, sucursal_id)
  VALUES (p_user_id, p_profile_name, p_email, v_invite.sucursal_id)
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    sucursal_id = EXCLUDED.sucursal_id,
    updated_at = NOW();

  -- Eliminar invitacion usada
  DELETE FROM public.pending_invites WHERE id = v_invite.id;

  -- Resultado
  RETURN jsonb_build_object(
    'role', jsonb_build_object('id', v_role_id, 'role', 'employee', 'organization_id', v_invite.organization_id),
    'perfil', jsonb_build_object('id', p_user_id, 'nombre', p_profile_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;

-- 3. DROP + CREATE de assign_user_role_v2
-- ============================================================================
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
    RAISE EXCEPTION 'Rol invalido: %. Debe ser owner, admin, manager o employee', p_role;
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

-- ============================================================================
-- VERIFICACION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FUNCIONES ACTUALIZADAS CORRECTAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'create_initial_setup_v2: OK';
  RAISE NOTICE 'complete_employee_setup_v2: OK';
  RAISE NOTICE 'assign_user_role_v2: OK';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Ninguna funcion usa rol/organization_id en perfiles';
  RAISE NOTICE '========================================';
END $$;
