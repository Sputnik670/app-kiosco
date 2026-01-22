-- ============================================================================
-- Migration: Create V2 Functions for Owner-First Model
-- Date: 2026-01-12
-- Description: New RPC functions that read from user_organization_roles
-- ============================================================================

-- ============================================================================
-- get_my_org_id_v2()
-- Lee de user_organization_roles en lugar de perfiles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_org_id_v2()
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

COMMENT ON FUNCTION public.get_my_org_id_v2() IS
'V2: Retorna el organization_id del usuario desde user_organization_roles.
Prioriza: owner > admin > manager > employee, luego por antigüedad.';

GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO anon;


-- ============================================================================
-- get_my_role_v2()
-- Retorna el rol del usuario en su organización actual
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_role_v2()
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

COMMENT ON FUNCTION public.get_my_role_v2() IS
'V2: Retorna el rol principal del usuario.';

GRANT EXECUTE ON FUNCTION public.get_my_role_v2() TO authenticated;


-- ============================================================================
-- es_owner_v2() / es_dueno_v2()
-- Verifica si el usuario es owner de alguna organización activa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.es_owner_v2()
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

-- Alias en español para compatibilidad
CREATE OR REPLACE FUNCTION public.es_dueno_v2()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.es_owner_v2();
$$;

COMMENT ON FUNCTION public.es_owner_v2() IS
'V2: Retorna TRUE si el usuario es owner de alguna organización activa.';

COMMENT ON FUNCTION public.es_dueno_v2() IS
'V2: Alias de es_owner_v2() para compatibilidad con código existente.';

GRANT EXECUTE ON FUNCTION public.es_owner_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_dueno_v2() TO authenticated;


-- ============================================================================
-- get_my_sucursal_id_v2()
-- Retorna la sucursal asignada al usuario
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_sucursal_id_v2()
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

COMMENT ON FUNCTION public.get_my_sucursal_id_v2() IS
'V2: Retorna la sucursal asignada al usuario.
NULL para owners/admins (acceso a todas).';

GRANT EXECUTE ON FUNCTION public.get_my_sucursal_id_v2() TO authenticated;


-- ============================================================================
-- get_user_org_context_v2()
-- Retorna contexto completo del usuario (org_id, role, sucursal_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_org_context_v2()
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

COMMENT ON FUNCTION public.get_user_org_context_v2() IS
'V2: Retorna el contexto completo del usuario en una sola llamada.
Incluye: organization_id, role, sucursal_id, is_owner.';

GRANT EXECUTE ON FUNCTION public.get_user_org_context_v2() TO authenticated;


-- ============================================================================
-- create_organization_v2(p_owner_id, p_org_name)
-- Crea una organización con owner_id
-- ============================================================================
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
  -- Crear la organización con owner_id
  INSERT INTO public.organizations (nombre, owner_id)
  VALUES (COALESCE(NULLIF(TRIM(p_org_name), ''), 'Mi Negocio'), p_owner_id)
  RETURNING id INTO v_org_id;

  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION public.create_organization_v2(UUID, TEXT) IS
'V2: Crea una organización con su owner_id.';

GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO anon;


-- ============================================================================
-- assign_user_role_v2(p_user_id, p_org_id, p_role, p_sucursal_id, p_invited_by)
-- Asigna un rol a un usuario en una organización
-- ============================================================================
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
  -- Validar rol
  IF p_role NOT IN ('owner', 'admin', 'manager', 'employee') THEN
    RAISE EXCEPTION 'Rol inválido: %. Debe ser owner, admin, manager o employee', p_role;
  END IF;

  -- Insertar o actualizar rol
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

COMMENT ON FUNCTION public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) IS
'V2: Asigna un rol a un usuario en una organización.
Soporta upsert: si ya existe la relación, la actualiza.';

GRANT EXECUTE ON FUNCTION public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) TO authenticated;


-- ============================================================================
-- create_initial_setup_v2(p_user_id, p_org_name, p_profile_name, p_email)
-- Setup completo para nuevo dueño (Owner-First)
-- ============================================================================
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
  v_result JSONB;
