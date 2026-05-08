#!/usr/bin/env node

/**
 * Script para generar tipos TypeScript desde Supabase
 * 
 * Uso:
 * 1. Obtén tu Access Token de Supabase:
 *    - Ve a https://app.supabase.com
 *    - Settings → Access Tokens
 *    - Crea un nuevo token o usa uno existente
 * 
 * 2. Ejecuta:
 *    SUPABASE_ACCESS_TOKEN=tu_token node scripts/generate-types.js
 * 
 * O en PowerShell:
 *    $env:SUPABASE_ACCESS_TOKEN="tu_token"; node scripts/generate-types.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'vrgexonzlrdptrplqpri';
// Puedes usar SUPABASE_ACCESS_TOKEN (personal access token) 
// O SUPABASE_SERVICE_ROLE_KEY (service role key) como alternativa temporal
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ACCESS_TOKEN) {
  console.error('❌ Error: No se encontró SUPABASE_ACCESS_TOKEN ni SUPABASE_SERVICE_ROLE_KEY');
  console.log('\n📝 Opción 1: Personal Access Token (Recomendado)');
  console.log('   1. Ve a https://app.supabase.com');
  console.log('   2. Haz clic en tu avatar (arriba derecha) → Account Settings');
  console.log('   3. En el menú lateral: "Access Tokens" o "Personal Access Tokens"');
  console.log('   4. Crea un nuevo token');
  console.log('\n📝 Opción 2: Service Role Key (Temporal, solo para generar tipos)');
  console.log('   1. Ve a tu proyecto en Supabase');
  console.log('   2. Settings → API');
  console.log('   3. Busca "service_role" key (secret)');
  console.log('   4. ⚠️ IMPORTANTE: Solo úsalo para generar tipos, NUNCA en código de producción');
  console.log('\n💻 Ejecuta:');
  console.log('   Windows (PowerShell):');
  console.log('     $env:SUPABASE_ACCESS_TOKEN="tu_token"; npm run generate-types');
  console.log('     # O con service role key:');
  console.log('     $env:SUPABASE_SERVICE_ROLE_KEY="tu_service_key"; npm run generate-types');
  console.log('   Mac/Linux:');
  console.log('     SUPABASE_ACCESS_TOKEN=tu_token npm run generate-types');
  process.exit(1);
}

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_ID}/types/typescript`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'apikey': ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
};

console.log('🔄 Generando tipos TypeScript desde Supabase...');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const outputPath = path.join(__dirname, '..', 'types', 'tipos-db.ts');
      
      // El API devuelve JSON con un campo "types" que contiene el TypeScript
      try {
        const jsonData = JSON.parse(data);
        const typesContent = jsonData.types || data; // Si ya es texto, usar directamente
        fs.writeFileSync(outputPath, typesContent, 'utf8');
        console.log('✅ Tipos generados exitosamente en types/tipos-db.ts');
      } catch (parseError) {
        // Si no es JSON, escribir directamente
        fs.writeFileSync(outputPath, data, 'utf8');
        console.log('✅ Tipos generados exitosamente en types/tipos-db.ts');
      }
    } else {
      console.error(`❌ Error: ${res.statusCode}`);
      console.error(data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  process.exit(1);
});

req.end();

