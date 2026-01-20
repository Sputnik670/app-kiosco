-- -------------------------------------------------------------------------------
-- ELIMINACION QUIRURGICA DE POLITICAS INTRUSAS - PlanetaZEGA
-- -------------------------------------------------------------------------------
--
-- PROPOSITO:
--    Eliminar SOLO las politicas que NO deben existir segun READY_FOR_PRODUCTION.md
--
-- POLITICAS CORRECTAS QUE DEBEN PERMANECER:
--    ORGANIZATIONS (3):
--      - organizations_select_own
--      - organizations_update_own
--      - organizations_insert_new
--
--    PERFILES (4):
--      - perfiles_select_organization
--      - perfiles_insert_own
--      - perfiles_update_organization
--      - perfiles_delete_organization
--
-- POLITICAS INTRUSAS CONOCIDAS:
--    ORGANIZATIONS:
--      - select_own_org (usa subconsulta manual)
--      - update_own_org (usa subconsulta manual)
--
-- VERSION: 1.0.0
-- FECHA: 2026-01-05
--
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Iniciando eliminacion quirurgica de politicas intrusas...';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 1: Listar politicas actuales ANTES de la limpieza
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'PASO 1: Politicas ANTES de la limpieza';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;

SELECT
  tablename AS "Tabla",
  policyname AS "Politica",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'perfiles')
ORDER BY tablename, policyname;

-- -------------------------------------------------------------------------------
-- PASO 2: Eliminar politicas intrusas en ORGANIZATIONS
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'PASO 2: Eliminando politicas intrusas en ORGANIZATIONS';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;

-- Politicas intrusas conocidas (usan subconsultas manuales)
DROP POLICY IF EXISTS "select_own_org" ON organizations;
DROP POLICY IF EXISTS "update_own_org" ON organizations;

-- Otras variantes de nombres antiguos que NO deben existir
DROP POLICY IF EXISTS "select_organization" ON organizations;
DROP POLICY IF EXISTS "update_organization" ON organizations;
DROP POLICY IF EXISTS "insert_organization" ON organizations;
DROP POLICY IF EXISTS "delete_organization" ON organizations;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "organizations_insert" ON organizations;
DROP POLICY IF EXISTS "organizations_delete" ON organizations;

DO $$
BEGIN
  RAISE NOTICE 'Politicas intrusas eliminadas de ORGANIZATIONS';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 3: Eliminar politicas intrusas en PERFILES
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'PASO 3: Eliminando politicas intrusas en PERFILES';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;

-- Variantes antiguas que NO deben existir
DROP POLICY IF EXISTS "select_own_profiles" ON perfiles;
DROP POLICY IF EXISTS "update_own_profiles" ON perfiles;
DROP POLICY IF EXISTS "insert_own_profiles" ON perfiles;
DROP POLICY IF EXISTS "delete_own_profiles" ON perfiles;
DROP POLICY IF EXISTS "perfiles_select" ON perfiles;
DROP POLICY IF EXISTS "perfiles_update" ON perfiles;
DROP POLICY IF EXISTS "perfiles_insert" ON perfiles;
DROP POLICY IF EXISTS "perfiles_delete" ON perfiles;
DROP POLICY IF EXISTS "perfiles_insert_organization" ON perfiles;

-- Politicas con subconsultas manuales
DROP POLICY IF EXISTS "select_organization_profiles" ON perfiles;
DROP POLICY IF EXISTS "update_organization_profiles" ON perfiles;
DROP POLICY IF EXISTS "insert_organization_profiles" ON perfiles;
DROP POLICY IF EXISTS "delete_organization_profiles" ON perfiles;

DO $$
BEGIN
  RAISE NOTICE 'Politicas intrusas eliminadas de PERFILES';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 4: Listar politicas DESPUES de la limpieza
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'PASO 4: Politicas DESPUES de la limpieza';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;

SELECT
  tablename AS "Tabla",
  policyname AS "Politica",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'perfiles')
ORDER BY tablename, policyname;

-- -------------------------------------------------------------------------------
-- PASO 5: Verificacion final - Conteo de politicas
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  orgs_count INTEGER;
  perfiles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orgs_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations';

  SELECT COUNT(*) INTO perfiles_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'perfiles';

  RAISE NOTICE '';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'VERIFICACION FINAL - Conteo de politicas';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'ORGANIZATIONS: % politicas (esperadas: 3)', orgs_count;
  RAISE NOTICE 'PERFILES: % politicas (esperadas: 4)', perfiles_count;
  RAISE NOTICE '';

  IF orgs_count = 3 AND perfiles_count = 4 THEN
    RAISE NOTICE 'ESTADO: EXITOSO';
    RAISE NOTICE '  - Todas las politicas intrusas eliminadas';
    RAISE NOTICE '  - Sistema listo para produccion';
  ELSE
    RAISE WARNING 'ESTADO: VERIFICACION REQUERIDA';
    RAISE WARNING '  - ORGANIZATIONS: % (esperadas: 3)', orgs_count;
    RAISE WARNING '  - PERFILES: % (esperadas: 4)', perfiles_count;
    RAISE WARNING '  - Revisa la tabla PASO 4 para ver que politicas quedan';
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
  RAISE NOTICE 'Eliminacion quirurgica completada';
  RAISE NOTICE '';
  RAISE NOTICE 'SIGUIENTE PASO: Ejecutar VERIFY_RLS_UPGRADE.sql para verificacion completa';
  RAISE NOTICE '';
END $$;