BEGIN
  -- 1. Crear Organización con owner_id
  v_org_id := public.create_organization_v2(p_user_id, p_org_name);

  -- 2. Asignar rol de Owner en user_organization_roles (ANTES de crear sucursal)
  -- Esto permite que las políticas RLS funcionen correctamente
  v_role_id := public.assign_user_role_v2(
    p_user_id,
    v_org_id,
    'owner',
    NULL,  -- owners tienen acceso a todas las sucursales
    NULL   -- no invitado por nadie
  );

  -- 3. Crear Sucursal inicial (Casa Matriz)
  -- Ahora el usuario ya tiene rol owner, las políticas RLS permiten la inserción
  INSERT INTO public.sucursales (organization_id, nombre, direccion)
  VALUES (v_org_id, 'Casa Matriz', NULL)
  RETURNING id INTO v_sucursal_id;

  -- 4. Crear perfil (COMPATIBILIDAD TEMPORAL - escritura dual)
  INSERT INTO public.perfiles (id, organization_id, sucursal_id, rol, nombre, email)
  VALUES (p_user_id, v_org_id, v_sucursal_id, 'dueño', p_profile_name, p_email)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    sucursal_id = EXCLUDED.sucursal_id,
    rol = 'dueño',
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
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
      'email', p_email,
      'rol', 'dueño'
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) IS
'V2: Setup completo para nuevo dueño (Owner-First).
1. Crea organización con owner_id
2. Asigna rol owner en user_organization_roles (antes de sucursal para RLS)
3. Crea sucursal inicial (ahora RLS permite porque ya es owner)
4. Crea perfil (compatibilidad temporal)';

GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;


-- ============================================================================
-- invite_employee_v2(p_email, p_org_id, p_sucursal_id, p_invited_by)
-- Crea una invitación para un empleado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.invite_employee_v2(
  p_email TEXT,
  p_organization_id UUID,
  p_sucursal_id UUID,
  p_invited_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite_id UUID;
  v_token TEXT;
BEGIN
  -- Generar token único
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Crear invitación
  INSERT INTO public.pending_invites (
    email,
    organization_id,
    sucursal_id,
    token,
    expires_at
  ) VALUES (
    LOWER(TRIM(p_email)),
    p_organization_id,
    p_sucursal_id,
    v_token,
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

COMMENT ON FUNCTION public.invite_employee_v2(TEXT, UUID, UUID, UUID) IS
'V2: Crea una invitación para un empleado.';

GRANT EXECUTE ON FUNCTION public.invite_employee_v2(TEXT, UUID, UUID, UUID) TO authenticated;


-- ============================================================================
-- complete_employee_setup_v2(p_user_id, p_profile_name, p_email, p_invite_token)
-- Completa el setup de un empleado invitado
-- ============================================================================
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
  v_result JSONB;
BEGIN
  -- Buscar invitación válida por token o email
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
  v_role_id := public.assign_user_role_v2(
    p_user_id,
    v_invite.organization_id,
    'employee',
    v_invite.sucursal_id,
    NULL  -- invited_by se podría agregar si lo guardamos en pending_invites
  );

  -- Crear perfil (COMPATIBILIDAD TEMPORAL)
  INSERT INTO public.perfiles (id, organization_id, sucursal_id, rol, nombre, email)
  VALUES (p_user_id, v_invite.organization_id, v_invite.sucursal_id, 'empleado', p_profile_name, p_email)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    sucursal_id = EXCLUDED.sucursal_id,
    rol = 'empleado',
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
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
      'email', p_email,
      'rol', 'empleado'
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) IS
'V2: Completa el setup de un empleado invitado.
1. Valida invitación
2. Asigna rol employee
3. Crea perfil (compatibilidad)
4. Elimina invitación';

GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;


-- ============================================================================
-- Verificación
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Funciones V2 creadas:';
  RAISE NOTICE '  - get_my_org_id_v2()';
  RAISE NOTICE '  - get_my_role_v2()';
  RAISE NOTICE '  - es_owner_v2() / es_dueno_v2()';
  RAISE NOTICE '  - get_my_sucursal_id_v2()';
  RAISE NOTICE '  - get_user_org_context_v2()';
  RAISE NOTICE '  - create_organization_v2()';
  RAISE NOTICE '  - assign_user_role_v2()';
  RAISE NOTICE '  - create_initial_setup_v2()';
  RAISE NOTICE '  - invite_employee_v2()';
  RAISE NOTICE '  - complete_employee_setup_v2()';
END $$;
