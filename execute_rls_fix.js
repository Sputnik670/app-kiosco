require('dotenv').config();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔑 Configuración cargada');
console.log('📡 URL:', supabaseUrl);

// Script SQL para ejecutar
const sqlScript = `
-- LIMPIEZA DE POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS organizations_insert_new ON organizations;
DROP POLICY IF EXISTS organizations_select_own ON organizations;
DROP POLICY IF EXISTS organizations_update_own ON organizations;
DROP POLICY IF EXISTS organizations_delete_own ON organizations;

-- POLÍTICA PARA INSERT (PERMITIR CUALQUIER USUARIO AUTENTICADO)
CREATE POLICY organizations_insert_any_auth
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- POLÍTICA PARA SELECT (SOLO PROPIAS ORGANIZACIONES)
CREATE POLICY organizations_select_own
ON organizations
FOR SELECT
USING (id = COALESCE(
  (SELECT organization_id FROM perfiles WHERE id = auth.uid()),
  (SELECT id FROM organizations WHERE created_by = auth.uid())
));

-- VERIFICACIÓN DE POLÍTICAS CREADAS
SELECT 
  policyname,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT' 
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
  END as command
FROM pg_policies 
WHERE tablename = 'organizations';
`;

console.log('📝 Script SQL preparado');

// Ejecutar vía REST API de Supabase
fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
  method: 'POST',
  headers: {
    'apikey': apiKey,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Prefer': 'return=minimal'
  },
  body: JSON.stringify({
    query: sqlScript
  })
})
.then(response => response.json())
.then(data => {
  console.log('📊 Respuesta de Supabase:', data);
  if (data.error) {
    console.error('❌ Error SQL:', data.error);
  } else {
    console.log('✅ Políticas RLS modificadas correctamente');
  }
})
.catch(error => {
  console.error('🚨 Error de red:', error.message);
});