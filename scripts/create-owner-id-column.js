/**
 * Agrega la columna owner_id a organizations via Supabase Management API
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Verificando estado actual de la columna owner_id...\n');

  // Primero verificamos si la columna existe consultando la tabla
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  // Ver qué columnas tiene
  if (data && data.length > 0) {
    console.log('Columnas actuales en organizations:');
    console.log(Object.keys(data[0]).join(', '));
    console.log('');

    if ('owner_id' in data[0]) {
      console.log('✓ La columna owner_id ya existe');
      return;
    }
  }

  console.log('La columna owner_id NO existe.\n');
  console.log('Por favor ejecuta el siguiente SQL en Supabase Dashboard > SQL Editor:\n');
  console.log('─'.repeat(70));
  console.log(`
-- Agregar columna owner_id a organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Agregar comentario
COMMENT ON COLUMN public.organizations.owner_id IS
'ID del usuario que creó esta organización. Inmutable.';

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name = 'owner_id';
  `);
  console.log('─'.repeat(70));
}

main().catch(console.error);
