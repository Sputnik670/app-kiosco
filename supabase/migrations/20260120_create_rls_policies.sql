-- ============================================================================
-- MIGRATION: Create Complete RLS Policies for Multitenancy
-- ============================================================================
-- Created: 2026-01-20
-- Purpose: Define secure Row Level Security policies for all tables
-- Security: CRITICAL - Enforces organization_id isolation
--
-- Dependencies:
-- - 20260120_enable_rls_all_tables.sql (must run first)
-- - 20260112_create_v2_functions.sql (get_my_org_id_v2, es_owner_v2)
--
-- Policy Pattern:
-- - SELECT: All authenticated users see their own org data
-- - INSERT: All authenticated users can insert to their org
-- - UPDATE: All authenticated users can update their org data
-- - DELETE: Only owners can delete (except audit tables)
-- - service_role: Bypass all policies (for migrations/admin)
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- PRODUCTOS (Products Catalog)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "productos_select_own_org" ON public.productos;
CREATE POLICY "productos_select_own_org"
  ON public.productos FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "productos_insert_own_org" ON public.productos;
CREATE POLICY "productos_insert_own_org"
  ON public.productos FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "productos_update_own_org" ON public.productos;
CREATE POLICY "productos_update_own_org"
  ON public.productos FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2())
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "productos_delete_owners_only" ON public.productos;
CREATE POLICY "productos_delete_owners_only"
  ON public.productos FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

-- Service role bypass
DROP POLICY IF EXISTS "productos_service_role_bypass" ON public.productos;
CREATE POLICY "productos_service_role_bypass"
  ON public.productos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- STOCK (Inventory per Branch)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "stock_select_own_org" ON public.stock;
CREATE POLICY "stock_select_own_org"
  ON public.stock FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "stock_insert_own_org" ON public.stock;
CREATE POLICY "stock_insert_own_org"
  ON public.stock FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "stock_update_own_org" ON public.stock;
CREATE POLICY "stock_update_own_org"
  ON public.stock FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2())
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "stock_delete_owners_only" ON public.stock;
CREATE POLICY "stock_delete_owners_only"
  ON public.stock FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "stock_service_role_bypass" ON public.stock;
CREATE POLICY "stock_service_role_bypass"
  ON public.stock FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- VENTAS (Sales - IMMUTABLE AUDIT TABLE)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "ventas_select_own_org" ON public.ventas;
CREATE POLICY "ventas_select_own_org"
  ON public.ventas FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "ventas_insert_own_org" ON public.ventas;
CREATE POLICY "ventas_insert_own_org"
  ON public.ventas FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

-- CRITICAL: Ventas are IMMUTABLE for audit compliance
DROP POLICY IF EXISTS "ventas_no_update" ON public.ventas;
CREATE POLICY "ventas_no_update"
  ON public.ventas FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "ventas_no_delete" ON public.ventas;
CREATE POLICY "ventas_no_delete"
  ON public.ventas FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "ventas_service_role_bypass" ON public.ventas;
CREATE POLICY "ventas_service_role_bypass"
  ON public.ventas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- DETALLES_VENTA (Sales Line Items - IMMUTABLE AUDIT TABLE)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "detalles_venta_select_own_org" ON public.detalles_venta;
CREATE POLICY "detalles_venta_select_own_org"
  ON public.detalles_venta FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "detalles_venta_insert_own_org" ON public.detalles_venta;
CREATE POLICY "detalles_venta_insert_own_org"
  ON public.detalles_venta FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "detalles_venta_no_update" ON public.detalles_venta;
CREATE POLICY "detalles_venta_no_update"
  ON public.detalles_venta FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "detalles_venta_no_delete" ON public.detalles_venta;
CREATE POLICY "detalles_venta_no_delete"
  ON public.detalles_venta FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "detalles_venta_service_role_bypass" ON public.detalles_venta;
CREATE POLICY "detalles_venta_service_role_bypass"
  ON public.detalles_venta FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- MOVIMIENTOS (Stock Movements - IMMUTABLE AUDIT TABLE)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "movimientos_select_own_org" ON public.movimientos;
CREATE POLICY "movimientos_select_own_org"
  ON public.movimientos FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "movimientos_insert_own_org" ON public.movimientos;
CREATE POLICY "movimientos_insert_own_org"
  ON public.movimientos FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

-- CRITICAL: Movimientos are IMMUTABLE for audit
DROP POLICY IF EXISTS "movimientos_no_update" ON public.movimientos;
CREATE POLICY "movimientos_no_update"
  ON public.movimientos FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "movimientos_no_delete" ON public.movimientos;
CREATE POLICY "movimientos_no_delete"
  ON public.movimientos FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "movimientos_service_role_bypass" ON public.movimientos;
