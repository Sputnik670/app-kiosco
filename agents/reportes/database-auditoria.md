# Auditoría de Base de Datos - App Kiosco

> Generado: 2026-02-25
> Actualizado: 2026-02-25 (post-fixes)
> Agente: kiosco-database
> Schema: V2 (PostgreSQL via Supabase)

---

## Salud de la base de datos: FIXES APLICADOS — LISTO PARA DEPLOY

El schema base (00001 + 00002) es sólido: 15 tablas, RLS en todas, 3 RPCs, 3 vistas.
Se corrigieron los problemas detectados: bug V1 en attendance, patrones N+1 eliminados,
migraciones 00003/00004 corregidas, índices de performance preparados.

---

## 1. Índices existentes (00001 + 00002)

### Tabla: organizations
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_org_owner | owner_id | B-tree |

### Tabla: branches
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_branches_org | organization_id | B-tree |
| idx_branches_qr | qr_code | B-tree |

### Tabla: memberships
| Índice | Columnas | Tipo |
|--------|----------|------|
| unique_user_org | (user_id, organization_id) | UNIQUE |
| idx_memberships_user | user_id | B-tree |
| idx_memberships_org | organization_id | B-tree |
| idx_memberships_active | is_active (WHERE true) | Partial |

### Tabla: products
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_products_org | organization_id | B-tree |
| idx_products_barcode | barcode (WHERE NOT NULL) | Partial |
| idx_products_active | (organization_id, is_active) WHERE active | Partial |

### Tabla: stock_batches
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_stock_fifo | (product_id, branch_id, expiration_date NULLS LAST) | B-tree |
| idx_stock_org | organization_id | B-tree |
| idx_stock_product | (product_id, branch_id) | B-tree |
| idx_stock_expiry | expiration_date (WHERE NOT NULL) | Partial |

### Tabla: cash_registers
| Índice | Columnas | Tipo |
|--------|----------|------|
| unique_branch_date | (branch_id, date) | UNIQUE |
| idx_cash_reg_org | organization_id | B-tree |
| idx_cash_reg_branch | (branch_id, date DESC) | B-tree |
| idx_cash_reg_open | is_open (WHERE true) | Partial |

### Tabla: sales
| Índice | Columnas | Tipo |
|--------|----------|------|
| unique_local_id | (organization_id, local_id) | UNIQUE |
| idx_sales_org | organization_id | B-tree |
| idx_sales_branch | (branch_id, created_at DESC) | B-tree |
| idx_sales_cash_reg | cash_register_id | B-tree |
| idx_sales_local | (organization_id, local_id) WHERE NOT NULL | Partial |

### Tabla: sale_items
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_items_sale | sale_id | B-tree |
| idx_items_product | product_id | B-tree |

### Tabla: cash_movements
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_movements_cash_reg | cash_register_id | B-tree |

### Tabla: attendance
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_attendance_org | organization_id | B-tree |
| idx_attendance_user | user_id | B-tree |
| idx_attendance_checkin | check_in DESC | B-tree |

### Tabla: missions (sin índices custom)

### Tabla: pending_invites
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_invites_token | token | B-tree |
| idx_invites_email | email | B-tree |
| idx_invites_expires | expires_at | B-tree |

### Tabla: mission_templates (00002)
| Índice | Columnas | Tipo |
|--------|----------|------|
| idx_mission_templates_org | organization_id | B-tree |
| idx_mission_templates_branch | branch_id (WHERE NOT NULL) | Partial |
| idx_mission_templates_active | is_active (WHERE true) | Partial |

**Total: ~30 índices** (incluyendo PKs y UNIQUEs)

---

## 2. Índices faltantes (impacto directo en performance)

Propuestos en `supabase/migrations/00005_performance_indexes.sql`:

| # | Índice propuesto | Query afectada | Impacto |
|---|-----------------|----------------|---------|
| 1 | `products(organization_id, barcode) WHERE barcode IS NOT NULL` | `searchProductos()` producto.repository.ts | **ALTO** - Búsqueda por barcode es la operación más frecuente (cada venta) |
| 2 | `products(organization_id, category) WHERE is_active` | `getProductosByCategoria()` producto.repository.ts | MEDIO - Filtro por categoría en catálogo |
| 3 | `cash_registers(branch_id, is_open) WHERE is_open` | `getCajaActivaAction()` cash.actions.ts | **ALTO** - Se ejecuta al abrir la app |
| 4 | `cash_registers(opened_by, is_open, opened_at DESC)` | `getTeamRankingAction()` stats.actions.ts | **ALTO** - Se ejecuta N veces por empleado |
| 5 | `attendance(user_id, branch_id, check_in DESC)` | `getAttendanceStatusAction()` attendance.actions.ts | ALTO - Cada fichaje de empleado |
| 6 | `missions(user_id, is_completed, created_at DESC)` | `getTeamRankingAction()`, `getEmployeeMissionsAction()` | MEDIO - Ranking y panel de misiones |
| 7 | `missions(cash_register_id) WHERE NOT NULL` | `cerrarCajaAction()` cash.actions.ts | MEDIO - Cierre de caja + gamificación |
| 8 | `stock_batches(branch_id, status, expiration_date) WHERE available` | `getExpiringStockAction()`, `getCriticalStockAction()` | ALTO - Alertas de vencimiento |
| 9 | `sales(cash_register_id, payment_method)` | `closeShiftAction()`, `cerrarCajaAction()` | ALTO - Cierre de caja (operación crítica) |
| 10 | `memberships(organization_id, role) WHERE is_active` | `getTeamRankingAction()`, `getEmployeesForMissionsAction()` | MEDIO - Queries de ranking y misiones |

