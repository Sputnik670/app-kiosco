#!/usr/bin/env node

/**
 * Obtener esquema detallado de una tabla específica
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function obtenerEsquemaTabla(nombreTabla) {
  console.log(`🔍 Obteniendo esquema de: ${nombreTabla}`);
  console.log('═'.repeat(60));

  try {
    // Intentar obtener información de la tabla desde information_schema
    const { data: columnas, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', nombreTabla)
      .order('ordinal_position');

    if (error) {
      console.error('⚠️  No se pudo acceder a information_schema:', error.message);
      console.log('   Intentando método alternativo...\n');

      // Método alternativo: insertar un registro vacío y ver qué campos faltan
      const { error: insertError } = await supabase
        .from(nombreTabla)
        .insert({})
        .select();

      if (insertError) {
        // El error nos dirá qué campos son requeridos
        console.log('📋 Información del error de inserción:');
        console.log(`   ${insertError.message}\n`);

        // Intentar hacer un select con limit 0 para obtener estructura
        const { data: sample, error: selectError } = await supabase
          .from(nombreTabla)
          .select('*')
          .limit(1);

        if (sample && sample.length > 0) {
          console.log('✅ Columnas detectadas desde datos existentes:');
          console.log('');
          Object.keys(sample[0]).forEach(col => {
            const valor = sample[0][col];
            const tipo = typeof valor === 'number' ? 'number' :
                        typeof valor === 'boolean' ? 'boolean' :
                        valor === null ? 'null' : 'string';
            console.log(`   ${col.padEnd(30)} | ${tipo}`);
          });
          return sample[0];
        } else {
          console.log('⚠️  Tabla vacía y sin acceso a esquema');
          return null;
        }
      }

      return null;
    }

    if (!columnas || columnas.length === 0) {
      console.log('❌ No se encontraron columnas para esta tabla');
      return null;
    }

    console.log('✅ Esquema obtenido desde information_schema:');
    console.log('');
    console.log('Columna'.padEnd(30) + ' | Tipo'.padEnd(20) + ' | Nullable | Default');
    console.log('─'.repeat(90));

    columnas.forEach(col => {
      const nombre = col.column_name.padEnd(30);
      const tipo = col.data_type.padEnd(20);
      const nullable = col.is_nullable === 'YES' ? '✓' : '✗';
      const defaultVal = col.column_default || '-';

      console.log(`${nombre} | ${tipo} | ${nullable.padEnd(8)} | ${defaultVal}`);
    });

    console.log('');
    console.log('═'.repeat(60));

    // Generar TypeScript type
    console.log('');
    console.log('📝 Sugerencia de tipo TypeScript:');
    console.log('');
    console.log(`${nombreTabla}: {`);
    console.log('  Row: {');
    columnas.forEach(col => {
      const tsType = mapearTipoSQL(col.data_type);
      const nullableSuffix = col.is_nullable === 'YES' ? ' | null' : '';
      console.log(`    ${col.column_name}: ${tsType}${nullableSuffix}`);
    });
    console.log('  }');
    console.log('}');

    return columnas;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

function mapearTipoSQL(sqlType) {
  const mapa = {
    'integer': 'number',
    'bigint': 'number',
    'numeric': 'number',
    'real': 'number',
    'double precision': 'number',
    'smallint': 'number',
    'decimal': 'number',
    'text': 'string',
    'character varying': 'string',
    'varchar': 'string',
    'char': 'string',
    'uuid': 'string',
    'timestamp with time zone': 'string',
    'timestamp without time zone': 'string',
    'date': 'string',
    'time': 'string',
    'boolean': 'boolean',
    'json': 'Json',
    'jsonb': 'Json',
    'array': 'Json[]'
  };

  return mapa[sqlType.toLowerCase()] || 'unknown';
}

// Main
const nombreTabla = process.argv[2] || 'ventas_servicios';
obtenerEsquemaTabla(nombreTabla);
