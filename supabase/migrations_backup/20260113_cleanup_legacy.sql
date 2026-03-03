-- ============================================================================
-- Migration: Cleanup Legacy Columns and Rename V2 Functions
-- Date: 2026-01-13
-- Description: Final cleanup after Owner-First migration is stable
-- ============================================================================
-- IMPORTANTE: Ejecutar SOLO después de verificar que el sistema funciona
-- correctamente con user_organization_roles como fuente de verdad.
-- ============================================================================

-- ============================================================================
-- PASO 1: Eliminar columnas obsoletas de perfiles
-- ============================================================================

-- Las columnas organization_id y rol ya no se usan, ahora están en user_organization_roles
ALTER TABLE public.perfiles
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS rol;

-- ============================================================================
-- PASO 2: Eliminar funciones legacy (versiones antiguas)
-- ============================================================================

-- Eliminar funciones legacy que leían de perfiles.organization_id
DROP FUNCTION IF EXISTS public.get_my_org_id() CASCADE;
DROP FUNCTION IF EXISTS public.es_dueno() CASCADE;
DROP FUNCTION IF EXISTS public.es_owner() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_sucursal_id() CASCADE;
DROP FUNCTION IF EXISTS public.create_initial_setup(UUID, TEXT, TEXT, TEXT) CASCADE;

-- ============================================================================
-- PASO 3: Renombrar funciones V2 a nombres originales
-- ============================================================================

-- get_my_org_id_v2 -> get_my_org_id
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
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

COMMENT ON FUNCTION public.get_my_org_id() IS
'Retorna el organization_id del usuario desde user_organization_roles.
Prioriza: owner > admin > manager > employee, luego por antigüedad.';

GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO anon;

-- get_my_role_v2 -> get_my_role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.user_organization_roles
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY
    CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END,
    created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_role() IS
'Retorna el rol principal del usuario.';

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- es_owner_v2 -> es_owner
CREATE OR REPLACE FUNCTION public.es_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_roles
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.es_owner() IS
'Retorna TRUE si el usuario es owner de alguna organización activa.';

GRANT EXECUTE ON FUNCTION public.es_owner() TO authenticated;

-- es_dueno (alias)
CREATE OR REPLACE FUNCTION public.es_dueno()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.es_owner();
$$;

COMMENT ON FUNCTION public.es_dueno() IS
'Alias de es_owner() para compatibilidad con código existente.';

GRANT EXECUTE ON FUNCTION public.es_dueno() TO authenticated;

-- get_my_sucursal_id_v2 -> get_my_sucursal_id
CREATE OR REPLACE FUNCTION public.get_my_sucursal_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT sucursal_id
  FROM public.user_organization_roles
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY
    CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END,
    created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_sucursal_id() IS
'Retorna la sucursal asignada al usuario. NULL para owners/admins (acceso a todas).';

GRANT EXECUTE ON FUNCTION public.get_my_sucursal_id() TO authenticated;