### Redundancias detectadas
- `idx_stock_product(product_id, branch_id)` es un subconjunto de `idx_stock_fifo(product_id, branch_id, expiration_date)`.
  **Recomendación**: Mantener ambos. El primero sirve para queries sin ORDER BY expiration_date.

---

## 3. Queries problemáticas

### 3.1 Patrón N+1 — CORREGIDO

**`stats.actions.ts` — getTeamRankingAction()** — FIXED

Antes: 4 queries POR empleado (4N total). Con 10 empleados = 40 queries.

**Fix aplicado**: Reescrito con 4 queries batch totales:
1. 1 query: todas las memberships (empleados activos)
2. 1 query: todos los cash_registers con `.in('opened_by', employeeIds)`
3. 1 query: todas las sales con `.in('cash_register_id', allShiftIds)`
4. 1 query: todas las missions completadas con `.in('user_id', employeeIds)`

Agregación en JS con Maps. De 4N queries a 4 fijas.

---

**`inventory.actions.ts` — getStockSummary()** — FIXED

Antes: 1 query por producto (N queries).

**Fix aplicado**: Una sola query con `.in('product_id', productoIds)` + agregación con Map en JS.

---

### 3.2 SELECTs sin límite

| Archivo | Línea | Query | Riesgo |
|---------|-------|-------|--------|
| stock.repository.ts | 230 | `listMovimientosBySucursal()` — SELECT * sin .limit() | Puede devolver miles de lotes |
| stock.repository.ts | 264 | `listMovimientosByProducto()` — SELECT * sin .limit() | Crece con el tiempo |
| dashboard.actions.ts | 222 | `cash_registers.select('id').eq('branch_id',...)` | Sin límite temporal |
| dashboard.actions.ts | 269 | `sale_items.select().in('sale_id', saleIds)` | Si hay 1000 ventas, trae miles de items |

**Recomendación**: Agregar `.limit(500)` como safety net, o paginar.

---

### 3.3 Bug tabla V1 en código V2 — CORREGIDO

**`attendance.actions.ts`** — FIXED

Cambios aplicados:
- Tabla: `'asistencia'` → `'attendance'`
- Columnas: `empleado_id` → `user_id`, `sucursal_id` → `branch_id`, `entrada` → `check_in`, `salida` → `check_out`
- Interface `AttendanceRecord` actualizada a V2
- Las 3 funciones actualizadas: `getAttendanceStatusAction`, `toggleAttendanceAction`, `processQRScanAction`
- Componente `reloj-control.tsx` actualizado: `fichajeActivo.entrada` → `fichajeActivo.check_in`

---

## 4. Migraciones pendientes

### 00003_invoicing.sql — Estado: CORREGIDA, LISTA PARA APLICAR

**Contenido**: Tablas `invoices`, `invoice_sales`, columna `fiscal_config` en organizations, vista `v_uninvoiced_sales`, función `get_next_invoice_number`.

**Evaluación**:

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Tablas | OK | Estructura correcta, tipos adecuados (DECIMAL para montos) |
| Constraints | OK | UNIQUE, CHECK, FK con ON DELETE apropiados |
| Índices | OK | 7 índices definidos para las queries esperadas |
| RLS | CORREGIDO | Agregado `TO authenticated` a las 8 policies |
| Función RPC | CORREGIDO | Agregado `GRANT EXECUTE ON FUNCTION get_next_invoice_number(UUID, INTEGER, TEXT) TO authenticated` |
| Riesgo | BAJO | Solo agrega (ALTER ADD COLUMN, CREATE TABLE). No modifica nada existente |

**Fixes aplicados**:
1. Agregado `TO authenticated` a todas las policies de invoices e invoice_sales
2. Agregado `GRANT EXECUTE` para `get_next_invoice_number`

---

### 00004_audit_logs.sql — Estado: CORREGIDA, LISTA PARA APLICAR

**Contenido**: Tabla `audit_logs`, función `audit_table_changes()`, triggers en 6 tablas, función `cleanup_old_audit_logs`.