CREATE POLICY "movimientos_service_role_bypass"
  ON public.movimientos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- HISTORIAL_PRECIOS (Price History - IMMUTABLE AUDIT TABLE)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "historial_precios_select_own_org" ON public.historial_precios;
CREATE POLICY "historial_precios_select_own_org"
  ON public.historial_precios FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "historial_precios_insert_own_org" ON public.historial_precios;
CREATE POLICY "historial_precios_insert_own_org"
  ON public.historial_precios FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "historial_precios_no_update" ON public.historial_precios;
CREATE POLICY "historial_precios_no_update"
  ON public.historial_precios FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "historial_precios_no_delete" ON public.historial_precios;
CREATE POLICY "historial_precios_no_delete"
  ON public.historial_precios FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "historial_precios_service_role_bypass" ON public.historial_precios;
CREATE POLICY "historial_precios_service_role_bypass"
  ON public.historial_precios FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- SUCURSALES (Branches - OWNERS ONLY CAN MODIFY)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "sucursales_select_own_org" ON public.sucursales;
CREATE POLICY "sucursales_select_own_org"
  ON public.sucursales FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "sucursales_insert_owners_only" ON public.sucursales;
CREATE POLICY "sucursales_insert_owners_only"
  ON public.sucursales FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "sucursales_update_owners_only" ON public.sucursales;
CREATE POLICY "sucursales_update_owners_only"
  ON public.sucursales FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  )
  WITH CHECK (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "sucursales_delete_owners_only" ON public.sucursales;
CREATE POLICY "sucursales_delete_owners_only"
  ON public.sucursales FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "sucursales_service_role_bypass" ON public.sucursales;
CREATE POLICY "sucursales_service_role_bypass"
  ON public.sucursales FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- ASISTENCIA (Employee Attendance - GDPR Protected)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "asistencia_select_own_org" ON public.asistencia;
CREATE POLICY "asistencia_select_own_org"
  ON public.asistencia FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "asistencia_insert_own_org" ON public.asistencia;
CREATE POLICY "asistencia_insert_own_org"
  ON public.asistencia FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "asistencia_update_own_org" ON public.asistencia;
CREATE POLICY "asistencia_update_own_org"
  ON public.asistencia FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2())
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "asistencia_delete_owners_only" ON public.asistencia;
CREATE POLICY "asistencia_delete_owners_only"
  ON public.asistencia FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "asistencia_service_role_bypass" ON public.asistencia;
CREATE POLICY "asistencia_service_role_bypass"
  ON public.asistencia FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- PROVEEDORES (Suppliers)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "proveedores_select_own_org" ON public.proveedores;
CREATE POLICY "proveedores_select_own_org"
  ON public.proveedores FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "proveedores_insert_own_org" ON public.proveedores;
CREATE POLICY "proveedores_insert_own_org"
  ON public.proveedores FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "proveedores_update_own_org" ON public.proveedores;
CREATE POLICY "proveedores_update_own_org"
  ON public.proveedores FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2())
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "proveedores_delete_owners_only" ON public.proveedores;
CREATE POLICY "proveedores_delete_owners_only"
  ON public.proveedores FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "proveedores_service_role_bypass" ON public.proveedores;
CREATE POLICY "proveedores_service_role_bypass"
  ON public.proveedores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- COMPRAS (Purchase Orders)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "compras_select_own_org" ON public.compras;
CREATE POLICY "compras_select_own_org"
  ON public.compras FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "compras_insert_own_org" ON public.compras;
CREATE POLICY "compras_insert_own_org"
  ON public.compras FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "compras_update_own_org" ON public.compras;
CREATE POLICY "compras_update_own_org"
  ON public.compras FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2())
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "compras_delete_owners_only" ON public.compras;
CREATE POLICY "compras_delete_owners_only"
  ON public.compras FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "compras_service_role_bypass" ON public.compras;
CREATE POLICY "compras_service_role_bypass"
  ON public.compras FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- CAJA_DIARIA (Daily Cash Register - IMMUTABLE AUDIT TABLE)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "caja_diaria_select_own_org" ON public.caja_diaria;
CREATE POLICY "caja_diaria_select_own_org"
  ON public.caja_diaria FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "caja_diaria_insert_own_org" ON public.caja_diaria;
CREATE POLICY "caja_diaria_insert_own_org"
  ON public.caja_diaria FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "caja_diaria_update_own_org" ON public.caja_diaria;
CREATE POLICY "caja_diaria_update_own_org"
  ON public.caja_diaria FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2())
  WITH CHECK (organization_id = public.get_my_org_id_v2());

-- CRITICAL: Cannot delete cash register records (audit)
DROP POLICY IF EXISTS "caja_diaria_no_delete" ON public.caja_diaria;
CREATE POLICY "caja_diaria_no_delete"
  ON public.caja_diaria FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "caja_diaria_service_role_bypass" ON public.caja_diaria;
