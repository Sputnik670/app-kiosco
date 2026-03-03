-- ============================================================================
-- MIGRATION 00003: Sistema de Facturación Electrónica (ARCA/AFIP)
-- ============================================================================
--
-- Este script crea las tablas necesarias para el sistema de facturación
-- retroactiva y opcional. Permite al dueño seleccionar ventas pasadas
-- y agruparlas en facturas.
--
-- FLUJO:
-- 1. Ventas se registran normalmente (sin facturar)
-- 2. Dueño selecciona ventas desde el dashboard
-- 3. Sistema agrupa ventas en una factura
-- 4. Se obtiene CAE (mock o real) y se guarda
--
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLA: invoices (Facturas emitidas)
-- ----------------------------------------------------------------------------
-- Almacena las facturas electrónicas emitidas. Cada factura puede contener
-- una o más ventas agrupadas.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  -- Datos del comprobante
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('A', 'B', 'C')),
  invoice_number INTEGER NOT NULL,
  point_of_sale INTEGER NOT NULL DEFAULT 1,

  -- Datos del cliente (opcional para B/C con consumidor final)
  customer_cuit TEXT,
  customer_name TEXT,
  customer_tax_status TEXT CHECK (customer_tax_status IN ('RI', 'MONO', 'CF', 'EX', NULL)),
  customer_address TEXT,

  -- Totales
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,

  -- ARCA/AFIP
  cae TEXT,
  cae_expiry DATE,
  is_mock BOOLEAN DEFAULT TRUE,

  -- Estado y auditoría
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: número único por punto de venta y tipo
  CONSTRAINT unique_invoice_number UNIQUE (organization_id, point_of_sale, invoice_type, invoice_number)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_branch ON invoices(branch_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX idx_invoices_type_number ON invoices(invoice_type, invoice_number);

-- ----------------------------------------------------------------------------
-- TABLA: invoice_sales (Relación N:M entre facturas y ventas)
-- ----------------------------------------------------------------------------
-- Permite que una factura agrupe múltiples ventas.
-- Una venta solo puede estar en UNA factura (o en ninguna).

CREATE TABLE IF NOT EXISTS invoice_sales (
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (invoice_id, sale_id)
);

-- Índice para buscar si una venta ya está facturada
CREATE UNIQUE INDEX idx_invoice_sales_sale ON invoice_sales(sale_id);
CREATE INDEX idx_invoice_sales_invoice ON invoice_sales(invoice_id);

-- ----------------------------------------------------------------------------
-- AGREGAR fiscal_config A organizations
-- ----------------------------------------------------------------------------
-- Configuración fiscal opcional. Si no existe, la facturación no está habilitada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'fiscal_config'
  ) THEN
    ALTER TABLE organizations ADD COLUMN fiscal_config JSONB;

    COMMENT ON COLUMN organizations.fiscal_config IS
    'Configuración fiscal opcional. Estructura:
    {
      "cuit": "20-12345678-9",
      "tax_status": "RI" | "MONO",
      "business_name": "Razón Social",
      "business_address": "Dirección fiscal",
      "point_of_sale": 1,
      "arca_environment": "testing" | "production",
      "enabled": true
    }';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sales ENABLE ROW LEVEL SECURITY;

-- Invoices: Solo usuarios autenticados de la organización pueden ver/crear
CREATE POLICY "invoices_select_own_org" ON invoices
  FOR SELECT TO authenticated USING (organization_id = get_my_org_id());

CREATE POLICY "invoices_insert_own_org" ON invoices
  FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "invoices_update_own_org" ON invoices
  FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());

-- Invoice_sales: Heredar política de invoices (solo authenticated)
CREATE POLICY "invoice_sales_select" ON invoice_sales
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_sales.invoice_id
      AND invoices.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "invoice_sales_insert" ON invoice_sales
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_sales.invoice_id
      AND invoices.organization_id = get_my_org_id()
    )
  );

-- Invoices: Prohibir DELETE (auditoría - las facturas se anulan, no se eliminan)
CREATE POLICY "invoices_no_delete" ON invoices
  FOR DELETE TO authenticated USING (false);

-- Invoice_sales: Prohibir UPDATE (relación inmutable)
CREATE POLICY "invoice_sales_no_update" ON invoice_sales
  FOR UPDATE TO authenticated USING (false);

-- Invoice_sales: DELETE solo cuando se anula una factura (via cancelInvoiceAction)
-- El DELETE se hace desde código con service_role, no directamente por usuarios
CREATE POLICY "invoice_sales_no_delete" ON invoice_sales
  FOR DELETE TO authenticated USING (false);

-- Service role bypass para operaciones administrativas
CREATE POLICY "invoices_service" ON invoices
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "invoice_sales_service" ON invoice_sales
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- FUNCIÓN: get_next_invoice_number
-- ----------------------------------------------------------------------------
-- Obtiene el siguiente número de factura para un punto de venta y tipo.

CREATE OR REPLACE FUNCTION get_next_invoice_number(
  p_org_id UUID,
  p_point_of_sale INTEGER,
  p_invoice_type TEXT
) RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(invoice_number), 0) + 1 INTO next_number
  FROM invoices
  WHERE organization_id = p_org_id
    AND point_of_sale = p_point_of_sale
    AND invoice_type = p_invoice_type;

  RETURN next_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_next_invoice_number(UUID, INTEGER, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- VISTA: v_uninvoiced_sales
-- ----------------------------------------------------------------------------
-- Ventas que NO han sido incluidas en ninguna factura.

CREATE OR REPLACE VIEW v_uninvoiced_sales AS
SELECT
  s.id,
  s.organization_id,
  s.branch_id,
  s.cash_register_id,
  s.total,
  s.payment_method,
  s.created_at,
  s.notes,
  (
    SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id
  ) as item_count,
  (
    SELECT json_agg(json_build_object(
      'product_name', p.name,
      'quantity', si.quantity,
      'unit_price', si.unit_price
    ))
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = s.id
  ) as items_preview
FROM sales s
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_sales inv_s WHERE inv_s.sale_id = s.id
);

-- Comentarios de documentación
COMMENT ON TABLE invoices IS 'Facturas electrónicas emitidas (A, B, C)';
COMMENT ON TABLE invoice_sales IS 'Relación entre facturas y ventas agrupadas';
COMMENT ON VIEW v_uninvoiced_sales IS 'Ventas que aún no han sido facturadas';

-- ----------------------------------------------------------------------------
-- FIN DE MIGRACIÓN
-- ----------------------------------------------------------------------------
