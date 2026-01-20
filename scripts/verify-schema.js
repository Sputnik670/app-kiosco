/**
 * Verificación de esquema usando queries directas
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(sql) {
  // No podemos ejecutar SQL arbitrario via REST
  // Pero podemos verificar las tablas probando insertar/seleccionar
  return null;
}

async function checkTableViaRest(tableName) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?limit=1`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=representation'
    }
  });

  if (response.status === 404) {
    return { exists: false, error: 'Table not found' };
  }

  if (response.status === 200) {
    const data = await response.json();
    return { exists: true, data, columns: data.length > 0 ? Object.keys(data[0]) : [] };
  }

  const text = await response.text();
  return { exists: null, status: response.status, error: text };
}

async function main() {
  console.log('Verificación directa via REST API\n');
  console.log('URL:', SUPABASE_URL);
  console.log('');

  // Verificar organizations
  console.log('>>> Tabla: organizations');
  const orgs = await checkTableViaRest('organizations');
  if (orgs.exists === false) {
    console.log('  ✗ No existe');
  } else if (orgs.exists) {
    console.log('  ✓ Existe');
    console.log('  Columnas:', orgs.columns.join(', ') || '(sin datos para inferir)');
    console.log('  Registros:', orgs.data?.length || 0);
  } else {
    console.log('  ? Status:', orgs.status, orgs.error?.substring(0, 100));
  }

  // Verificar user_organization_roles
  console.log('\n>>> Tabla: user_organization_roles');
  const roles = await checkTableViaRest('user_organization_roles');
  if (roles.exists === false) {
    console.log('  ✗ No existe');
  } else if (roles.exists) {
    console.log('  ✓ Existe');
    console.log('  Columnas:', roles.columns.join(', ') || '(sin datos para inferir)');
    console.log('  Registros:', roles.data?.length || 0);
  } else {
    console.log('  ? Status:', roles.status);
    // Puede ser error de RLS
    if (roles.error?.includes('row-level security')) {
      console.log('  ✓ Existe (bloqueada por RLS para service_role)');
    } else {
      console.log('  Error:', roles.error?.substring(0, 200));
    }
  }

  // Verificar perfiles
  console.log('\n>>> Tabla: perfiles');
  const perfiles = await checkTableViaRest('perfiles');
  if (perfiles.exists) {
    console.log('  ✓ Existe');
    console.log('  Registros:', perfiles.data?.length || 0);
  }

  // Ahora intentar una operación para forzar el refresh del cache
  console.log('\n>>> Intentando refrescar cache de esquema...');

  // Hacer una llamada a la API de administración
  const reloadResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });

  if (reloadResponse.ok) {
    const spec = await reloadResponse.json();
    console.log('  Tablas disponibles en API:');

    // Listar paths que no son RPC
    const tables = Object.keys(spec.paths || {})
      .filter(p => !p.startsWith('/rpc/'))
      .map(p => p.replace('/', ''))
      .filter(p => p);

    for (const t of tables.slice(0, 20)) {
      console.log(`    - ${t}`);
    }

    // Verificar si user_organization_roles está
    const hasUOR = tables.includes('user_organization_roles');
    console.log('\n  user_organization_roles en API:', hasUOR ? '✓ SÍ' : '✗ NO');
  }
}

main().catch(console.error);
