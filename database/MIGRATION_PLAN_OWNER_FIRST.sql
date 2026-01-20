-- ===============================================================================
-- PLAN DE MIGRACION: OWNER-FIRST MODEL
-- ===============================================================================
--
-- Fecha: 2026-01-10
-- Autor: Claudio (Staff Engineer)
-- Revisado por: Arquitecto (Gemini)
--
-- OBJETIVO:
--   Migrar de un modelo donde organization_id vive en perfiles
--   a un modelo donde la relacion usuario-organizacion es N:M
--   con roles explicitos y owner_id en organizations.
--
-- ===============================================================================


-- ===============================================================================
-- SECCION 1: ANALISIS DE IMPACTO
-- ===============================================================================
--
-- FUNCIONES RPC QUE SE ROMPEN SI QUITAMOS perfiles.organization_id:
--
-- ┌─────────────────────────────┬────────────────────────────────────────────────┐
-- │ FUNCION                     │ IMPACTO                                        │
-- ├─────────────────────────────┼────────────────────────────────────────────────┤
-- │ get_my_org_id()             │ CRITICO - Lee perfiles.organization_id         │
-- │                             │ Linea 38-41: SELECT organization_id FROM       │
-- │                             │ perfiles WHERE id = auth.uid()                 │
-- ├─────────────────────────────┼────────────────────────────────────────────────┤
-- │ es_dueno()                  │ MEDIO - Lee perfiles.rol                       │
-- │                             │ Linea 64: SELECT rol = 'dueno' FROM perfiles   │
-- │                             │ Nota: El rol tambien debe migrar               │
-- ├─────────────────────────────┼────────────────────────────────────────────────┤
-- │ create_initial_setup()      │ CRITICO - Inserta en perfiles con org_id       │
-- │                             │ Linea 124: INSERT INTO perfiles                │
-- │                             │ (id, organization_id, sucursal_id, rol, ...)   │
-- ├─────────────────────────────┼────────────────────────────────────────────────┤
-- │ procesar_venta()            │ CRITICO - Lee perfiles.organization_id         │
-- │                             │ Linea 247-248: SELECT organization_id, id      │
-- │                             │ INTO v_organization_id FROM perfiles           │
-- └─────────────────────────────┴────────────────────────────────────────────────┘
--
-- ARCHIVOS TYPESCRIPT AFECTADOS (27 referencias):
--   - lib/actions/branch.actions.ts (3 refs)
--   - lib/actions/auth.actions.ts (6 refs)
--   - lib/actions/attendance.actions.ts (2 refs)
--   - lib/actions/inventory.actions.ts (3 refs)
--   - lib/actions/product.actions.ts (5 refs)
--   - lib/actions/provider.actions.ts (2 refs)
--   - lib/actions/caja.actions.ts (3 refs)
--   - lib/actions/shift.actions.ts (2 refs)
--   - lib/actions/stats.actions.ts (2 refs)
--   + otros...
--
-- ===============================================================================


-- ===============================================================================
-- SECCION 2: NUEVA TABLA - user_organization_roles
-- ===============================================================================
--
-- PROPOSITO:
--   Tabla de vinculacion N:M entre usuarios y organizaciones.
--   Permite que un usuario tenga multiples roles en multiples orgs.
--   Soporta asignacion a sucursal especifica (empleados).
--
-- MODELO:
--   Usuario <-->> user_organization_roles <<--> Organization
--                       |
--                       v
--                   Sucursal (opcional)
--
-- ===============================================================================

CREATE TABLE IF NOT EXISTS public.user_organization_roles (
  -- Clave primaria compuesta alternativa (ver constraint unico)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones principales
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Rol del usuario en esta organizacion
  -- 'owner' = Dueno/Propietario (full access)
  -- 'admin' = Administrador (casi full access, no puede eliminar org)
  -- 'manager' = Gerente de sucursal (acceso a su sucursal)
  -- 'employee' = Empleado (acceso limitado a su sucursal)
  role TEXT NOT NULL DEFAULT 'employee'
    CHECK (role IN ('owner', 'admin', 'manager', 'employee')),

  -- Sucursal asignada (NULL = acceso a todas, requerido para employee/manager)
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,

  -- Estado de la membresia
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadatos
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Auditoría estandar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_org UNIQUE (user_id, organization_id),
  CONSTRAINT employee_needs_sucursal CHECK (
    (role NOT IN ('employee', 'manager')) OR (sucursal_id IS NOT NULL)
  )
);

