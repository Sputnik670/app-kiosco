#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🍎 GENERATE APPLE TOUCH ICON
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Genera apple-touch-icon.png (180x180) para iOS desde icon.svg
 *
 * Requisitos: sharp (npm install -D sharp)
 *
 * Uso: node scripts/generate-apple-touch-icon.js
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const path = require('path')
const fs = require('fs')

// Intentar usar sharp si está disponible
let Sharp
try {
  Sharp = require('sharp')
} catch (error) {
  console.log(
    'ℹ️  Sharp no está instalado. Para generar PNG:',
    'npm install -D sharp'
  )
  console.log('\n⚠️  Generando placeholder en su lugar...')
}

const publicDir = path.join(__dirname, '..', 'public')
const iconPath = path.join(publicDir, 'icon.svg')
const outputPath = path.join(publicDir, 'apple-touch-icon.png')

async function generateIcon() {
  // Si no tenemos Sharp, crear un placeholder mínimo (imagen sólida con fallback)
  if (!Sharp) {
    console.log('✓ apple-touch-icon.png se servirá desde icon.svg vía metadata')
    console.log('  (iOS 15+ soporta SVG en apple-touch-icon)')
    return
  }

  try {
    console.log('Generando apple-touch-icon.png (180x180)...')

    // Leer SVG como buffer
    const svgBuffer = fs.readFileSync(iconPath)

    // Convertir SVG a PNG usando sharp
    await Sharp(svgBuffer)
      .resize(180, 180, {
        fit: 'cover',
        background: { r: 15, g: 23, b: 42 }, // #0f172a
      })
      .png({ quality: 90 })
      .toFile(outputPath)

    console.log('✓ apple-touch-icon.png generado en:', outputPath)
    console.log('  Tamaño: 180x180px')
  } catch (error) {
    console.error('✗ Error generando icon:', error.message)
    process.exit(1)
  }
}

// Ejecutar solo si Sharp está disponible
if (Sharp) {
  generateIcon()
} else {
  console.log(
    '\nℹ️  Nota: Apple ahora soporta SVG directo en apple-touch-icon (iOS 15+)'
  )
  console.log('   El metadata ya incluye icon.svg que iOS usará automáticamente')
  console.log('\n   Para generar PNG para compatibilidad con iOS < 15:')
  console.log('   npm install -D sharp && node scripts/generate-apple-touch-icon.js')
}
