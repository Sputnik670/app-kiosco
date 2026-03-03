-- ============================================================================
-- MIGRACIÓN COMPLETA: App Kiosco - Schema desde Cero
-- ============================================================================
-- Fecha: 2026-01-26
-- Versión: 2.0.0
--
-- Este archivo contiene TODO el schema necesario para la app:
-- - 15 tablas en orden de dependencias
-- - 2 funciones helper para RLS
-- - Políticas RLS para todas las tablas
-- - 3 RPCs de negocio
-- - 3 vistas para reportes
-- - Índices de performance
--
-- IMPORTANTE: Este archivo debe ejecutarse en una BD vacía
-- ============================================================================

BEGIN;

-- ============================================================================
-- EXTENSIONES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FUNCIONES HELPER (Necesarias antes de crear tablas para RLS)
-- ============================================================================

-- Placeholder que se actualizará después de crear memberships
CREATE OR REPLACE FUNCTION get_my_org_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT NULL::UUID;
$$;

CREATE OR REPLACE FUNCTION is_owner() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT FALSE;
$$;

-- ============================================================================
-- TABLA 1: ORGANIZATIONS (Tenant Root)
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'premium', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Organizaciones (tenants). Cada kiosco es una organización.';

-- ============================================================================
-- TABLA 2: BRANCHES (Sucursales) - Antes de memberships por FK
-- ============================================================================

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  qr_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE branches IS 'Sucursales de cada organización. Cada sucursal tiene QR único para fichaje.';

-- ============================================================================
-- TABLA 3: MEMBERSHIPS (Reemplaza perfiles + user_organization_roles)
-- ============================================================================

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'admin', 'employee')),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  xp INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_org UNIQUE (user_id, organization_id)
);

COMMENT ON TABLE memberships IS 'Vinculación usuario-organización. ÚNICA fuente de verdad para roles.';
COMMENT ON COLUMN memberships.role IS 'owner: propietario | admin: administrador | employee: empleado';
COMMENT ON COLUMN memberships.xp IS 'Puntos de experiencia para gamificación';

-- ============================================================================
-- ACTUALIZAR FUNCIONES HELPER (ahora que memberships existe)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_org_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organization_id
  FROM memberships
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY
    CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_owner() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  );
$$;

-- Función adicional para obtener branch asignada
CREATE OR REPLACE FUNCTION get_my_branch_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT branch_id
  FROM memberships
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY
    CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    created_at ASC
  LIMIT 1;
$$;

-- Función para obtener rol actual
CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role
  FROM memberships
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY
    CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    created_at ASC
  LIMIT 1;
$$;

-- Grants para funciones helper
GRANT EXECUTE ON FUNCTION get_my_org_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_branch_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

-- ============================================================================
-- TABLA 4: SUPPLIERS (Proveedores) - Antes de stock_batches
-- ============================================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  balance DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE suppliers IS 'Proveedores con cuenta corriente integrada.';

-- ============================================================================
-- TABLA 5: PRODUCTS (Catálogo de productos)
-- ============================================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL CHECK (sale_price >= 0),
  cost DECIMAL(10,2) DEFAULT 0 CHECK (cost >= 0),
  barcode TEXT,
  category TEXT,
  emoji TEXT,
  min_stock INTEGER DEFAULT 5,
  is_service BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE products IS 'Catálogo de productos. Compartido entre sucursales de la misma org.';
COMMENT ON COLUMN products.is_service IS 'TRUE para servicios virtuales (recargas, SUBE). FALSE para productos físicos.';

-- ============================================================================
-- TABLA 6: STOCK_BATCHES (Inventario FIFO por lotes)
-- ============================================================================

CREATE TABLE stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_cost DECIMAL(10,2),
  batch_number TEXT,
  expiration_date DATE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'expired', 'damaged')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE stock_batches IS 'Stock por lotes con soporte FIFO. Cada lote es una fila.';

-- Índice para FIFO (ordenar por vencimiento)
CREATE INDEX idx_stock_fifo ON stock_batches(product_id, branch_id, expiration_date NULLS LAST);

