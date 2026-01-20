-- Migration: Create user_organization_roles table
-- Date: 2026-01-10
-- Description: Part of Owner-First migration - Create roles table

-- ============================================================================
-- TABLA: user_organization_roles
-- ============================================================================
-- Vincula usuarios con organizaciones y define su rol
-- Permite relación N:M entre usuarios y organizaciones

CREATE TABLE IF NOT EXISTS public.user_organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones principales
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Rol del usuario en esta organización
  role TEXT NOT NULL DEFAULT 'employee'
    CHECK (role IN ('owner', 'admin', 'manager', 'employee')),

  -- Sucursal asignada (NULL = acceso a todas)
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,

  -- Estado de la membresía
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata de invitación
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_org UNIQUE (user_id, organization_id)
);

-- ============================================================================
-- INDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_uor_user_id ON public.user_organization_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_uor_org_id ON public.user_organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_uor_sucursal_id ON public.user_organization_roles(sucursal_id)
  WHERE sucursal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uor_role ON public.user_organization_roles(role);
CREATE INDEX IF NOT EXISTS idx_uor_active ON public.user_organization_roles(is_active)
  WHERE is_active = true;

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE public.user_organization_roles ENABLE ROW LEVEL SECURITY;

-- Política para service_role (acceso total)
CREATE POLICY "service_role_all_access" ON public.user_organization_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política para usuarios autenticados (ver sus propios roles)
CREATE POLICY "users_see_own_roles" ON public.user_organization_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política para que owners vean todos los roles de su org
CREATE POLICY "owners_see_org_roles" ON public.user_organization_roles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- ============================================================================
-- TRIGGER para updated_at
-- ============================================================================

CREATE TRIGGER update_user_organization_roles_updated_at
  BEFORE UPDATE ON public.user_organization_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE public.user_organization_roles IS
'Tabla de vinculación usuario-organización con roles.
Modelo Owner-First: permite múltiples organizaciones por usuario.';

COMMENT ON COLUMN public.user_organization_roles.role IS
'owner: Propietario original (full control)
admin: Administrador (casi full access)
manager: Gerente de sucursal
employee: Empleado básico';

COMMENT ON COLUMN public.user_organization_roles.sucursal_id IS
'Sucursal asignada. NULL significa acceso a todas las sucursales.';
