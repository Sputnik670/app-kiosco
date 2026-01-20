/**
 * Ejecuta SQL de migración usando la API de Supabase
 * Usa fetch directo al endpoint de SQL de Supabase
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extraer project ref del URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

async function executeSql(sql, description) {
  console.log(`\n>>> Ejecutando: ${description}`);

  // Usar el endpoint de Supabase para ejecutar SQL
  // POST https://<project_ref>.supabase.co/rest/v1/rpc/...
  // Pero como no tenemos una función RPC para ejecutar SQL arbitrario,
  // vamos a usar la API de Management (requiere access token diferente)

  // Alternativa: usar pg directamente
  // Por ahora, mostraremos el SQL para ejecutar manualmente
  console.log('SQL a ejecutar:');
  console.log('─'.repeat(60));
  console.log(sql);
  console.log('─'.repeat(60));
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     SQL DE MIGRACION - EJECUTAR EN SUPABASE SQL EDITOR       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nProject: ${projectRef}`);
  console.log(`URL: ${SUPABASE_URL}/project/${projectRef}/sql`);

  // SQL COMPLETO PARA FASE 1 Y 2
  const migrationSQL = `
-- ============================================================================
-- MIGRACION OWNER-FIRST - FASES 1 y 2
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- FASE 1.1: Verificar que la tabla user_organization_roles existe
-- (Ya debería existir según el script anterior)
-- ============================================================================

-- Si no existe, descomentar:
/*
CREATE TABLE IF NOT EXISTS public.user_organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee'
    CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_org UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_uor_user_id ON public.user_organization_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_uor_org_id ON public.user_organization_roles(organization_id);

ALTER TABLE public.user_organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.user_organization_roles
  FOR ALL USING (auth.role() = 'service_role');
*/

-- ============================================================================
-- FASE 1.2: Agregar columna owner_id a organizations
-- ============================================================================

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.organizations.owner_id IS
'ID del usuario que creó esta organización. Inmutable.';

-- ============================================================================
-- FASE 2.1: Poblar owner_id desde perfiles (primer dueño de cada org)
-- ============================================================================

UPDATE public.organizations o
SET owner_id = (
  SELECT p.id
  FROM public.perfiles p
  WHERE p.organization_id = o.id
    AND p.rol = 'dueño'
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE o.owner_id IS NULL;

-- ============================================================================
-- FASE 2.2: Migrar datos de perfiles a user_organization_roles
-- ============================================================================

INSERT INTO public.user_organization_roles (
  user_id,
  organization_id,
  role,
  sucursal_id,
  is_active,
  joined_at,
  created_at,
  updated_at
)
SELECT
  p.id AS user_id,
  p.organization_id,
  CASE p.rol
    WHEN 'dueño' THEN 'owner'
    WHEN 'empleado' THEN 'employee'
    ELSE 'employee'
  END AS role,
  CASE p.rol
    WHEN 'dueño' THEN NULL
    ELSE p.sucursal_id
  END AS sucursal_id,
  COALESCE(p.activo, true) AS is_active,
  p.created_at AS joined_at,
  p.created_at,
  COALESCE(p.updated_at, NOW())
FROM public.perfiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- ============================================================================
-- VERIFICACION: Mostrar resultados
-- ============================================================================

SELECT 'FASE 1.2 - Columna owner_id' AS fase,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'organizations' AND column_name = 'owner_id'
       ) THEN 'OK' ELSE 'FALTA' END AS estado;

SELECT 'FASE 2.1 - Orgs con owner_id' AS fase,
       COUNT(*) FILTER (WHERE owner_id IS NOT NULL)::TEXT || '/' || COUNT(*)::TEXT AS estado
FROM public.organizations;

SELECT 'FASE 2.2 - Roles migrados' AS fase,
       COUNT(*)::TEXT || ' registros' AS estado
FROM public.user_organization_roles;

-- Detalle por organización
SELECT
  o.nombre AS organizacion,
  o.owner_id IS NOT NULL AS tiene_owner_id,
  COUNT(r.id) AS roles_asignados,
  STRING_AGG(DISTINCT r.role, ', ') AS roles
FROM public.organizations o
LEFT JOIN public.user_organization_roles r ON r.organization_id = o.id
GROUP BY o.id, o.nombre, o.owner_id
ORDER BY o.nombre;
`;

  console.log('\n' + '═'.repeat(70));
  console.log('COPIA Y EJECUTA ESTE SQL EN SUPABASE SQL EDITOR:');
  console.log('═'.repeat(70));
  console.log(migrationSQL);
  console.log('═'.repeat(70));
  console.log('\nDespués de ejecutar, corre: node scripts/execute-migration-v2.js');
}

main();