CREATE POLICY "caja_diaria_service_role_bypass"
  ON public.caja_diaria FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- MOVIMIENTOS_CAJA (Cash Movements - IMMUTABLE AUDIT TABLE)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "movimientos_caja_select_own_org" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_select_own_org"
  ON public.movimientos_caja FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "movimientos_caja_insert_own_org" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_insert_own_org"
  ON public.movimientos_caja FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

-- CRITICAL: Cash movements are IMMUTABLE
DROP POLICY IF EXISTS "movimientos_caja_no_update" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_no_update"
  ON public.movimientos_caja FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "movimientos_caja_no_delete" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_no_delete"
  ON public.movimientos_caja FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "movimientos_caja_service_role_bypass" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_service_role_bypass"
  ON public.movimientos_caja FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- MISIONES (Employee Missions/Tasks)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "misiones_select_own_org" ON public.misiones;
CREATE POLICY "misiones_select_own_org"
  ON public.misiones FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "misiones_insert_own_org" ON public.misiones;
CREATE POLICY "misiones_insert_own_org"
  ON public.misiones FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "misiones_update_own_org" ON public.misiones;
CREATE POLICY "misiones_update_own_org"
  ON public.misiones FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2())
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "misiones_delete_owners_only" ON public.misiones;
CREATE POLICY "misiones_delete_owners_only"
  ON public.misiones FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_my_org_id_v2()
    AND public.es_owner_v2()
  );

DROP POLICY IF EXISTS "misiones_service_role_bypass" ON public.misiones;
CREATE POLICY "misiones_service_role_bypass"
  ON public.misiones FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- MOVIMIENTOS_MISIONES (Mission History - IMMUTABLE AUDIT TABLE)
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "movimientos_misiones_select_own_org" ON public.movimientos_misiones;
CREATE POLICY "movimientos_misiones_select_own_org"
  ON public.movimientos_misiones FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "movimientos_misiones_insert_own_org" ON public.movimientos_misiones;
CREATE POLICY "movimientos_misiones_insert_own_org"
  ON public.movimientos_misiones FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id_v2());

DROP POLICY IF EXISTS "movimientos_misiones_no_update" ON public.movimientos_misiones;
CREATE POLICY "movimientos_misiones_no_update"
  ON public.movimientos_misiones FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "movimientos_misiones_no_delete" ON public.movimientos_misiones;
CREATE POLICY "movimientos_misiones_no_delete"
  ON public.movimientos_misiones FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "movimientos_misiones_service_role_bypass" ON public.movimientos_misiones;
CREATE POLICY "movimientos_misiones_service_role_bypass"
  ON public.movimientos_misiones FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- PERFILES (User Profiles - Legacy Table)
-- ══════════════════════════════════════════════════════════════════════════

-- Users can only see/edit their own profile
DROP POLICY IF EXISTS "perfiles_select_own" ON public.perfiles;
CREATE POLICY "perfiles_select_own"
  ON public.perfiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "perfiles_insert_own" ON public.perfiles;
CREATE POLICY "perfiles_insert_own"
  ON public.perfiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "perfiles_update_own" ON public.perfiles;
CREATE POLICY "perfiles_update_own"
  ON public.perfiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Cannot delete own profile
DROP POLICY IF EXISTS "perfiles_no_delete" ON public.perfiles;
CREATE POLICY "perfiles_no_delete"
  ON public.perfiles FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "perfiles_service_role_bypass" ON public.perfiles;
CREATE POLICY "perfiles_service_role_bypass"
  ON public.perfiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- USER_ORGANIZATION_ROLES (V2 Authorization - CRITICAL)
-- ══════════════════════════════════════════════════════════════════════════

-- Users see their own roles
DROP POLICY IF EXISTS "user_organization_roles_select_own" ON public.user_organization_roles;
CREATE POLICY "user_organization_roles_select_own"
  ON public.user_organization_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owners see all roles in their org
DROP POLICY IF EXISTS "user_organization_roles_owners_see_org" ON public.user_organization_roles;
CREATE POLICY "user_organization_roles_owners_see_org"
  ON public.user_organization_roles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Only owners can assign roles
DROP POLICY IF EXISTS "user_organization_roles_owners_insert" ON public.user_organization_roles;
CREATE POLICY "user_organization_roles_owners_insert"
  ON public.user_organization_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Only owners can update roles
DROP POLICY IF EXISTS "user_organization_roles_owners_update" ON public.user_organization_roles;
CREATE POLICY "user_organization_roles_owners_update"
  ON public.user_organization_roles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Cannot delete roles (only deactivate via is_active=false)
