-- ============================================================================
-- Fix: Cambiar orden de operaciones en create_initial_setup_v2
-- Problema: Las políticas RLS de sucursales verifican es_owner_v2() pero
--           el rol owner se asignaba DESPUÉS de crear la sucursal
-- Solución: Asignar rol owner ANTES de crear la sucursal
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

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✓ create_initial_setup_v2 actualizada: rol owner se asigna ANTES de crear sucursal';
END $$;
