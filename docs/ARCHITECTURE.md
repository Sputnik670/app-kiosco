# App-Kiosco: Documentación de Arquitectura

> **Propósito de este documento**: Permitir que un desarrollador o sesión de Claude Code pueda entender, auditar y continuar el desarrollo de esta aplicación con contexto completo.

---

## 1. RESUMEN EJECUTIVO

**App-Kiosco** es un sistema POS (Point of Sale) multi-tenant diseñado para cadenas de kioscos en Argentina.

| Aspecto | Detalle |
|---------|---------|
| **Stack** | Next.js 16 + Supabase (PostgreSQL + Auth + RLS) |
| **Arquitectura** | Multi-tenant SaaS con Row Level Security |
| **Patrón de datos** | Server Actions (no REST API) |
| **Offline** | PWA con IndexedDB + Service Worker |
| **Estado** | ~85% funcional, en desarrollo activo |

---

## 2. ESTRUCTURA DEL REPOSITORIO

```
App-kiosco-main/
├── app/                      # Next.js App Router
│   ├── page.tsx              # Landing / Login
│   ├── fichaje/              # Clock-in de empleados
│   └── api/                  # API routes (mínimo uso)
│
├── components/               # Componentes React
│   ├── ui/                   # Primitivos UI (shadcn/radix)
│   ├── dashboard/            # Componentes del dashboard
│   ├── facturacion/          # Sistema de facturación (NUEVO)
│   └── *.tsx                 # Componentes de negocio
│
├── lib/
│   ├── actions/              # ⭐ Server Actions (lógica de negocio)
│   ├── repositories/         # Acceso a datos (patrón repository)
│   ├── services/             # Servicios externos (ARCA mock)
│   ├── offline/              # Lógica offline/sync
│   └── utils.ts              # Utilidades compartidas
│
├── hooks/                    # Custom React hooks
│   └── use-offline-ventas.ts # Hook para ventas offline
│
├── types/                    # TypeScript types
│   ├── database.types.ts     # Tipos generados de Supabase
│   ├── app.types.ts          # Tipos de aplicación
│   ├── dashboard.types.ts    # Tipos del dashboard
│   └── invoicing.types.ts    # Tipos de facturación (NUEVO)
│
├── supabase/
│   ├── migrations/           # Migraciones SQL
│   │   ├── 00001_complete_schema.sql   # Schema base V2
│   │   ├── 00002_mission_templates.sql # Templates de misiones
│   │   └── 00003_invoicing.sql         # Sistema de facturación (NUEVO)
│   └── migrations_backup/    # Migraciones V1 (legacy, no usar)
│
├── public/
│   └── sw.js                 # Service Worker para PWA
│
└── docs/
    ├── ARCHITECTURE.md       # Este documento
    └── MIGRATION_STATUS.md   # Estado de migración V1→V2
```

---

## 3. MODELO DE DATOS (Schema V2)

### 3.1 Diagrama de Entidades

```
┌─────────────────┐
│  organizations  │ ← Tenant root (una org = una cadena de kioscos)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐  ┌─────────────┐
│ branches│  │ memberships │ ← Empleados/dueños de la org
└────┬────┘  └─────────────┘
     │
     ├──────────────┬──────────────┬──────────────┐
     │              │              │              │
     ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ products │  │  sales   │  │cash_regs │  │ missions │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
     │              │              │
     ▼              │              ▼
┌──────────┐        │        ┌───────────────┐
│  stock   │        │        │cash_movements │
│ (lotes)  │        │        └───────────────┘
└──────────┘        │
                    ▼
              ┌──────────┐
              │ invoices │ ← NUEVO: Facturas opcionales
              └──────────┘
```

### 3.2 Tablas Principales

