-- ============================================================================
-- MIGRACIÓN: Sistema de Audit Logs
-- Propósito: Registro de auditoría para trazabilidad de operaciones críticas
-- Fecha: 2026-02-02
-- Corregido: 2026-02-25 (policy INSERT, org_id resolution, cleanup default)
-- ============================================================================

-- Crear tabla de audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_id) WHERE record_id IS NOT NULL;

-- RLS para audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo dueños pueden ver audit logs de su organización
CREATE POLICY "Owners can view org audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND is_owner()
  );

-- Nadie inserta directamente — solo los triggers (SECURITY DEFINER) pueden insertar.
-- La función audit_table_changes() es SECURITY DEFINER, lo que bypasea RLS.
CREATE POLICY "audit_logs_no_direct_insert"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (false);

-- No se permiten UPDATE ni DELETE desde usuarios
CREATE POLICY "audit_logs_no_update"
  ON audit_logs FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "audit_logs_no_delete"
  ON audit_logs FOR DELETE TO authenticated
  USING (false);

-- Service role bypass para operaciones administrativas y triggers
CREATE POLICY "audit_logs_service"
  ON audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCIÓN: Registrar cambios en audit_logs
-- ============================================================================
-- CORREGIDO: sales, cash_registers, stock_batches, cash_movements y sale_items
-- tienen organization_id directamente — no necesitan subquery a branches.
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_record_id UUID;
BEGIN
  -- Obtener user_id del contexto de auth
  v_user_id := auth.uid();

  -- Determinar organization_id y record_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := OLD.id;
    ELSE
      -- Todas las tablas auditadas (branches, products, memberships,
      -- sales, cash_registers, stock_batches, cash_movements, sale_items)
      -- tienen organization_id directamente.
      v_org_id := OLD.organization_id;
    END IF;
  ELSE
    v_record_id := NEW.id;
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org_id := NEW.id;
    ELSE
      v_org_id := NEW.organization_id;
    END IF;
  END IF;

  -- Insertar log solo si tenemos org_id y user_id
  IF v_org_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO audit_logs (
      organization_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) VALUES (
      v_org_id,
      v_user_id,
      TG_OP,
      TG_TABLE_NAME,
      v_record_id,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
  END IF;

  -- Retornar el registro apropiado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS: Aplicar auditoría a tablas críticas
-- ============================================================================

-- Auditar ventas
DROP TRIGGER IF EXISTS audit_sales_trigger ON sales;
CREATE TRIGGER audit_sales_trigger
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- Auditar cajas
DROP TRIGGER IF EXISTS audit_cash_registers_trigger ON cash_registers;
CREATE TRIGGER audit_cash_registers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cash_registers
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- Auditar movimientos de caja
DROP TRIGGER IF EXISTS audit_cash_movements_trigger ON cash_movements;
CREATE TRIGGER audit_cash_movements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- Auditar productos (cambios de precio, etc)
DROP TRIGGER IF EXISTS audit_products_trigger ON products;
CREATE TRIGGER audit_products_trigger
  AFTER UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- Auditar stock (solo UPDATE y DELETE para evitar overhead en INSERT masivo de process_sale)
DROP TRIGGER IF EXISTS audit_stock_batches_trigger ON stock_batches;
CREATE TRIGGER audit_stock_batches_trigger
  AFTER UPDATE OR DELETE ON stock_batches
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- Auditar membresías (cambios de roles, desactivaciones)
DROP TRIGGER IF EXISTS audit_memberships_trigger ON memberships;
CREATE TRIGGER audit_memberships_trigger
  AFTER UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- ============================================================================
-- FUNCIÓN: Limpiar logs antiguos (ejecutar periódicamente)
-- ============================================================================
-- Default 365 días según SPECIFICATIONS.md (Datos históricos: 1 año)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs(INTEGER) TO service_role;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON TABLE audit_logs IS 'Registro de auditoría para operaciones críticas del sistema';
COMMENT ON FUNCTION audit_table_changes() IS 'Trigger function que registra cambios en tablas auditadas';
COMMENT ON FUNCTION cleanup_old_audit_logs(INTEGER) IS 'Limpia logs de auditoría más antiguos que N días (default: 365)';
