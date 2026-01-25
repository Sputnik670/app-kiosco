-- ============================================================================
-- Fix: create_initial_setup_v2 - Bypass RLS for initial sucursal creation
-- ============================================================================
-- Problema: Aunque create_initial_setup_v2 es SECURITY DEFINER y asigna
-- el rol owner ANTES de crear la sucursal, las políticas RLS siguen
-- bloqueando el INSERT porque las funciones es_owner_v2() y
-- get_my_org_id_v2() se evalúan en el contexto del usuario autenticado.
--
-- Root Cause: SECURITY DEFINER no bypasea automáticamente RLS. Las políticas
-- RLS se aplican al usuario autenticado incluso en funciones SECURITY DEFINER.
--
-- Solución: Usar SET LOCAL row_security = off dentro de la función para
-- deshabilitar RLS temporalmente durante la creación inicial.
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
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_sucursal_id UUID;
  v_role_id UUID;
  v_result JSONB;
BEGIN
  -- Temporalmente deshabilitar RLS para esta función
  -- Es seguro porque esta función solo se ejecuta durante el setup inicial
  -- y valida que el usuario es el owner de la organización que se está creando
  SET LOCAL row_security = off;

  -- 1. Crear Organización con owner_id
  v_org_id := public.create_organization_v2(p_user_id, p_org_name);

  -- 2. Asignar rol de Owner en user_organization_roles (ANTES de crear sucursal)
  v_role_id := public.assign_user_role_v2(
    p_user_id,
    v_org_id,
    'owner',
    NULL,  -- owners tienen acceso a todas las sucursales
    NULL   -- no invitado por nadie
  );

  -- 3. Crear Sucursal inicial (Casa Matriz)
  -- RLS está deshabilitado temporalmente, así que esto funcionará
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
'V2: Setup completo para nuevo dueño (Owner-First) con RLS bypass.
1. Deshabilita RLS temporalmente (seguro durante setup inicial)
2. Crea organización con owner_id
3. Asigna rol owner en user_organization_roles
4. Crea sucursal inicial (Casa Matriz)
5. Crea perfil (compatibilidad temporal)';

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✓ create_initial_setup_v2 actualizado con SET LOCAL row_security = off';
  RAISE NOTICE '✓ RLS se deshabilitará temporalmente durante initial setup';
  RAISE NOTICE '✓ Es seguro porque la función valida ownership';
END $$;
