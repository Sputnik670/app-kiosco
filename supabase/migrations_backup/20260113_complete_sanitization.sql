-- ============================================================================
-- MIGRACIÓN: Saneamiento Completo del Sistema Owner-First
-- Fecha: 2026-01-13
-- Propósito: Crear TODAS las funciones faltantes y unificar el sistema
-- ============================================================================
-- ESTADO ACTUAL (según auditoría):
--   ✅ get_my_org_id (versión legacy - LEE de perfiles)
--   ❌ get_my_org_id_v2 (NO EXISTE - código TS la llama)
--   ❌ get_my_role (NO EXISTE)
--   ✅ get_my_role_v2 (EXISTE)
--   ❌ es_owner (NO EXISTE)
--   ✅ es_owner_v2 (EXISTE)
--   ✅ es_dueno (EXISTE)
--   ❌ create_initial_setup (NO EXISTE)
--   ❌ create_initial_setup_v2 (NO EXISTE)
--   ❌ assign_user_role_v2 (NO EXISTE)
--   ❌ complete_employee_setup_v2 (NO EXISTE)
--   ✅ get_user_org_context_v2 (EXISTE)
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear funciones V2 faltantes que el código TypeScript necesita
-- ============================================================================

-- 1.1 get_my_org_id_v2 - CRÍTICA (código la llama constantemente)
DROP FUNCTION IF EXISTS public.get_my_org_id_v2() CASCADE;
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
'V2: Retorna organization_id desde user_organization_roles (no perfiles).';

GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO anon;

-- 1.2 create_organization_v2
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

COMMENT ON FUNCTION public.create_organization_v2(UUID, TEXT) IS
'Crea una organización con owner_id.';

GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO anon;

-- 1.3 assign_user_role_v2
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

COMMENT ON FUNCTION public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) IS
'Asigna rol en user_organization_roles. Soporta upsert.';

GRANT EXECUTE ON FUNCTION public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) TO authenticated;

-- 1.4 create_initial_setup_v2 - CRÍTICA para registro de dueños
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
  v_result JSONB;
BEGIN
  -- 1. Crear Organización
  v_org_id := public.create_organization_v2(p_user_id, p_org_name);

  -- 2. Crear Sucursal inicial
  INSERT INTO public.sucursales (organization_id, nombre, direccion)
  VALUES (v_org_id, 'Casa Matriz', NULL)
  RETURNING id INTO v_sucursal_id;

  -- 3. Asignar rol owner
  v_role_id := public.assign_user_role_v2(
    p_user_id,
    v_org_id,
    'owner',
    NULL,
    NULL
  );

  -- 4. Crear/actualizar perfil
  INSERT INTO public.perfiles (id, nombre, email, sucursal_id, rol, organization_id)
  VALUES (p_user_id, p_profile_name, p_email, v_sucursal_id, 'dueño', v_org_id)
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    sucursal_id = EXCLUDED.sucursal_id,
    rol = EXCLUDED.rol,
    organization_id = EXCLUDED.organization_id,
    updated_at = NOW();

  -- 5. Resultado
  v_result := jsonb_build_object(
    'organization', jsonb_build_object('id', v_org_id, 'nombre', COALESCE(NULLIF(TRIM(p_org_name), ''), 'Mi Negocio')),
    'sucursal', jsonb_build_object('id', v_sucursal_id, 'nombre', 'Casa Matriz'),
    'role', jsonb_build_object('id', v_role_id, 'role', 'owner'),
    'perfil', jsonb_build_object('id', p_user_id, 'nombre', p_profile_name)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) IS
'Setup completo para nuevo dueño: org + sucursal + rol + perfil.';

GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;

-- 1.5 complete_employee_setup_v2 - CRÍTICA para registro de empleados
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
  v_result JSONB;
BEGIN
  -- Buscar invitación válida
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

  -- Asignar rol employee
  v_role_id := public.assign_user_role_v2(
    p_user_id,
    v_invite.organization_id,
    'employee',
    v_invite.sucursal_id,
    NULL
  );

  -- Crear perfil
  INSERT INTO public.perfiles (id, nombre, email, sucursal_id, rol, organization_id)
  VALUES (p_user_id, p_profile_name, p_email, v_invite.sucursal_id, 'empleado', v_invite.organization_id)
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    sucursal_id = EXCLUDED.sucursal_id,
    rol = EXCLUDED.rol,
    organization_id = EXCLUDED.organization_id,
    updated_at = NOW();

  -- Eliminar invitación
  DELETE FROM public.pending_invites WHERE id = v_invite.id;

  -- Resultado
  v_result := jsonb_build_object(
    'role', jsonb_build_object('id', v_role_id, 'role', 'employee', 'organization_id', v_invite.organization_id),
    'perfil', jsonb_build_object('id', p_user_id, 'nombre', p_profile_name)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) IS
'Completa setup de empleado invitado.';

GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_employee_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;

-- 1.6 get_my_role (sin V2, para compatibilidad)
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
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

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 1.7 es_owner (sin V2, para RLS)
DROP FUNCTION IF EXISTS public.es_owner() CASCADE;
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

GRANT EXECUTE ON FUNCTION public.es_owner() TO authenticated;

-- 1.8 get_my_sucursal_id_v2
DROP FUNCTION IF EXISTS public.get_my_sucursal_id_v2() CASCADE;
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

GRANT EXECUTE ON FUNCTION public.get_my_sucursal_id_v2() TO authenticated;

-- ============================================================================
-- PASO 2: Verificar que owner_id existe en organizations
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN owner_id UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Columna owner_id agregada a organizations';
  ELSE
    RAISE NOTICE 'Columna owner_id ya existe en organizations';
  END IF;
END $$;

-- ============================================================================
-- PASO 3: Verificar tabla user_organization_roles
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_organization_roles') THEN
    CREATE TABLE public.user_organization_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
      sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
      invited_by UUID REFERENCES auth.users(id),
      invited_at TIMESTAMPTZ,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, organization_id)
    );

    CREATE INDEX idx_uor_user ON public.user_organization_roles(user_id);
    CREATE INDEX idx_uor_org ON public.user_organization_roles(organization_id);

    ALTER TABLE public.user_organization_roles ENABLE ROW LEVEL SECURITY;

    RAISE NOTICE 'Tabla user_organization_roles creada';
  ELSE
    RAISE NOTICE 'Tabla user_organization_roles ya existe';
  END IF;
END $$;

-- ============================================================================
-- PASO 4: RLS para user_organization_roles
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_organization_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_organization_roles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage org roles" ON public.user_organization_roles;
CREATE POLICY "Owners can manage org roles"
  ON public.user_organization_roles FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Service role bypass" ON public.user_organization_roles;
CREATE POLICY "Service role bypass"
  ON public.user_organization_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
  fn_count INT;
BEGIN
  SELECT COUNT(*) INTO fn_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_my_org_id_v2',
    'create_initial_setup_v2',
    'complete_employee_setup_v2',
    'assign_user_role_v2',
    'get_my_role',
    'es_owner'
  );

  RAISE NOTICE '✅ Saneamiento completado. Funciones V2 creadas: %', fn_count;
END $$;