| Tabla | Propósito | Columnas clave |
|-------|-----------|----------------|
| `organizations` | Tenant (cadena de kioscos) | id, name, fiscal_config |
| `branches` | Sucursales | id, organization_id, name |
| `memberships` | Usuarios de la org | id, user_id, organization_id, role, xp |
| `products` | Catálogo de productos | id, organization_id, name, barcode, price |
| `stock` | Lotes con FIFO | id, product_id, branch_id, quantity, cost, expiry_date |
| `sales` | Ventas realizadas | id, branch_id, total, payment_method, items (JSONB) |
| `cash_registers` | Cajas/turnos | id, branch_id, opened_by, initial_amount, status |
| `cash_movements` | Ingresos/egresos | id, cash_register_id, type, amount, reason |
| `missions` | Misiones gamificadas | id, membership_id, type, status, xp_reward |
| `invoices` | Facturas ARCA (NUEVO) | id, branch_id, cae, invoice_number, status |
| `invoice_sales` | Ventas → Factura (NUEVO) | invoice_id, sale_id |

### 3.3 Convenciones de Naming (Schema V2)

El schema migró de español (V1) a inglés (V2):

| V1 (Legacy) | V2 (Actual) |
|-------------|-------------|
| `sucursales` | `branches` |
| `caja_diaria` | `cash_registers` |
| `movimientos_caja` | `cash_movements` |
| `misiones` | `missions` |
| `empleado_id` | `opened_by` / `user_id` |
| `sucursal_id` | `branch_id` |

---

## 4. FLUJOS DE NEGOCIO PRINCIPALES

### 4.1 Flujo de Venta

```
1. Empleado abre caja (cash_registers.status = 'open')
   └─ Server Action: shift.actions.ts → openCashRegisterAction()

2. Empleado escanea/busca productos
   └─ Repository: producto.repository.ts

3. Empleado procesa venta
   └─ Server Action: ventas.actions.ts → createSaleAction()
   └─ Se descuenta stock (FIFO por lotes)
   └─ Se genera ticket PDF (lib/generar-ticket.ts)

4. [OFFLINE] Si no hay conexión:
   └─ Hook: use-offline-ventas.ts guarda en IndexedDB
   └─ Sync automática cuando vuelve conexión

5. Empleado cierra caja
   └─ Server Action: shift.actions.ts → closeCashRegisterAction()
   └─ Cálculo automático de varianza (esperado vs real)
```

### 4.2 Flujo de Facturación (NUEVO - Opcional)

```
1. Ventas se acumulan SIN facturar (comportamiento normal)

2. Dueño entra a sección Facturación en dashboard
   └─ Componente: components/facturacion/index.tsx

3. Dueño selecciona ventas pasadas con checkbox
   └─ Componente: components/facturacion/sales-selector.tsx
   └─ Server Action: getUninvoicedSalesAction()

4. Dueño ingresa datos del cliente (opcional para Factura B)
   └─ Componente: components/facturacion/invoice-form.tsx

5. Sistema genera factura y obtiene CAE (mock)
   └─ Server Action: issueInvoiceAction()
   └─ Service: lib/services/arca.service.ts (MOCKEADO)

6. Factura aparece en historial
   └─ Componente: components/facturacion/invoice-list.tsx
```

### 4.3 Flujo de Gamificación

```
1. Al abrir caja, se generan misiones automáticas
   └─ Server Action: missions.actions.ts → generateDailyMissions()
   └─ Tipos: EXPIRING_PRODUCTS, CASH_COUNT, TEMPLATE

2. Empleado completa misiones durante el turno
   └─ Server Action: completeMissionAction()
   └─ Se otorga XP al membership

3. Ranking de equipo visible en dashboard
   └─ Componente: components/team-ranking.tsx
   └─ Ordenado por XP acumulado
```

---

## 5. PATRONES DE CÓDIGO

### 5.1 Server Actions (Patrón Principal)

Toda la lógica de negocio está en `lib/actions/*.actions.ts`. NO usamos REST API.

```typescript
// Ejemplo: lib/actions/ventas.actions.ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createSaleAction(data: SaleInput) {
  const supabase = await createClient()

  // 1. Validar usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "No autenticado" }

  // 2. Operación de BD (RLS valida org automáticamente)
  const { data: sale, error } = await supabase
    .from("sales")
    .insert(saleData)
    .select()
    .single()

  // 3. Revalidar cache de Next.js
  revalidatePath("/dashboard")

  return { success: true, data: sale }
}
```