-- ============================================================================
-- TABLA 7: CASH_REGISTERS (Cajas diarias)
-- ============================================================================

CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(10,2),
  expected_amount DECIMAL(10,2),
  variance DECIMAL(10,2),
  is_open BOOLEAN DEFAULT true,
  opened_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_branch_date UNIQUE (branch_id, date)
);

COMMENT ON TABLE cash_registers IS 'Caja diaria por sucursal. Solo puede haber una abierta por sucursal/día.';
COMMENT ON COLUMN cash_registers.variance IS 'Diferencia entre closing_amount y expected_amount. Positivo = sobra.';

-- ============================================================================
-- TABLA 8: SALES (Ventas - INMUTABLE)
-- ============================================================================

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
  cashier_id UUID REFERENCES auth.users(id),
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'wallet')),
  local_id TEXT,  -- Para sincronización offline (idempotencia)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_local_id UNIQUE (organization_id, local_id)
);

COMMENT ON TABLE sales IS 'Registro de ventas. INMUTABLE para auditoría.';
COMMENT ON COLUMN sales.local_id IS 'ID local para ventas offline. Garantiza idempotencia al sincronizar.';

-- ============================================================================
-- TABLA 9: SALE_ITEMS (Líneas de venta - INMUTABLE)
-- ============================================================================

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  stock_batch_id UUID REFERENCES stock_batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sale_items IS 'Líneas de cada venta. INMUTABLE para auditoría.';
COMMENT ON COLUMN sale_items.unit_cost IS 'Costo al momento de la venta (histórico).';

-- ============================================================================
-- TABLA 10: CASH_MOVEMENTS (Movimientos de caja - INMUTABLE)
-- ============================================================================

CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'opening', 'closing', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  category TEXT,
  description TEXT,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cash_movements IS 'Movimientos de efectivo. INMUTABLE para auditoría.';

-- ============================================================================
-- TABLA 11: PURCHASES (Compras a proveedores)
-- ============================================================================

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  invoice_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'check', 'credit')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE purchases IS 'Registro de compras a proveedores.';

-- ============================================================================
-- TABLA 12: ATTENDANCE (Fichaje de empleados)
-- ============================================================================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ,
  hours_worked DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE attendance IS 'Fichaje de empleados. Un registro por día.';

-- ============================================================================
-- TABLA 13: MISSIONS (Misiones/Gamificación)
-- ============================================================================

CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT,
  target_value INTEGER DEFAULT 1,
  current_value INTEGER DEFAULT 0,
  points INTEGER DEFAULT 10,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE missions IS 'Misiones diarias para gamificación de empleados.';

-- ============================================================================
-- TABLA 14: PENDING_INVITES (Invitaciones pendientes)
-- ============================================================================

CREATE TABLE pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pending_invites IS 'Invitaciones pendientes para empleados. Token expira en 7 días.';

-- ============================================================================
-- TABLA 15: PRICE_HISTORY (Historial de precios - INMUTABLE)
-- ============================================================================

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  old_cost DECIMAL(10,2),
  new_cost DECIMAL(10,2),
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE price_history IS 'Historial de cambios de precio. INMUTABLE para auditoría.';

-- ============================================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS: ORGANIZATIONS
-- ============================================================================

-- SELECT: Ver org donde soy miembro
CREATE POLICY "org_select_member" ON organizations
  FOR SELECT TO authenticated
  USING (id = get_my_org_id() OR owner_id = auth.uid());

-- INSERT: Solo para crear org propia (via RPC)
CREATE POLICY "org_insert_owner" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: Solo owner puede modificar
CREATE POLICY "org_update_owner" ON organizations
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE: Solo owner puede eliminar
CREATE POLICY "org_delete_owner" ON organizations
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Service role bypass
CREATE POLICY "org_service_bypass" ON organizations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: BRANCHES
-- ============================================================================

CREATE POLICY "branches_select" ON branches
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY "branches_insert" ON branches
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "branches_update" ON branches
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "branches_delete" ON branches
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id() AND is_owner());