-- Indices para performance
CREATE INDEX idx_uor_user_id ON public.user_organization_roles(user_id);
CREATE INDEX idx_uor_org_id ON public.user_organization_roles(organization_id);
CREATE INDEX idx_uor_sucursal_id ON public.user_organization_roles(sucursal_id) WHERE sucursal_id IS NOT NULL;
CREATE INDEX idx_uor_role ON public.user_organization_roles(role);
CREATE INDEX idx_uor_active ON public.user_organization_roles(is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER update_user_organization_roles_updated_at
  BEFORE UPDATE ON public.user_organization_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comentarios
COMMENT ON TABLE public.user_organization_roles IS
'Tabla de vinculacion usuario-organizacion con roles.
Modelo Owner-First: permite multiples organizaciones por usuario
y multiples usuarios por organizacion con roles diferenciados.';

COMMENT ON COLUMN public.user_organization_roles.role IS
'owner: Propietario original, full control
admin: Administrador, casi full access
manager: Gerente de sucursal
employee: Empleado basico';


-- ===============================================================================
-- SECCION 3: MODIFICACION DE TABLA organizations
-- ===============================================================================
--
-- Agregamos owner_id para identificar al propietario original.
-- Esto es inmutable: el owner es quien creo la organizacion.
--
-- ===============================================================================

-- Agregar columna owner_id
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Comentario
COMMENT ON COLUMN public.organizations.owner_id IS
'ID del usuario que creo esta organizacion. Inmutable.
Es el "dueno original" con privilegios especiales.';


-- ===============================================================================
-- SECCION 4: MIGRACION DE DATOS EXISTENTES
-- ===============================================================================
--
-- ESTRATEGIA: Zero-downtime migration
--
-- Fase 1: Crear nueva estructura (sin borrar la vieja)
-- Fase 2: Copiar datos a nueva estructura
-- Fase 3: Validar integridad
-- Fase 4: Actualizar funciones RPC para leer de nueva tabla
-- Fase 5: Deprecar columnas viejas (soft delete)
-- Fase 6: Eliminar columnas viejas (hard delete, en release futuro)
--
-- ===============================================================================

-- ---------------------------------------------------------------------------
-- PASO 4.1: Poblar owner_id en organizations
-- ---------------------------------------------------------------------------
-- Para cada organizacion, el owner es el primer perfil con rol='dueno'
-- ordenado por created_at (el mas antiguo)

UPDATE public.organizations o
SET owner_id = (
  SELECT p.id
  FROM public.perfiles p
  WHERE p.organization_id = o.id
    AND p.rol = 'dueño'
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE o.owner_id IS NULL;

-- Validar que todas las organizaciones tienen owner
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.organizations
  WHERE owner_id IS NULL;

  IF v_count > 0 THEN
    RAISE WARNING 'Hay % organizaciones sin owner_id asignado', v_count;
  ELSE
    RAISE NOTICE 'OK: Todas las organizaciones tienen owner_id';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- PASO 4.2: Migrar datos de perfiles a user_organization_roles
-- ---------------------------------------------------------------------------
-- Mapeo de roles:
--   perfiles.rol = 'dueño'    -> user_organization_roles.role = 'owner'
--   perfiles.rol = 'empleado' -> user_organization_roles.role = 'employee'

INSERT INTO public.user_organization_roles (
  user_id,
  organization_id,
  role,
  sucursal_id,
  is_active,
  joined_at,
  created_at,
  updated_at
)
SELECT
  p.id AS user_id,
  p.organization_id,
  CASE p.rol
    WHEN 'dueño' THEN 'owner'
    WHEN 'empleado' THEN 'employee'
    ELSE 'employee'
  END AS role,
  -- Duenos no necesitan sucursal asignada (acceso a todas)
  CASE p.rol
    WHEN 'dueño' THEN NULL
    ELSE p.sucursal_id
  END AS sucursal_id,
  p.activo AS is_active,
  p.created_at AS joined_at,
  p.created_at,
  p.updated_at
FROM public.perfiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Reporte de migracion
DO $$
DECLARE
  v_perfiles_count INTEGER;
  v_roles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_perfiles_count FROM public.perfiles WHERE organization_id IS NOT NULL;
  SELECT COUNT(*) INTO v_roles_count FROM public.user_organization_roles;

  RAISE NOTICE 'Migracion completada:';
  RAISE NOTICE '  - Perfiles originales: %', v_perfiles_count;
  RAISE NOTICE '  - Roles migrados: %', v_roles_count;
END $$;


-- ===============================================================================
-- SECCION 5: NUEVAS FUNCIONES RPC (v2)
-- ===============================================================================
--
-- Estas funciones reemplazan las anteriores pero leen de la nueva tabla.
-- Se crean con sufijo _v2 para coexistir durante la migracion.
--
-- ===============================================================================

-- ---------------------------------------------------------------------------
-- get_my_org_id_v2()
-- Lee de user_organization_roles en lugar de perfiles
-- Retorna la organizacion principal (primera activa, priorizando owner)
-- ---------------------------------------------------------------------------
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
    CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_org_id_v2() IS
'V2: Retorna el organization_id del usuario desde user_organization_roles.
Prioriza: owner > admin > otros, luego por antiguedad.';

GRANT EXECUTE ON FUNCTION public.get_my_org_id_v2() TO authenticated;


-- ---------------------------------------------------------------------------
-- get_my_role_v2()
-- Retorna el rol del usuario en su organizacion actual
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role_v2()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.user_organization_roles
  WHERE user_id = auth.uid()
    AND organization_id = public.get_my_org_id_v2()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_role_v2() IS
'V2: Retorna el rol del usuario en su organizacion actual.';

GRANT EXECUTE ON FUNCTION public.get_my_role_v2() TO authenticated;


-- ---------------------------------------------------------------------------
-- es_owner_v2()
-- Verifica si el usuario es owner de su organizacion actual
-- ---------------------------------------------------------------------------
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
      AND organization_id = public.get_my_org_id_v2()
      AND role = 'owner'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.es_owner_v2() IS
'V2: Retorna TRUE si el usuario es owner de su organizacion actual.
Reemplaza es_dueno() que leia de perfiles.';

GRANT EXECUTE ON FUNCTION public.es_owner_v2() TO authenticated;


-- ---------------------------------------------------------------------------
-- get_my_sucursal_id_v2()
-- Retorna la sucursal asignada al usuario en su organizacion actual
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_sucursal_id_v2()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT sucursal_id
  FROM public.user_organization_roles
  WHERE user_id = auth.uid()
    AND organization_id = public.get_my_org_id_v2()
    AND is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_sucursal_id_v2() IS
'V2: Retorna la sucursal asignada al usuario.
NULL para owners/admins (acceso a todas).';

GRANT EXECUTE ON FUNCTION public.get_my_sucursal_id_v2() TO authenticated;


-- ===============================================================================
-- SECCION 6: REFACTORIZACION DE create_initial_setup
-- ===============================================================================
--
-- ANTES: Una funcion monolitica que creaba todo junto
-- AHORA: Dos funciones separadas para mayor flexibilidad
--
-- Parte A: create_organization_v2() - Crea la org con owner_id
-- Parte B: assign_user_role_v2() - Vincula usuario a org con rol
--
-- ===============================================================================

-- ---------------------------------------------------------------------------
-- PARTE A: create_organization_v2()
-- Crea una organizacion y asigna el owner_id
-- ---------------------------------------------------------------------------
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
  -- Validar que el usuario existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_owner_id) THEN
    RAISE EXCEPTION 'Usuario no encontrado: %', p_owner_id;
  END IF;

  -- Crear la organizacion
  INSERT INTO public.organizations (nombre, owner_id)
  VALUES (COALESCE(p_org_name, 'Mi Negocio'), p_owner_id)
  RETURNING id INTO v_org_id;

  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION public.create_organization_v2(UUID, TEXT) IS
'Parte A del onboarding: Crea una organizacion con su owner_id.
El owner_id es inmutable y representa al creador original.';

GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_v2(UUID, TEXT) TO anon;


-- ---------------------------------------------------------------------------
-- PARTE B: assign_user_role_v2()
-- Vincula un usuario a una organizacion con un rol
-- ---------------------------------------------------------------------------
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
    RAISE EXCEPTION 'Rol invalido: %. Debe ser owner, admin, manager o employee', p_role;
  END IF;

  -- Validar que empleado/manager tenga sucursal
  IF p_role IN ('employee', 'manager') AND p_sucursal_id IS NULL THEN
    RAISE EXCEPTION 'Los roles employee y manager requieren sucursal_id';
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
'Parte B del onboarding: Vincula un usuario a una organizacion con un rol.
Soporta upsert: si ya existe la relacion, la actualiza.';

GRANT EXECUTE ON FUNCTION public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- create_initial_setup_v2()
-- Nueva version que usa las funciones separadas
-- Mantiene compatibilidad con la anterior para migracion gradual
-- ---------------------------------------------------------------------------
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
  -- 1. Crear Organizacion (Parte A)
  v_org_id := public.create_organization_v2(p_user_id, p_org_name);

  -- 2. Crear Sucursal inicial (Casa Matriz)
  INSERT INTO public.sucursales (organization_id, nombre, direccion)
  VALUES (v_org_id, 'Casa Matriz', NULL)
  RETURNING id INTO v_sucursal_id;

  -- 3. Asignar rol de Owner (Parte B)
  -- Nota: owner no necesita sucursal_id asignada
  v_role_id := public.assign_user_role_v2(
    p_user_id,
    v_org_id,
    'owner',
    NULL,  -- sin sucursal asignada (acceso a todas)
    NULL   -- no invitado por nadie (es el creador)
  );

  -- 4. Crear perfil basico (mantener compatibilidad)
  -- TODO: En futuro, mover todos los campos a user_organization_roles
  INSERT INTO public.perfiles (id, organization_id, sucursal_id, rol, nombre, email)
  VALUES (p_user_id, v_org_id, v_sucursal_id, 'dueño', p_profile_name, p_email)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    rol = 'dueño',
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email;

  -- 5. Construir respuesta
  v_result := jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org_id,
      'nombre', p_org_name,
      'owner_id', p_user_id
    ),
    'sucursal', jsonb_build_object(
      'id', v_sucursal_id,
      'nombre', 'Casa Matriz'
    ),
    'role', jsonb_build_object(
      'id', v_role_id,
      'role', 'owner'
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) IS
'V2 del onboarding: Usa modelo Owner-First.
1. Crea organizacion con owner_id
2. Crea sucursal inicial
3. Asigna rol de owner en user_organization_roles
4. Crea perfil (compatibilidad temporal)';

GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT) TO anon;


-- ===============================================================================
-- SECCION 7: POLITICAS RLS PARA NUEVA TABLA
-- ===============================================================================

-- Habilitar RLS
ALTER TABLE public.user_organization_roles ENABLE ROW LEVEL SECURITY;

-- Politica: Usuario puede ver sus propias membresías
CREATE POLICY "users_see_own_roles"
  ON public.user_organization_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Politica: Owners/Admins pueden ver todos los roles de su org
CREATE POLICY "owners_see_org_roles"
  ON public.user_organization_roles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Politica: Solo owners pueden insertar nuevos roles
CREATE POLICY "owners_insert_roles"
  ON public.user_organization_roles
  FOR INSERT
  WITH CHECK (
    -- Permitir a usuarios nuevos crear su propio rol owner
    (user_id = auth.uid() AND role = 'owner')
    OR
    -- Permitir a owners existentes invitar
    (organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND is_active = true
    ))
  );

-- Politica: Solo owners pueden modificar roles
CREATE POLICY "owners_update_roles"
  ON public.user_organization_roles
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND is_active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND is_active = true
    )
  );


-- ===============================================================================
-- SECCION 8: VALIDACION Y ROLLBACK
-- ===============================================================================

-- ---------------------------------------------------------------------------
-- Funcion de validacion: Verifica integridad de la migracion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_owner_first_migration()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check 1: Todas las orgs tienen owner_id
  RETURN QUERY
  SELECT
    'organizations_have_owner'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Orgs sin owner: ' || COUNT(*)::TEXT
  FROM public.organizations WHERE owner_id IS NULL;

  -- Check 2: Todos los perfiles migraron a roles
  RETURN QUERY
  SELECT
    'perfiles_migrated'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Perfiles sin rol: ' || COUNT(*)::TEXT
  FROM public.perfiles p
  WHERE p.organization_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_organization_roles r
      WHERE r.user_id = p.id AND r.organization_id = p.organization_id
    );

  -- Check 3: Cada org tiene al menos un owner
  RETURN QUERY
  SELECT
    'orgs_have_owner_role'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Orgs sin owner role: ' || COUNT(*)::TEXT
  FROM public.organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_organization_roles r
    WHERE r.organization_id = o.id AND r.role = 'owner'
  );

  -- Check 4: Consistencia owner_id vs role owner
  RETURN QUERY
  SELECT
    'owner_id_matches_owner_role'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Inconsistencias: ' || COUNT(*)::TEXT
  FROM public.organizations o
  WHERE o.owner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_organization_roles r
      WHERE r.organization_id = o.id
        AND r.user_id = o.owner_id
        AND r.role = 'owner'
    );

