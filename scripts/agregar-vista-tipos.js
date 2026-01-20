#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'types', 'database.types.ts');

console.log('📝 Agregando vista reportes_ventas_unificados a database.types.ts...\n');

// Leer archivo en UTF-16LE
const content = fs.readFileSync(filePath, 'utf16le');

// Verificar si la vista ya existe
if (content.includes('reportes_ventas_unificados')) {
  console.log('✅ La vista ya existe en el archivo');
  process.exit(0);
}

// Encontrar el cierre de la sección Views (justo antes de Functions)
const searchPattern = '    }\n    Functions: {';
const viewsEndIndex = content.indexOf(searchPattern);

if (viewsEndIndex === -1) {
  console.error('❌ No se encontró el cierre de Views');
  process.exit(1);
}

// Nueva vista a insertar
const newView = `      reportes_ventas_unificados: {
        Row: {
          venta_id: string | null
          organization_id: string | null
          sucursal_id: string | null
          caja_diaria_id: string | null
          fecha_venta: string | null
          tipo_venta: string | null
          descripcion: string | null
          icono: string | null
          referencia_id: string | null
          unidades_vendidas: number | null
          precio_unitario: number | null
          monto_total: number | null
          costo_unitario: number | null
          ganancia_neta: number | null
          metodo_pago: string | null
          notas: string | null
          timestamp_original: string | null
        }
        Relationships: []
      }
`;

// Insertar la nueva vista
const newContent = content.slice(0, viewsEndIndex) + newView + '\n' + content.slice(viewsEndIndex);

// Escribir el archivo de vuelta en UTF-16LE
fs.writeFileSync(filePath, newContent, 'utf16le');

console.log('✅ Vista reportes_ventas_unificados agregada exitosamente');
console.log('✅ Archivo: types/database.types.ts');
console.log('\n🎯 Próximo paso: Ejecuta "npm run build" para verificar');
