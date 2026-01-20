-- ============================================================================
-- Migration: Create Missing Tables (pending_invites)
-- ============================================================================
-- Created: 2026-01-21
-- Purpose: Create tables that were missing for invite_employee_v2 functionality
--
-- Dependencies:
-- - 20260110_add_owner_id.sql (organizations table must exist)
-- - 20260111_create_user_org_roles.sql (user_organization_roles must exist)
--
-- Tables Created:
-- - pending_invites: Stores pending employee invitations
-- ============================================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- PENDING_INVITES (Employee Invitations)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_pending_invites_token
ON public.pending_invites(token);

CREATE INDEX IF NOT EXISTS idx_pending_invites_email
ON public.pending_invites(email);

CREATE INDEX IF NOT EXISTS idx_pending_invites_org
ON public.pending_invites(organization_id);

CREATE INDEX IF NOT EXISTS idx_pending_invites_expires
ON public.pending_invites(expires_at)
WHERE expires_at > NOW();

COMMENT ON TABLE public.pending_invites IS
'Invitaciones pendientes para empleados. Token expira en 7 días.';

COMMENT ON COLUMN public.pending_invites.token IS
'Token único de 64 caracteres generado con gen_random_bytes(32)';

COMMENT ON COLUMN public.pending_invites.expires_at IS
'Fecha de expiración de la invitación (típicamente created_at + 7 días)';

-- ══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES FOR PENDING_INVITES
-- ══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- SELECT: Owners ven todas las invitaciones de su org
DROP POLICY IF EXISTS "pending_invites_select_own_org" ON public.pending_invites;
CREATE POLICY "pending_invites_select_own_org"
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

-- INSERT: Solo owners pueden crear invitaciones
DROP POLICY IF EXISTS "pending_invites_insert_owners_only" ON public.pending_invites;
CREATE POLICY "pending_invites_insert_owners_only"
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

-- UPDATE: No se permiten actualizaciones (solo INSERT y DELETE)
DROP POLICY IF EXISTS "pending_invites_no_update" ON public.pending_invites;
CREATE POLICY "pending_invites_no_update"
  ON public.pending_invites FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: Owners pueden eliminar invitaciones o sistema al aceptarlas
DROP POLICY IF EXISTS "pending_invites_delete_owners_or_system" ON public.pending_invites;
CREATE POLICY "pending_invites_delete_owners_or_system"
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

-- Service role bypass (para complete_employee_setup_v2)
DROP POLICY IF EXISTS "pending_invites_service_role_bypass" ON public.pending_invites;
CREATE POLICY "pending_invites_service_role_bypass"
  ON public.pending_invites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════
-- CLEANUP EXPIRED INVITES (Optional Background Job)
-- ══════════════════════════════════════════════════════════════════════════

-- Función para limpiar invitaciones expiradas
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.pending_invites
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_invites() IS
'Elimina invitaciones expiradas.
Ejecutar periódicamente mediante cron job de Supabase.
Ejemplo: SELECT cron.schedule(''cleanup-invites'', ''0 2 * * *'', $$SELECT cleanup_expired_invites()$$);';

GRANT EXECUTE ON FUNCTION public.cleanup_expired_invites() TO service_role;

-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '✓ Tabla pending_invites creada con éxito';
  RAISE NOTICE '✓ RLS habilitado en pending_invites';
  RAISE NOTICE '✓ 5 políticas RLS creadas';
  RAISE NOTICE '✓ 4 índices creados';
  RAISE NOTICE '✓ Función cleanup_expired_invites creada';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Próximos pasos:';
  RAISE NOTICE '  1. Ejecutar migración 20260120_enable_rls_all_tables.sql';
  RAISE NOTICE '  2. Ejecutar migración 20260120_create_rls_policies.sql';
  RAISE NOTICE '  3. Ejecutar migración 20260120_add_org_validation_rpcs.sql';
END $$;

COMMIT;
