/**
 * Limpia organizaciones huérfanas (vacías y sin dueños)
 * Solo elimina si están completamente vacías
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Limpiando organizaciones huérfanas vacías...\n');

  // Obtener organizaciones sin owner_id
  const { data: orphanOrgs } = await supabase
    .from('organizations')
    .select('id, nombre')
    .is('owner_id', null);

  if (!orphanOrgs || orphanOrgs.length === 0) {
    console.log('No hay organizaciones huérfanas.');
    return;
  }

  console.log(`Encontradas ${orphanOrgs.length} organizaciones sin owner_id\n`);

  let deleted = 0;
  let skipped = 0;

  for (const org of orphanOrgs) {
    // Verificar si tiene datos
    const { count: perfilesCount } = await supabase
      .from('perfiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    const { count: sucursalesCount } = await supabase
      .from('sucursales')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    const { count: productosCount } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    const { count: ventasCount } = await supabase
      .from('ventas_servicios')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    const totalData = (perfilesCount || 0) + (sucursalesCount || 0) +
                      (productosCount || 0) + (ventasCount || 0);

    if (totalData > 0) {
      console.log(`⚠️  "${org.nombre}": tiene ${totalData} registros asociados - SALTANDO`);
      skipped++;
      continue;
    }

    // Eliminar organización vacía
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', org.id);

    if (error) {
      console.log(`❌ "${org.nombre}": error al eliminar - ${error.message}`);
      skipped++;
    } else {
      console.log(`✓  "${org.nombre}": eliminada`);
      deleted++;
    }
  }

  console.log(`\nResultado: ${deleted} eliminadas, ${skipped} conservadas`);
}

main().catch(console.error);
