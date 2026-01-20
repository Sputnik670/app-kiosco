-- ===============================================================================
-- SECURIZAR TABLA pending_invites - PlanetaZEGA
-- ===============================================================================
--
-- PROPOSITO:
--    Habilitar Row Level Security (RLS) en pending_invites usando get_my_org_id()
--
-- POLITICAS RLS QUE SE CREAN:
--    1. SELECT: Solo invitaciones de tu organizacion
--    2. INSERT: Solo crear invitaciones para tu organizacion
--    3. DELETE: Solo eliminar invitaciones de tu organizacion
--    4. UPDATE: BLOQUEADO (las invitaciones no se modifican, se eliminan)
--
-- PRERREQUISITOS:
--    - Funcion get_my_org_id() debe existir (ver: CREATE_SECURITY_FUNCTIONS.sql)
--    - Usuario autenticado con perfil en tabla perfiles
--
-- VERSION: 1.0.0
-- FECHA: 2026-01-06
-- AUTOR: Claude - Refactorizacion Server Actions
--
-- ===============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'INICIANDO: Securizacion de pending_invites';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 1: Verificar que funcion get_my_org_id() existe
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'PASO 1: Verificando funcion get_my_org_id()';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_my_org_id'
  ) INTO func_exists;

  IF NOT func_exists THEN
    RAISE EXCEPTION 'ERROR: Funcion get_my_org_id() NO existe. Ejecuta CREATE_SECURITY_FUNCTIONS.sql primero.';
  END IF;

  RAISE NOTICE 'Funcion get_my_org_id() encontrada';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 2: Habilitar RLS en pending_invites
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'PASO 2: Habilitando RLS en pending_invites';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'RLS habilitado en pending_invites';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 3: Eliminar politicas antiguas (si existen)
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'PASO 3: Eliminando politicas antiguas (si existen)';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

-- Politicas con nombres antiguos (por si existian)
DROP POLICY IF EXISTS "select_own_invites" ON pending_invites;
DROP POLICY IF EXISTS "insert_own_invites" ON pending_invites;
DROP POLICY IF EXISTS "update_own_invites" ON pending_invites;
DROP POLICY IF EXISTS "delete_own_invites" ON pending_invites;

-- Politicas con nombres nuevos (que vamos a crear)
DROP POLICY IF EXISTS "pending_invites_select_own_org" ON pending_invites;
DROP POLICY IF EXISTS "pending_invites_insert_own_org" ON pending_invites;
DROP POLICY IF EXISTS "pending_invites_delete_own_org" ON pending_invites;
DROP POLICY IF EXISTS "pending_invites_prevent_update" ON pending_invites;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 4: Crear politicas RLS profesionalizadas
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'PASO 4: Creando politicas RLS con get_my_org_id()';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

-- ---------------------------------------------------------------------------
-- POLITICA 1: SELECT - Solo invitaciones de tu organizacion
-- ---------------------------------------------------------------------------

CREATE POLICY "pending_invites_select_own_org"
  ON pending_invites
  FOR SELECT
  USING (organization_id = public.get_my_org_id());

-- ---------------------------------------------------------------------------
-- POLITICA 2: INSERT - Solo crear invitaciones para tu organizacion
-- ---------------------------------------------------------------------------

CREATE POLICY "pending_invites_insert_own_org"
  ON pending_invites
  FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());

-- ---------------------------------------------------------------------------
-- POLITICA 3: DELETE - Solo eliminar invitaciones de tu organizacion
-- ---------------------------------------------------------------------------

CREATE POLICY "pending_invites_delete_own_org"
  ON pending_invites
  FOR DELETE
  USING (organization_id = public.get_my_org_id());

-- ---------------------------------------------------------------------------
-- POLITICA 4: UPDATE - BLOQUEADO (las invitaciones no se modifican)
-- ---------------------------------------------------------------------------

CREATE POLICY "pending_invites_prevent_update"
  ON pending_invites
  FOR UPDATE
  USING (false);

DO $$
BEGIN
  RAISE NOTICE 'Politicas RLS creadas exitosamente';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 5: Verificacion - Listar politicas creadas
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'PASO 5: Verificacion - Politicas creadas';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT
  policyname AS "Politica",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando",
  LEFT(qual::text, 80) AS "USING (primeros 80 chars)",
  LEFT(with_check::text, 80) AS "WITH CHECK (primeros 80 chars)"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'pending_invites'
ORDER BY policyname;

-- -------------------------------------------------------------------------------
-- PASO 6: Verificacion - Conteo de politicas
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'PASO 6: Verificacion - Conteo de politicas';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'pending_invites';

  RAISE NOTICE 'PENDING_INVITES: % politicas (esperadas: 4)', policy_count;
  RAISE NOTICE '';

  IF policy_count = 4 THEN
    RAISE NOTICE 'ESTADO: EXITOSO';
    RAISE NOTICE '  - 4 politicas RLS creadas correctamente';
    RAISE NOTICE '  - SELECT: organization_id = get_my_org_id()';
    RAISE NOTICE '  - INSERT: organization_id = get_my_org_id()';
    RAISE NOTICE '  - DELETE: organization_id = get_my_org_id()';
    RAISE NOTICE '  - UPDATE: BLOQUEADO (false)';
  ELSE
    RAISE WARNING 'ESTADO: VERIFICACION REQUERIDA';
    RAISE WARNING '  - PENDING_INVITES: % politicas (esperadas: 4)', policy_count;
    RAISE WARNING '  - Revisa la tabla arriba para ver que politicas existen';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- MENSAJE FINAL
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Securizacion de pending_invites completada';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANTE:';
  RAISE NOTICE '  - Todas las consultas a pending_invites ahora filtran por organization_id';
  RAISE NOTICE '  - Solo el dueno puede ver/gestionar invitaciones de su organizacion';
  RAISE NOTICE '  - Las invitaciones NO pueden modificarse (UPDATE bloqueado)';
  RAISE NOTICE '';
  RAISE NOTICE 'SIGUIENTE PASO: Ejecutar VERIFY_SECURITY.sql para verificacion completa';
  RAISE NOTICE '';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;
