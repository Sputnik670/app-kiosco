-- ============================================================================
-- MIGRACIÓN: Tabla mission_templates
-- ============================================================================
-- Fecha: 2026-01-27
-- Descripción: Agrega tabla para plantillas de misiones recurrentes
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLA: MISSION_TEMPLATES (Plantillas de misiones recurrentes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  points INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE mission_templates IS 'Plantillas de misiones recurrentes. Se activan automáticamente al abrir caja.';
COMMENT ON COLUMN mission_templates.branch_id IS 'Si es NULL, aplica a todas las sucursales de la organización.';

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mission_templates_org ON mission_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_mission_templates_branch ON mission_templates(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mission_templates_active ON mission_templates(is_active) WHERE is_active = true;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE mission_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: Miembros de la organización pueden ver plantillas
CREATE POLICY "templates_select" ON mission_templates
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

-- INSERT: Solo owners/admins pueden crear plantillas
CREATE POLICY "templates_insert" ON mission_templates
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() AND is_owner());

-- UPDATE: Solo owners/admins pueden actualizar plantillas
CREATE POLICY "templates_update" ON mission_templates
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

-- DELETE: Solo owners/admins pueden eliminar plantillas
CREATE POLICY "templates_delete" ON mission_templates
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

-- Service role bypass
CREATE POLICY "templates_service" ON mission_templates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mission_templates') THEN
    RAISE NOTICE 'Tabla mission_templates creada exitosamente';
  END IF;
END $$;

COMMIT;
