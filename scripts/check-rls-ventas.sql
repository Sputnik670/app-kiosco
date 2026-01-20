-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAR RLS EN MOTOR DE VENTAS V2.0
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Este script verifica que las tablas del motor de ventas tengan RLS habilitado
-- y muestra las políticas activas.
--
-- ═══════════════════════════════════════════════════════════════════════════════

\echo ''
\echo '🔐 VERIFICANDO RLS EN MOTOR DE VENTAS V2.0'
\echo '════════════════════════════════════════════════════════════════════════'

-- Ver estado RLS de las tablas
SELECT
    tablename AS "Tabla",
    CASE
        WHEN rowsecurity THEN '✅ ACTIVO'
        ELSE '❌ INACTIVO'
    END AS "Estado RLS"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('ventas', 'detalles_venta', 'movimientos')
ORDER BY tablename;

\echo ''
\echo '📋 POLÍTICAS ACTIVAS:'
\echo '────────────────────────────────────────────────────────────────────────'

-- Ver políticas
SELECT
    tablename AS "Tabla",
    policyname AS "Política",
    cmd AS "Comando",
    qual AS "Condición"
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('ventas', 'detalles_venta', 'movimientos')
ORDER BY tablename, policyname;

\echo ''
\echo '✅ Verificación completada'
\echo ''