CREATE POLICY "branches_service" ON branches
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: MEMBERSHIPS
-- ============================================================================

-- Usuarios ven sus propios memberships
CREATE POLICY "memberships_select_own" ON memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Owners/admins ven todos los de su org
CREATE POLICY "memberships_select_org" ON memberships
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Solo owners pueden crear memberships
CREATE POLICY "memberships_insert" ON memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Solo owners pueden actualizar
CREATE POLICY "memberships_update" ON memberships
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- No se pueden eliminar memberships (solo desactivar)
CREATE POLICY "memberships_no_delete" ON memberships
  FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "memberships_service" ON memberships
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS RLS: TABLAS DE NEGOCIO (Patrón común)
-- ============================================================================

-- SUPPLIERS
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE TO authenticated USING (organization_id = get_my_org_id() AND is_owner());
CREATE POLICY "suppliers_service" ON suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PRODUCTS
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated USING (organization_id = get_my_org_id() AND is_owner());
CREATE POLICY "products_service" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);

-- STOCK_BATCHES
CREATE POLICY "stock_select" ON stock_batches FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "stock_insert" ON stock_batches FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "stock_update" ON stock_batches FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "stock_delete" ON stock_batches FOR DELETE TO authenticated USING (organization_id = get_my_org_id() AND is_owner());
CREATE POLICY "stock_service" ON stock_batches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- CASH_REGISTERS
CREATE POLICY "cash_reg_select" ON cash_registers FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "cash_reg_insert" ON cash_registers FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "cash_reg_update" ON cash_registers FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "cash_reg_no_delete" ON cash_registers FOR DELETE TO authenticated USING (false); -- INMUTABLE
CREATE POLICY "cash_reg_service" ON cash_registers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- SALES (INMUTABLE)
CREATE POLICY "sales_select" ON sales FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "sales_insert" ON sales FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "sales_no_update" ON sales FOR UPDATE TO authenticated USING (false);
CREATE POLICY "sales_no_delete" ON sales FOR DELETE TO authenticated USING (false);
CREATE POLICY "sales_service" ON sales FOR ALL TO service_role USING (true) WITH CHECK (true);

-- SALE_ITEMS (INMUTABLE)
CREATE POLICY "items_select" ON sale_items FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "items_insert" ON sale_items FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "items_no_update" ON sale_items FOR UPDATE TO authenticated USING (false);
CREATE POLICY "items_no_delete" ON sale_items FOR DELETE TO authenticated USING (false);
CREATE POLICY "items_service" ON sale_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- CASH_MOVEMENTS (INMUTABLE)
CREATE POLICY "movements_select" ON cash_movements FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "movements_insert" ON cash_movements FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "movements_no_update" ON cash_movements FOR UPDATE TO authenticated USING (false);
CREATE POLICY "movements_no_delete" ON cash_movements FOR DELETE TO authenticated USING (false);
CREATE POLICY "movements_service" ON cash_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PURCHASES
CREATE POLICY "purchases_select" ON purchases FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "purchases_insert" ON purchases FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "purchases_update" ON purchases FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "purchases_delete" ON purchases FOR DELETE TO authenticated USING (organization_id = get_my_org_id() AND is_owner());
CREATE POLICY "purchases_service" ON purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ATTENDANCE
CREATE POLICY "attendance_select" ON attendance FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "attendance_insert" ON attendance FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "attendance_update" ON attendance FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "attendance_delete" ON attendance FOR DELETE TO authenticated USING (organization_id = get_my_org_id() AND is_owner());
CREATE POLICY "attendance_service" ON attendance FOR ALL TO service_role USING (true) WITH CHECK (true);

