-- -------------------------------------------------------------------------------
-- VERIFICACION DE UPGRADE RLS - PlanetaZEGA
-- -------------------------------------------------------------------------------
--
-- PROPOSITO:
--    Verificar que las politicas RLS se aplicaron correctamente y usan get_my_org_id()
--
-- VERIFICACIONES:
--    1. RLS esta activo en perfiles y organizations
--    2. Politicas existentes usan get_my_org_id()
--    3. No hay politicas antiguas con subconsultas manuales
--
-- CREADO: 2026-01-05
--
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Iniciando verificacion de RLS upgrade...';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- VERIFICACION 1: Estado de RLS en las tablas
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'VERIFICACION 1: Estado de RLS';
  RAISE NOTICE '';
END $$;

SELECT
  tablename AS "Tabla",
  CASE rowsecurity
    WHEN true THEN 'ACTIVO'
    ELSE 'INACTIVO'
  END AS "Estado RLS"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('perfiles', 'organizations')
ORDER BY tablename;

-- -------------------------------------------------------------------------------
-- VERIFICACION 2: Politicas en tabla PERFILES
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICACION 2: Politicas en tabla PERFILES';
  RAISE NOTICE '';
END $$;

SELECT
  policyname AS "Nombre Politica",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando",
  CASE
    WHEN qual::text LIKE '%get_my_org_id%' THEN 'SI'
    WHEN qual IS NULL THEN 'N/A'
    ELSE 'NO'
  END AS "Usa get_my_org_id (USING)",
  CASE
    WHEN with_check::text LIKE '%get_my_org_id%' THEN 'SI'
    WHEN with_check::text LIKE '%auth.uid%' THEN 'auth.uid'
    WHEN with_check IS NULL THEN 'N/A'
    ELSE 'NO'
  END AS "Usa get_my_org_id (CHECK)"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'perfiles'
ORDER BY
  CASE cmd
    WHEN 'r' THEN 1
    WHEN 'a' THEN 2
    WHEN 'w' THEN 3
    WHEN 'd' THEN 4
    ELSE 5
  END;

-- -------------------------------------------------------------------------------
-- VERIFICACION 3: Politicas en tabla ORGANIZATIONS
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICACION 3: Politicas en tabla ORGANIZATIONS';
  RAISE NOTICE '';
END $$;

SELECT
  policyname AS "Nombre Politica",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando",
  CASE
    WHEN qual::text LIKE '%get_my_org_id%' THEN 'SI'
    WHEN qual IS NULL THEN 'N/A'
    ELSE 'NO'
  END AS "Usa get_my_org_id (USING)",
  CASE
    WHEN with_check::text LIKE '%get_my_org_id%' THEN 'SI'
    WHEN with_check::text = 'true' THEN 'OPEN (signup)'
    WHEN with_check IS NULL THEN 'N/A'
    ELSE 'NO'
  END AS "Usa get_my_org_id (CHECK)"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'organizations'
ORDER BY
  CASE cmd
    WHEN 'r' THEN 1
    WHEN 'a' THEN 2
    WHEN 'w' THEN 3
    WHEN 'd' THEN 4
    ELSE 5
  END;

-- -------------------------------------------------------------------------------
-- VERIFICACION 4: Conteo de politicas
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICACION 4: Conteo de politicas';
  RAISE NOTICE '';
END $$;

SELECT
  tablename AS "Tabla",
  COUNT(*) AS "Total Politicas",
  SUM(CASE WHEN qual::text LIKE '%get_my_org_id%' OR with_check::text LIKE '%get_my_org_id%' THEN 1 ELSE 0 END) AS "Con get_my_org_id()"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('perfiles', 'organizations')
GROUP BY tablename
ORDER BY tablename;

-- -------------------------------------------------------------------------------
-- VERIFICACION 5: Detectar politicas antiguas (con subconsultas manuales)
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICACION 5: Detectar politicas antiguas';
  RAISE NOTICE '';
END $$;

SELECT
  tablename AS "Tabla",
  policyname AS "Politica Antigua",
  'Usa subconsulta manual' AS "Problema"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('perfiles', 'organizations')
  AND (
    qual::text LIKE '%SELECT%organization_id%FROM%perfiles%'
    OR with_check::text LIKE '%SELECT%organization_id%FROM%perfiles%'
  );

-- Si no hay resultados, mostrar mensaje positivo
DO $$
DECLARE
  count_old_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_old_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('perfiles', 'organizations')
    AND (
      qual::text LIKE '%SELECT%organization_id%FROM%perfiles%'
      OR with_check::text LIKE '%SELECT%organization_id%FROM%perfiles%'
    );

  IF count_old_policies = 0 THEN
    RAISE NOTICE 'No se detectaron politicas antiguas con subconsultas manuales';
  ELSE
    RAISE WARNING 'Se encontraron % politicas antiguas. Ejecuta UPGRADE_RLS_POLICIES.sql', count_old_policies;
  END IF;
END $$;

-- -------------------------------------------------------------------------------
-- RESUMEN EJECUTIVO
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'RESUMEN EJECUTIVO';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

DO $$
DECLARE
  perfiles_rls_active BOOLEAN;
  orgs_rls_active BOOLEAN;
  perfiles_policy_count INTEGER;
  orgs_policy_count INTEGER;
  perfiles_get_my_org_count INTEGER;
  orgs_get_my_org_count INTEGER;
BEGIN
  -- Verificar RLS activo
  SELECT rowsecurity INTO perfiles_rls_active
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'perfiles';

  SELECT rowsecurity INTO orgs_rls_active
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'organizations';

  -- Contar politicas
  SELECT COUNT(*) INTO perfiles_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'perfiles';

  SELECT COUNT(*) INTO orgs_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations';

  -- Contar politicas con get_my_org_id
  SELECT COUNT(*) INTO perfiles_get_my_org_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'perfiles'
    AND (qual::text LIKE '%get_my_org_id%' OR with_check::text LIKE '%get_my_org_id%');

  SELECT COUNT(*) INTO orgs_get_my_org_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations'
    AND (qual::text LIKE '%get_my_org_id%' OR with_check::text LIKE '%get_my_org_id%');

  -- Mostrar resultados
  RAISE NOTICE 'Tabla PERFILES:';
  RAISE NOTICE '   RLS Activo: %', CASE WHEN perfiles_rls_active THEN 'SI' ELSE 'NO' END;
  RAISE NOTICE '   Total Politicas: %', perfiles_policy_count;
  RAISE NOTICE '   Usando get_my_org_id(): %', perfiles_get_my_org_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Tabla ORGANIZATIONS:';
  RAISE NOTICE '   RLS Activo: %', CASE WHEN orgs_rls_active THEN 'SI' ELSE 'NO' END;
  RAISE NOTICE '   Total Politicas: %', orgs_policy_count;
  RAISE NOTICE '   Usando get_my_org_id(): %', orgs_get_my_org_count;
  RAISE NOTICE '';

  -- Evaluacion final
  IF perfiles_rls_active AND orgs_rls_active
     AND perfiles_policy_count >= 4
     AND orgs_policy_count >= 3
     AND perfiles_get_my_org_count >= 3
     AND orgs_get_my_org_count >= 2
  THEN
    RAISE NOTICE 'UPGRADE EXITOSO - Todas las verificaciones pasaron';
  ELSE
    RAISE WARNING 'UPGRADE INCOMPLETO - Revisa los detalles arriba';
  END IF;
  RAISE NOTICE '';
END $$;

DO $$
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'Verificacion completada';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;
