# Guía de Deployment - SaaS Kiosco

## Índice
1. [Pre-requisitos](#pre-requisitos)
2. [Variables de Entorno](#variables-de-entorno)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Configuración de Supabase](#configuración-de-supabase)
5. [Despliegue en Vercel](#despliegue-en-vercel)
6. [Health Check](#health-check)
7. [Migración de Datos](#migración-de-datos)
8. [Verificación Post-Deploy](#verificación-post-deploy)
9. [Rollback](#rollback-de-emergencia)
10. [Troubleshooting](#troubleshooting)

---

## Pre-requisitos

### Cuentas Necesarias
- [ ] Cuenta de Supabase (gratuita o Pro)
- [ ] Cuenta de Vercel (gratuita o Pro)
- [ ] Cuenta de GitHub (para repositorio del código)
- [ ] Node.js 18+ instalado localmente

### Herramientas
```bash
node --version  # >= 18.0.0
npm --version   # >= 8.0.0
git --version   # >= 2.0.0
```

---

## Variables de Entorno

Todas las variables de entorno necesarias para compilar y ejecutar la app. NO incluir valores reales en el repositorio.

### Variables requeridas (build y runtime)

| Variable | Tipo | Descripcion |
|----------|------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser + server) | URL del proyecto Supabase (`https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser + server) | Clave anon/publica de Supabase |

### Variables opcionales

| Variable | Tipo | Descripcion |
|----------|------|-------------|
| `NEXT_PUBLIC_APP_URL` | Public | URL de la app desplegada (para redirects de auth) |
| `NEXT_PUBLIC_PWA_ENABLED` | Public | Activar/desactivar PWA (`true`/`false`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Clave de servicio para migraciones y admin. NUNCA exponer al browser. |
| `VERCEL_URL` | Auto (Vercel) | Vercel inyecta esta variable automaticamente. |

### Donde configurar

| Entorno | Ubicacion |
|---------|-----------|
| Local | `.env.local` (ya en `.gitignore`) |
| CI/CD (GitHub Actions) | Repository Settings > Secrets and variables > Actions |
| Produccion / Preview | Vercel Dashboard > Project Settings > Environment Variables |

---

## CI/CD Pipeline

El proyecto usa GitHub Actions para validar cada push y pull request antes del deploy.

### Archivo: `.github/workflows/ci.yml`

**Se ejecuta en:**
- Push a `main`
- Pull request a `main`

**Pasos del pipeline:**
1. Checkout del codigo
2. Setup Node.js 20 (con cache de npm)
3. `npm ci` - instalar dependencias
4. `npx tsc --noEmit` - verificacion de tipos TypeScript
5. `npx vitest run` - ejecutar 146+ tests unitarios
6. `npm run build` - compilar Next.js

**Secrets necesarios en GitHub:**
- `NEXT_PUBLIC_SUPABASE_URL` - requerido para build
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - requerido para build

Para configurarlos:
1. Ir al repositorio en GitHub
2. Settings > Secrets and variables > Actions
3. Click "New repository secret" para cada variable

**Nota:** El pipeline NO hace deploy automatico. El deploy se hace manualmente via Vercel o aprobacion manual.

### Archivo existente: `.github/workflows/keep-alive.yml`

Ping semanal a Supabase (lunes 10:00 UTC) para evitar que el proyecto free-tier se pause por inactividad.

---

## Configuración de Supabase

### 1. Crear Proyecto en Supabase

1. Ir a https://supabase.com/dashboard
2. Crear nuevo proyecto:
   - **Nombre**: `app-kiosco-prod` (o tu nombre preferido)
   - **Database Password**: Guardar en lugar seguro
   - **Region**: Elegir más cercana a tus usuarios
   - **Plan**: Pro recomendado para producción

3. Esperar ~2 minutos a que el proyecto se provisione

### 2. Obtener Credenciales

Una vez creado el proyecto:

1. Ir a **Settings → API**
2. Copiar las siguientes credenciales:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: Clave pública (segura para el browser)
   - **service_role key**: ⚠️ **CRÍTICO - NUNCA EXPONER** ⚠️

3. Guardar estas credenciales en un gestor de contraseñas

### 3. Ejecutar Migraciones SQL

**IMPORTANTE**: Ejecutar en este orden exacto.

#### Paso 3.1: Verificar Funciones V2 Existen

```bash
# Conectar a SQL Editor en Supabase Dashboard
# Verificar que estas migraciones ya existen:
# - 20260112_create_v2_functions.sql
# Si no existen, contactar al equipo de desarrollo
```

#### Paso 3.2: Habilitar RLS

```sql
-- Copiar y pegar todo el contenido de:
-- supabase/migrations/20260120_enable_rls_all_tables.sql
```

**Verificación**:
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('productos', 'stock', 'ventas', 'sucursales');
-- Todas deben tener rowsecurity = true
```

#### Paso 3.3: Crear Políticas RLS

```sql
-- Copiar y pegar todo el contenido de:
-- supabase/migrations/20260120_create_rls_policies.sql
```

**Verificación**:
```sql
SELECT tablename, COUNT(*) as policies
FROM pg_policies
WHERE tablename IN ('productos', 'stock', 'ventas')
GROUP BY tablename;
-- Cada tabla debe tener al menos 4-5 políticas
```

#### Paso 3.4: Actualizar Funciones RPC

```sql
-- Copiar y pegar todo el contenido de:
-- supabase/migrations/20260120_add_org_validation_rpcs.sql
```

**Verificación**:
```sql
SELECT proname FROM pg_proc
WHERE proname IN ('procesar_venta', 'verificar_stock_disponible')
AND prosecdef = true;
-- Ambas funciones deben existir
```

#### Paso 3.5: Estandarizar Roles

```sql
-- Copiar y pegar todo el contenido de:
-- supabase/migrations/20260120_standardize_roles.sql
```

#### Paso 3.6: Agregar Índices de Performance

```sql
-- Copiar y pegar todo el contenido de:
-- supabase/migrations/20260121_add_performance_indexes.sql
```

**Verificación**:
```sql
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
-- Debe retornar 50+ índices
```

#### Paso 3.7: Validar Seguridad

```sql
-- Copiar y pegar todo el contenido de:
-- scripts/validate-security.sql

-- Revisar que todos los tests pasen:
-- ✅ RLS habilitado en todas las tablas
-- ✅ Políticas creadas
-- ✅ Funciones V2 existen
```

### 4. Configurar Storage (Opcional)

Si usas Supabase Storage para QR codes o imágenes:

1. Ir a **Storage → Create Bucket**
2. Nombre: `qr-codes`
3. Public: `false` (privado)
4. RLS Policies:
```sql
-- Usuarios pueden ver QR codes de su organización
CREATE POLICY "users_see_own_org_qr"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.get_my_org_id_v2())
);
```

### 5. Backup Inicial

**CRÍTICO**: Crear backup antes de cualquier migración de datos.

1. Ir a **Settings → Database → Backups**
2. Click en **Create Backup**
3. Nombrar: `pre-production-migration`
4. Esperar confirmación

---

## Despliegue en Vercel

### 1. Conectar Repositorio GitHub

1. Ir a https://vercel.com/new
2. Click en **Import Git Repository**
3. Seleccionar el repositorio del proyecto
4. Click en **Import**

### 2. Configurar Variables de Entorno

En la pantalla de configuración del proyecto:

1. Click en **Environment Variables**
2. Agregar las siguientes variables:

```bash
# Supabase (REQUERIDO)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ⚠️ Service Role Key - SOLO para migraciones
# NO agregar en producción si no es necesario
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App URL (OPCIONAL)
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

3. Seleccionar environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

### 3. Configurar Build Settings

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

Vercel detecta automáticamente Next.js, así que esto ya está configurado.

### 4. Deploy

1. Click en **Deploy**
2. Esperar ~3-5 minutos
3. Vercel mostrará la URL del deploy: `https://tu-proyecto.vercel.app`

### 5. Configurar Dominio Personalizado (Opcional)

1. En Vercel Dashboard → **Settings → Domains**
2. Agregar dominio: `app.tu-empresa.com`
3. Configurar DNS según instrucciones de Vercel
4. Esperar propagación DNS (~10 minutos)

---

## Health Check

La app expone un endpoint `/api/health` para monitoreo.

### URL

```
GET https://tu-dominio.vercel.app/api/health
```

### Respuesta esperada

```json
{
  "status": "ok",
  "timestamp": "2026-02-26T12:00:00.000Z",
  "version": "0.1.0",
  "supabase": "connected",
  "uptime": 12345.678,
  "responseTimeMs": 45,
  "dbLatencyMs": 30
}
```

### Campos

| Campo | Descripcion |
|-------|-------------|
| `status` | Siempre `"ok"` (retorna 200 incluso si Supabase esta caido) |
| `timestamp` | Hora UTC del server |
| `version` | Version del `package.json` |
| `supabase` | `"connected"` o `"error"` |
| `uptime` | Segundos desde el inicio del proceso Node.js |
| `responseTimeMs` | Tiempo total del handler en ms |
| `dbLatencyMs` | Tiempo de la query a Supabase en ms (null si falla) |

### Verificar el deploy

Despues de cada deploy, verificar:

```bash
curl -s https://tu-dominio.vercel.app/api/health | jq .
```

Si `supabase` muestra `"error"`, verificar las variables de entorno en Vercel.

### Uso para monitoreo externo

Se puede conectar a servicios como UptimeRobot, Better Uptime, o cron jobs que hagan ping periodicamente y alerten si el endpoint no responde o si `supabase` esta en `"error"`.

---

## Migración de Datos

### Pre-migración: Recolectar Datos del Cliente

Solicitar al cliente:
- [ ] Excel/CSV con productos actuales
- [ ] Lista de sucursales con direcciones
- [ ] Lista de empleados con emails
- [ ] Proveedores existentes
- [ ] Datos históricos de ventas (opcional)

### Migración Paso a Paso

#### 1. Crear Organización Principal

```typescript
// En Supabase SQL Editor o usando scripts/migrate.ts
// Usar service_role_key para bypass RLS

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS
);

// 1. Crear owner user (si no existe en Supabase Auth)
const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
  email: 'dueño@cliente.com',
  password: 'password_temporal_123',
  email_confirm: true
});

// 2. Crear setup inicial
const { data, error } = await supabase.rpc('create_initial_setup_v2', {
  p_user_id: authUser.user.id,
  p_org_name: 'Cadena Kioscos XYZ',
  p_profile_name: 'Juan Pérez',
  p_email: 'dueño@cliente.com'
});

console.log('Organization created:', data);
```

#### 2. Importar Sucursales

```typescript
const sucursales = [
  { nombre: 'Kiosco Centro', direccion: 'Av. Principal 123' },
  { nombre: 'Kiosco Norte', direccion: 'Calle 45 #678' },
  // ... más sucursales
];

for (const sucursal of sucursales) {
  const { data, error } = await supabase
    .from('sucursales')
    .insert({
      organization_id: data.organization.id,
      nombre: sucursal.nombre,
      direccion: sucursal.direccion
    });
}
```

#### 3. Importar Productos

```typescript
import * as XLSX from 'xlsx';

const workbook = XLSX.readFile('productos_cliente.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const productos = XLSX.utils.sheet_to_json(sheet);

for (const producto of productos) {
  const { data, error } = await supabase.rpc('create_full_product', {
    p_organization_id: organizationId,
    p_nombre: producto.nombre,
    p_categoria: producto.categoria,
    p_precio_venta: producto.precio,
    p_costo: producto.costo,
    p_codigo_barras: producto.codigo_barras,
    p_stock_inicial: producto.stock,
    p_sucursal_id: sucursalId
  });

  if (error) {
    console.error('Error importing product:', producto.nombre, error);
  }
}
```

#### 4. Invitar Empleados

```typescript
const empleados = [
  { email: 'empleado1@cliente.com', nombre: 'María García', sucursal_id: 'xxx' },
  { email: 'empleado2@cliente.com', nombre: 'Carlos López', sucursal_id: 'yyy' },
];

for (const empleado of empleados) {
  // Crear usuario en Supabase Auth
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: empleado.email,
    password: 'temporal123', // Usuario debe cambiar en primer login
    email_confirm: true
  });

  // Asignar rol
  await supabase.rpc('assign_user_role_v2', {
    p_user_id: authUser.user.id,
    p_organization_id: organizationId,
    p_role: 'employee',
    p_sucursal_id: empleado.sucursal_id
  });

  // Crear perfil
  await supabase.from('perfiles').insert({
    id: authUser.user.id,
    nombre: empleado.nombre,
    email: empleado.email,
    organization_id: organizationId,
    rol: 'employee'
  });
}
```

### Validación Post-Migración

```sql
-- 1. Verificar organizaciones
SELECT id, nombre, owner_id FROM organizations;

-- 2. Verificar sucursales
SELECT COUNT(*), organization_id FROM sucursales GROUP BY organization_id;

-- 3. Verificar productos
SELECT COUNT(*), organization_id FROM productos GROUP BY organization_id;

-- 4. Verificar empleados
SELECT COUNT(*), organization_id FROM perfiles GROUP BY organization_id;

-- 5. Verificar stock inicial
SELECT SUM(cantidad_disponible), organization_id FROM stock GROUP BY organization_id;
```

---

## Verificación Post-Deploy

### Checklist Funcional

- [ ] **Autenticación**
  - [ ] Registro de nuevo usuario funciona
  - [ ] Login funciona
  - [ ] Logout funciona
  - [ ] Reset password funciona

- [ ] **Ventas**
  - [ ] Escanear código de barras funciona
  - [ ] Agregar productos al carrito
  - [ ] Procesar venta reduce stock
  - [ ] Generar ticket PDF
  - [ ] Movimiento de caja registrado

- [ ] **Inventario**
  - [ ] Agregar stock funciona
  - [ ] Stock crítico muestra alertas
  - [ ] Vencimientos próximos alertan
  - [ ] Merma reduce stock

- [ ] **Fichaje**
  - [ ] Escanear QR entrada registra
  - [ ] Escanear QR salida actualiza
  - [ ] Doble fichaje se previene

- [ ] **Multitenancy**
  - [ ] Crear 2 organizaciones de prueba
  - [ ] Verificar que org A no ve datos de org B
  - [ ] Intentar acceso cruzado (debe fallar)

### Tests de Performance

```bash
# Lighthouse (PWA Score)
npx lighthouse https://tu-app.vercel.app --view

# Esperado:
# - Performance: 90+
# - Accessibility: 90+
# - Best Practices: 90+
# - SEO: 90+
# - PWA: 100
```

### Monitoreo Inicial

1. **Vercel Analytics**
   - Ir a Vercel Dashboard → Analytics
   - Verificar que está recibiendo datos

2. **Supabase Logs**
   - Ir a Supabase Dashboard → Logs
   - Filtrar por errores
   - Verificar que no hay errores críticos

3. **Errores de RLS**
   - Buscar: "permission denied" o "RLS"
   - Si aparecen, revisar políticas

---

## Troubleshooting

### Error: "RLS policy violation"

**Síntoma**: Usuarios no pueden ver sus propios datos.

**Solución**:
```sql
-- Verificar que get_my_org_id_v2 retorna valor
SELECT public.get_my_org_id_v2();

-- Si retorna NULL, verificar user_organization_roles
SELECT * FROM user_organization_roles WHERE user_id = auth.uid();

-- Debe existir un registro con is_active = true
```

### Error: "Function get_my_org_id_v2 does not exist"

**Síntoma**: Políticas RLS fallan.

**Solución**:
```sql
-- Ejecutar migración de funciones V2
-- supabase/migrations/20260112_create_v2_functions.sql
```

### Error: "Service role key exposed"

**Síntoma**: service_role_key está en variables de entorno del browser.

**Solución**:
1. Ir a Vercel → Settings → Environment Variables
2. Eliminar `SUPABASE_SERVICE_ROLE_KEY` de Production
3. Re-deploy
4. Regenerar service_role_key en Supabase (Settings → API → Reset)

### Performance Lento

**Síntoma**: Queries tardan >2 segundos.

**Diagnóstico**:
```sql
-- Ver queries lentas
SELECT calls, mean_exec_time, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Solución**:
```sql
-- Verificar índices existen
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%';

-- Si faltan, ejecutar:
-- supabase/migrations/20260121_add_performance_indexes.sql
```

### PWA No Instala

**Síntoma**: No aparece opción "Agregar a pantalla de inicio".

**Verificación**:
1. Abrir DevTools → Application → Manifest
2. Verificar que `/manifest.json` carga correctamente
3. Verificar Service Worker está activo

**Solución**:
- Verificar que HTTPS está habilitado (Vercel lo hace automáticamente)
- Verificar que `manifest.json` es válido
- Limpiar caché y recargar

---

## Rollback de Emergencia

Si algo sale mal en producción:

### 1. Rollback de Deploy (Vercel)

```bash
# En Vercel Dashboard
1. Ir a Deployments
2. Encontrar último deploy estable
3. Click en "..." → "Promote to Production"
```

### 2. Rollback de Base de Datos (Supabase)

```bash
# En Supabase Dashboard
1. Ir a Settings → Database → Backups
2. Seleccionar backup pre-migración
3. Click en "Restore"
4. Confirmar (⚠️ esto sobrescribe la BD actual)
```

### 3. Deshabilitar RLS Temporalmente

**SOLO EN EMERGENCIA**:
```sql
-- Deshabilitar RLS en tablas críticas
ALTER TABLE productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventas DISABLE ROW LEVEL SECURITY;

-- ⚠️ INSEGURO - solo para debugging temporal
-- Re-habilitar ASAP
```

---

## Contactos de Soporte

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/dashboard/support
- **Documentación Next.js**: https://nextjs.org/docs
- **GitHub Issues**: https://github.com/tu-org/app-kiosco/issues

---

## Próximos Pasos

Después del deploy exitoso:

1. **Capacitación de Usuarios**
   - Agendar sesión con dueños
   - Agendar sesión con empleados

2. **Monitoreo Continuo**
   - Revisar logs diariamente (primera semana)
   - Configurar alertas en Vercel/Supabase

3. **Optimizaciones**
   - Analizar queries lentas
   - Agregar índices adicionales si es necesario

4. **Backups Automáticos**
   - Configurar backups diarios en Supabase
   - Retención: 30 días
