-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔍 VERIFICACIÓN DE SEGURIDAD - PlanetaZEGA
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 📋 PROPÓSITO:
--    Script de diagnóstico para verificar que la función get_my_org_id() existe
--    y está correctamente configurada.
--
-- 🎯 VERIFICACIONES:
--    1. Existencia de la función get_my_org_id()
--    2. Permisos de ejecución
--    3. Tipo de retorno correcto (UUID)
--    4. Configuración de seguridad (SECURITY DEFINER)
--
-- 📅 USO:
--    Ejecutar este script en Supabase SQL Editor después de CREATE_SECURITY_FUNCTIONS.sql
--
-- ═══════════════════════════════════════════════════════════════════════════════

\echo '🔍 Iniciando verificación de seguridad...'
\echo ''

-- ───────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN 1: ¿Existe la función get_my_org_id()?
-- ───────────────────────────────────────────────────────────────────────────────

SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END AS status,
  'Función get_my_org_id() existe' AS test,
  COUNT(*) AS count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_my_org_id';

-- ───────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN 2: Detalles de la función
-- ───────────────────────────────────────────────────────────────────────────────

SELECT
  p.proname AS "Nombre",
  pg_catalog.pg_get_function_result(p.oid) AS "Tipo Retorno",
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END AS "Volatilidad",
  CASE p.prosecdef
    WHEN true THEN '✓ SECURITY DEFINER'
    ELSE '✗ SECURITY INVOKER'
  END AS "Seguridad",
  CASE p.proparallel
    WHEN 's' THEN '✓ PARALLEL SAFE'
    WHEN 'u' THEN 'PARALLEL UNSAFE'
    WHEN 'r' THEN 'PARALLEL RESTRICTED'
  END AS "Paralelización"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_my_org_id';

-- ───────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN 3: Permisos de ejecución
-- ───────────────────────────────────────────────────────────────────────────────

SELECT
  p.proname AS "Función",
  CASE
    WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN '✓ SÍ'
    ELSE '✗ NO'
  END AS "authenticated puede ejecutar",
  CASE
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN '✓ SÍ'
    ELSE '✗ NO'
  END AS "anon puede ejecutar"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_my_org_id';

-- ───────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN 4: Código fuente de la función
-- ───────────────────────────────────────────────────────────────────────────────

SELECT
  '📄 Código fuente:' AS info,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_my_org_id';

-- ───────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN 5: Test funcional (requiere usuario autenticado)
-- ───────────────────────────────────────────────────────────────────────────────

\echo ''
\echo '📝 Para probar la función con un usuario real, ejecuta:'
\echo '   SELECT get_my_org_id() AS mi_organizacion;'
\echo ''
\echo '   Debe retornar el UUID de tu organización si estás autenticado,'
\echo '   o NULL si no estás autenticado o no tienes perfil.'
\echo ''

-- ───────────────────────────────────────────────────────────────────────────────
-- RESUMEN DE POLÍTICAS RLS QUE USAN get_my_org_id()
-- ───────────────────────────────────────────────────────────────────────────────

SELECT
  schemaname AS "Schema",
  tablename AS "Tabla",
  policyname AS "Política",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando",
  CASE
    WHEN qual::text LIKE '%get_my_org_id%' OR with_check::text LIKE '%get_my_org_id%'
    THEN '✓ Usa get_my_org_id()'
    ELSE '✗ No usa'
  END AS "Estado"
FROM pg_policies
WHERE qual::text LIKE '%get_my_org_id%'
   OR with_check::text LIKE '%get_my_org_id%'
ORDER BY tablename, policyname;

-- ───────────────────────────────────────────────────────────────────────────────
-- FIN DE VERIFICACIÓN
-- ───────────────────────────────────────────────────────────────────────────────

\echo ''
\echo '✓ Verificación de seguridad completada'
\echo ''
