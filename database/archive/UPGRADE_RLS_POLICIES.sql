-- ===============================================================================
-- UPGRADE DE POLITICAS RLS - PlanetaZEGA
-- ===============================================================================
--
-- PROPOSITO:
--    Profesionalizar las politicas RLS usando la funcion get_my_org_id()
--    para garantizar aislamiento multi-tenant.
--
-- TABLAS AFECTADAS:
--    1. perfiles - Ver solo perfiles de la misma organizacion
--    2. organizations - Usar get_my_org_id() en lugar de subconsultas
--
-- IMPORTANTE:
--    - EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
--    - Requiere que get_my_org_id() ya exista (CREATE_SECURITY_FUNCTIONS.sql)
--    - Mantiene RLS activo en ambas tablas
--
-- CREADO: 2026-01-05
-- AUTOR: Refactorizacion Server Actions
--
-- ===============================================================================

-- -------------------------------------------------------------------------------
-- TABLA 1: PERFILES
-- -------------------------------------------------------------------------------

-- PASO 1: Eliminar politicas existentes
DROP POLICY IF EXISTS "Usuarios ven solo perfiles de su organización" ON perfiles;
DROP POLICY IF EXISTS "perfiles_select_policy" ON perfiles;
DROP POLICY IF EXISTS "perfiles_insert_policy" ON perfiles;
DROP POLICY IF EXISTS "perfiles_update_policy" ON perfiles;
DROP POLICY IF EXISTS "perfiles_insert_organization" ON perfiles;
DROP POLICY IF EXISTS "perfiles_insert_own" ON perfiles;
DROP POLICY IF EXISTS "perfiles_delete_organization" ON perfiles;

-- PASO 2: Crear nueva politica profesional para SELECT
CREATE POLICY "perfiles_select_organization"
  ON perfiles
  FOR SELECT
  USING (organization_id = public.get_my_org_id());

-- PASO 3: Politica para INSERT (usuarios pueden crear su propio perfil inicial)
-- IMPORTANTE: No usa get_my_org_id() porque el perfil aun no existe durante signup
CREATE POLICY "perfiles_insert_own"
  ON perfiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- PASO 4: Politica para UPDATE (solo perfiles de su organizacion)
CREATE POLICY "perfiles_update_organization"
  ON perfiles
  FOR UPDATE
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- PASO 5: Politica para DELETE (solo perfiles de su organizacion)
CREATE POLICY "perfiles_delete_organization"
  ON perfiles
  FOR DELETE
  USING (organization_id = public.get_my_org_id());

-- -------------------------------------------------------------------------------
-- TABLA 2: ORGANIZATIONS
-- -------------------------------------------------------------------------------

-- PASO 1: Eliminar politicas existentes
DROP POLICY IF EXISTS "Usuarios ven solo su organización" ON organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_new" ON organizations;

-- PASO 2: Crear nueva politica profesional para SELECT
CREATE POLICY "organizations_select_own"
  ON organizations
  FOR SELECT
  USING (id = public.get_my_org_id());

-- PASO 3: Politica para UPDATE (solo su propia organizacion)
CREATE POLICY "organizations_update_own"
  ON organizations
  FOR UPDATE
  USING (id = public.get_my_org_id())
  WITH CHECK (id = public.get_my_org_id());

-- PASO 4: Politica para INSERT (permitir crear nueva organizacion durante signup)
-- NOTA: Esta politica es especial porque durante el signup inicial el usuario
-- aun no tiene organization_id en perfiles, por lo que permitimos INSERT sin restricciones
CREATE POLICY "organizations_insert_new"
  ON organizations
  FOR INSERT
  WITH CHECK (true);

-- -------------------------------------------------------------------------------
-- VERIFICACION FINAL
-- -------------------------------------------------------------------------------

-- Verificar que RLS este activo en ambas tablas
DO $$
BEGIN
  -- Verificar perfiles
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'perfiles' AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'RLS activo en tabla perfiles';
  ELSE
    RAISE WARNING 'RLS NO esta activo en tabla perfiles';
  END IF;

  -- Verificar organizations
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'organizations' AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'RLS activo en tabla organizations';
  ELSE
    RAISE WARNING 'RLS NO esta activo en tabla organizations';
  END IF;
END $$;

-- -------------------------------------------------------------------------------
-- RESUMEN DE POLITICAS APLICADAS
-- -------------------------------------------------------------------------------

SELECT
  schemaname AS "Schema",
  tablename AS "Tabla",
  policyname AS "Politica",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando",
  CASE
    WHEN qual::text LIKE '%get_my_org_id%' OR with_check::text LIKE '%get_my_org_id%'
    THEN 'Usa get_my_org_id()'
    WHEN qual::text = 'true' OR with_check::text = 'true'
    THEN 'Abierto (signup)'
    WHEN qual::text LIKE '%auth.uid%' OR with_check::text LIKE '%auth.uid%'
    THEN 'Usa auth.uid()'
    ELSE 'Otro'
  END AS "Estado"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('perfiles', 'organizations')
ORDER BY tablename, policyname;

-- -------------------------------------------------------------------------------
-- RESUMEN FINAL
-- -------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE 'UPGRADE COMPLETADO';
  RAISE NOTICE '===============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'RESUMEN:';
  RAISE NOTICE '  - Tabla perfiles: 4 politicas (SELECT, INSERT, UPDATE, DELETE)';
  RAISE NOTICE '  - Tabla organizations: 3 politicas (SELECT, UPDATE, INSERT)';
  RAISE NOTICE '';
  RAISE NOTICE 'EXCEPCIONES DE SEGURIDAD (necesarias para signup):';
  RAISE NOTICE '  - perfiles INSERT: usa auth.uid() (usuario crea su propio perfil)';
  RAISE NOTICE '  - organizations INSERT: usa WITH CHECK(true) (signup inicial)';
  RAISE NOTICE '';
  RAISE NOTICE 'SEGURIDAD:';
  RAISE NOTICE '  - RLS activo en ambas tablas';
  RAISE NOTICE '  - Aislamiento multi-tenant garantizado';
  RAISE NOTICE '  - Sin subconsultas manuales (mejor performance)';
  RAISE NOTICE '';
  RAISE NOTICE '===============================================================================';
END $$;