END;
$$;

-- Ejecutar validacion
-- SELECT * FROM public.validate_owner_first_migration();


-- ---------------------------------------------------------------------------
-- Funcion de rollback (en caso de emergencia)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rollback_owner_first_migration()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo ejecutar si hay problemas criticos
  RAISE NOTICE 'Iniciando rollback de Owner-First migration...';

  -- 1. Eliminar nuevas funciones V2
  DROP FUNCTION IF EXISTS public.get_my_org_id_v2();
  DROP FUNCTION IF EXISTS public.get_my_role_v2();
  DROP FUNCTION IF EXISTS public.es_owner_v2();
  DROP FUNCTION IF EXISTS public.get_my_sucursal_id_v2();
  DROP FUNCTION IF EXISTS public.create_organization_v2(UUID, TEXT);
  DROP FUNCTION IF EXISTS public.assign_user_role_v2(UUID, UUID, TEXT, UUID, UUID);
  DROP FUNCTION IF EXISTS public.create_initial_setup_v2(UUID, TEXT, TEXT, TEXT);

  -- 2. Eliminar politicas RLS de nueva tabla
  DROP POLICY IF EXISTS "users_see_own_roles" ON public.user_organization_roles;
  DROP POLICY IF EXISTS "owners_see_org_roles" ON public.user_organization_roles;
  DROP POLICY IF EXISTS "owners_insert_roles" ON public.user_organization_roles;
  DROP POLICY IF EXISTS "owners_update_roles" ON public.user_organization_roles;

  -- 3. Eliminar nueva tabla
  DROP TABLE IF EXISTS public.user_organization_roles;

  -- 4. Eliminar columna owner_id (con cuidado)
  ALTER TABLE public.organizations DROP COLUMN IF EXISTS owner_id;

  RAISE NOTICE 'Rollback completado. Sistema restaurado a estado anterior.';
