/**
 * Verifica organizaciones huérfanas (sin dueños en perfiles)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Verificando organizaciones y sus dueños...\n');

  // Obtener todas las organizaciones
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, nombre, owner_id, created_at');

  console.log(`Total organizaciones: ${orgs?.length || 0}\n`);

  for (const org of (orgs || [])) {
    // Buscar perfiles asociados
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, email')
      .eq('organization_id', org.id);

    const dueños = perfiles?.filter(p => p.rol === 'dueño') || [];
    const empleados = perfiles?.filter(p => p.rol === 'empleado') || [];

    console.log(`📦 ${org.nombre}`);
    console.log(`   ID: ${org.id}`);
    console.log(`   owner_id: ${org.owner_id || '(vacío)'}`);
    console.log(`   Creada: ${org.created_at}`);
    console.log(`   Perfiles: ${perfiles?.length || 0} (${dueños.length} dueños, ${empleados.length} empleados)`);

    if (dueños.length > 0) {
      console.log(`   Dueños:`);
      for (const d of dueños) {
        console.log(`     - ${d.nombre} (${d.email || 'sin email'})`);
      }
    } else {
      console.log(`   ⚠️  SIN DUEÑOS - organización huérfana`);
    }

    // Buscar sucursales
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('organization_id', org.id);

    console.log(`   Sucursales: ${sucursales?.length || 0}`);

    // Buscar datos de negocio
    const { count: productosCount } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    const { count: ventasCount } = await supabase
      .from('ventas_servicios')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    console.log(`   Productos: ${productosCount || 0}, Ventas: ${ventasCount || 0}`);

    if (!perfiles?.length && !sucursales?.length && !productosCount && !ventasCount) {
      console.log(`   💀 ORGANIZACION VACIA - candidata para eliminación`);
    }

    console.log('');
  }

  // Resumen
  const orphanOrgs = orgs?.filter(o => !o.owner_id) || [];
  console.log('═'.repeat(60));
  console.log('RESUMEN:');
  console.log(`  - Organizaciones totales: ${orgs?.length || 0}`);
  console.log(`  - Con owner_id: ${(orgs?.length || 0) - orphanOrgs.length}`);
  console.log(`  - Sin owner_id (huérfanas): ${orphanOrgs.length}`);
  if (orphanOrgs.length > 0) {
    console.log(`\nOrganizaciones huérfanas:`);
    for (const o of orphanOrgs) {
      console.log(`  - ${o.nombre} (${o.id})`);
    }
  }
}

main().catch(console.error);