### 5.2 Row Level Security (RLS)

Cada tabla tiene políticas RLS que validan `organization_id` usando la función `get_my_org_id()`:

```sql
-- Ejemplo de política RLS
CREATE POLICY "Users can view their org sales"
ON sales FOR SELECT
USING (
  branch_id IN (
    SELECT id FROM branches
    WHERE organization_id = get_my_org_id()
  )
);
```

**Importante**: El código NO filtra por organización manualmente. RLS lo hace automáticamente.

### 5.3 Tipos de Supabase con Joins

Cuando hacemos joins en Supabase, los tipos pueden ser problemáticos. Usamos este patrón:

```typescript
// ❌ Problema: TypeScript infiere arrays incorrectos
const { data } = await supabase
  .from("sales")
  .select("*, products(name)")

// ✅ Solución: Double type assertion
const products = item.products as unknown as { name: string } | null
return { product_name: products?.name || 'Producto' }
```

### 5.4 Offline Sync

El hook `use-offline-ventas.ts` maneja ventas sin conexión:

```typescript
// Guarda en IndexedDB con UUID para idempotencia
await saveOfflineSale({
  id: crypto.randomUUID(), // Evita duplicados al sincronizar
  ...saleData,
  synced: false
})

// Sync con backoff exponencial (1s → 2s → 4s → ... → 32s)
```

---

## 6. ARCHIVOS CRÍTICOS

### 6.1 Server Actions (Lógica de Negocio)

| Archivo | Responsabilidad | Estado |
|---------|-----------------|--------|
| `auth.actions.ts` | Login, signup, magic links | ✅ Estable |
| `ventas.actions.ts` | CRUD de ventas | ✅ Estable |
| `shift.actions.ts` | Apertura/cierre de caja | ✅ Migrado a V2 |
| `cash.actions.ts` | Movimientos de caja | ✅ Estable |
| `inventory.actions.ts` | Gestión de stock | ✅ Estable |
| `missions.actions.ts` | Gamificación | ✅ Consolidado |
| `invoicing.actions.ts` | Facturación ARCA | 🆕 Nuevo, sin integrar |
| `stats.actions.ts` | Estadísticas | ✅ Migrado a V2 |
| `service.actions.ts` | Servicios virtuales | ✅ Migrado a V2 |

### 6.2 Componentes Principales

| Componente | Propósito | Notas |
|------------|-----------|-------|
| `dashboard-dueno.tsx` | Dashboard del dueño | Falta integrar facturación |
| `vista-empleado.tsx` | Vista del empleado | Estable |
| `caja-ventas.tsx` | POS de ventas | Estable |
| `arqueo-caja.tsx` | Cierre de caja | Estable |
| `team-ranking.tsx` | Ranking gamificación | Estable |
| `facturacion/index.tsx` | Facturación | 🆕 Sin integrar |

### 6.3 Migraciones SQL

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| `00001_complete_schema.sql` | Schema V2 completo | ✅ Aplicada |
| `00002_mission_templates.sql` | Templates de misiones | ✅ Aplicada |
| `00003_invoicing.sql` | Tablas de facturación | ⏳ Pendiente aplicar |

---

## 7. ESTADO ACTUAL Y PENDIENTES

### 7.1 Lo que FUNCIONA

- [x] Autenticación (email, magic links)
- [x] Multi-tenant con RLS
- [x] CRUD de productos y stock
- [x] Sistema de ventas completo
- [x] Apertura/cierre de caja
- [x] Gamificación (misiones, XP, ranking)
- [x] PWA con offline sync
- [x] Dashboard con 5 tabs
- [x] Build compila sin errores

### 7.2 Lo que está INCOMPLETO

