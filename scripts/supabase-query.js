#!/usr/bin/env node

/**
 * Script interactivo para hacer queries a Supabase
 * Uso: node scripts/supabase-query.js [comando]
 *
 * Comandos disponibles:
 *   stats       - Mostrar estadísticas generales
 *   orgs        - Listar organizaciones
 *   users       - Listar usuarios
 *   sucursales  - Listar sucursales
 *   asistencia  - Listar registros de asistencia
 *   productos   - Listar productos
 *   cajas       - Listar cajas diarias
 *   all         - Mostrar todo (por defecto)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Faltan credenciales de Supabase');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utilidad para formatear fechas
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

// Utilidad para formatear duración
function formatDuration(entrada, salida) {
  if (!entrada || !salida) return 'En curso';
  const diff = new Date(salida) - new Date(entrada);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

// Comando: Estadísticas generales
async function mostrarStats() {
  console.log('\n📊 ESTADÍSTICAS GENERALES');
  console.log('═'.repeat(60));

  const stats = {};

  // Contar registros en cada tabla (14 tablas oficiales)
  const tablas = [
    'asistencia',
    'caja_diaria',
    'compras',
    'historial_precios',
    'misiones',
    'movimientos_caja',
    'organizations',
    'pending_invites',
    'perfiles',
    'plantillas_misiones',
    'productos',
    'proveedores',
    'stock',
    'sucursales'
  ];

  for (const tabla of tablas) {
    const { count, error } = await supabase
      .from(tabla)
      .select('*', { count: 'exact', head: true });

    stats[tabla] = error ? 0 : (count || 0);
  }

  console.log('\n🏢 Organizaciones:         ', stats.organizations);
  console.log('👥 Usuarios (perfiles):    ', stats.perfiles);
  console.log('🏪 Sucursales:             ', stats.sucursales);
  console.log('📦 Productos:              ', stats.productos);
  console.log('📊 Stock (movimientos):    ', stats.stock);
  console.log('🚚 Proveedores:            ', stats.proveedores);
  console.log('🛒 Compras:                ', stats.compras);
  console.log('💰 Cajas diarias:          ', stats.caja_diaria);
  console.log('💵 Movimientos de caja:    ', stats.movimientos_caja);
  console.log('🎯 Misiones:               ', stats.misiones);
  console.log('📋 Plantillas misiones:    ', stats.plantillas_misiones);
  console.log('💲 Historial de precios:   ', stats.historial_precios);
  console.log('⏰ Asistencias (fichajes): ', stats.asistencia);
  console.log('📧 Invitaciones pend.:     ', stats.pending_invites);

  // Calcular totales
  const totalRegistros = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log('\n' + '─'.repeat(60));
  console.log(`📈 Total de registros: ${totalRegistros}`);

  return stats;
}

// Comando: Listar organizaciones
async function listarOrganizaciones() {
  console.log('\n🏢 ORGANIZACIONES');
  console.log('═'.repeat(60));

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n📭 No hay organizaciones registradas');
    return;
  }

  console.log(`\nTotal: ${data.length}\n`);
  data.forEach((org, i) => {
    console.log(`${i + 1}. ${org.nombre || '(Sin nombre)'}`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Creado: ${formatDate(org.created_at)}`);
    console.log('');
  });
}

// Comando: Listar usuarios
async function listarUsuarios() {
  console.log('\n👥 USUARIOS (PERFILES)');
  console.log('═'.repeat(60));

  const { data, error } = await supabase
    .from('perfiles')
    .select(`
      id,
      nombre,
      email,
      rol,
      xp,
      nivel,
      organization_id,
      sucursal_id,
      created_at,
      organizations(nombre),
      sucursales(nombre)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n📭 No hay usuarios registrados');
    return;
  }

  const duenos = data.filter(u => u.rol === 'dueño');
  const empleados = data.filter(u => u.rol === 'empleado');

  console.log(`\nTotal: ${data.length} (${duenos.length} dueños, ${empleados.length} empleados)\n`);

  if (duenos.length > 0) {
    console.log('🔑 DUEÑOS:\n');
    duenos.forEach((u, i) => {
      console.log(`${i + 1}. ${u.nombre || u.email || 'Sin nombre'}`);
      console.log(`   Email: ${u.email || 'N/A'}`);
      console.log(`   Organización: ${u.organizations?.nombre || 'N/A'}`);
      console.log(`   Registrado: ${formatDate(u.created_at)}`);
      console.log('');
    });
  }

  if (empleados.length > 0) {
    console.log('👤 EMPLEADOS:\n');
    empleados.forEach((u, i) => {
      console.log(`${i + 1}. ${u.nombre || u.email || 'Sin nombre'}`);
      console.log(`   Email: ${u.email || 'N/A'}`);
      console.log(`   Organización: ${u.organizations?.nombre || 'N/A'}`);
      console.log(`   Sucursal: ${u.sucursales?.nombre || 'No asignada'}`);
      console.log(`   Nivel: ${u.nivel || 1} (XP: ${u.xp || 0})`);
      console.log(`   Registrado: ${formatDate(u.created_at)}`);
      console.log('');
    });
  }
}

// Comando: Listar sucursales
async function listarSucursales() {
  console.log('\n🏪 SUCURSALES');
  console.log('═'.repeat(60));

  const { data, error } = await supabase
    .from('sucursales')
    .select(`
      id,
      nombre,
      direccion,
      qr_entrada_url,
      qr_salida_url,
      created_at,
      organizations(nombre)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n📭 No hay sucursales registradas');
    return;
  }

  console.log(`\nTotal: ${data.length}\n`);
  data.forEach((s, i) => {
    console.log(`${i + 1}. ${s.nombre}`);
    console.log(`   Organización: ${s.organizations?.nombre || 'N/A'}`);
    console.log(`   Dirección: ${s.direccion || 'No especificada'}`);
    console.log(`   QR Entrada: ${s.qr_entrada_url ? '✅ Configurado' : '❌ Sin configurar'}`);
    console.log(`   QR Salida: ${s.qr_salida_url ? '✅ Configurado' : '❌ Sin configurar'}`);
    console.log(`   Creado: ${formatDate(s.created_at)}`);
    console.log('');
  });
}

// Comando: Listar asistencias
async function listarAsistencias() {
  console.log('\n⏰ REGISTROS DE ASISTENCIA');
  console.log('═'.repeat(60));

  const { data, error } = await supabase
    .from('asistencia')
    .select(`
      id,
      entrada,
      salida,
      created_at,
      perfiles(nombre, email),
      sucursales(nombre),
      organizations(nombre)
    `)
    .order('entrada', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n📭 No hay registros de asistencia');
    return;
  }

  console.log(`\nMostrando últimos ${data.length} registros\n`);
  data.forEach((a, i) => {
    const empleado = a.perfiles?.nombre || a.perfiles?.email || 'Empleado eliminado';
    const sucursal = a.sucursales?.nombre || 'Sucursal eliminada';
    const org = a.organizations?.nombre || 'N/A';
    const duracion = formatDuration(a.entrada, a.salida);
    const estado = a.salida ? '✅ Finalizado' : '🔵 En curso';

    console.log(`${i + 1}. ${empleado} → ${sucursal}`);
    console.log(`   Organización: ${org}`);
    console.log(`   Estado: ${estado}`);
    console.log(`   📥 Entrada: ${formatDate(a.entrada)}`);
    console.log(`   📤 Salida:  ${a.salida ? formatDate(a.salida) : '⏳ En curso'}`);
    console.log(`   ⏱️  Duración: ${duracion}`);
    console.log('');
  });

  // Mostrar asistencias abiertas
  const abiertas = data.filter(a => !a.salida);
  if (abiertas.length > 0) {
    console.log('─'.repeat(60));
    console.log(`\n🔵 Asistencias activas: ${abiertas.length}`);
  }
}

// Comando: Listar productos
async function listarProductos() {
  console.log('\n📦 PRODUCTOS');
  console.log('═'.repeat(60));

  const { data, error } = await supabase
    .from('productos')
    .select(`
      id,
      nombre,
      emoji,
      precio_venta,
      costo,
      codigo_barras,
      categoria,
      created_at,
      organizations(nombre)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n📭 No hay productos registrados');
    return;
  }

  console.log(`\nMostrando ${data.length} productos\n`);
  data.forEach((p, i) => {
    const margen = p.precio_venta && p.costo
      ? ((p.precio_venta - p.costo) / p.costo * 100).toFixed(1)
      : 'N/A';

    console.log(`${i + 1}. ${p.emoji || '📦'} ${p.nombre}`);
    console.log(`   Organización: ${p.organizations?.nombre || 'N/A'}`);
    console.log(`   Categoría: ${p.categoria || 'Sin categoría'}`);
    console.log(`   💰 Precio: $${p.precio_venta || 0} | Costo: $${p.costo || 0} (Margen: ${margen}%)`);
    console.log(`   🔢 Código barras: ${p.codigo_barras || 'Sin código'}`);
    console.log(`   📅 Creado: ${formatDate(p.created_at)}`);
    console.log('');
  });
}

// Comando: Listar cajas
async function listarCajas() {
  console.log('\n💰 CAJAS DIARIAS');
  console.log('═'.repeat(60));

  const { data, error } = await supabase
    .from('caja_diaria')
    .select(`
      id,
      fecha_apertura,
      fecha_cierre,
      monto_inicial,
      monto_final,
      turno,
      perfiles(nombre, email),
      sucursales(nombre),
      organizations(nombre)
    `)
    .order('fecha_apertura', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('\n📭 No hay cajas registradas');
    return;
  }

  console.log(`\nMostrando últimas ${data.length} cajas\n`);
  data.forEach((c, i) => {
    const empleado = c.perfiles?.nombre || c.perfiles?.email || 'Empleado eliminado';
    const sucursal = c.sucursales?.nombre || 'Sucursal eliminada';
    const org = c.organizations?.nombre || 'N/A';
    const estado = c.fecha_cierre ? '🔴 Cerrada' : '🟢 Abierta';
    const diferencia = c.monto_final && c.monto_inicial
      ? (c.monto_final - c.monto_inicial).toFixed(2)
      : 'N/A';

    console.log(`${i + 1}. ${empleado} → ${sucursal}`);
    console.log(`   Organización: ${org}`);
    console.log(`   Estado: ${estado}`);
    console.log(`   Turno: ${c.turno || 'N/A'}`);
    console.log(`   📅 Apertura: ${formatDate(c.fecha_apertura)}`);
    console.log(`   📅 Cierre:   ${c.fecha_cierre ? formatDate(c.fecha_cierre) : '⏳ Abierta'}`);
    console.log(`   💵 Inicial: $${c.monto_inicial || 0}`);
    console.log(`   💵 Final:   $${c.monto_final || 0}`);
    console.log(`   📊 Diferencia: $${diferencia}`);
    console.log('');
  });

  // Mostrar cajas abiertas
  const abiertas = data.filter(c => !c.fecha_cierre);
  if (abiertas.length > 0) {
    console.log('─'.repeat(60));
    console.log(`\n🟢 Cajas abiertas: ${abiertas.length}`);
  }
}

// Main
async function main() {
  const comando = process.argv[2] || 'all';

  console.log('🔌 Conectado a Supabase');
  console.log(`📍 ${SUPABASE_URL}\n`);

  try {
    switch (comando) {
      case 'stats':
        await mostrarStats();
        break;
      case 'orgs':
        await listarOrganizaciones();
        break;
      case 'users':
        await listarUsuarios();
        break;
      case 'sucursales':
        await listarSucursales();
        break;
      case 'asistencia':
        await listarAsistencias();
        break;
      case 'productos':
        await listarProductos();
        break;
      case 'cajas':
        await listarCajas();
        break;
      case 'all':
        await mostrarStats();
        await listarOrganizaciones();
        await listarUsuarios();
        await listarSucursales();
        await listarAsistencias();
        break;
      default:
        console.log('❌ Comando no reconocido:', comando);
        console.log('\nComandos disponibles:');
        console.log('  stats       - Estadísticas generales');
        console.log('  orgs        - Listar organizaciones');
        console.log('  users       - Listar usuarios');
        console.log('  sucursales  - Listar sucursales');
        console.log('  asistencia  - Listar asistencias');
        console.log('  productos   - Listar productos');
        console.log('  cajas       - Listar cajas diarias');
        console.log('  all         - Mostrar todo');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();
