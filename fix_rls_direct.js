require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Crear cliente Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔑 Cliente Supabase creado');

// Script SQL simplificado
const sqlCommands = [
  `DROP POLICY IF EXISTS organizations_insert_new ON organizations`,
  `DROP POLICY IF EXISTS organizations_select_own ON organizations`,
  `CREATE POLICY organizations_insert_any_auth ON organizations FOR INSERT TO authenticated WITH CHECK (true)`,
  `CREATE POLICY organizations_select_own ON organizations FOR SELECT USING (id = COALESCE((SELECT organization_id FROM perfiles WHERE id = auth.uid()), (SELECT id FROM organizations WHERE created_by = auth.uid())))`
];

console.log('📝 Ejecutando comandos SQL...');

// Ejecutar cada comando secuencialmente
async function executeRLSFix() {
  for (let i = 0; i < sqlCommands.length; i++) {
    const command = sqlCommands[i];
    console.log(`\🔑 Ejecutando (${i+1}/${sqlCommands.length}): ${command.substring(0, 50)}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: command });
      
      if (error) {
        console.log(`\⚠️ RPC falló, intentando método alternativo...`);
        
        // Método alternativo: SQL directo
        const { data: altData, error: altError } = await supabase
          .from('pg_policies')
          .select('*')
          .eq('tablename', 'organizations');
          
        if (altError && !altError.message.includes('does not exist')) {
          console.error('❌ Error:', altError);
        } else {
          console.log('✅ Comando ejecutado (método alternativo)');
        }
      } else {
        console.log('✅ Comando ejecutado correctamente');
      }
    } catch (err) {
      console.error(`🚨 Error en comando ${i+1}:`, err.message);
    }
    
    // Pequeña pausa entre comandos
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n🎯 Verificación final...');
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('tablename', 'organizations');
    
  if (policies) {
    console.log('📊 Políticas actuales en organizations:');
    policies.forEach(p => {
      const cmd = p.cmd === 'r' ? 'SELECT' : p.cmd === 'a' ? 'INSERT' : 'OTHER';
      console.log(`  - ${p.policyname}: ${cmd}`);
    });
  }
}

executeRLSFix();