| Feature | Estado | Siguiente paso |
|---------|--------|----------------|
| Facturación ARCA | Código escrito, no integrado | Integrar en dashboard-dueno.tsx |
| Migración 00003 | Archivo creado | Aplicar: `npm run db:migrate` |
| Reportes PDF/Excel | No implementado | Sprint 2 del roadmap |
| Notificaciones | No implementado | Sprint 3 del roadmap |
| Tests unitarios | 0% | Sprint 4 del roadmap |

### 7.3 Lo que necesita REVISIÓN

> ⚠️ **Advertencia**: Este código fue desarrollado parcialmente con IA ("vibecoding"). Se recomienda auditar:

1. **Tipos de Supabase joins** - Usamos `as unknown as` en varios lugares para solucionar errores de tipos. Verificar que los datos fluyen correctamente.

2. **Políticas RLS** - Verificar que TODAS las tablas tienen políticas correctas. Especialmente `invoices` e `invoice_sales`.

3. **Función `get_my_org_id()`** - Es crítica para la seguridad. Verificar que existe y funciona.

4. **Sync offline** - El hook `use-offline-ventas.ts` necesita testing exhaustivo.

5. **ARCA mock** - El servicio está mockeado. Los CAE generados NO son válidos para AFIP.

---

## 8. CÓMO CONTINUAR EL DESARROLLO

### 8.1 Para auditar el código

```bash
# 1. Verificar que compila
npm run build

# 2. Verificar tipos
npm run type-check  # o npx tsc --noEmit

# 3. Revisar server actions críticos
# Leer: lib/actions/ventas.actions.ts
# Leer: lib/actions/shift.actions.ts
# Leer: lib/actions/invoicing.actions.ts

# 4. Verificar migraciones pendientes
ls supabase/migrations/
```

### 8.2 Para integrar facturación

1. Aplicar migración:
   ```bash
   npx supabase db push  # o el comando de migración configurado
   ```

2. Integrar componente en dashboard:
   ```tsx
   // En components/dashboard-dueno.tsx
   import { Facturacion } from "./facturacion"

   // Agregar como nuevo tab o sección
   <TabsContent value="facturacion">
     <Facturacion />
   </TabsContent>
   ```

3. Probar flujo completo:
   - Hacer ventas → Ver en selector → Crear factura → Ver en historial

### 8.3 Para continuar el roadmap

El roadmap está documentado en el plan file:
```
C:\Users\Rram\.claude\plans\ethereal-roaming-waterfall.md
```

Próximos sprints:
- **Sprint 2**: Reportes exportables (PDF/Excel)
- **Sprint 3**: Notificaciones (email/push)
- **Sprint 4**: Tests unitarios + Sentry

---

## 9. COMANDOS ÚTILES

```bash
# Desarrollo
npm run dev           # Servidor de desarrollo
npm run build         # Build de producción
npm run lint          # Linter

# Base de datos
npx supabase start    # Supabase local
npx supabase db push  # Aplicar migraciones
npx supabase gen types typescript --local > types/database.types.ts

# Git (estado actual)
git status            # Ver cambios pendientes
git diff              # Ver diferencias
```

---

## 10. CONTACTO Y CONTEXTO

- **Desarrollador**: Usuario trabajando con Claude Code
- **Fecha de este documento**: 1 Feb 2026
- **Estado del proyecto**: MVP funcional, pre-lanzamiento B2B
- **Mercado objetivo**: Kioscos y minimercados en Argentina

---

## CHECKLIST PARA SESIÓN DE AUDITORÍA

Antes de continuar desarrollo, verificar:

- [ ] `npm run build` compila sin errores
- [ ] Las 3 migraciones SQL están aplicadas en Supabase
- [ ] Función `get_my_org_id()` existe y retorna el org_id correcto
- [ ] Políticas RLS existen en TODAS las tablas
- [ ] El flujo de venta funciona end-to-end
- [ ] El flujo de facturación funciona (después de integrar)
- [ ] El sync offline funciona (probar desconectando internet)

---

*Documento generado para facilitar continuidad del desarrollo con IA.*
