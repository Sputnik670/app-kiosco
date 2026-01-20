-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔒 FUNCIONES DE SEGURIDAD - PlanetaZEGA
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 📋 PROPÓSITO:
--    Crear funciones SQL que sirven como cimiento de seguridad para RLS (Row Level Security)
--    y garantizan que cada usuario solo acceda a datos de su organización.
--
-- 🎯 FUNCIONES INCLUIDAS:
--    1. get_my_org_id() - Obtiene el organization_id del usuario actual
--
-- ⚠️  IMPORTANTE:
--    - Estas funciones se usan en políticas RLS de todas las tablas
--    - DEBEN ejecutarse ANTES de crear políticas RLS
--    - Son SECURITY DEFINER para evitar escalación de privilegios
--
-- 📅 CREADO: 2026-01-05
-- 👤 AUTOR: Refactorización Server Actions
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: get_my_org_id()
-- ───────────────────────────────────────────────────────────────────────────────
--
-- DESCRIPCIÓN:
--   Retorna el organization_id del usuario autenticado actual (auth.uid()).
--   Esta función es el cimiento de todas las políticas RLS multi-tenant.
--
-- FLUJO:
--   1. Obtiene el ID del usuario autenticado usando auth.uid()
--   2. Busca el organization_id en la tabla perfiles
--   3. Retorna UUID del organization_id o NULL si no existe
--
-- USO EN RLS:
--   CREATE POLICY "usuarios_ven_su_org" ON sucursales
--   FOR SELECT USING (organization_id = get_my_org_id());
--
-- SEGURIDAD:
--   - SECURITY DEFINER: Se ejecuta con permisos del creador
--   - STABLE: Garantiza mismo resultado en una transacción
--   - PARALLEL SAFE: Puede ejecutarse en paralelo
--
-- RETORNA:
--   UUID - organization_id del usuario actual
--   NULL - Si el usuario no está autenticado o no tiene perfil
--
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT organization_id
  FROM public.perfiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- COMENTARIOS Y METADATOS
-- ───────────────────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.get_my_org_id() IS
'Retorna el organization_id del usuario autenticado actual.
Función base para todas las políticas RLS multi-tenant.
Uso: WHERE organization_id = get_my_org_id()';

-- ───────────────────────────────────────────────────────────────────────────────
-- PERMISOS
-- ───────────────────────────────────────────────────────────────────────────────
-- Permitir que usuarios autenticados ejecuten la función

GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO anon;

-- ───────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ───────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Verificar que la función existe
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_my_org_id'
  ) THEN
    RAISE NOTICE '✓ Función get_my_org_id() creada exitosamente';
    RAISE NOTICE '  → Retorna: UUID (organization_id del usuario actual)';
    RAISE NOTICE '  → Seguridad: SECURITY DEFINER, STABLE, PARALLEL SAFE';
    RAISE NOTICE '  → Uso en RLS: WHERE organization_id = get_my_org_id()';
  ELSE
    RAISE EXCEPTION '✗ Error: Función get_my_org_id() no se pudo crear';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📝 EJEMPLOS DE USO
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ejemplo 1: Uso directo en consultas
-- SELECT * FROM sucursales WHERE organization_id = get_my_org_id();

-- Ejemplo 2: Uso en políticas RLS
-- CREATE POLICY "usuarios_ven_su_org" ON sucursales
--   FOR SELECT
--   USING (organization_id = get_my_org_id());

-- Ejemplo 3: Uso en inserts con valor por defecto
-- CREATE POLICY "usuarios_insertan_en_su_org" ON productos
--   FOR INSERT
--   WITH CHECK (organization_id = get_my_org_id());

-- Ejemplo 4: Verificar que funciona (ejecutar como usuario autenticado)
-- SELECT get_my_org_id() AS mi_organizacion;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- ═══════════════════════════════════════════════════════════════════════════════