-- MISSIONS
CREATE POLICY "missions_select" ON missions FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "missions_insert" ON missions FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "missions_update" ON missions FOR UPDATE TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "missions_delete" ON missions FOR DELETE TO authenticated USING (organization_id = get_my_org_id() AND is_owner());
CREATE POLICY "missions_service" ON missions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PENDING_INVITES (solo owners ven/crean)
CREATE POLICY "invites_select" ON pending_invites FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ));
CREATE POLICY "invites_insert" ON pending_invites FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ));
CREATE POLICY "invites_delete" ON pending_invites FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ));
CREATE POLICY "invites_service" ON pending_invites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PRICE_HISTORY (INMUTABLE)
CREATE POLICY "prices_select" ON price_history FOR SELECT TO authenticated USING (organization_id = get_my_org_id());
CREATE POLICY "prices_insert" ON price_history FOR INSERT TO authenticated WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "prices_no_update" ON price_history FOR UPDATE TO authenticated USING (false);
CREATE POLICY "prices_no_delete" ON price_history FOR DELETE TO authenticated USING (false);
CREATE POLICY "prices_service" ON price_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- RPC 1: SETUP_ORGANIZATION (Onboarding de Owner)
-- ============================================================================

CREATE OR REPLACE FUNCTION setup_organization(
  p_org_name TEXT,
  p_user_name TEXT,
  p_email TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_branch_id UUID;
BEGIN
  -- Validaciones
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM memberships WHERE user_id = v_user_id AND is_active = true) THEN
    RAISE EXCEPTION 'El usuario ya pertenece a una organización';
  END IF;

  -- 1. Crear organización
  INSERT INTO organizations (name, owner_id)
  VALUES (COALESCE(NULLIF(TRIM(p_org_name), ''), 'Mi Negocio'), v_user_id)
  RETURNING id INTO v_org_id;

  -- 2. Crear membership (owner)
  INSERT INTO memberships (user_id, organization_id, role, display_name, email)
  VALUES (v_user_id, v_org_id, 'owner', p_user_name, p_email);

  -- 3. Crear sucursal por defecto
  INSERT INTO branches (organization_id, name)
  VALUES (v_org_id, 'Sucursal Principal')
  RETURNING id INTO v_branch_id;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'branch_id', v_branch_id,
    'role', 'owner',
    'success', true
  );
END;
$$;

COMMENT ON FUNCTION setup_organization IS 'Crea organización, membership owner y sucursal inicial. SECURITY DEFINER para bypass RLS.';
GRANT EXECUTE ON FUNCTION setup_organization(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- RPC 2: ACCEPT_INVITE (Onboarding de Empleado)
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_invite(
  p_token TEXT,
  p_user_name TEXT,
  p_email TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite RECORD;
BEGIN
  -- Validaciones
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Buscar invitación válida
  SELECT * INTO v_invite
  FROM pending_invites
  WHERE token = p_token
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación inválida o expirada';
  END IF;

  -- Verificar que no pertenece ya a esta org
  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = v_user_id
      AND organization_id = v_invite.organization_id
  ) THEN
    RAISE EXCEPTION 'Ya eres miembro de esta organización';
  END IF;

  -- Crear membership
  INSERT INTO memberships (
    user_id,
    organization_id,
    role,
    branch_id,
    display_name,
    email,
    invited_by
  ) VALUES (
    v_user_id,
    v_invite.organization_id,
    'employee',
    v_invite.branch_id,
    p_user_name,
    p_email,
    v_invite.invited_by
  );

  -- Eliminar invitación usada
  DELETE FROM pending_invites WHERE id = v_invite.id;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'organization_id', v_invite.organization_id,
    'branch_id', v_invite.branch_id,
    'role', 'employee',
    'success', true
  );
END;
$$;

