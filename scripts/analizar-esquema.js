#!/usr/bin/env node

/**
 * Análisis completo del esquema SQL
 * Detecta duplicados, inconsistencias y problemas
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'supabase-schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

console.log('🔍 ANÁLISIS DEL ESQUEMA SQL');
console.log('═'.repeat(70));
console.log('');

// 1. Buscar todas las tablas creadas
console.log('📊 TABLAS ENCONTRADAS:\n');
const createTableRegex = /CREATE TABLE[^(]*\s+(?:IF NOT EXISTS\s+)?public\.(\w+)/gi;
const tablas = [];
let match;

while ((match = createTableRegex.exec(schema)) !== null) {
  tablas.push({
    nombre: match[1],
    linea: schema.substring(0, match.index).split('\n').length
  });
}

// Detectar duplicados
const tablasCount = {};
tablas.forEach(t => {
  tablasCount[t.nombre] = (tablasCount[t.nombre] || 0) + 1;
});

const duplicadas = Object.entries(tablasCount).filter(([_, count]) => count > 1);

console.log(`Total de CREATE TABLE encontrados: ${tablas.length}`);
console.log(`Tablas únicas: ${Object.keys(tablasCount).length}`);
console.log('');

if (duplicadas.length > 0) {
  console.log('❌ TABLAS DUPLICADAS:\n');
  duplicadas.forEach(([nombre, count]) => {
    console.log(`   ${nombre} - ${count} veces`);
    const ocurrencias = tablas.filter(t => t.nombre === nombre);
    ocurrencias.forEach((t, i) => {
      console.log(`      Ocurrencia ${i + 1}: línea ${t.linea}`);
    });
    console.log('');
  });
} else {
  console.log('✅ No hay tablas duplicadas\n');
}

// 2. Listar todas las tablas únicas
console.log('─'.repeat(70));
console.log('\n📋 LISTADO DE TABLAS ÚNICAS:\n');
Object.keys(tablasCount).sort().forEach((nombre, i) => {
  console.log(`${i + 1}. ${nombre}`);
});

// 3. Buscar vistas
console.log('\n─'.repeat(70));
console.log('\n🔍 VISTAS SQL:\n');
const createViewRegex = /CREATE\s+(?:OR REPLACE\s+)?VIEW\s+public\.(\w+)/gi;
const vistas = [];

while ((match = createViewRegex.exec(schema)) !== null) {
  vistas.push({
    nombre: match[1],
    linea: schema.substring(0, match.index).split('\n').length
  });
}

if (vistas.length > 0) {
  vistas.forEach((v, i) => {
    console.log(`${i + 1}. ${v.nombre} (línea ${v.linea})`);
  });
} else {
  console.log('❌ No se encontraron vistas');
}

// 4. Buscar ALTER TABLE ENABLE RLS duplicados
console.log('\n─'.repeat(70));
console.log('\n🔒 ROW LEVEL SECURITY:\n');
const rlsRegex = /ALTER TABLE public\.(\w+) ENABLE ROW LEVEL SECURITY/gi;
const rlsTables = [];

while ((match = rlsRegex.exec(schema)) !== null) {
  rlsTables.push({
    nombre: match[1],
    linea: schema.substring(0, match.index).split('\n').length
  });
}

const rlsCount = {};
rlsTables.forEach(t => {
  rlsCount[t.nombre] = (rlsCount[t.nombre] || 0) + 1;
});

const rlsDuplicados = Object.entries(rlsCount).filter(([_, count]) => count > 1);

if (rlsDuplicados.length > 0) {
  console.log('⚠️  ENABLE RLS duplicado en:\n');
  rlsDuplicados.forEach(([nombre, count]) => {
    console.log(`   ${nombre} - ${count} veces`);
    const ocurrencias = rlsTables.filter(t => t.nombre === nombre);
    ocurrencias.forEach((t, i) => {
      console.log(`      Ocurrencia ${i + 1}: línea ${t.linea}`);
    });
    console.log('');
  });
} else {
  console.log('✅ No hay ENABLE RLS duplicados\n');
}

console.log(`Total de tablas con RLS: ${Object.keys(rlsCount).length}`);

// 5. Comparar tablas con RLS vs tablas creadas
console.log('\n─'.repeat(70));
console.log('\n🔍 VERIFICACIÓN DE RLS:\n');

const tablasUnicas = Object.keys(tablasCount);
const tablasSinRLS = tablasUnicas.filter(t => !rlsCount[t]);

if (tablasSinRLS.length > 0) {
  console.log('⚠️  Tablas SIN RLS habilitado:\n');
  tablasSinRLS.forEach(t => {
    console.log(`   ❌ ${t}`);
  });
} else {
  console.log('✅ Todas las tablas tienen RLS habilitado');
}

// 6. Buscar políticas RLS
console.log('\n─'.repeat(70));
console.log('\n🛡️  POLÍTICAS RLS:\n');
const policyRegex = /CREATE POLICY "([^"]+)"\s+ON public\.(\w+)/gi;
const policies = [];

while ((match = policyRegex.exec(schema)) !== null) {
  policies.push({
    nombre: match[1],
    tabla: match[2],
    linea: schema.substring(0, match.index).split('\n').length
  });
}

console.log(`Total de políticas: ${policies.length}\n`);

const policiesPorTabla = {};
policies.forEach(p => {
  if (!policiesPorTabla[p.tabla]) {
    policiesPorTabla[p.tabla] = [];
  }
  policiesPorTabla[p.tabla].push(p.nombre);
});

Object.entries(policiesPorTabla).sort().forEach(([tabla, pols]) => {
  console.log(`${tabla} (${pols.length} políticas):`);
  pols.forEach(pol => {
    console.log(`   • ${pol}`);
  });
  console.log('');
});

// 7. Buscar índices
console.log('─'.repeat(70));
console.log('\n📑 ÍNDICES:\n');
const indexRegex = /CREATE INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)\s+ON public\.(\w+)/gi;
const indices = [];

while ((match = indexRegex.exec(schema)) !== null) {
  indices.push({
    nombre: match[1],
    tabla: match[2],
    linea: schema.substring(0, match.index).split('\n').length
  });
}

console.log(`Total de índices: ${indices.length}\n`);

const indicesPorTabla = {};
indices.forEach(idx => {
  if (!indicesPorTabla[idx.tabla]) {
    indicesPorTabla[idx.tabla] = [];
  }
  indicesPorTabla[idx.tabla].push(idx.nombre);
});

Object.entries(indicesPorTabla).sort().forEach(([tabla, idxs]) => {
  console.log(`${tabla} (${idxs.length} índices):`);
  idxs.forEach(idx => {
    console.log(`   • ${idx}`);
  });
  console.log('');
});

// 8. Resumen final
console.log('═'.repeat(70));
console.log('\n📊 RESUMEN FINAL:\n');
console.log(`Tablas únicas:         ${tablasUnicas.length}`);
console.log(`Vistas:                ${vistas.length}`);
console.log(`Políticas RLS:         ${policies.length}`);
console.log(`Índices:               ${indices.length}`);
console.log('');

if (duplicadas.length > 0 || rlsDuplicados.length > 0 || tablasSinRLS.length > 0) {
  console.log('⚠️  PROBLEMAS ENCONTRADOS:\n');
  if (duplicadas.length > 0) {
    console.log(`   • ${duplicadas.length} tabla(s) duplicada(s)`);
  }
  if (rlsDuplicados.length > 0) {
    console.log(`   • ${rlsDuplicados.length} ENABLE RLS duplicado(s)`);
  }
  if (tablasSinRLS.length > 0) {
    console.log(`   • ${tablasSinRLS.length} tabla(s) sin RLS`);
  }
  console.log('\n❌ Se requiere limpieza del esquema SQL\n');
} else {
  console.log('✅ El esquema está limpio y consistente\n');
}

// 9. Exportar lista de tablas para scripts
console.log('─'.repeat(70));
console.log('\n📝 LISTA DE TABLAS PARA SCRIPTS:\n');
console.log('const TABLAS = [');
tablasUnicas.sort().forEach(t => {
  console.log(`  '${t}',`);
});
console.log('];\n');
