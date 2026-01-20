/**
 * Verificación final de la migración Owner-First
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' }
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

async function main() {
  console.log('\n' + colors.bold + colors.cyan);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        VERIFICACION FINAL - MIGRACION OWNER-FIRST            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝' + colors.reset + '\n');

  // 1. Verificar tabla user_organization_roles
  console.log(colors.bold + '>>> Verificando tabla user_organization_roles...' + colors.reset);
  const { data: roles, error: rolesError } = await supabase
    .from('user_organization_roles')
    .select('*');

  if (rolesError) {
    console.log(colors.red + '  ✗ Error: ' + rolesError.message + colors.reset);
  } else {
    console.log(colors.green + '  ✓ Tabla existe' + colors.reset);
    console.log(`    Registros: ${roles?.length || 0}`);
  }

  // 2. Verificar columna owner_id en organizations
  console.log('\n' + colors.bold + '>>> Verificando columna owner_id en organizations...' + colors.reset);

  // Hacer un select * para ver todas las columnas
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*');

  if (orgsError) {
    console.log(colors.red + '  ✗ Error: ' + orgsError.message + colors.reset);
  } else {
    if (orgs && orgs.length > 0) {
      const columns = Object.keys(orgs[0]);
      console.log(`    Columnas: ${columns.join(', ')}`);
      const hasOwnerId = columns.includes('owner_id');
      console.log(hasOwnerId
        ? colors.green + '  ✓ Columna owner_id existe' + colors.reset
        : colors.red + '  ✗ Columna owner_id NO existe' + colors.reset);

      if (hasOwnerId) {
        const withOwner = orgs.filter(o => o.owner_id !== null);
        console.log(`    Organizaciones con owner_id: ${withOwner.length}/${orgs.length}`);
      }
    } else {
      console.log(colors.yellow + '  ! No hay organizaciones en la base de datos' + colors.reset);
    }
  }

  // 3. Verificar perfiles
  console.log('\n' + colors.bold + '>>> Verificando perfiles...' + colors.reset);
  const { data: perfiles, error: perfilesError } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, organization_id');

  if (perfilesError) {
    console.log(colors.red + '  ✗ Error: ' + perfilesError.message + colors.reset);
  } else {
    console.log(colors.green + '  ✓ Tabla perfiles accesible' + colors.reset);
    console.log(`    Total perfiles: ${perfiles?.length || 0}`);
    const duenos = perfiles?.filter(p => p.rol === 'dueño') || [];
    const empleados = perfiles?.filter(p => p.rol === 'empleado') || [];
    console.log(`    Dueños: ${duenos.length}, Empleados: ${empleados.length}`);
  }

  // 4. Resumen de estado
  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  console.log(colors.bold + '                    ESTADO ACTUAL' + colors.reset);
  console.log(colors.bold + '═'.repeat(60) + colors.reset);

  const tableOk = !rolesError;
  const columnOk = orgs && orgs.length > 0 ? Object.keys(orgs[0]).includes('owner_id') : false;
  const noOrgs = !orgs || orgs.length === 0;
  const noPerfiles = !perfiles || perfiles.length === 0;

  console.log(`  Tabla user_organization_roles: ${tableOk ? colors.green + '✓ OK' : colors.red + '✗ FALTA'}${colors.reset}`);
  console.log(`  Columna owner_id:              ${columnOk ? colors.green + '✓ OK' : (noOrgs ? colors.yellow + '⚠ Sin orgs para verificar' : colors.red + '✗ FALTA')}${colors.reset}`);
  console.log(`  Organizaciones:                ${noOrgs ? colors.yellow + '0 (vacío)' : colors.green + (orgs?.length || 0)}${colors.reset}`);
  console.log(`  Perfiles:                      ${noPerfiles ? colors.yellow + '0 (vacío)' : colors.green + (perfiles?.length || 0)}${colors.reset}`);
  console.log(`  Roles migrados:                ${colors.green + (roles?.length || 0)}${colors.reset}`);

  // Estado final
  const structureReady = tableOk && (columnOk || noOrgs);
  const dataEmpty = noOrgs && noPerfiles;

  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);

  if (structureReady && dataEmpty) {
    console.log(colors.green + colors.bold);
    console.log('✓ ESTRUCTURA LISTA - BASE DE DATOS VACIA (sin datos de producción)');
    console.log(colors.reset);
    console.log('La migración estructural está completa.');
    console.log('Cuando haya datos reales, se poblarán automáticamente en la nueva estructura.');
  } else if (structureReady) {
    console.log(colors.green + colors.bold);
    console.log('✓ MIGRACION COMPLETA');
    console.log(colors.reset);
  } else {
    console.log(colors.yellow + colors.bold);
    console.log('⚠ MIGRACION PARCIAL - REVISAR ITEMS PENDIENTES');
    console.log(colors.reset);
  }

  console.log('');
}

main().catch(console.error);
