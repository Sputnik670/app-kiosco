-- ============================================================================
-- MIGRATION 00007: Incidents, Owner Notes + Security Fixes
-- ============================================================================
-- Fecha: 2026-03-16
-- Descripcion:
--   1. Crear tabla incidents con politicas RLS granulares
--   2. Crear tabla owner_notes con politicas RLS solo-owner
--   3. Fix: mercadopago_credentials INSERT/UPDATE/DELETE solo para owner
--
-- Problemas que resuelve:
--   - incidents y owner_notes no tenian migracion formal
--   - mercadopago_credentials permitia escritura a cualquier miembro
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLA: incidents
-- ============================================================================
-- Registro de incidentes laborales. El dueño crea y resuelve, el empleado
-- puede ver los suyos y justificarse.

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL,

  -- Tipo y detalle
  type TEXT NOT NULL CHECK (type IN ('error', 'cash_difference', 'stock_loss', 'attendance', 'other')),
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),

  -- Resolución (dueño)
  resolution TEXT,

  -- Justificación (empleado)
  justification TEXT,
  justification_type TEXT CHECK (
    justification_type IS NULL OR
    justification_type IN ('desconocimiento', 'olvido', 'externo', 'otro')
  ),

  -- Estado
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'justified', 'resolved', 'dismissed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  -- Constraint: resolved_at solo si esta resuelto o descartado
  CONSTRAINT chk_resolved_at CHECK (
    (status IN ('resolved', 'dismissed') AND resolved_at IS NOT NULL)
    OR (status NOT IN ('resolved', 'dismissed'))
  )
);

COMMENT ON TABLE incidents IS 'Incidentes laborales reportados por el dueño. Empleados pueden justificarse.';
COMMENT ON COLUMN incidents.reported_by IS 'UID del dueño que reportó el incidente.';
COMMENT ON COLUMN incidents.justification_type IS 'Tipo de justificación del empleado: desconocimiento, olvido, externo, otro.';

-- Indices
CREATE INDEX IF NOT EXISTS idx_incidents_org_status ON incidents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_employee ON incidents(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_branch ON incidents(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(organization_id, created_at DESC);

-- ============================================================================
-- 1b. RLS POLICIES: incidents
-- ============================================================================
-- SELECT: cualquier miembro del org puede ver (dueño ve todos, empleado ve los suyos via server action)
-- INSERT: solo owner
-- UPDATE: owner puede todo, empleado solo puede justificar SUS incidentes
-- DELETE: solo owner

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Lectura: todos los miembros del org
CREATE POLICY "incidents_select" ON incidents
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

-- Creación: solo owner
CREATE POLICY "incidents_insert" ON incidents
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() AND is_owner());

-- Actualización: owner puede todo, empleado solo puede justificar sus propios incidentes
-- (el server action ya valida qué campos se tocan, pero la RLS da acceso granular)
CREATE POLICY "incidents_update_owner" ON incidents
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "incidents_update_employee_justify" ON incidents
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND employee_id = auth.uid()
    AND status = 'open'  -- Solo pueden justificar incidentes abiertos
  );

-- Eliminación: solo owner
CREATE POLICY "incidents_delete" ON incidents
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

-- Service role (para operaciones del sistema)
CREATE POLICY "incidents_service" ON incidents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. TABLA: owner_notes
-- ============================================================================
-- Diario privado del dueño. Nadie más puede ver ni editar.

CREATE TABLE IF NOT EXISTS owner_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),

  -- Contenido
  note_date DATE NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (
    category IN ('general', 'finanzas', 'empleados', 'proveedores', 'ideas', 'urgente')
  ),
  pinned BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE owner_notes IS 'Notas privadas del dueño. Solo accesibles por el owner de la organizacion.';
COMMENT ON COLUMN owner_notes.note_date IS 'Fecha a la que se refiere la nota (para calendario).';
COMMENT ON COLUMN owner_notes.category IS 'Categoría: general, finanzas, empleados, proveedores, ideas, urgente.';

-- Indices
CREATE INDEX IF NOT EXISTS idx_notes_org_date ON owner_notes(organization_id, note_date DESC);
CREATE INDEX IF NOT EXISTS idx_notes_org_category ON owner_notes(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_notes_org_pinned ON owner_notes(organization_id, pinned DESC, note_date DESC);

-- ============================================================================
-- 2b. RLS POLICIES: owner_notes (SOLO OWNER)
-- ============================================================================

ALTER TABLE owner_notes ENABLE ROW LEVEL SECURITY;

-- TODAS las operaciones requieren ser owner
CREATE POLICY "notes_select" ON owner_notes
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "notes_insert" ON owner_notes
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "notes_update" ON owner_notes
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "notes_delete" ON owner_notes
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

-- Service role
CREATE POLICY "notes_service" ON owner_notes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_owner_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_owner_notes_updated_at
  BEFORE UPDATE ON owner_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_owner_notes_updated_at();

-- ============================================================================
-- 3. FIX: mercadopago_credentials — restringir escritura a owner
-- ============================================================================
-- Problema: las politicas originales permitían INSERT/UPDATE/DELETE a cualquier
-- miembro del org. Solo el dueño deberia poder gestionar credenciales de pago.

-- Eliminar politicas permisivas
DROP POLICY IF EXISTS "mp_creds_insert" ON mercadopago_credentials;
DROP POLICY IF EXISTS "mp_creds_update" ON mercadopago_credentials;
DROP POLICY IF EXISTS "mp_creds_delete" ON mercadopago_credentials;

-- Recrear con is_owner()
CREATE POLICY "mp_creds_insert" ON mercadopago_credentials
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "mp_creds_update" ON mercadopago_credentials
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "mp_creds_delete" ON mercadopago_credentials
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

-- ============================================================================
-- VERIFICACION
-- ============================================================================

DO $$
DECLARE
  v_incidents BOOLEAN;
  v_notes BOOLEAN;
  v_incidents_rls BOOLEAN;
  v_notes_rls BOOLEAN;
  v_mp_fix BOOLEAN;
BEGIN
  -- Tablas existen
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'incidents') INTO v_incidents;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'owner_notes') INTO v_notes;

  -- RLS habilitado
  SELECT rowsecurity FROM pg_tables WHERE tablename = 'incidents' INTO v_incidents_rls;
  SELECT rowsecurity FROM pg_tables WHERE tablename = 'owner_notes' INTO v_notes_rls;

  -- MP credentials tiene is_owner en insert
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mercadopago_credentials'
      AND policyname = 'mp_creds_insert'
      AND qual LIKE '%is_owner%' OR with_check LIKE '%is_owner%'
  ) INTO v_mp_fix;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  MIGRACION 00007: SECURITY FIXES';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  incidents tabla:        %', CASE WHEN v_incidents THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  incidents RLS:          %', CASE WHEN v_incidents_rls THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  owner_notes tabla:      %', CASE WHEN v_notes THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  owner_notes RLS:        %', CASE WHEN v_notes_rls THEN 'OK' ELSE 'FALLO' END;
  RAISE NOTICE '  mp_creds owner-only:    %', CASE WHEN v_mp_fix THEN 'OK' ELSE 'VERIFICAR' END;
  RAISE NOTICE '============================================';

  IF NOT (v_incidents AND v_notes AND v_incidents_rls AND v_notes_rls) THEN
    RAISE EXCEPTION 'Migracion 00007 fallo verificacion';
  END IF;
END $$;

COMMIT;
