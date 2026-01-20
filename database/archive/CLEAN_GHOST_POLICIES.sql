-- -------------------------------------------------------------------------------
-- LIMPIEZA DE POLITICAS FANTASMA - PlanetaZEGA
-- -------------------------------------------------------------------------------
--
-- PROPOSITO:
--    Eliminar politicas antiguas que todavia usan subconsultas manuales
--    en lugar de la funcion get_my_org_id()
--
-- POLITICAS DETECTADAS:
--    - organizations: select_own_org (usa subconsulta manual)
--    - organizations: update_own_org (usa subconsulta manual)
--    - Otras politicas antiguas en tablas operativas
--
-- CREADO: 2026-01-05
--
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'Iniciando limpieza de politicas fantasma...';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 1: Eliminar politicas fantasma en ORGANIZATIONS
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'PASO 1: Limpiando politicas en tabla ORGANIZATIONS';
END $$;

-- Politicas antiguas detectadas
DROP POLICY IF EXISTS "select_own_org" ON organizations;
DROP POLICY IF EXISTS "update_own_org" ON organizations;

-- Otras variantes posibles de nombres antiguos
DROP POLICY IF EXISTS "select_organization" ON organizations;
DROP POLICY IF EXISTS "update_organization" ON organizations;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas de ORGANIZATIONS';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 2: Eliminar politicas fantasma en PERFILES
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'PASO 2: Limpiando politicas en tabla PERFILES';
END $$;

-- Variantes antiguas posibles
DROP POLICY IF EXISTS "select_own_profiles" ON perfiles;
DROP POLICY IF EXISTS "update_own_profiles" ON perfiles;
DROP POLICY IF EXISTS "insert_own_profiles" ON perfiles;
DROP POLICY IF EXISTS "delete_own_profiles" ON perfiles;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas de PERFILES';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 3: Eliminar politicas fantasma en SUCURSALES
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'PASO 3: Limpiando politicas en tabla SUCURSALES';
END $$;

DROP POLICY IF EXISTS "select_own_branches" ON sucursales;
DROP POLICY IF EXISTS "update_own_branches" ON sucursales;
DROP POLICY IF EXISTS "insert_own_branches" ON sucursales;
DROP POLICY IF EXISTS "delete_own_branches" ON sucursales;
DROP POLICY IF EXISTS "sucursales_select" ON sucursales;
DROP POLICY IF EXISTS "sucursales_update" ON sucursales;
DROP POLICY IF EXISTS "sucursales_insert" ON sucursales;
DROP POLICY IF EXISTS "sucursales_delete" ON sucursales;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas de SUCURSALES';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 4: Eliminar politicas fantasma en PRODUCTOS
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'PASO 4: Limpiando politicas en tabla PRODUCTOS';
END $$;

DROP POLICY IF EXISTS "select_own_products" ON productos;
DROP POLICY IF EXISTS "update_own_products" ON productos;
DROP POLICY IF EXISTS "insert_own_products" ON productos;
DROP POLICY IF EXISTS "delete_own_products" ON productos;
DROP POLICY IF EXISTS "productos_select" ON productos;
DROP POLICY IF EXISTS "productos_update" ON productos;
DROP POLICY IF EXISTS "productos_insert" ON productos;
DROP POLICY IF EXISTS "productos_delete" ON productos;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas de PRODUCTOS';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 5: Eliminar politicas fantasma en STOCK
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'PASO 5: Limpiando politicas en tabla STOCK';
END $$;

DROP POLICY IF EXISTS "select_own_stock" ON stock;
DROP POLICY IF EXISTS "update_own_stock" ON stock;
DROP POLICY IF EXISTS "insert_own_stock" ON stock;
DROP POLICY IF EXISTS "delete_own_stock" ON stock;
DROP POLICY IF EXISTS "stock_select" ON stock;
DROP POLICY IF EXISTS "stock_update" ON stock;
DROP POLICY IF EXISTS "stock_insert" ON stock;
DROP POLICY IF EXISTS "stock_delete" ON stock;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas de STOCK';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 6: Eliminar politicas fantasma en CAJA_DIARIA
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'PASO 6: Limpiando politicas en tabla CAJA_DIARIA';
END $$;

DROP POLICY IF EXISTS "select_own_caja" ON caja_diaria;
DROP POLICY IF EXISTS "update_own_caja" ON caja_diaria;
DROP POLICY IF EXISTS "insert_own_caja" ON caja_diaria;
DROP POLICY IF EXISTS "delete_own_caja" ON caja_diaria;
DROP POLICY IF EXISTS "caja_select" ON caja_diaria;
DROP POLICY IF EXISTS "caja_update" ON caja_diaria;
DROP POLICY IF EXISTS "caja_insert" ON caja_diaria;
DROP POLICY IF EXISTS "caja_delete" ON caja_diaria;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas de CAJA_DIARIA';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- PASO 7: Eliminar politicas fantasma en MOVIMIENTOS_CAJA
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE 'PASO 7: Limpiando politicas en tabla MOVIMIENTOS_CAJA';
END $$;

