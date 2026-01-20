/**
 * EJECUTOR DE MIGRACION OWNER-FIRST - FASES 1 y 2 (v2)
 *
 * Ejecuta la migración usando consultas directas a Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
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

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.cyan}[INFO]${colors.reset}`,
    success: `${colors.green}[✓]${colors.reset}`,
    error: `${colors.red}[✗]${colors.reset}`,
    warn: `${colors.yellow}[!]${colors.reset}`,
    step: `${colors.bold}${colors.cyan}>>>${colors.reset}`
  };
  console.log(`${prefix[type]} ${message}`);
}

// ============================================================================
// FASE 1.1: Verificar/Crear tabla user_organization_roles
// ============================================================================
async function phase1_1_checkTable() {
  log('FASE 1.1: Verificando tabla user_organization_roles', 'step');

  // Intentar hacer una consulta a la tabla
  const { data, error } = await supabase
    .from('user_organization_roles')
    .select('id, user_id, organization_id, role')
    .limit(1);

  if (error) {
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      log('Tabla NO existe - debe crearse manualmente', 'error');
      return { exists: false, needsCreation: true };
    }
    // Otro tipo de error (quizás RLS)
    log(`Error consultando tabla: ${error.message}`, 'warn');
    // Pero la tabla probablemente existe
  }

  log('Tabla user_organization_roles existe', 'success');

  // Contar registros
  const { count } = await supabase
    .from('user_organization_roles')
    .select('*', { count: 'exact', head: true });

  log(`  Registros actuales: ${count || 0}`, 'info');

  return { exists: true, count: count || 0 };
}

// ============================================================================
// FASE 1.2: Verificar columna owner_id en organizations
// ============================================================================
async function phase1_2_checkOwnerIdColumn() {
  log('FASE 1.2: Verificando columna owner_id en organizations', 'step');

  // Intentar seleccionar owner_id
  const { data, error } = await supabase
    .from('organizations')
    .select('id, nombre, owner_id')
    .limit(1);

  if (error) {
    if (error.message.includes('owner_id') || error.code === '42703') {
      log('Columna owner_id NO existe - debe agregarse', 'error');
      return { exists: false };
    }
    log(`Error: ${error.message}`, 'warn');
  }

  log('Columna owner_id existe en organizations', 'success');

  // Contar orgs con owner_id poblado
  const { data: withOwner } = await supabase
    .from('organizations')
    .select('id')
    .not('owner_id', 'is', null);

  const { data: total } = await supabase
    .from('organizations')
    .select('id');

  log(`  Orgs con owner_id: ${withOwner?.length || 0}/${total?.length || 0}`, 'info');

  return {
    exists: true,
    populated: withOwner?.length || 0,
    total: total?.length || 0
  };
}

// ============================================================================
// FASE 2.1: Poblar owner_id desde perfiles
// ============================================================================
async function phase2_1_populateOwnerId() {
  log('FASE 2.1: Poblando owner_id en organizations', 'step');

  // Obtener organizaciones sin owner_id
  const { data: orgsWithoutOwner, error: orgsError } = await supabase
    .from('organizations')
    .select('id, nombre')
    .is('owner_id', null);

  if (orgsError) {
    log(`Error obteniendo organizaciones: ${orgsError.message}`, 'error');
    return { success: false, error: orgsError };
  }

  if (!orgsWithoutOwner || orgsWithoutOwner.length === 0) {
    log('Todas las organizaciones ya tienen owner_id asignado', 'success');
    return { success: true, updated: 0, skipped: 0 };
  }

  log(`Organizaciones sin owner_id: ${orgsWithoutOwner.length}`, 'info');

  let updated = 0;
  let failed = 0;

  for (const org of orgsWithoutOwner) {
    // Buscar el primer dueño de esta org
    const { data: dueno, error: duenoError } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .eq('organization_id', org.id)
      .eq('rol', 'dueño')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (duenoError || !dueno) {
      log(`  "${org.nombre}": Sin dueño encontrado`, 'warn');
      failed++;
      continue;
    }

    // Actualizar owner_id
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ owner_id: dueno.id })
      .eq('id', org.id);

    if (updateError) {
      log(`  "${org.nombre}": Error - ${updateError.message}`, 'error');
      failed++;
    } else {
      log(`  "${org.nombre}" -> owner: ${dueno.nombre}`, 'success');
      updated++;
    }
  }

  log(`Resultado: ${updated} actualizados, ${failed} sin dueño`, updated > 0 ? 'success' : 'warn');
  return { success: true, updated, failed };
}

// ============================================================================
// FASE 2.2: Migrar perfiles a user_organization_roles
// ============================================================================
async function phase2_2_migrateRoles() {
  log('FASE 2.2: Migrando perfiles a user_organization_roles', 'step');

  // Obtener todos los perfiles con organization_id
  const { data: perfiles, error: perfilesError } = await supabase
    .from('perfiles')
    .select('id, organization_id, sucursal_id, rol, nombre, activo, created_at, updated_at')
    .not('organization_id', 'is', null);

  if (perfilesError) {
    log(`Error obteniendo perfiles: ${perfilesError.message}`, 'error');
    return { success: false, error: perfilesError };
  }

  if (!perfiles || perfiles.length === 0) {
    log('No hay perfiles para migrar', 'warn');
    return { success: true, migrated: 0 };
  }

  log(`Perfiles a procesar: ${perfiles.length}`, 'info');

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const perfil of perfiles) {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('user_id', perfil.id)
      .eq('organization_id', perfil.organization_id)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Mapear rol
    const newRole = perfil.rol === 'dueño' ? 'owner' : 'employee';

    // Para owners, sucursal_id es null (acceso a todas)
    // Para employees, mantener la sucursal asignada
    const sucursalId = newRole === 'owner' ? null : perfil.sucursal_id;

    // Insertar
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
        updated_at: perfil.updated_at || new Date().toISOString()
      });

    if (insertError) {
      // Si es constraint de empleado sin sucursal, loguear pero continuar
      if (insertError.message.includes('employee_needs_sucursal')) {
        log(`  ${perfil.nombre}: empleado sin sucursal asignada`, 'warn');
        // Intentar sin sucursal_id (temporal)
        const { error: retry } = await supabase
          .from('user_organization_roles')
          .insert({
            user_id: perfil.id,
            organization_id: perfil.organization_id,
            role: 'employee',
            sucursal_id: null, // temporal
            is_active: perfil.activo !== false,
            joined_at: perfil.created_at
          });
        if (!retry) {
          migrated++;
          continue;
        }
      }
      log(`  ${perfil.nombre}: ${insertError.message}`, 'error');
      failed++;
    } else {
      migrated++;
    }
  }

  log(`Resultado: ${migrated} migrados, ${skipped} existentes, ${failed} errores`, 'info');
  return { success: failed === 0, migrated, skipped, failed };
}

// ============================================================================
// VALIDACION
// ============================================================================
async function validateMigration() {
  log('VERIFICACION: Validando integridad de migración', 'step');
  console.log('');

  const results = [];

  // Check 1: Todas las orgs tienen owner_id
  const { data: orgsWithoutOwner } = await supabase
    .from('organizations')
    .select('id')
    .is('owner_id', null);

  const check1 = !orgsWithoutOwner || orgsWithoutOwner.length === 0;
  results.push({
    name: 'organizations_have_owner',
    pass: check1,
    detail: check1 ? 'OK' : `${orgsWithoutOwner?.length} sin owner`
  });

  // Check 2: Cantidad de roles >= perfiles
  const { count: perfilesCount } = await supabase
    .from('perfiles')
    .select('*', { count: 'exact', head: true })
    .not('organization_id', 'is', null);

  const { count: rolesCount } = await supabase
    .from('user_organization_roles')
    .select('*', { count: 'exact', head: true });

  const check2 = (rolesCount || 0) >= (perfilesCount || 0);
  results.push({
    name: 'perfiles_migrated',
    pass: check2,
    detail: `${rolesCount || 0}/${perfilesCount || 0} roles`
  });

  // Check 3: Cada org tiene owner role
  const { data: allOrgs } = await supabase.from('organizations').select('id');
  let orgsWithoutOwnerRole = 0;

  for (const org of (allOrgs || [])) {
    const { data: ownerRole } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('organization_id', org.id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    if (!ownerRole) orgsWithoutOwnerRole++;
  }

  const check3 = orgsWithoutOwnerRole === 0;
  results.push({
    name: 'orgs_have_owner_role',
    pass: check3,
    detail: check3 ? 'OK' : `${orgsWithoutOwnerRole} sin owner role`
  });

  // Check 4: Consistencia owner_id = owner role
  const { data: orgsWithOwner } = await supabase
    .from('organizations')
    .select('id, owner_id')
    .not('owner_id', 'is', null);

  let inconsistencies = 0;
  for (const org of (orgsWithOwner || [])) {
    const { data: matchingRole } = await supabase
      .from('user_organization_roles')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', org.owner_id)
      .eq('role', 'owner')
      .maybeSingle();

    if (!matchingRole) inconsistencies++;
  }

  const check4 = inconsistencies === 0;
  results.push({
    name: 'owner_id_matches_role',
    pass: check4,
    detail: check4 ? 'OK' : `${inconsistencies} inconsistencias`
  });

  // Mostrar tabla de resultados
  console.log(colors.bold + '┌───────────────────────────────┬────────┬────────────────────┐' + colors.reset);
  console.log(colors.bold + '│ CHECK                         │ STATUS │ DETAILS            │' + colors.reset);
  console.log(colors.bold + '├───────────────────────────────┼────────┼────────────────────┤' + colors.reset);

  for (const r of results) {
    const status = r.pass ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`│ ${r.name.padEnd(29)} │ ${status}   │ ${r.detail.padEnd(18)} │`);
  }

  console.log(colors.bold + '└───────────────────────────────┴────────┴────────────────────┘' + colors.reset);

  const allPass = results.every(r => r.pass);
  console.log('');
  if (allPass) {
    log('MIGRACION VALIDADA EXITOSAMENTE', 'success');
  } else {
    log('MIGRACION CON PROBLEMAS - REVISAR', 'error');
  }

  return allPass;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('\n' + colors.bold + colors.cyan);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MIGRACION OWNER-FIRST - FASES 1 y 2                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝' + colors.reset + '\n');

  // Test conexión
  const { error: connError } = await supabase.from('organizations').select('id').limit(1);
  if (connError) {
    log(`Error de conexión: ${connError.message}`, 'error');
    process.exit(1);
  }
  log('Conexión establecida con Supabase', 'success');
  console.log('');

  // FASE 1.1
  const phase1_1 = await phase1_1_checkTable();
  if (!phase1_1.exists) {
    console.log('\n' + colors.yellow + '⚠️  Debes crear la tabla manualmente. Ejecuta el SQL del plan en Supabase.' + colors.reset);
    process.exit(1);
  }
  console.log('');

  // FASE 1.2
  const phase1_2 = await phase1_2_checkOwnerIdColumn();
  if (!phase1_2.exists) {
    console.log('\n' + colors.yellow + '⚠️  Debes agregar la columna owner_id. Ejecuta el SQL del plan en Supabase.' + colors.reset);
    process.exit(1);
  }
  console.log('');

  // FASE 2.1
  const phase2_1 = await phase2_1_populateOwnerId();
  console.log('');

  // FASE 2.2
  const phase2_2 = await phase2_2_migrateRoles();
  console.log('');

  // VALIDACION
  const valid = await validateMigration();

  // RESUMEN
  console.log('\n' + colors.bold + '═══════════════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.bold + '                    RESUMEN DE EJECUCION' + colors.reset);
  console.log(colors.bold + '═══════════════════════════════════════════════════════════════' + colors.reset);
  console.log(`  Fase 1.1 (Tabla):       ${phase1_1.exists ? colors.green + '✓ Existe' : colors.red + '✗ Falta'}${colors.reset}`);
  console.log(`  Fase 1.2 (owner_id):    ${phase1_2.exists ? colors.green + '✓ Existe' : colors.red + '✗ Falta'}${colors.reset}`);
  console.log(`  Fase 2.1 (Poblar):      ${phase2_1.success ? colors.green + '✓ ' + phase2_1.updated + ' actualizados' : colors.red + '✗ Error'}${colors.reset}`);
  console.log(`  Fase 2.2 (Migrar):      ${phase2_2.success ? colors.green + '✓ ' + phase2_2.migrated + ' migrados' : colors.red + '✗ Error'}${colors.reset}`);
  console.log(`  Validación:             ${valid ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'}${colors.reset}`);
  console.log('');

  process.exit(valid ? 0 : 1);
}

main().catch(err => {
  log(`Error fatal: ${err.message}`, 'error');
  process.exit(1);
});