-- get_user_org_context_v2 -> get_user_org_context
CREATE OR REPLACE FUNCTION public.get_user_org_context()
RETURNS TABLE (
  organization_id UUID,
  role TEXT,
  sucursal_id UUID,
  is_owner BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    r.organization_id,
    r.role,
    r.sucursal_id,
    (r.role = 'owner') AS is_owner
  FROM public.user_organization_roles r
  WHERE r.user_id = auth.uid()
    AND r.is_active = true
  ORDER BY
    CASE r.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END,
    r.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_org_context() IS
'Retorna el contexto completo del usuario: organization_id, role, sucursal_id, is_owner.';

GRANT EXECUTE ON FUNCTION public.get_user_org_context() TO authenticated;

-- create_organization_v2 -> create_organization
CREATE OR REPLACE FUNCTION public.create_organization(
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

COMMENT ON FUNCTION public.create_organization(UUID, TEXT) IS
'Crea una organización con su owner_id.';

GRANT EXECUTE ON FUNCTION public.create_organization(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization(UUID, TEXT) TO anon;

-- assign_user_role_v2 -> assign_user_role
CREATE OR REPLACE FUNCTION public.assign_user_role(
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
    RAISE EXCEPTION 'Rol inválido: %. Debe ser owner, admin, manager o employee', p_role;
  END IF;

  INSERT INTO public.user_organization_roles (
    user_id,
    organization_id,
    role,
    sucursal_id,
    invited_by,
    invited_at,
    joined_at,
    is_active
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_role,
    p_sucursal_id,
    p_invited_by,
    CASE WHEN p_invited_by IS NOT NULL THEN NOW() ELSE NULL END,
    NOW(),
    true
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

COMMENT ON FUNCTION public.assign_user_role(UUID, UUID, TEXT, UUID, UUID) IS
'Asigna un rol a un usuario en una organización. Soporta upsert.';

GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, UUID, TEXT, UUID, UUID) TO authenticated;

-- create_initial_setup (versión final sin dual-write)
CREATE OR REPLACE FUNCTION public.create_initial_setup(
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
  v_result JSONB;
BEGIN
  -- 1. Crear Organización con owner_id
  v_org_id := public.create_organization(p_user_id, p_org_name);

  -- 2. Crear Sucursal inicial (Casa Matriz)
  INSERT INTO public.sucursales (organization_id, nombre, direccion)
  VALUES (v_org_id, 'Casa Matriz', NULL)
  RETURNING id INTO v_sucursal_id;

  -- 3. Asignar rol de Owner en user_organization_roles
  v_role_id := public.assign_user_role(
    p_user_id,
    v_org_id,
    'owner',
    NULL,
    NULL
  );

  -- 4. Crear perfil (solo datos básicos, sin organization_id ni rol)
  INSERT INTO public.perfiles (id, nombre, email, sucursal_id)
  VALUES (p_user_id, p_profile_name, p_email, v_sucursal_id)
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    sucursal_id = EXCLUDED.sucursal_id,
    updated_at = NOW();

  -- 5. Construir respuesta
  v_result := jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org_id,
      'nombre', COALESCE(NULLIF(TRIM(p_org_name), ''), 'Mi Negocio'),
      'owner_id', p_user_id
    ),
    'sucursal', jsonb_build_object(
      'id', v_sucursal_id,
      'nombre', 'Casa Matriz'
    ),
    'role', jsonb_build_object(
      'id', v_role_id,
      'role', 'owner',
      'organization_id', v_org_id
    ),
    'perfil', jsonb_build_object(
      'id', p_user_id,
      'nombre', p_profile_name,
      'email', p_email
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_initial_setup(UUID, TEXT, TEXT, TEXT) IS
'Setup completo para nuevo dueño.
1. Crea organización con owner_id
2. Crea sucursal inicial
3. Asigna rol owner en user_organization_roles
4. Crea perfil básico';

GRANT EXECUTE ON FUNCTION public.create_initial_setup(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_initial_setup(UUID, TEXT, TEXT, TEXT) TO anon;

-- complete_employee_setup (versión final sin dual-write)
CREATE OR REPLACE FUNCTION public.complete_employee_setup(
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
  v_result JSONB;
BEGIN
  SELECT * INTO v_invite
  FROM public.pending_invites
  WHERE (
    (p_invite_token IS NOT NULL AND token = p_invite_token)
    OR
    (p_invite_token IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM(p_email)))
  )
  AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'No se encontró invitación válida para este usuario';
  END IF;

  -- Asignar rol de empleado
  v_role_id := public.assign_user_role(
    p_user_id,
    v_invite.organization_id,
    'employee',
    v_invite.sucursal_id,
    NULL
  );

  -- Crear perfil (solo datos básicos)
  INSERT INTO public.perfiles (id, nombre, email, sucursal_id)
  VALUES (p_user_id, p_profile_name, p_email, v_invite.sucursal_id)
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    sucursal_id = EXCLUDED.sucursal_id,
    updated_at = NOW();

  -- Eliminar invitación usada
  DELETE FROM public.pending_invites WHERE id = v_invite.id;

  -- Construir respuesta
  v_result := jsonb_build_object(
    'role', jsonb_build_object(
      'id', v_role_id,
      'role', 'employee',
      'organization_id', v_invite.organization_id,
      'sucursal_id', v_invite.sucursal_id
    ),
    'perfil', jsonb_build_object(
      'id', p_user_id,
      'nombre', p_profile_name,
      'email', p_email
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.complete_employee_setup(UUID, TEXT, TEXT, TEXT) IS
'Completa el setup de un empleado invitado.
1. Valida invitación
2. Asigna rol employee
3. Crea perfil
4. Elimina invitación';

GRANT EXECUTE ON FUNCTION public.complete_employee_setup(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_employee_setup(UUID, TEXT, TEXT, TEXT) TO anon;

-- ============================================================================
-- PASO 4: Eliminar funciones V2 (ya renombradas)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_my_org_id_v2() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role_v2() CASCADE;
DROP FUNCTION IF EXISTS public.es_owner_v2() CASCADE;
DROP FUNCTION IF EXISTS public.es_dueno_v2() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_sucursal_id_v2() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_org_context_v2() CASCADE;
DROP FUNCTION IF EXISTS public.create_organization_v2(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.invite_employee_v2(TEXT, UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) CASCADE;

-- ============================================================================
-- Verificación
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Limpieza completada:';
  RAISE NOTICE '  - Columnas organization_id y rol eliminadas de perfiles';
  RAISE NOTICE '  - Funciones legacy eliminadas';
  RAISE NOTICE '  - Funciones V2 renombradas a nombres originales';
  RAISE NOTICE '  - Sistema usa user_organization_roles como fuente única';
END $$;