DROP POLICY IF EXISTS "select_own_movements" ON movimientos_caja;
DROP POLICY IF EXISTS "update_own_movements" ON movimientos_caja;
DROP POLICY IF EXISTS "insert_own_movements" ON movimientos_caja;
DROP POLICY IF EXISTS "delete_own_movements" ON movimientos_caja;
DROP POLICY IF EXISTS "movimientos_select" ON movimientos_caja;
DROP POLICY IF EXISTS "movimientos_update" ON movimientos_caja;
DROP POLICY IF EXISTS "movimientos_insert" ON movimientos_caja;
DROP POLICY IF EXISTS "movimientos_delete" ON movimientos_caja;

DO $$
BEGIN
  RAISE NOTICE 'Politicas antiguas eliminadas de MOVIMIENTOS_CAJA';
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- VERIFICACION: Detectar politicas restantes con subconsultas
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'VERIFICACION: Buscando politicas con subconsultas manuales';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT
  schemaname AS "Schema",
  tablename AS "Tabla",
  policyname AS "Politica Antigua",
  'Usa subconsulta manual' AS "Problema"
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%SELECT%organization_id%FROM%perfiles%'
    OR with_check::text LIKE '%SELECT%organization_id%FROM%perfiles%'
    OR qual::text LIKE '%SELECT%FROM%perfiles%WHERE%auth.uid%'
    OR with_check::text LIKE '%SELECT%FROM%perfiles%WHERE%auth.uid%'
  )
ORDER BY tablename, policyname;

-- -------------------------------------------------------------------------------
-- VERIFICACION FINAL: Contar politicas restantes
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  count_ghost_policies INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_ghost_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual::text LIKE '%SELECT%organization_id%FROM%perfiles%'
      OR with_check::text LIKE '%SELECT%organization_id%FROM%perfiles%'
      OR qual::text LIKE '%SELECT%FROM%perfiles%WHERE%auth.uid%'
      OR with_check::text LIKE '%SELECT%FROM%perfiles%WHERE%auth.uid%'
    );

  RAISE NOTICE '';
  IF count_ghost_policies = 0 THEN
    RAISE NOTICE 'LIMPIEZA EXITOSA: No se detectaron politicas fantasma';
  ELSE
    RAISE WARNING 'ATENCION: Se encontraron % politicas fantasma restantes', count_ghost_policies;
    RAISE WARNING 'Revisa la tabla de arriba para ver cuales son';
  END IF;
  RAISE NOTICE '';
END $$;

-- -------------------------------------------------------------------------------
-- RESUMEN FINAL: Estado de politicas en ORGANIZATIONS y PERFILES
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE 'RESUMEN: Politicas actuales en ORGANIZATIONS y PERFILES';
  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT
  tablename AS "Tabla",
  COUNT(*) AS "Total Politicas",
  SUM(CASE
    WHEN qual::text LIKE '%get_my_org_id%' OR with_check::text LIKE '%get_my_org_id%'
    THEN 1
    ELSE 0
  END) AS "Usan get_my_org_id()",
  SUM(CASE
    WHEN qual::text LIKE '%auth.uid%' OR with_check::text LIKE '%auth.uid%'
    THEN 1
    ELSE 0
  END) AS "Usan auth.uid()"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'perfiles')
GROUP BY tablename
ORDER BY tablename;

-- -------------------------------------------------------------------------------
-- MENSAJE FINAL
-- -------------------------------------------------------------------------------

DO $$
DECLARE
  orgs_policy_count INTEGER;
  perfiles_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orgs_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations';

  SELECT COUNT(*) INTO perfiles_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'perfiles';

  RAISE NOTICE '';
  RAISE NOTICE '-------------------------------------------------------------------------------';

  IF orgs_policy_count = 3 AND perfiles_policy_count = 4 THEN
    RAISE NOTICE 'UPGRADE EXITOSO - Sistema listo para produccion';
    RAISE NOTICE '  - ORGANIZATIONS: 3 politicas (SELECT, UPDATE, INSERT)';
    RAISE NOTICE '  - PERFILES: 4 politicas (SELECT, INSERT, UPDATE, DELETE)';
  ELSE
    RAISE WARNING 'VERIFICACION REQUERIDA - Conteo de politicas inesperado';
    RAISE WARNING '  - ORGANIZATIONS: % politicas (esperadas: 3)', orgs_policy_count;
    RAISE WARNING '  - PERFILES: % politicas (esperadas: 4)', perfiles_policy_count;
    RAISE WARNING '  - Ejecuta VERIFY_RLS_UPGRADE.sql para diagnostico completo';
  END IF;

  RAISE NOTICE '-------------------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Limpieza de politicas fantasma completada';
  RAISE NOTICE '';
END $$;
