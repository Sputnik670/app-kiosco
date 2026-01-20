-- -------------------------------------------------------------------------------
-- LISTAR POLITICAS ACTUALES - PlanetaZEGA
-- -------------------------------------------------------------------------------
--
-- PROPOSITO:
--    Listar TODAS las politicas actuales en organizations y perfiles
--    para identificar las politicas intrusas que deben eliminarse
--
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Listando todas las politicas en ORGANIZATIONS y PERFILES...';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- POLITICAS EN ORGANIZATIONS
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'POLITICAS EN TABLA: ORGANIZATIONS';
  RAISE NOTICE '===============================================================================';
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
    WHEN qual IS NOT NULL THEN LEFT(qual::text, 100)
    ELSE 'N/A'
  END AS "USING (primeros 100 chars)",
  CASE
    WHEN with_check IS NOT NULL THEN LEFT(with_check::text, 100)
    ELSE 'N/A'
  END AS "WITH CHECK (primeros 100 chars)"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'organizations'
ORDER BY policyname;

-- -------------------------------------------------------------------------------
-- CONTEO DE POLITICAS EN ORGANIZATIONS
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  total_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations';

  RAISE NOTICE '';
  RAISE NOTICE 'Total de politicas en ORGANIZATIONS: %', total_policies;
  RAISE NOTICE 'Esperado: 3 politicas';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- POLITICAS EN PERFILES
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'POLITICAS EN TABLA: PERFILES';
  RAISE NOTICE '===============================================================================';
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
    WHEN qual IS NOT NULL THEN LEFT(qual::text, 100)
    ELSE 'N/A'
  END AS "USING (primeros 100 chars)",
  CASE
    WHEN with_check IS NOT NULL THEN LEFT(with_check::text, 100)
    ELSE 'N/A'
  END AS "WITH CHECK (primeros 100 chars)"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'perfiles'
ORDER BY policyname;

-- -------------------------------------------------------------------------------
-- CONTEO DE POLITICAS EN PERFILES
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  total_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'perfiles';

  RAISE NOTICE '';
  RAISE NOTICE 'Total de politicas en PERFILES: %', total_policies;
  RAISE NOTICE 'Esperado: 4 politicas';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- RESUMEN
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  orgs_count INTEGER;
  perfiles_count INTEGER;
  orgs_extra INTEGER;
  perfiles_extra INTEGER;
BEGIN
  SELECT COUNT(*) INTO orgs_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations';

  SELECT COUNT(*) INTO perfiles_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'perfiles';

  orgs_extra := orgs_count - 3;
  perfiles_extra := perfiles_count - 4;

  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'RESUMEN';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'ORGANIZATIONS: % politicas (% extras)', orgs_count, orgs_extra;
  RAISE NOTICE 'PERFILES: % politicas (% extras)', perfiles_count, perfiles_extra;
  RAISE NOTICE '';

  IF orgs_count = 3 AND perfiles_count = 4 THEN
    RAISE NOTICE 'Estado: OK - No hay politicas extras';
  ELSE
    RAISE NOTICE 'Estado: ATENCION - Hay politicas extras que deben eliminarse';
    RAISE NOTICE '';
    RAISE NOTICE 'Revisa las tablas de arriba para identificar cuales son las intrusas';
  END IF;

  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
END $$;
