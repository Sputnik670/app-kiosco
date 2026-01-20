-- ===============================================================================
-- FIX: PERMITIR CREACIÓN DE ORGANIZACIONES
-- ===============================================================================
-- Problema: La política RLS actual impide insertar porque el usuario
-- todavía no está vinculado a la organización que intenta crear.

-- 1. Eliminar políticas restrictivas existentes en 'organizations'
-- (Probamos borrar los nombres más comunes que pudimos haber usado)
DROP POLICY IF EXISTS "organizations_all_own" ON organizations;
DROP POLICY IF EXISTS "organizations_isolation" ON organizations;
DROP POLICY IF EXISTS "organizations_select_own" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_own" ON organizations;
DROP POLICY IF EXISTS "organizations_update_own" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_own" ON organizations;

-- 2. Habilitar RLS (por si acaso)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- 3. CREAR POLÍTICAS DIFERENCIADAS

-- A. INSERT: "Puerta Abierta"
-- Cualquier usuario logueado puede crear una organización.
-- Una vez creada, el código backend se encarga de vincularlo como dueño.
CREATE POLICY "organizations_insert_any_auth"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- B. SELECT: "Solo lo mío"
-- Solo puedes ver la organización a la que perteneces.
CREATE POLICY "organizations_select_own"
ON organizations
FOR SELECT
USING (id = public.get_my_org_id());

-- C. UPDATE: "Solo el dueño/miembro"
CREATE POLICY "organizations_update_own"
ON organizations
FOR UPDATE
USING (id = public.get_my_org_id());

-- D. DELETE: "Solo el dueño/miembro"
CREATE POLICY "organizations_delete_own"
ON organizations
FOR DELETE
USING (id = public.get_my_org_id());

-- ===============================================================================
-- VERIFICACIÓN
-- ===============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Políticas de organizations actualizadas: INSERT liberado.';
END $$;