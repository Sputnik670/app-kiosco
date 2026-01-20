-- ============================================================================
-- SECURITY VALIDATION SCRIPT
-- ============================================================================
-- Purpose: Verify that all security measures are correctly implemented
-- Run this script after migrations to ensure RLS and policies are working
--
-- How to run:
-- 1. Connect to Supabase SQL Editor
-- 2. Copy and paste this entire file
-- 3. Execute and check that all tests pass (no errors)
-- ============================================================================

\echo '════════════════════════════════════════════════════════════════════════'
\echo 'SECURITY VALIDATION SCRIPT'
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 1: Verify RLS is enabled on all critical tables
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 1: Checking RLS is ENABLED on all tables'
\echo '──────────────────────────────────────────────────────────────────────'

SELECT
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'productos', 'stock', 'ventas', 'detalles_venta', 'movimientos',
    'sucursales', 'asistencia', 'proveedores', 'caja_diaria',
    'movimientos_caja', 'compras', 'perfiles', 'user_organization_roles',
    'pending_invites', 'historial_precios', 'misiones', 'movimientos_misiones'
  )
ORDER BY tablename;

-- Verify: All tables should have rls_enabled = true
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE rowsecurity = false) = 0
    THEN '✅ PASS: All tables have RLS enabled'
    ELSE '❌ FAIL: ' || COUNT(*) FILTER (WHERE rowsecurity = false) || ' tables have RLS DISABLED'
  END as test_result
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'productos', 'stock', 'ventas', 'detalles_venta', 'movimientos',
    'sucursales', 'asistencia', 'proveedores', 'caja_diaria',
    'movimientos_caja', 'compras', 'perfiles', 'user_organization_roles',
    'pending_invites', 'historial_precios', 'misiones', 'movimientos_misiones'
  );

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 2: Count RLS policies per table
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 2: Counting RLS policies per table (minimum 4 expected)'
\echo '──────────────────────────────────────────────────────────────────────'

SELECT
  tablename,
  COUNT(*) as num_policies,
  CASE
    WHEN COUNT(*) >= 4 THEN '✅ OK'
    WHEN COUNT(*) >= 2 THEN '⚠️  FEW POLICIES'
    ELSE '❌ INSUFFICIENT'
  END as status
FROM pg_policies
WHERE tablename IN (
    'productos', 'stock', 'ventas', 'detalles_venta', 'movimientos',
    'sucursales', 'asistencia', 'proveedores', 'caja_diaria',
    'movimientos_caja', 'compras', 'perfiles', 'user_organization_roles',
    'pending_invites', 'historial_precios', 'misiones', 'movimientos_misiones'
  )
GROUP BY tablename
ORDER BY num_policies ASC, tablename;

-- List policy names for reference
\echo ''
\echo 'Policy names per table:'
SELECT
  tablename,
  string_agg(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE tablename IN (
    'productos', 'stock', 'ventas', 'sucursales', 'user_organization_roles'
  )
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 3: Verify V2 functions exist and are SECURITY DEFINER
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 3: Verifying V2 functions exist and are SECURITY DEFINER'
\echo '──────────────────────────────────────────────────────────────────────'

SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  CASE
    WHEN prosecdef = true THEN '✅ SECURITY DEFINER'
    ELSE '❌ NOT SECURITY DEFINER'
  END as security_status,
  provolatile as volatility
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'get_my_org_id_v2',
    'get_my_role_v2',
    'es_owner_v2',
    'create_initial_setup_v2',
    'procesar_venta',
    'verificar_stock_disponible',
    'incrementar_saldo_proveedor',
    'descontar_saldo_proveedor',
    'calcular_horas_trabajadas'
  )
ORDER BY proname;

-- Verify: All functions should exist and be SECURITY DEFINER
SELECT
  CASE
    WHEN COUNT(*) = 9 AND COUNT(*) FILTER (WHERE prosecdef = true) = 9
    THEN '✅ PASS: All V2 functions exist and are SECURITY DEFINER'
    WHEN COUNT(*) < 9
    THEN '❌ FAIL: Missing ' || (9 - COUNT(*)) || ' functions'
    ELSE '❌ FAIL: ' || (9 - COUNT(*) FILTER (WHERE prosecdef = true)) || ' functions are not SECURITY DEFINER'
  END as test_result
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'get_my_org_id_v2', 'get_my_role_v2', 'es_owner_v2', 'create_initial_setup_v2',
    'procesar_venta', 'verificar_stock_disponible', 'incrementar_saldo_proveedor',
    'descontar_saldo_proveedor', 'calcular_horas_trabajadas'
  );

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 4: Verify legacy functions now point to V2
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 4: Verifying legacy functions point to V2'
\echo '──────────────────────────────────────────────────────────────────────'

SELECT
  proname as legacy_function,
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%get_my_org_id_v2%'
      OR pg_get_functiondef(oid) LIKE '%es_owner_v2%'
    THEN '✅ Points to V2'
    ELSE '⚠️  May not use V2'
  END as status,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('get_my_org_id', 'es_dueno')
