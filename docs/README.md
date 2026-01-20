# SaaS Kiosco - Documentación Completa

## Descripción General

SaaS multitenant para gestión integral de cadenas de kioscos y comercios minoristas. Solución completa para control de inventario, ventas, empleados, y caja.

**Stack Tecnológico**:
- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + PostgREST + Auth)
- **PWA**: Service Worker + Workbox (modo offline)
- **Deploy**: Vercel (frontend) + Supabase (backend)

---

## Índice de Documentación

### Para Desarrolladores
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guía completa de despliegue en producción
- [SEGURIDAD.md](./SEGURIDAD.md) - Políticas RLS y modelo de autorización
- [ARQUITECTURA.md](#arquitectura) - Diagrama de arquitectura (este archivo)
- [API.md](#api-reference) - Documentación de Server Actions y RPCs (este archivo)

### Para Usuarios
- [MANUAL_DUEÑOS.md](#manual-para-dueños) - Cómo usar la aplicación (owners)
- [MANUAL_EMPLEADOS.md](#manual-para-empleados) - Cómo usar la aplicación (employees)

### Para Administradores
- [TROUBLESHOOTING.md](#troubleshooting) - Problemas comunes y soluciones
- [BACKUP_RESTORE.md](#backup-y-restore) - Procedimientos de backup

---

## Arquitectura

### Diagrama General

```
┌─────────────────────────────────────────────────────────────┐
│                        USUARIOS                             │
│  (Dueños de kioscos, Empleados, Gerentes)                  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Edge Network)                    │
│  • CDN Global                                               │
│  • Next.js 16 App Router                                    │
│  • PWA (Service Worker)                                     │
│  • React 19 Client Components                               │
└────────────────────┬────────────────────────────────────────┘
                     │ Server Actions
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS SERVER                            │
│  • Server Actions (lib/actions/*.ts)                        │
│  • Middleware (auth validation)                             │
│  • API Routes                                               │
└────────────────────┬────────────────────────────────────────┘
                     │ Supabase Client
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (BaaS)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL 14.1                                    │   │
│  │  • RLS habilitado en todas las tablas               │   │
│  │  • Políticas de seguridad por organización          │   │
│  │  • Funciones RPC (procesar_venta, etc.)            │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Supabase Auth                                      │   │
│  │  • JWT tokens                                        │   │
│  │  • Email/Password                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgREST API                                      │   │
│  │  • REST endpoints auto-generados                    │   │
│  │  • Filtrado automático por RLS                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Arquitectura Multitenant

```
Organization (Tenant)
├── Sucursales (Branches)
│   ├── Sucursal Centro
│   ├── Sucursal Norte
│   └── Sucursal Sur
├── Usuarios (Users)
│   ├── Owner (dueño)
│   ├── Empleados
│   └── Gerentes
├── Productos (Products)
│   └── Stock por sucursal
├── Ventas (Sales)
├── Proveedores (Suppliers)
└── Cajas (Cash Registers)
```

**Aislamiento de Datos**:
- Cada fila tiene `organization_id`
- RLS filtra automáticamente por `organization_id` del usuario
- Imposible acceder a datos de otra organización (garantizado por BD)

### Flujo de Datos: Venta

```
1. Empleado escanea código de barras
   ↓
2. Frontend: searchProductsAction(codigo_barras)
   ↓
3. Server Action: Query a Supabase
   WHERE codigo_barras = ? AND organization_id = get_my_org_id_v2()
   ↓
4. RLS valida: usuario pertenece a org
   ↓
5. Retorna producto (si existe y pertenece a la org)
   ↓
6. Empleado confirma venta
   ↓
7. Frontend: confirmVentaAction(items, metodo_pago)
   ↓
8. Server Action: llama RPC procesar_venta()
   ↓
9. RPC procesar_venta():
   • Valida sucursal pertenece a org ✅
   • Valida caja pertenece a org ✅
   • Valida productos pertenecen a org ✅
   • Bloquea stock (FOR UPDATE) 🔒
   • Reduce stock (FIFO por vencimiento)
   • Crea venta + detalles
   • Registra movimiento de caja
   • Registra movimiento de stock
   • Actualiza misiones de empleado
   ↓
10. Retorna venta_id
   ↓
11. Frontend: genera ticket PDF
```

---

## API Reference

### Server Actions

Todas las Server Actions están en `lib/actions/*.ts` y son llamadas desde Client Components.

#### Authentication

**Archivo**: `lib/actions/auth.actions.ts`

```typescript
// Login
await signInWithPassword(email: string, password: string)
// Retorna: { user, session } o { error }

// Registro
await signUpWithEmail(email: string, password: string)
// Retorna: { user, session } o { error }

// Logout
await signOut()
```

#### Products

**Archivo**: `lib/actions/product.actions.ts`

```typescript
// Crear producto completo (producto + historial + stock inicial)
await createFullProductAction({
  nombre: string,
  categoria: string,
  precio_venta: number,
  costo: number,
  codigo_barras?: string,
  stock_inicial: number,
  sucursal_id: string,
  fecha_vencimiento?: Date
})

// Buscar productos (por nombre o código de barras)
await searchProductsAction(query: string)
// Retorna: Product[]

// Actualizar producto
await updateProductAction(id: string, data: Partial<Product>)

// Eliminar producto (solo owners)
await deleteProductAction(id: string)
```

#### Sales

**Archivo**: `lib/actions/ventas.actions.ts`

```typescript
// Procesar venta
await confirmVentaAction({
  sucursal_id: string,
  caja_diaria_id: string,
  items: Array<{ producto_id: string, cantidad: number }>,
  metodo_pago: 'efectivo' | 'tarjeta' | 'billetera_virtual',
  monto_total: number
})
// Retorna: { venta_id, success: true } o { error }

// Obtener ventas del día
await getVentasDelDiaAction(sucursal_id: string)
// Retorna: Venta[]
```

#### Inventory

**Archivo**: `lib/actions/inventory.actions.ts`

```typescript
// Agregar stock
await processComplexStockEntry({
  producto_id: string,
  sucursal_id: string,
  cantidad: number,
  costo_unitario: number,
  proveedor_id?: string,
  fecha_vencimiento?: Date
})

// Obtener stock crítico (< 7 días para vencer)
await getCriticalStockAction(sucursal_id: string)
// Retorna: StockCritico[]

// Procesar merma/pérdida
await processStockLossAction({
  stock_id: string,
  cantidad: number,
  motivo: string
})
```

#### Attendance

**Archivo**: `lib/actions/attendance.actions.ts`

```typescript
// Registrar entrada/salida
await toggleAttendanceAction(sucursal_id: string)
// Retorna: { tipo: 'entrada' | 'salida', timestamp: Date }

// Procesar QR de fichaje
await processQRScanAction({
  sucursal_id: string,
  tipo: 'entrada' | 'salida'
})

// Obtener horas trabajadas
await getEmployeeShiftsAction(
  empleado_id: string,
  fecha_inicio: Date,
  fecha_fin: Date
)
```

#### Cash Register

**Archivo**: `lib/actions/caja.actions.ts`

```typescript
// Abrir caja
await abrirCajaAction({
  sucursal_id: string,
  monto_inicial: number
})

// Cerrar caja (arqueo)
await cerrarCajaAction({
  caja_diaria_id: string,
  monto_declarado: number
})
// Retorna: {
//   dinero_esperado: number,
//   desvio: number,
//   arqueo_exitoso: boolean
// }
```

### RPC Functions

Funciones SQL que se llaman desde Server Actions.

#### `procesar_venta()`

**Parámetros**:
```typescript
{
  p_sucursal_id: string,
  p_caja_diaria_id: string,
  p_items: Array<{ producto_id: string, cantidad: number }>,
  p_metodo_pago_global: string,
  p_monto_total_cliente: number
}
```

**Retorna**: `UUID` (venta_id)

**Validaciones**:
- ✅ Sucursal pertenece a la org
- ✅ Caja pertenece a la org
- ✅ Productos pertenecen a la org
- ✅ Stock suficiente
- ✅ Bloqueo pesimista (FOR UPDATE)

**Efectos**:
- Crea venta + detalles
- Reduce stock (FIFO)
- Registra movimiento de caja
- Registra movimiento de stock

#### `create_initial_setup_v2()`

**Parámetros**:
```typescript
{
  p_user_id: string,
  p_org_name: string,
  p_profile_name: string,
  p_email: string
}
```

**Retorna**: `{ organization, perfil, sucursal }`

**Efectos**:
- Crea organización
- Crea sucursal principal
- Crea perfil de usuario
- Asigna rol 'owner' en user_organization_roles

---

## Funcionalidades Principales

### Para Dueños (Owners)

1. **Dashboard Completo**
   - Ventas del día/semana/mes
   - Top productos más vendidos
   - Margen de ganancia
   - Stock crítico y vencimientos

2. **Gestión de Sucursales**
   - Crear/editar/eliminar sucursales
   - Generar QR codes de fichaje

3. **Gestión de Empleados**
   - Invitar empleados por email
   - Asignar a sucursales
   - Ver ranking por XP/ventas
   - Crear misiones personalizadas

4. **Gestión de Productos**
   - Crear productos con código de barras
   - Control de stock multi-sucursal
   - Alertas de vencimiento
   - Happy Hour (descuentos automáticos)

5. **Proveedores**
   - ABM de proveedores
   - Control de saldo/deudas

6. **Reportes**
   - Ventas por período
   - Utilidad neta
   - ROI
   - Capital físico vs virtual

### Para Empleados (Employees)

1. **Fichaje**
   - Escaneo de QR al entrar/salir
   - Registro automático de horarios

2. **Ventas**
   - Escaneo de código de barras
   - Procesamiento de ventas
   - Generación de tickets
   - Métodos de pago múltiples

3. **Inventario**
   - Agregar stock
   - Ver stock disponible
   - Registrar mermas

4. **Misiones**
   - Ver misiones asignadas
   - Completar tareas
   - Ganar XP
   - Ranking personal

5. **Caja**
   - Apertura de caja
   - Arqueo al cerrar
   - Registro de movimientos manuales

---

## Tecnologías Detalladas

### Frontend

```json
{
  "next": "16.0.10",
  "react": "19.2.0",
  "typescript": "5.x",
  "tailwindcss": "4.1.9",
  "@radix-ui/*": "Componentes UI accesibles",
  "lucide-react": "Iconos",
  "recharts": "Gráficos",
  "react-hook-form": "Formularios",
  "zod": "Validación de schemas",
  "jspdf": "Generación de PDFs",
  "html5-qrcode": "Escaneo de QR",
  "qrcode.react": "Generación de QR"
}
```

### Backend

```json
{
  "@supabase/supabase-js": "Cliente Supabase",
  "@supabase/auth-helpers-nextjs": "Auth para Next.js",
  "PostgreSQL": "14.1",
  "PostgREST": "API REST auto-generada"
}
```

### PWA

```json
{
  "@ducanh2912/next-pwa": "Plugin PWA para Next.js",
  "workbox": "Service Worker caching"
}
```

---

## Estructura del Proyecto

```
app-kiosco/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout con PWA
│   ├── page.tsx             # Homepage (router principal)
│   ├── fichaje/             # Página de procesamiento QR
│   └── legal/               # Términos y privacidad
├── components/              # Componentes React
│   ├── ui/                  # shadcn/ui components
│   ├── pwa/                 # PWA components
│   ├── dashboard-dueno.tsx  # Dashboard owners
│   ├── vista-empleado.tsx   # Dashboard employees
│   └── [50+ componentes]
├── lib/                     # Lógica de negocio
│   ├── actions/             # Server Actions (16 archivos)
│   ├── repositories/        # Data access layer
│   ├── supabase*.ts         # Clientes Supabase
│   └── utils.ts             # Utilidades
├── types/                   # TypeScript types
│   ├── database.types.ts    # Tipos Supabase (auto-generados)
│   └── tipos-db.ts          # Tipos custom
├── supabase/                # Supabase config
│   └── migrations/          # SQL migrations (6 archivos)
├── database/                # SQL schemas
│   └── current_logic.sql    # Funciones RPC
├── scripts/                 # Scripts de utilidad
│   └── validate-security.sql
├── docs/                    # Documentación
│   ├── DEPLOYMENT.md
│   ├── SEGURIDAD.md
│   └── README.md (este archivo)
├── public/                  # Assets estáticos
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service Worker
│   └── icon.svg
├── .env.local.example       # Template variables de entorno
├── vercel.json              # Config Vercel
├── next.config.ts           # Config Next.js
├── tsconfig.json            # Config TypeScript
├── tailwind.config.ts       # Config Tailwind
└── package.json             # Dependencias
```

---

## Quick Start

### Desarrollo Local

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-org/app-kiosco.git
cd app-kiosco

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Ejecutar en desarrollo
npm run dev

# 5. Abrir en navegador
# http://localhost:3000
```

### Ejecutar Migraciones (Primera vez)

```bash
# En Supabase SQL Editor, ejecutar en orden:
1. supabase/migrations/20260120_enable_rls_all_tables.sql
2. supabase/migrations/20260120_create_rls_policies.sql
3. supabase/migrations/20260120_add_org_validation_rpcs.sql
4. supabase/migrations/20260120_standardize_roles.sql
5. supabase/migrations/20260121_add_performance_indexes.sql

# Verificar seguridad
6. scripts/validate-security.sql
```

### Deploy a Producción

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para guía completa.

```bash
# 1. Push a GitHub
git push origin main

# 2. Conectar en Vercel
# Ir a https://vercel.com/new

# 3. Configurar variables de entorno
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 4. Deploy automático
# Vercel detecta push y deploya
```

---

## Testing

### Tests E2E con Playwright

```bash
# Ejecutar todos los tests
npm run test:e2e

# UI interactiva
npm run test:e2e:ui

# Solo tests de QR
npm run test:e2e:qr

# Tests en móvil
npm run test:e2e:mobile
```

### Tests Manuales

Ver [DEPLOYMENT.md - Verificación Post-Deploy](./DEPLOYMENT.md#verificación-post-deploy)

---

## Monitoreo

### Vercel Analytics

Habilitado automáticamente:
- Pageviews
- Web Vitals (LCP, FID, CLS)
- Errores de runtime

### Supabase Logs

```bash
# Dashboard → Logs → Database
# Filtrar por:
- severity: error
- query: específico
- timestamp: rango
```

### Métricas Clave

| Métrica | Objetivo | Crítico |
|---------|----------|---------|
| Latencia p95 (ventas) | < 500ms | < 2s |
| Error rate | < 0.1% | < 1% |
| PWA Score | 100 | > 90 |
| Uptime | 99.9% | > 99% |

---

## Soporte

### Documentación
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)

### Issues
https://github.com/tu-org/app-kiosco/issues

### Contacto
- Email: soporte@tu-empresa.com
- Slack: #app-kiosco

---

## Licencia

Propietario - Todos los derechos reservados

---

**Última actualización**: 2026-01-20
**Versión**: 1.0.0
