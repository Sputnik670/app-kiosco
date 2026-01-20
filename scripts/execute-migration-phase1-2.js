/**
 * EJECUTOR DE MIGRACION OWNER-FIRST - FASES 1 y 2
 *
 * Este script ejecuta las fases de preparación y migración de datos
 * de manera controlada y con validación en cada paso.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.cyan}[INFO]${colors.reset}`,
    success: `${colors.green}[OK]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    step: `${colors.bold}${colors.cyan}[STEP]${colors.reset}`
  };
  console.log(`${prefix[type]} ${message}`);
}

async function executeSQL(sql, description) {
  log(`Ejecutando: ${description}`, 'step');

  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    // Si exec_sql no existe, intentamos via REST directo
    if (error.message.includes('function') || error.code === 'PGRST202') {
      log('RPC exec_sql no disponible, ejecutando via query directo...', 'warn');
      return { success: false, needsManual: true };
    }
    log(`Error: ${error.message}`, 'error');
    return { success: false, error };
  }

  log(`Completado: ${description}`, 'success');
  return { success: true, data };
}

async function checkTableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  return !error || error.code !== 'PGRST116';
}

async function checkColumnExists(tableName, columnName) {
  const { data, error } = await supabase
    .from(tableName)
    .select(columnName)
    .limit(1);

  return !error;
}

// ============================================================================
// FASE 1: CREAR ESTRUCTURA
// ============================================================================

async function phase1_createUserOrgRolesTable() {
  log('='.repeat(60), 'info');
  log('FASE 1.1: Crear tabla user_organization_roles', 'step');
  log('='.repeat(60), 'info');

  // Verificar si ya existe
  const exists = await checkTableExists('user_organization_roles');
  if (exists) {
    log('Tabla user_organization_roles ya existe', 'warn');

    // Verificar estructura
    const { data, error } = await supabase
      .from('user_organization_roles')
      .select('*')
      .limit(0);

    if (!error) {
      log('Estructura verificada correctamente', 'success');
      return true;
    }
  }

  // La tabla no existe, necesitamos crearla via SQL Editor
  log('La tabla debe crearse via SQL Editor de Supabase', 'warn');
  console.log('\n' + colors.yellow + 'Ejecuta este SQL en Supabase Dashboard > SQL Editor:' + colors.reset);
  console.log(`
-- ============================================================================
-- FASE 1.1: CREAR TABLA user_organization_roles
-- ============================================================================

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

-- Indices
CREATE INDEX IF NOT EXISTS idx_uor_user_id ON public.user_organization_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_uor_org_id ON public.user_organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_uor_sucursal_id ON public.user_organization_roles(sucursal_id) WHERE sucursal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uor_role ON public.user_organization_roles(role);
CREATE INDEX IF NOT EXISTS idx_uor_active ON public.user_organization_roles(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.user_organization_roles ENABLE ROW LEVEL SECURITY;

-- Politicas RLS
CREATE POLICY "users_see_own_roles" ON public.user_organization_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "service_role_all" ON public.user_organization_roles
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger updated_at
CREATE TRIGGER update_user_organization_roles_updated_at
  BEFORE UPDATE ON public.user_organization_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

SELECT 'Tabla user_organization_roles creada' AS resultado;
  `);

  return false;
}

async function phase1_addOwnerIdColumn() {
  log('='.repeat(60), 'info');
  log('FASE 1.2: Agregar columna owner_id a organizations', 'step');
  log('='.repeat(60), 'info');

  // Verificar si ya existe
  const exists = await checkColumnExists('organizations', 'owner_id');
  if (exists) {
    log('Columna owner_id ya existe en organizations', 'success');
    return true;
  }

  log('La columna debe agregarse via SQL Editor de Supabase', 'warn');
  console.log('\n' + colors.yellow + 'Ejecuta este SQL en Supabase Dashboard > SQL Editor:' + colors.reset);
  console.log(`
-- ============================================================================
-- FASE 1.2: AGREGAR COLUMNA owner_id A organizations
-- ============================================================================

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.organizations.owner_id IS
'ID del usuario que creo esta organizacion. Inmutable.';

SELECT 'Columna owner_id agregada' AS resultado;
  `);

  return false;
}

// ============================================================================
// FASE 2: MIGRAR DATOS
// ============================================================================

async function phase2_populateOwnerId() {
  log('='.repeat(60), 'info');
  log('FASE 2.1: Poblar owner_id en organizations', 'step');
  log('='.repeat(60), 'info');

  // Obtener organizaciones sin owner_id
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, nombre, owner_id')
    .is('owner_id', null);

  if (orgsError) {
    log(`Error obteniendo organizaciones: ${orgsError.message}`, 'error');
    return false;
  }

  if (!orgs || orgs.length === 0) {
    log('Todas las organizaciones ya tienen owner_id', 'success');
    return true;
  }

  log(`Encontradas ${orgs.length} organizaciones sin owner_id`, 'info');

  let updated = 0;
  let failed = 0;

  for (const org of orgs) {
    // Buscar el primer dueño de esta organización
    const { data: owner, error: ownerError } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .eq('organization_id', org.id)
      .eq('rol', 'dueño')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (ownerError || !owner) {
      log(`  Org "${org.nombre}" (${org.id}): No se encontró dueño`, 'warn');
      failed++;
      continue;
    }

    // Actualizar owner_id
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ owner_id: owner.id })
      .eq('id', org.id);

    if (updateError) {
      log(`  Org "${org.nombre}": Error actualizando - ${updateError.message}`, 'error');
      failed++;
    } else {
      log(`  Org "${org.nombre}": owner_id = ${owner.nombre} (${owner.id})`, 'success');
      updated++;
    }
  }

  log(`Resultado: ${updated} actualizadas, ${failed} fallidas`, updated > 0 ? 'success' : 'warn');
  return failed === 0;
}

async function phase2_migrateToUserOrgRoles() {
  log('='.repeat(60), 'info');
  log('FASE 2.2: Migrar datos de perfiles a user_organization_roles', 'step');
  log('='.repeat(60), 'info');

  // Verificar que la tabla destino existe
  const tableExists = await checkTableExists('user_organization_roles');
  if (!tableExists) {
    log('Tabla user_organization_roles no existe. Ejecuta Fase 1.1 primero.', 'error');
    return false;
  }

  // Obtener todos los perfiles con organization_id
  const { data: perfiles, error: perfilesError } = await supabase
    .from('perfiles')
    .select('id, organization_id, sucursal_id, rol, nombre, activo, created_at, updated_at')
    .not('organization_id', 'is', null);

  if (perfilesError) {
    log(`Error obteniendo perfiles: ${perfilesError.message}`, 'error');
    return false;
  }

  if (!perfiles || perfiles.length === 0) {
    log('No hay perfiles para migrar', 'warn');
    return true;
  }

  log(`Encontrados ${perfiles.length} perfiles para migrar`, 'info');

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const perfil of perfiles) {
    // Verificar si ya existe en user_organization_roles
    const { data: existing } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('user_id', perfil.id)
      .eq('organization_id', perfil.organization_id)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Mapear rol
    const newRole = perfil.rol === 'dueño' ? 'owner' : 'employee';

    // Determinar sucursal_id (dueños no necesitan, empleados sí)
    const sucursalId = newRole === 'owner' ? null : perfil.sucursal_id;

    // Insertar en nueva tabla
    const { error: insertError } = await supabase
      .from('user_organization_roles')
      .insert({
        user_id: perfil.id,
        organization_id: perfil.organization_id,
        role: newRole,
        sucursal_id: sucursalId,
        is_active: perfil.activo !== false,
        joined_at: perfil.created_at,
        created_at: perfil.created_at,
        updated_at: perfil.updated_at
      });

    if (insertError) {
      log(`  Usuario ${perfil.nombre} (${perfil.id}): Error - ${insertError.message}`, 'error');
      failed++;
    } else {
      log(`  Usuario ${perfil.nombre}: ${perfil.rol} -> ${newRole}`, 'success');
      migrated++;
    }
  }

  log(`Resultado: ${migrated} migrados, ${skipped} ya existían, ${failed} fallidos`, 'info');
  return failed === 0;
}

// ============================================================================
// VERIFICACION
// ============================================================================

async function validateMigration() {
  log('='.repeat(60), 'info');
  log('VERIFICACION: Validando migración Owner-First', 'step');
  log('='.repeat(60), 'info');

  const results = [];

  // Check 1: Todas las orgs tienen owner_id
  const { data: orgsWithoutOwner } = await supabase
    .from('organizations')
    .select('id, nombre')
    .is('owner_id', null);

  const check1Pass = !orgsWithoutOwner || orgsWithoutOwner.length === 0;
  results.push({
    check: 'organizations_have_owner',
    status: check1Pass ? 'PASS' : 'FAIL',
    details: check1Pass ? 'Todas las orgs tienen owner_id' : `${orgsWithoutOwner?.length} orgs sin owner`
  });

  // Check 2: Todos los perfiles migraron
  const { data: perfilesCount } = await supabase
    .from('perfiles')
    .select('id', { count: 'exact' })
    .not('organization_id', 'is', null);

  const { data: rolesCount } = await supabase
    .from('user_organization_roles')
    .select('id', { count: 'exact' });

  const perfilesTotal = perfilesCount?.length || 0;
  const rolesTotal = rolesCount?.length || 0;
  const check2Pass = rolesTotal >= perfilesTotal;
  results.push({
    check: 'perfiles_migrated',
    status: check2Pass ? 'PASS' : 'FAIL',
    details: `Perfiles: ${perfilesTotal}, Roles: ${rolesTotal}`
  });

  // Check 3: Cada org tiene al menos un owner role
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id');

  let orgsWithoutOwnerRole = 0;
  for (const org of (orgs || [])) {
    const { data: ownerRole } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('organization_id', org.id)
      .eq('role', 'owner')
      .limit(1)
      .single();

    if (!ownerRole) orgsWithoutOwnerRole++;
  }

  const check3Pass = orgsWithoutOwnerRole === 0;
  results.push({
    check: 'orgs_have_owner_role',
    status: check3Pass ? 'PASS' : 'FAIL',
    details: check3Pass ? 'Todas las orgs tienen owner role' : `${orgsWithoutOwnerRole} orgs sin owner role`
  });

  // Check 4: Consistencia owner_id vs role owner
  let inconsistencies = 0;
  const { data: orgsWithOwner } = await supabase
    .from('organizations')
    .select('id, owner_id')
    .not('owner_id', 'is', null);

  for (const org of (orgsWithOwner || [])) {
    const { data: ownerRole } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', org.owner_id)
      .eq('role', 'owner')
      .single();

    if (!ownerRole) inconsistencies++;
  }

  const check4Pass = inconsistencies === 0;
  results.push({
    check: 'owner_id_matches_owner_role',
    status: check4Pass ? 'PASS' : 'FAIL',
    details: check4Pass ? 'owner_id coincide con owner role' : `${inconsistencies} inconsistencias`
  });

  // Mostrar resultados
  console.log('\n' + colors.bold + '┌────────────────────────────────────┬────────┬─────────────────────────────────┐' + colors.reset);
  console.log(colors.bold + '│ CHECK                              │ STATUS │ DETAILS                         │' + colors.reset);
  console.log(colors.bold + '├────────────────────────────────────┼────────┼─────────────────────────────────┤' + colors.reset);

  for (const r of results) {
    const statusColor = r.status === 'PASS' ? colors.green : colors.red;
    const checkPadded = r.check.padEnd(34);
    const statusPadded = r.status.padEnd(6);
    const detailsPadded = r.details.substring(0, 31).padEnd(31);
    console.log(`│ ${checkPadded} │ ${statusColor}${statusPadded}${colors.reset} │ ${detailsPadded} │`);
  }

  console.log(colors.bold + '└────────────────────────────────────┴────────┴─────────────────────────────────┘' + colors.reset);

  const allPass = results.every(r => r.status === 'PASS');
  console.log('\n' + (allPass
    ? colors.green + colors.bold + '✓ MIGRACION VALIDADA EXITOSAMENTE' + colors.reset
    : colors.red + colors.bold + '✗ MIGRACION CON ERRORES - REVISAR' + colors.reset));

  return allPass;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + colors.bold + colors.cyan);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     MIGRACION OWNER-FIRST - FASES 1 y 2                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  // Verificar conexión
  const { data: testData, error: testError } = await supabase
    .from('organizations')
    .select('id')
    .limit(1);

  if (testError) {
    log(`Error de conexión: ${testError.message}`, 'error');
    process.exit(1);
  }
  log('Conexión a Supabase establecida', 'success');

  // FASE 1.1
  const phase1_1 = await phase1_createUserOrgRolesTable();
  if (!phase1_1) {
    log('\nEjecuta el SQL mostrado arriba en Supabase SQL Editor y vuelve a correr el script.', 'warn');
    process.exit(0);
  }

  // FASE 1.2
  const phase1_2 = await phase1_addOwnerIdColumn();
  if (!phase1_2) {
    log('\nEjecuta el SQL mostrado arriba en Supabase SQL Editor y vuelve a correr el script.', 'warn');
    process.exit(0);
  }

  // FASE 2.1
  const phase2_1 = await phase2_populateOwnerId();

  // FASE 2.2
  const phase2_2 = await phase2_migrateToUserOrgRoles();

  // VERIFICACION
  const valid = await validateMigration();

  console.log('\n' + colors.bold + colors.cyan);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMEN DE EJECUCION                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  console.log(`  Fase 1.1 (Crear tabla):     ${phase1_1 ? colors.green + 'OK' : colors.yellow + 'PENDIENTE'}${colors.reset}`);
  console.log(`  Fase 1.2 (Agregar owner_id): ${phase1_2 ? colors.green + 'OK' : colors.yellow + 'PENDIENTE'}${colors.reset}`);
  console.log(`  Fase 2.1 (Poblar owner_id):  ${phase2_1 ? colors.green + 'OK' : colors.red + 'ERROR'}${colors.reset}`);
  console.log(`  Fase 2.2 (Migrar roles):     ${phase2_2 ? colors.green + 'OK' : colors.red + 'ERROR'}${colors.reset}`);
  console.log(`  Validación:                  ${valid ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
}

main().catch(console.error);