ORDER BY proname;

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 5: Check for Spanish role values in perfiles table
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 5: Checking for Spanish role values (should be 0)'
\echo '──────────────────────────────────────────────────────────────────────'

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'perfiles' AND column_name = 'rol'
  ) THEN
    RAISE NOTICE 'perfiles.rol column exists - checking values...';

    EXECUTE (
      SELECT
        'SELECT COUNT(*) as count, ' ||
        'CASE WHEN COUNT(*) = 0 THEN ''✅ PASS: No Spanish roles found'' ' ||
        'ELSE ''❌ FAIL: '' || COUNT(*) || '' Spanish roles remaining'' END as result ' ||
        'FROM public.perfiles WHERE rol IN (''dueño'', ''empleado'', ''gerente'')'
    );
  ELSE
    RAISE NOTICE '✅ perfiles.rol column does not exist (table cleaned up)';
  END IF;
END $$;

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 6: Verify user_organization_roles structure
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 6: Verifying user_organization_roles table structure'
\echo '──────────────────────────────────────────────────────────────────────'

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_organization_roles'
ORDER BY ordinal_position;

-- Expected columns: user_id, organization_id, role, sucursal_id, is_active, created_at, updated_at
SELECT
  CASE
    WHEN COUNT(*) >= 5 THEN '✅ PASS: user_organization_roles has required columns'
    ELSE '❌ FAIL: user_organization_roles is missing columns'
  END as test_result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_organization_roles'
  AND column_name IN ('user_id', 'organization_id', 'role', 'is_active');

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 7: Check for tables without organization_id (should be few)
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 7: Tables without organization_id column (expected: few)'
\echo '──────────────────────────────────────────────────────────────────────'

SELECT DISTINCT
  t.tablename,
  CASE
    WHEN c.column_name IS NULL THEN '⚠️  NO organization_id'
    ELSE '✅ HAS organization_id'
  END as status
FROM pg_tables t
LEFT JOIN information_schema.columns c
  ON c.table_name = t.tablename
  AND c.column_name = 'organization_id'
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'productos', 'stock', 'ventas', 'detalles_venta', 'movimientos',
    'sucursales', 'asistencia', 'proveedores', 'caja_diaria',
    'movimientos_caja', 'compras', 'historial_precios', 'misiones'
  )
ORDER BY status, tablename;

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- TEST 8: Verify indexes on organization_id exist (for performance)
-- ══════════════════════════════════════════════════════════════════════════

\echo '──────────────────────────────────────────────────────────────────────'
\echo 'TEST 8: Checking for indexes on organization_id (performance)'
\echo '──────────────────────────────────────────────────────────────────────'

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%organization_id%'
ORDER BY tablename;

-- Count tables with organization_id index
WITH org_id_tables AS (
  SELECT DISTINCT tablename
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND column_name = 'organization_id'
  AND table_name IN (
    'productos', 'stock', 'ventas', 'sucursales', 'asistencia',
    'proveedores', 'caja_diaria', 'movimientos_caja'
  )
),
indexed_tables AS (
  SELECT DISTINCT tablename
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexdef LIKE '%organization_id%'
)
SELECT
  COUNT(DISTINCT o.tablename) as tables_with_org_id,
  COUNT(DISTINCT i.tablename) as tables_with_index,
  CASE
    WHEN COUNT(DISTINCT i.tablename) >= 5
    THEN '✅ Good: ' || COUNT(DISTINCT i.tablename) || ' tables have organization_id indexes'
    ELSE '⚠️  Consider adding more indexes on organization_id'
  END as recommendation
FROM org_id_tables o
LEFT JOIN indexed_tables i ON o.tablename = i.tablename;

\echo ''

-- ══════════════════════════════════════════════════════════════════════════
-- SUMMARY
-- ══════════════════════════════════════════════════════════════════════════

\echo '════════════════════════════════════════════════════════════════════════'
\echo 'VALIDATION SUMMARY'
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''
\echo 'Review the results above:'
\echo '  ✅ = Test passed'
\echo '  ⚠️  = Warning (may need attention)'
\echo '  ❌ = Test failed (must fix before production)'
\echo ''
\echo 'Next steps:'
\echo '  1. Fix any ❌ failures'
\echo '  2. Review any ⚠️  warnings'
\echo '  3. Test manually with two separate user accounts'
\echo '  4. Verify multitenancy isolation (TEST 9 below)'
\echo '════════════════════════════════════════════════════════════════════════'

-- ══════════════════════════════════════════════════════════════════════════
-- MANUAL TEST 9: Multitenancy Isolation Test
-- ══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ THIS TEST MUST BE RUN MANUALLY by logging in as a specific user
--
-- Steps:
-- 1. Create two test organizations (org A and org B) with different users
-- 2. Log in as user from org A
-- 3. Run this query as authenticated user:
--
--    SELECT COUNT(*) as cross_tenant_leak
--    FROM productos
--    WHERE organization_id != public.get_my_org_id_v2();
--
-- Expected result: 0 rows (RLS blocks cross-tenant access)
--
-- 4. Try to insert a product with another org's organization_id:
--
--    INSERT INTO productos (organization_id, nombre, precio_venta)
--    VALUES ('<org_B_uuid>', 'Test Product', 100);
--
-- Expected result: ERROR or 0 rows inserted (RLS blocks)
--
-- 5. Repeat test logged in as user from org B
-- ══════════════════════════════════════════════════════════════════════════
