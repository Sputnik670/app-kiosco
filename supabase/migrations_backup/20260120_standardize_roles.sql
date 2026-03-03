-- ============================================================================
-- MIGRATION: Standardize Roles from Spanish to English
-- ============================================================================
-- Created: 2026-01-20
-- Purpose: Unify role naming convention across all tables
-- Security: MEDIUM - Ensures consistency in authorization checks
--
-- Changes:
-- - Migrates perfiles.rol: 'dueño' → 'owner', 'empleado' → 'employee'
-- - Updates legacy functions to use V2 equivalents
-- - Creates alias functions for backward compatibility
--
-- Dependencies:
-- - 20260112_create_v2_functions.sql (get_my_org_id_v2, es_owner_v2)
--
-- Note: user_organization_roles already uses English ('owner', 'employee')
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. MIGRATE ROLES IN PERFILES TABLE (if column exists)
-- ══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Check if perfiles.rol column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'perfiles'
    AND column_name = 'rol'
  ) THEN
    -- Migrate existing roles from Spanish to English
    UPDATE public.perfiles
    SET rol = CASE rol
      WHEN 'dueño' THEN 'owner'
      WHEN 'empleado' THEN 'employee'
      WHEN 'gerente' THEN 'manager'
      WHEN 'admin' THEN 'admin'
      ELSE rol -- Keep any other values unchanged
    END
    WHERE rol IN ('dueño', 'empleado', 'gerente');

    RAISE NOTICE '✅ Migrated perfiles.rol values: dueño → owner, empleado → employee';
  ELSE
    RAISE NOTICE 'ℹ️  Column perfiles.rol does not exist (already removed in cleanup)';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. UPDATE LEGACY FUNCTIONS TO USE V2
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 2.1 Update get_my_org_id to call get_my_org_id_v2
-- ──────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_my_org_id() CASCADE;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  -- Alias that calls V2 function (reads from user_organization_roles)
  SELECT public.get_my_org_id_v2();
$$;

COMMENT ON FUNCTION public.get_my_org_id() IS
'Alias de get_my_org_id_v2() para compatibilidad con código existente.
Ahora lee de user_organization_roles (tabla V2) en lugar de perfiles.';

GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO anon;

-- ──────────────────────────────────────────────────────────────────────────
-- 2.2 Update es_dueno to call es_owner_v2
-- ──────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.es_dueno() CASCADE;

CREATE OR REPLACE FUNCTION public.es_dueno()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Alias that calls V2 function (reads from user_organization_roles)
  SELECT public.es_owner_v2();
$$;

COMMENT ON FUNCTION public.es_dueno() IS
'Alias de es_owner_v2() para compatibilidad con código existente.
Ahora lee de user_organization_roles.role = ''owner'' (inglés).
LEGACY: Mantener por compatibilidad pero migrar código a es_owner_v2().';

GRANT EXECUTE ON FUNCTION public.es_dueno() TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. CREATE ADDITIONAL ALIAS FUNCTIONS (for backward compatibility)
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 3.1 Alias: get_user_organization_id → get_my_org_id_v2
-- ──────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_user_organization_id() CASCADE;

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT public.get_my_org_id_v2();
$$;

COMMENT ON FUNCTION public.get_user_organization_id() IS
'Alias de get_my_org_id_v2().
LEGACY: Mantener por compatibilidad.';

GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 3.2 Alias: get_current_user_org_id → get_my_org_id_v2
-- ──────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_current_user_org_id() CASCADE;

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT public.get_my_org_id_v2();
$$;

COMMENT ON FUNCTION public.get_current_user_org_id() IS
'Alias de get_my_org_id_v2().
LEGACY: Mantener por compatibilidad.';

GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. UPDATE ROLE CHECK TYPE (if needed)
-- ══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Check if there's a CHECK constraint on perfiles.rol with Spanish values
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
    WHERE tc.table_schema = 'public'
    AND tc.table_name = 'perfiles'
    AND ccu.column_name = 'rol'
    AND tc.constraint_type = 'CHECK'
  ) THEN
    -- Drop old CHECK constraint (if exists)
    EXECUTE (
      SELECT 'ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS ' || tc.constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
      AND tc.table_name = 'perfiles'
      AND tc.constraint_type = 'CHECK'
      AND tc.constraint_name LIKE '%rol%'
      LIMIT 1
    );

    -- Create new CHECK constraint with English values
    ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_rol_check
    CHECK (rol IN ('owner', 'employee', 'manager', 'admin'));

    RAISE NOTICE '✅ Updated CHECK constraint on perfiles.rol to use English values';
  ELSE
    RAISE NOTICE 'ℹ️  No CHECK constraint found on perfiles.rol (may not exist)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️  Could not update CHECK constraint (table may have changed): %', SQLERRM;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check that functions were updated
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  missing_functions TEXT[];
BEGIN
  -- Check that all V2 functions exist
  SELECT ARRAY_AGG(func_name)
  INTO missing_functions
  FROM (
    SELECT unnest(ARRAY[
      'get_my_org_id_v2',
      'es_owner_v2',
      'get_my_org_id',
      'es_dueno'
    ]) AS func_name
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = func_name
    AND pronamespace = 'public'::regnamespace
  );

  IF array_length(missing_functions, 1) > 0 THEN
    RAISE WARNING 'The following functions are missing: %', missing_functions;
    RAISE EXCEPTION 'Migration failed: Not all functions exist';
  ELSE
    RAISE NOTICE '✅ SUCCESS: All legacy functions now point to V2 equivalents';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- SUMMARY OF CHANGES
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  perfiles_rol_exists BOOLEAN;
  perfiles_dueno_count INTEGER;
  perfiles_owner_count INTEGER;
BEGIN
  -- Check if perfiles.rol exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'perfiles' AND column_name = 'rol'
  ) INTO perfiles_rol_exists;

  IF perfiles_rol_exists THEN
    -- Count migrated roles
    SELECT COUNT(*) FROM public.perfiles WHERE rol = 'dueño' INTO perfiles_dueno_count;
    SELECT COUNT(*) FROM public.perfiles WHERE rol = 'owner' INTO perfiles_owner_count;

    RAISE NOTICE '══════════════════════════════════════════════════════';
    RAISE NOTICE '✅ MIGRATION SUMMARY: Standardize Roles';
    RAISE NOTICE '══════════════════════════════════════════════════════';
    RAISE NOTICE 'perfiles.rol migration:';
    RAISE NOTICE '  - Remaining "dueño" roles: % (should be 0)', perfiles_dueno_count;
    RAISE NOTICE '  - New "owner" roles: %', perfiles_owner_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Function aliases created:';
    RAISE NOTICE '  - get_my_org_id() → get_my_org_id_v2()';
    RAISE NOTICE '  - es_dueno() → es_owner_v2()';
    RAISE NOTICE '  - get_user_organization_id() → get_my_org_id_v2()';
    RAISE NOTICE '  - get_current_user_org_id() → get_my_org_id_v2()';
    RAISE NOTICE '══════════════════════════════════════════════════════';
  ELSE
    RAISE NOTICE '══════════════════════════════════════════════════════';
    RAISE NOTICE '✅ MIGRATION SUMMARY: Standardize Roles';
    RAISE NOTICE '══════════════════════════════════════════════════════';
    RAISE NOTICE 'perfiles.rol: Column does not exist (already cleaned up)';
    RAISE NOTICE '';
    RAISE NOTICE 'Function aliases created:';
    RAISE NOTICE '  - get_my_org_id() → get_my_org_id_v2()';
    RAISE NOTICE '  - es_dueno() → es_owner_v2()';
    RAISE NOTICE '  - get_user_organization_id() → get_my_org_id_v2()';
    RAISE NOTICE '  - get_current_user_org_id() → get_my_org_id_v2()';
    RAISE NOTICE '══════════════════════════════════════════════════════';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION RECOMMENDATIONS
-- ============================================================================
-- 1. Update TypeScript code to use V2 functions directly:
--    - Replace rpc('get_my_org_id') with rpc('get_my_org_id_v2')
--    - Replace rpc('es_dueno') with rpc('es_owner_v2')
--
-- 2. After confirming all code works, consider removing legacy aliases
--    in a future migration (not urgent - aliases are lightweight)
--
-- 3. Search codebase for references to Spanish roles:
--    - grep -r "dueño" lib/
--    - grep -r "empleado" lib/
--    - Update to use 'owner' and 'employee'
-- ============================================================================