END;
$$;


-- ===============================================================================
-- SECCION 9: PLAN DE EJECUCION PASO A PASO
-- ===============================================================================
--
-- FASE 1: PREPARACION (Este script)
-- ┌────┬────────────────────────────────────────────────────────────────────────┐
-- │ #  │ ACCION                                                                 │
-- ├────┼────────────────────────────────────────────────────────────────────────┤
-- │ 1  │ Backup completo de base de datos                                       │
-- │ 2  │ Ejecutar SECCION 2: Crear tabla user_organization_roles                │
-- │ 3  │ Ejecutar SECCION 3: Agregar owner_id a organizations                   │
-- │ 4  │ Ejecutar SECCION 4: Migrar datos existentes                            │
-- │ 5  │ Validar: SELECT * FROM validate_owner_first_migration();               │
-- └────┴────────────────────────────────────────────────────────────────────────┘
--
-- FASE 2: FUNCIONES V2 (Coexistencia)
-- ┌────┬────────────────────────────────────────────────────────────────────────┐
-- │ 6  │ Ejecutar SECCION 5: Crear funciones V2                                 │
-- │ 7  │ Ejecutar SECCION 6: Crear create_initial_setup_v2                      │
-- │ 8  │ Ejecutar SECCION 7: Aplicar politicas RLS                              │
-- │ 9  │ Probar funciones V2 en staging                                         │
-- └────┴────────────────────────────────────────────────────────────────────────┘
--
-- FASE 3: MIGRACION DE CODIGO (TypeScript)
-- ┌────┬────────────────────────────────────────────────────────────────────────┐
-- │ 10 │ Actualizar organization.repository.ts para usar create_initial_setup_v2│
-- │ 11 │ Actualizar Server Actions para usar get_my_org_id_v2()                 │
-- │ 12 │ Actualizar componentes para leer de user_organization_roles            │
-- │ 13 │ Regenerar types/database.types.ts con nueva tabla                      │
-- │ 14 │ Testing completo en staging                                            │
-- └────┴────────────────────────────────────────────────────────────────────────┘
--
-- FASE 4: DEPRECACION (Release Futuro)
-- ┌────┬────────────────────────────────────────────────────────────────────────┐
-- │ 15 │ Renombrar funciones V2 a nombres originales                            │
-- │ 16 │ Marcar perfiles.organization_id como deprecated                        │
-- │ 17 │ Marcar perfiles.rol como deprecated                                    │
-- │ 18 │ Eliminar funciones V1 (get_my_org_id, es_dueno, etc.)                  │
-- └────┴────────────────────────────────────────────────────────────────────────┘
--
-- FASE 5: LIMPIEZA (Release +2)
-- ┌────┬────────────────────────────────────────────────────────────────────────┐
-- │ 19 │ DROP COLUMN perfiles.organization_id                                   │
-- │ 20 │ DROP COLUMN perfiles.rol                                               │
-- │ 21 │ DROP COLUMN perfiles.sucursal_id                                       │
-- │ 22 │ Verificar que no hay referencias huerfanas                             │
-- └────┴────────────────────────────────────────────────────────────────────────┘
--
-- ===============================================================================


-- ===============================================================================
-- FIN DEL PLAN DE MIGRACION
-- ===============================================================================
