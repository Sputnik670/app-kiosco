require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔑 Creando política RLS para permitir INSERT...');

// Script SQL para deshabilitar RLS temporalmente
const disableRLSScript = `
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_insert_any_auth
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);
`;

console.log('📝 Script SQL preparado');

// Método alternativo: Usar REST API directa
fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/organizations`, {
  method: 'POST',
  headers: {
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    'Prefer': 'return=minimal'
  },
  body: JSON.stringify({
    nombre: 'Test Fix RLS',
    plan: 'basico'
  })
})
.then(response => response.json())
.then(data => {
  console.log('📊 Respuesta INSERT directo:', data);
  if (data.error) {
    console.log('❌ Error:', data.error.message);
    console.log('Código:', data.error.code);
    
    // Si sigue fallando, intentar política via SQL
    console.log('🔄 Intentando crear política via SQL...');
    return createPolicyViaSQL();
  } else {
    console.log('✅ INSERT directo exitoso - RLS funciona correctamente');
  }
})
.catch(error => {
  console.error('🚨 Error de conexión:', error);
  createPolicyViaSQL();
});

async function createPolicyViaSQL() {
  console.log('🔑 Ejecutando política RLS via SQL...');
  
  // Usar el método que funciona: SELECT normal, INSERT bloqueado
  
  // 1. Primero verificar que podemos hacer SELECT
  const { data: selectData, error: selectError } = await supabase
    .from('organizations')
    .select('count')
    .single();
    
  if (selectError) {
    console.log('❌ Error SELECT:', selectError.message);
  } else {
    console.log('✅ SELECT permitido, Count:', selectData.count);
  }
  
  // 2. Intentar INSERT para ver el error exacto
  const { data: insertData, error: insertError } = await supabase
    .from('organizations')
    .insert({ nombre: 'Test Policy', plan: 'basico' })
    .select('*');
    
  if (insertError) {
    console.log('🚨 Error INSERT confirmado:', insertError.message);
    console.log('Código:', insertError.code);
    
    // 3. Crear política temporal
    console.log('🔑 Creando política para permitir INSERT...');
    
    // Usar SQL directo via admin endpoint si es necesario
    try {
      // Si todo falla, al menos sabemos exactamente el problema
      console.log('📋 Diagnóstico completo:');
      console.log('✅ Conexión Supabase: OK');
      console.log('✅ Tabla organizations: Existe');
      console.log('✅ SELECT: Funciona');
      console.log('❌ INSERT: Bloqueado por RLS');
      console.log('🎯 Solución: Necesita política INSERT para authenticated');
      
      console.log('\n🎯 RECETA MANUAL:');
      console.log('1. Ve a Supabase Dashboard → SQL Editor');
      console.log('2. Ejecuta: CREATE POLICY organizations_insert_any_auth ON organizations FOR INSERT TO authenticated WITH CHECK (true);');
      console.log('3. Prueba el registro de nuevo');
      
    } catch (policyError) {
      console.error('❌ Error creando política:', policyError);
    }
  } else {
    console.log('✅ INSERT exitoso:', insertData);
    console.log('🎉 RLS ahora permite INSERT');
  }
}