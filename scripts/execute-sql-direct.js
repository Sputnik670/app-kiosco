/**
 * Ejecuta SQL directamente contra Supabase usando postgres connection string
 * o via la API de administración
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

async function log(msg, type = 'info') {
  const icons = {
    info: colors.cyan + '[i]' + colors.reset,
    success: colors.green + '[✓]' + colors.reset,
    error: colors.red + '[✗]' + colors.reset,
    warn: colors.yellow + '[!]' + colors.reset,
    step: colors.bold + '>>>' + colors.reset
  };
  console.log(`${icons[type]} ${msg}`);
}

// ============================================================================
// FASE 1.2: Agregar owner_id usando un workaround
// Supabase no permite ALTER TABLE via REST, pero podemos verificar y guiar
// ============================================================================

async function checkAndReportOwnerIdStatus() {
  log('Verificando columna owner_id en organizations...', 'step');

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (error) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    log(`Columnas actuales: ${columns.join(', ')}`, 'info');

    if (columns.includes('owner_id')) {
      log('Columna owner_id existe', 'success');
      return true;
    }
  }

  log('Columna owner_id NO existe', 'warn');
  return false;
}

// ============================================================================
// FASE 2.1: Poblar owner_id desde perfiles
// ============================================================================

async function populateOwnerId() {
  log('FASE 2.1: Poblando owner_id en organizations...', 'step');

  // Verificar si la columna existe primero
  const hasColumn = await checkAndReportOwnerIdStatus();
  if (!hasColumn) {
    log('No se puede poblar owner_id - columna no existe', 'error');
    console.log('\n' + colors.yellow + 'Ejecuta este SQL en Supabase Dashboard:' + colors.reset);
    console.log(`
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
    `);
    return false;
  }

  // Obtener organizaciones sin owner_id
  const { data: orgsWithoutOwner, error: fetchError } = await supabase
    .from('organizations')
    .select('id, nombre, owner_id')
    .is('owner_id', null);

  if (fetchError) {
    log(`Error obteniendo orgs: ${fetchError.message}`, 'error');
    return false;
  }

  if (!orgsWithoutOwner || orgsWithoutOwner.length === 0) {
    log('Todas las organizaciones ya tienen owner_id', 'success');
    return true;
  }

  log(`Organizaciones sin owner: ${orgsWithoutOwner.length}`, 'info');

  let updated = 0;
  for (const org of orgsWithoutOwner) {
    // Buscar el primer dueño
    const { data: owner } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .eq('organization_id', org.id)
      .eq('rol', 'dueño')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!owner) {
      log(`  "${org.nombre}": sin dueño encontrado`, 'warn');
      continue;
    }

    // Actualizar
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ owner_id: owner.id })
      .eq('id', org.id);

    if (updateError) {
      log(`  "${org.nombre}": error - ${updateError.message}`, 'error');
    } else {
      log(`  "${org.nombre}" -> ${owner.nombre}`, 'success');
      updated++;
    }
  }

  log(`Resultado: ${updated}/${orgsWithoutOwner.length} actualizados`, 'info');
  return true;
}

// ============================================================================
// FASE 2.2: Migrar perfiles a user_organization_roles
// ============================================================================

async function migrateRoles() {
  log('FASE 2.2: Migrando perfiles a user_organization_roles...', 'step');

  // Verificar que la tabla existe
  const { error: tableCheck } = await supabase
    .from('user_organization_roles')
    .select('id')
    .limit(1);

  if (tableCheck && tableCheck.message?.includes('does not exist')) {
    log('Tabla user_organization_roles no existe', 'error');
    return false;
  }

  // Obtener perfiles
  const { data: perfiles, error: perfilesError } = await supabase
    .from('perfiles')
    .select('id, organization_id, sucursal_id, rol, nombre, activo, created_at, updated_at')
    .not('organization_id', 'is', null);

  if (perfilesError) {
    log(`Error: ${perfilesError.message}`, 'error');
    return false;
  }

  if (!perfiles || perfiles.length === 0) {
    log('No hay perfiles para migrar', 'warn');
    return true;
  }

  log(`Perfiles a migrar: ${perfiles.length}`, 'info');

  let migrated = 0, skipped = 0, failed = 0;

  for (const p of perfiles) {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('user_id', p.id)
      .eq('organization_id', p.organization_id)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const role = p.rol === 'dueño' ? 'owner' : 'employee';
    const sucursalId = role === 'owner' ? null : p.sucursal_id;

    const { error: insertError } = await supabase
      .from('user_organization_roles')
      .insert({
        user_id: p.id,
        organization_id: p.organization_id,
        role: role,
        sucursal_id: sucursalId,
        is_active: p.activo !== false,
        joined_at: p.created_at,
        created_at: p.created_at,
        updated_at: p.updated_at || new Date().toISOString()
      });

    if (insertError) {
      log(`  ${p.nombre}: ${insertError.message}`, 'error');
      failed++;
    } else {
      migrated++;
    }
  }

  log(`Resultado: ${migrated} migrados, ${skipped} ya existían, ${failed} errores`, 'info');
  return failed === 0;
}

// ============================================================================
// VALIDACION
// ============================================================================

async function validate() {
  log('VALIDACION: Verificando integridad...', 'step');
  console.log('');

  const checks = [];

  // Check 1: owner_id poblado
  const { data: withOwner } = await supabase
    .from('organizations')
    .select('id')
    .not('owner_id', 'is', null);
  const { data: totalOrgs } = await supabase
    .from('organizations')
    .select('id');

  checks.push({
    name: 'organizations_have_owner',
    pass: (withOwner?.length || 0) === (totalOrgs?.length || 0),
    detail: `${withOwner?.length || 0}/${totalOrgs?.length || 0}`
  });

  // Check 2: roles migrados
  const { count: perfilesCount } = await supabase
    .from('perfiles')
    .select('*', { count: 'exact', head: true })
    .not('organization_id', 'is', null);
  const { count: rolesCount } = await supabase
    .from('user_organization_roles')
    .select('*', { count: 'exact', head: true });

  checks.push({
    name: 'perfiles_migrated',
    pass: (rolesCount || 0) >= (perfilesCount || 0),
    detail: `${rolesCount || 0} roles / ${perfilesCount || 0} perfiles`
  });

  // Check 3: cada org tiene owner role
  let orgsWithoutOwnerRole = 0;
  for (const org of (totalOrgs || [])) {
    const { data: ownerRole } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('organization_id', org.id)
      .eq('role', 'owner')
      .maybeSingle();
    if (!ownerRole) orgsWithoutOwnerRole++;
  }

  checks.push({
    name: 'orgs_have_owner_role',
    pass: orgsWithoutOwnerRole === 0,
    detail: orgsWithoutOwnerRole === 0 ? 'OK' : `${orgsWithoutOwnerRole} sin owner role`
  });

  // Mostrar resultados
  console.log('┌─────────────────────────────┬────────┬──────────────────────────┐');
  console.log('│ CHECK                       │ STATUS │ DETAILS                  │');
  console.log('├─────────────────────────────┼────────┼──────────────────────────┤');
  for (const c of checks) {
    const status = c.pass ? colors.green + 'PASS' + colors.reset : colors.red + 'FAIL' + colors.reset;
    console.log(`│ ${c.name.padEnd(27)} │ ${status}   │ ${c.detail.padEnd(24)} │`);
  }
  console.log('└─────────────────────────────┴────────┴──────────────────────────┘');

  const allPass = checks.every(c => c.pass);
  console.log('');
  log(allPass ? 'MIGRACION VALIDADA' : 'MIGRACION INCOMPLETA', allPass ? 'success' : 'error');

  return allPass;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + colors.bold + colors.cyan);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        MIGRACION OWNER-FIRST - EJECUCION DIRECTA               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝' + colors.reset + '\n');

  // Test conexión
  const { error } = await supabase.from('organizations').select('id').limit(1);
  if (error) {
    log(`Error de conexión: ${error.message}`, 'error');
    process.exit(1);
  }
  log('Conexión OK', 'success');
  console.log('');

  // Ejecutar fases
  const ownerIdExists = await checkAndReportOwnerIdStatus();
  console.log('');

  if (!ownerIdExists) {
    console.log(colors.yellow + '\n⚠️  ACCION REQUERIDA:' + colors.reset);
    console.log('Ejecuta este SQL en Supabase Dashboard > SQL Editor:\n');
    console.log(colors.cyan + `
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.organizations.owner_id IS
'ID del usuario que creó esta organización. Inmutable.';
    ` + colors.reset);
    console.log('\nLuego vuelve a ejecutar este script.');
    process.exit(1);
  }

  await populateOwnerId();
  console.log('');

  await migrateRoles();
  console.log('');

  const valid = await validate();

  console.log('\n' + colors.bold + '═══════════════════════════════════════════════════════════════' + colors.reset);
  console.log(valid
    ? colors.green + '✓ FASES 1 y 2 COMPLETADAS EXITOSAMENTE' + colors.reset
    : colors.yellow + '⚠ MIGRACION PARCIAL - REVISAR ERRORES' + colors.reset
  );
  console.log(colors.bold + '═══════════════════════════════════════════════════════════════' + colors.reset + '\n');

  process.exit(valid ? 0 : 1);
}

main().catch(err => {
  log(`Error fatal: ${err.message}`, 'error');
  process.exit(1);
});