**Evaluación**:

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Tabla | OK | Estructura correcta, índices adecuados |
| RLS | CORREGIDO | INSERT policy ahora `WITH CHECK (false)` — solo triggers SECURITY DEFINER pueden insertar |
| RLS | CORREGIDO | Agregadas policies deny para UPDATE/DELETE + service_role bypass |
| Trigger function | CORREGIDO | Simplificada: todas las tablas auditadas usan `OLD/NEW.organization_id` directo |
| Performance | OPTIMIZADO | stock_batches trigger solo AFTER UPDATE OR DELETE (sin INSERT para reducir overhead en process_sale) |
| Cleanup function | CORREGIDO | Default cambiado de 90 a 365 días (per SPECIFICATIONS.md) |
| Grants | CORREGIDO | Agregado `GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs(INTEGER) TO service_role` |
| Riesgo | BAJO | Triggers son AFTER, no bloquean operaciones |

**Fixes aplicados**:
1. Policy INSERT restrictiva (`WITH CHECK (false)`) — triggers SECURITY DEFINER bypassean RLS
2. Policies deny para UPDATE/DELETE de authenticated users
3. Policy service_role para operaciones administrativas
4. Trigger function simplificada: usa `organization_id` directo (todas las tablas lo tienen)
5. stock_batches trigger: solo UPDATE/DELETE (no INSERT) para no impactar process_sale
6. Cleanup default: 365 días (spec dice "Datos históricos: 1 año")
7. GRANT EXECUTE para service_role

---

## 5. Problemas de schema

### 5.1 Tipos de datos
- Montos usan `DECIMAL(10,2)` — **CORRECTO**
- Timestamps usan `TIMESTAMPTZ` — **CORRECTO**
- UUIDs para PKs y FKs — **CORRECTO**
- `sale_items.items` no existe como JSONB (se usa tabla normalizada) — **CORRECTO**

### 5.2 Integridad relacional
- Todas las tablas tienen FK a `organizations` (excepto `sale_items` que hereda via `sales`) — **CORRECTO**
- `ON DELETE CASCADE` en tablas operativas, `RESTRICT` en `sales → cash_registers` — **CORRECTO**
- `ON DELETE SET NULL` para FKs opcionales (supplier_id, branch_id en memberships) — **CORRECTO**
- No hay tablas huérfanas — **CORRECTO**

### 5.3 Issue menor: sale_items tiene organization_id redundante
`sale_items.organization_id` es redundante porque siempre se puede derivar de `sales.organization_id`.
Sin embargo, es útil para RLS (evita un JOIN en la policy) así que es una decisión de diseño aceptable.

---

## 6. SQL de optimización listo para ejecutar

### Archivo generado
`supabase/migrations/00005_performance_indexes.sql`

Contiene 10 índices nuevos, todos con `IF NOT EXISTS` para idempotencia.

### Comando para aplicar (cuando estés listo)
```bash
# Opción 1: Via Supabase CLI
npx supabase db push

# Opción 2: Ejecutar manualmente en SQL Editor de Supabase Dashboard
# Copiar contenido de 00005_performance_indexes.sql
```

### Impacto estimado
- **Búsqueda de productos**: ~3-5x más rápido (composite org+barcode)
- **Apertura de app (caja activa)**: ~2-3x más rápido (composite branch+is_open)
- **Cierre de caja**: ~2x más rápido (composite cashreg+payment)
- **Ranking de equipo**: Sin mejora hasta refactorizar N+1 a RPC
- **Alertas de vencimiento**: ~3x más rápido (composite branch+status+expiry)

---

## 7. Resumen de acciones ejecutadas (2026-02-25)

### COMPLETADOS

| # | Fix | Archivos tocados | Estado |
|---|-----|-------------------|--------|
| 1 | Bug V1 tabla attendance | `lib/actions/attendance.actions.ts`, `components/reloj-control.tsx` | DONE |
| 2 | N+1 getTeamRankingAction | `lib/actions/stats.actions.ts` | DONE |
| 3 | N+1 getStockSummary | `lib/actions/inventory.actions.ts` | DONE |
| 4 | Índices de performance | `supabase/migrations/00005_performance_indexes.sql` | LISTO PARA APLICAR |
| 5 | Corrección 00003 invoicing | `supabase/migrations/00003_invoicing.sql` | LISTO PARA APLICAR |
| 6 | Corrección 00004 audit_logs | `supabase/migrations/00004_audit_logs.sql` | LISTO PARA APLICAR |
| 7 | Build verification | `npm run build` | PASSED |

### PENDIENTES (P1)

| # | Tarea | Prioridad |
|---|-------|-----------|
| 1 | Agregar `.limit()` a queries sin tope (stock.repository.ts, dashboard.actions.ts) | MEDIO |
| 2 | Crear RPC para dashboard stats (`getOwnerStatsAction()` hace 5+ queries) | MEDIO |
| 3 | Evaluar vista materializada para `v_daily_sales` si el dashboard se hace lento | BAJO |
| 4 | Configurar pg_cron para `cleanup_old_audit_logs()` periódico | BAJO |

### Próximo paso: Aplicar migraciones

```bash
# Ejecutar en Supabase SQL Editor o via CLI, en este orden:
# 1. supabase/migrations/00003_invoicing.sql
# 2. supabase/migrations/00004_audit_logs.sql
# 3. supabase/migrations/00005_performance_indexes.sql
```

---

*Reporte generado y actualizado por el agente kiosco-database. Build verificado sin errores.*