COMMENT ON FUNCTION accept_invite IS 'Acepta invitación y crea membership. SECURITY DEFINER para bypass RLS.';
GRANT EXECUTE ON FUNCTION accept_invite(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- RPC 3: PROCESS_SALE (Venta atómica con soporte offline)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_sale(
  p_branch_id UUID,
  p_cash_register_id UUID,
  p_items JSONB,
  p_payment_method TEXT,
  p_total DECIMAL,
  p_local_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID := get_my_org_id();
  v_sale_id UUID;
  v_item JSONB;
  v_existing_id UUID;
BEGIN
  -- Validaciones
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no tiene organización asignada';
  END IF;

  -- Idempotencia: si local_id existe, retornar ID existente
  IF p_local_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM sales
    WHERE organization_id = v_org_id AND local_id = p_local_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  -- Verificar que la caja está abierta
  IF NOT EXISTS (
    SELECT 1 FROM cash_registers
    WHERE id = p_cash_register_id
      AND organization_id = v_org_id
      AND is_open = true
  ) THEN
    RAISE EXCEPTION 'La caja no está abierta';
  END IF;

  -- Crear venta
  INSERT INTO sales (
    organization_id,
    branch_id,
    cash_register_id,
    cashier_id,
    total,
    payment_method,
    local_id,
    notes
  ) VALUES (
    v_org_id,
    p_branch_id,
    p_cash_register_id,
    auth.uid(),
    p_total,
    p_payment_method,
    p_local_id,
    p_notes
  )
  RETURNING id INTO v_sale_id;

  -- Procesar items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sale_items (
      organization_id,
      sale_id,
      product_id,
      quantity,
      unit_price,
      unit_cost,
      subtotal
    )
    SELECT
      v_org_id,
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL,
      p.cost,
      (v_item->>'subtotal')::DECIMAL
    FROM products p
    WHERE p.id = (v_item->>'product_id')::UUID;

    -- Descontar stock FIFO
    UPDATE stock_batches
    SET quantity = quantity - (v_item->>'quantity')::INTEGER
    WHERE id = (
      SELECT id FROM stock_batches
      WHERE organization_id = v_org_id
        AND product_id = (v_item->>'product_id')::UUID
        AND branch_id = p_branch_id
        AND status = 'available'
        AND quantity > 0
      ORDER BY expiration_date NULLS LAST, created_at
      LIMIT 1
    );
  END LOOP;

  -- Registrar movimiento de caja si es efectivo
  IF p_payment_method = 'cash' THEN
    INSERT INTO cash_movements (
      organization_id,
      cash_register_id,
      type,
      amount,
      category,
      description,
      sale_id,
      user_id
    ) VALUES (
      v_org_id,
      p_cash_register_id,
      'income',
      p_total,
      'sale',
      'Venta',
      v_sale_id,
      auth.uid()
    );
  END IF;

  RETURN v_sale_id;
END;
$$;

COMMENT ON FUNCTION process_sale IS 'Procesa venta completa: crea sale, sale_items, descuenta stock FIFO, registra movimiento.';
GRANT EXECUTE ON FUNCTION process_sale(UUID, UUID, JSONB, TEXT, DECIMAL, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- VISTAS PARA REPORTES
-- ============================================================================

-- Vista: Productos con stock disponible
CREATE OR REPLACE VIEW v_products_with_stock AS
SELECT
  p.id,
  p.organization_id,
  p.name,
  p.sale_price,
  p.cost,
  p.barcode,
  p.category,
  p.emoji,
  p.min_stock,
  p.is_service,
  p.is_active,
  sb.branch_id,
  COALESCE(SUM(sb.quantity) FILTER (WHERE sb.status = 'available'), 0)::INTEGER as stock_available
FROM products p
LEFT JOIN stock_batches sb ON p.id = sb.product_id
WHERE p.is_active = true
GROUP BY p.id, sb.branch_id;

-- Vista: Ventas diarias agregadas
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
  s.organization_id,
  s.branch_id,
  DATE(s.created_at) as date,
  s.payment_method,
  COUNT(*)::INTEGER as sale_count,
  SUM(s.total) as total_amount,
  SUM(
    (SELECT COALESCE(SUM((si.unit_price - si.unit_cost) * si.quantity), 0)
     FROM sale_items si WHERE si.sale_id = s.id)
  ) as total_profit
FROM sales s
GROUP BY s.organization_id, s.branch_id, DATE(s.created_at), s.payment_method;

-- Vista: Stock próximo a vencer
CREATE OR REPLACE VIEW v_expiring_stock AS
SELECT
  sb.id,
  sb.organization_id,
  sb.branch_id,
  sb.product_id,
  p.name as product_name,
  p.emoji,
  sb.quantity,
  sb.expiration_date,
  (sb.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiry,
  (sb.quantity * p.sale_price) as value_at_risk
FROM stock_batches sb
JOIN products p ON sb.product_id = p.id
WHERE sb.status = 'available'
  AND sb.expiration_date IS NOT NULL
  AND sb.expiration_date <= CURRENT_DATE + 10
  AND sb.quantity > 0;

-- ============================================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================================

-- Organizations
CREATE INDEX idx_org_owner ON organizations(owner_id);

-- Branches
CREATE INDEX idx_branches_org ON branches(organization_id);
CREATE INDEX idx_branches_qr ON branches(qr_code);

-- Memberships
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org ON memberships(organization_id);
CREATE INDEX idx_memberships_active ON memberships(is_active) WHERE is_active = true;

-- Products
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_active ON products(organization_id, is_active) WHERE is_active = true;

-- Stock Batches
CREATE INDEX idx_stock_org ON stock_batches(organization_id);
CREATE INDEX idx_stock_product ON stock_batches(product_id, branch_id);
CREATE INDEX idx_stock_expiry ON stock_batches(expiration_date) WHERE expiration_date IS NOT NULL;

-- Cash Registers
CREATE INDEX idx_cash_reg_org ON cash_registers(organization_id);
CREATE INDEX idx_cash_reg_branch ON cash_registers(branch_id, date DESC);
CREATE INDEX idx_cash_reg_open ON cash_registers(is_open) WHERE is_open = true;

-- Sales
CREATE INDEX idx_sales_org ON sales(organization_id);
CREATE INDEX idx_sales_branch ON sales(branch_id, created_at DESC);
CREATE INDEX idx_sales_cash_reg ON sales(cash_register_id);
CREATE INDEX idx_sales_local ON sales(organization_id, local_id) WHERE local_id IS NOT NULL;

-- Sale Items
CREATE INDEX idx_items_sale ON sale_items(sale_id);
CREATE INDEX idx_items_product ON sale_items(product_id);

-- Cash Movements
CREATE INDEX idx_movements_cash_reg ON cash_movements(cash_register_id);

-- Attendance
CREATE INDEX idx_attendance_org ON attendance(organization_id);
CREATE INDEX idx_attendance_user ON attendance(user_id);
CREATE INDEX idx_attendance_checkin ON attendance(check_in DESC);

-- Pending Invites
CREATE INDEX idx_invites_token ON pending_invites(token);
CREATE INDEX idx_invites_email ON pending_invites(email);
CREATE INDEX idx_invites_expires ON pending_invites(expires_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para registrar cambios de precio automáticamente
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sale_price != NEW.sale_price OR OLD.cost != NEW.cost THEN
    INSERT INTO price_history (organization_id, product_id, old_price, new_price, old_cost, new_cost, changed_by)
    VALUES (NEW.organization_id, NEW.id, OLD.sale_price, NEW.sale_price, OLD.cost, NEW.cost, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_price_change
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- ============================================================================
-- FUNCIÓN AUXILIAR: Limpiar invitaciones expiradas
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM pending_invites WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_expired_invites() TO service_role;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
  v_table_count INTEGER;
  v_policy_count INTEGER;
  v_function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  SCHEMA COMPLETO CREADO EXITOSAMENTE';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  Tablas creadas: %', v_table_count;
  RAISE NOTICE '  Políticas RLS: %', v_policy_count;
  RAISE NOTICE '  Funciones: %', v_function_count;
  RAISE NOTICE '';
  RAISE NOTICE '  RPCs disponibles:';
  RAISE NOTICE '    - setup_organization(org_name, user_name, email)';
  RAISE NOTICE '    - accept_invite(token, user_name, email)';
  RAISE NOTICE '    - process_sale(branch_id, cash_reg_id, items, method, total, local_id)';
  RAISE NOTICE '';
  RAISE NOTICE '  Vistas disponibles:';
  RAISE NOTICE '    - v_products_with_stock';
  RAISE NOTICE '    - v_daily_sales';
  RAISE NOTICE '    - v_expiring_stock';
  RAISE NOTICE '============================================';
END $$;

COMMIT;
