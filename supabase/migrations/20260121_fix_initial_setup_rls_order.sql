-- ============================================================================
-- Fix: create_initial_setup_v2 y complete_employee_setup_v2
-- Problemas:
--   1. Las políticas RLS de sucursales verifican es_owner_v2() pero el rol
--      owner se asignaba DESPUÉS de crear la sucursal
--   2. Las funciones insertaban roles en español ('dueño', 'empleado') pero
--      el constraint perfiles_rol_check espera inglés ('owner', 'employee')
-- Soluciones:
--   1. Asignar rol owner ANTES de crear la sucursal
--   2. Usar valores en inglés para el campo rol en tabla perfiles
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
  VALUES (p_user_id, v_org_id, v_sucursal_id, 'owner', p_profile_name, p_email)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    sucursal_id = EXCLUDED.sucursal_id,
    rol = 'owner',
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
      'rol', 'owner'
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

-- ============================================================================
-- Fix: complete_employee_setup_v2 - usar 'employee' en vez de 'empleado'
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

  -- Crear perfil (COMPATIBILIDAD TEMPORAL) - usar 'employee' en inglés
  INSERT INTO public.perfiles (id, organization_id, sucursal_id, rol, nombre, email)
  VALUES (p_user_id, v_invite.organization_id, v_invite.sucursal_id, 'employee', p_profile_name, p_email)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    sucursal_id = EXCLUDED.sucursal_id,
    rol = 'employee',
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
      'rol', 'employee'
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) IS
'V2: Completa el setup de un empleado invitado.
1. Valida invitación
2. Asigna rol employee
3. Crea perfil (compatibilidad) con rol en inglés
4. Elimina invitación';

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✓ create_initial_setup_v2: rol owner asignado ANTES de crear sucursal, usa "owner"';
  RAISE NOTICE '✓ complete_employee_setup_v2: usa "employee" en vez de "empleado"';
END $$;