DROP POLICY IF EXISTS "user_organization_roles_no_delete" ON public.user_organization_roles;
CREATE POLICY "user_organization_roles_no_delete"
  ON public.user_organization_roles FOR DELETE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "user_organization_roles_service_role_bypass" ON public.user_organization_roles;
CREATE POLICY "user_organization_roles_service_role_bypass"
  ON public.user_organization_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- PENDING_INVITES (Employee Invitations)
-- ══════════════════════════════════════════════════════════════════════════

-- Only owners see invites from their org
DROP POLICY IF EXISTS "pending_invites_owners_see_org" ON public.pending_invites;
CREATE POLICY "pending_invites_owners_see_org"
  ON public.pending_invites FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Only owners can create invites
DROP POLICY IF EXISTS "pending_invites_owners_insert" ON public.pending_invites;
CREATE POLICY "pending_invites_owners_insert"
  ON public.pending_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Owners can update invite status
DROP POLICY IF EXISTS "pending_invites_owners_update" ON public.pending_invites;
CREATE POLICY "pending_invites_owners_update"
  ON public.pending_invites FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Owners can delete invites
DROP POLICY IF EXISTS "pending_invites_owners_delete" ON public.pending_invites;
CREATE POLICY "pending_invites_owners_delete"
  ON public.pending_invites FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "pending_invites_service_role_bypass" ON public.pending_invites;
CREATE POLICY "pending_invites_service_role_bypass"
  ON public.pending_invites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- ALERTAS_VENCIMIENTOS (Expiry Alerts - if table exists)
-- ══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'alertas_vencimientos') THEN
    DROP POLICY IF EXISTS "alertas_vencimientos_select_own_org" ON public.alertas_vencimientos;
    CREATE POLICY "alertas_vencimientos_select_own_org"
      ON public.alertas_vencimientos FOR SELECT
      TO authenticated
      USING (organization_id = public.get_my_org_id_v2());

    DROP POLICY IF EXISTS "alertas_vencimientos_insert_own_org" ON public.alertas_vencimientos;
    CREATE POLICY "alertas_vencimientos_insert_own_org"
      ON public.alertas_vencimientos FOR INSERT
      TO authenticated
      WITH CHECK (organization_id = public.get_my_org_id_v2());

    DROP POLICY IF EXISTS "alertas_vencimientos_update_own_org" ON public.alertas_vencimientos;
    CREATE POLICY "alertas_vencimientos_update_own_org"
      ON public.alertas_vencimientos FOR UPDATE
      TO authenticated
      USING (organization_id = public.get_my_org_id_v2());

    DROP POLICY IF EXISTS "alertas_vencimientos_delete_owners_only" ON public.alertas_vencimientos;
    CREATE POLICY "alertas_vencimientos_delete_owners_only"
      ON public.alertas_vencimientos FOR DELETE
      TO authenticated
      USING (organization_id = public.get_my_org_id_v2() AND public.es_owner_v2());

    DROP POLICY IF EXISTS "alertas_vencimientos_service_role_bypass" ON public.alertas_vencimientos;
    CREATE POLICY "alertas_vencimientos_service_role_bypass"
      ON public.alertas_vencimientos FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);

    RAISE NOTICE '✅ Policies created for alertas_vencimientos';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check that all tables have policies
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tables_without_policies TEXT[];
BEGIN
  SELECT ARRAY_AGG(t.tablename)
  INTO tables_without_policies
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'productos', 'stock', 'ventas', 'detalles_venta', 'movimientos',
      'sucursales', 'asistencia', 'proveedores', 'caja_diaria',
      'movimientos_caja', 'compras', 'perfiles', 'user_organization_roles',
      'pending_invites', 'historial_precios', 'misiones', 'movimientos_misiones'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.tablename = t.tablename
    );

  IF array_length(tables_without_policies, 1) > 0 THEN
    RAISE WARNING 'The following tables have NO POLICIES: %', tables_without_policies;
    RAISE EXCEPTION 'Migration failed: Not all tables have RLS policies';
  ELSE
    RAISE NOTICE '✅ SUCCESS: All critical tables have RLS policies configured';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these queries manually to verify policies are working:
--
-- 1. Count policies per table:
--    SELECT tablename, COUNT(*) as num_policies,
--           string_agg(policyname, ', ') as policy_names
--    FROM pg_policies
--    WHERE tablename IN ('productos', 'stock', 'ventas', ...)
--    GROUP BY tablename
--    ORDER BY tablename;
--
-- 2. Test isolation (as authenticated user):
--    SELECT COUNT(*) FROM productos
--    WHERE organization_id != public.get_my_org_id_v2();
--    -- Should return 0 rows
--
-- 3. Verify service_role bypass:
--    SELECT * FROM productos LIMIT 1; -- As service_role should work
-- ============================================================================
