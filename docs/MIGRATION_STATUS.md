# Estado de Migración del Schema de Base de Datos

**Fecha:** 2026-01-27
**Estado:** COMPLETADO - Build TypeScript OK

---

## Objetivo de la Migración

Rediseñar completamente el schema de base de datos para:
1. Consolidar tablas redundantes (`perfiles` + `user_organization_roles` → `memberships`)
2. Estandarizar nombres en inglés
3. Simplificar a un único archivo SQL
4. Mejorar las políticas RLS y RPCs

---

## Mapeo de Tablas (Antiguo → Nuevo)

| Tabla Antigua | Tabla Nueva | Notas |
|---------------|-------------|-------|
| `productos` | `products` | Campos: `nombre`→`name`, `precio_venta`→`sale_price`, `costo`→`cost`, `codigo_barras`→`barcode`, `categoria`→`category` |
| `stock` | `stock_batches` | Campos: `sucursal_id`→`branch_id`, `producto_id`→`product_id`, `cantidad`→`quantity`, `fecha_vencimiento`→`expiration_date`, `estado`→`status` |
| `sucursales` | `branches` | Campos: `nombre`→`name`, `direccion`→`address`, `telefono`→`phone` |
| `perfiles` | `memberships` | CONSOLIDADO con `user_organization_roles` |
| `user_organization_roles` | `memberships` | Campo `rol`→`role` con valores `'owner'`, `'admin'`, `'employee'` |
| `proveedores` | `suppliers` | Campos: `nombre`→`name`, `saldo_actual`→`balance` |
| `caja_diaria` | `cash_registers` | Campos: `monto_inicial`→`opening_amount`, `monto_final`→`closing_amount`, `fecha_apertura`→`opened_at`, `fecha_cierre`→`closed_at`, `diferencia`→`variance` |
| `movimientos_caja` | `cash_movements` | Campos: `monto`→`amount`, `tipo`→`type` (`ingreso`→`income`, `egreso`→`expense`), `descripcion`→`description`, `categoria`→`category` |
| `misiones` | `missions` | Campos: `empleado_id`→`user_id`, `caja_diaria_id`→`cash_register_id`, `es_completada`→`is_completed`, `objetivo_unidades`→`target_value`, `unidades_completadas`→`current_value` |
| `plantillas_misiones` | `mission_templates` | Campos: `sucursal_id`→`branch_id`, `descripcion`→`description`, `puntos`→`points`, `activa`→`is_active` |
| `asistencia` | `attendance_logs` | Campos: `empleado_id`→`user_id`, `sucursal_id`→`branch_id`, `entrada`→`check_in`, `salida`→`check_out` |
| `ventas` | `sales` | Campos: `total`, `metodo_pago`→`payment_method` |
| `detalles_venta` | `sale_items` | Campos: `producto_id`→`product_id`, `cantidad`→`quantity`, `precio_unitario`→`unit_price` |
| `historial_precios` | `price_history` | Campos actualizados a inglés |

---

## RPCs (Antiguo → Nuevo)

| RPC Antiguo | RPC Nuevo | Descripción |
|-------------|-----------|-------------|
| `create_initial_setup_v2` | `setup_organization` | Crea org + branch + membership para owner |
| `complete_employee_setup_v2` | `accept_invite` | Empleado acepta invitación |
| `get_my_org_id_v2` | `get_my_org_id` | Obtiene org_id del usuario actual |
| `procesar_venta` | `process_sale` | Procesa venta con FIFO automático |

---

## Vistas Nuevas

- `v_products_with_stock` - Productos con stock calculado
- `v_daily_sales` - Ventas diarias agregadas
- `v_expiring_stock` - Stock próximo a vencer

---

## Archivos Modificados (Completados)

### Actions (`lib/actions/`)
- [x] `auth.actions.ts` - Usa `setup_organization`, `accept_invite`, `get_my_org_id`
- [x] `ventas.actions.ts` - Usa `process_sale`, `v_products_with_stock`
- [x] `dashboard.actions.ts` - Usa nuevas vistas
- [x] `inventory.actions.ts` - Usa `products`, `stock_batches`, `suppliers`
- [x] `cash.actions.ts` - **MIGRADO** - Usa `cash_registers`, `cash_movements`, `missions`, `memberships`
- [x] `user.actions.ts` - **MIGRADO** - Usa `memberships`, `branches`, `attendance_logs`, `cash_registers`
- [x] `missions.actions.ts` - **MIGRADO** - Usa `missions`, `mission_templates`, `memberships`, `stock_batches`

### Repositorios (`lib/repositories/`)
- [x] `producto.repository.ts` - Usa tabla `products`
- [x] `stock.repository.ts` - Usa tabla `stock_batches`
- [x] `organization.repository.ts` - Usa `memberships`, `branches`

### Tipos (`types/`)
- [x] `database.types.ts` - Tipos del nuevo schema
- [x] `dashboard.types.ts` - `PaymentBreakdown` y `BusinessMetrics` en inglés
- [x] `app.types.ts` - **ACTUALIZADO** - Nuevas interfaces `CashRegister`, `Mission`, `CashMovement` + versiones legacy

### Componentes (`components/`)
- [x] `caja-ventas.tsx` - Campos `name`, `price`, `barcode`
- [x] `dashboard-dueno.tsx` - Usa nuevas vistas y tablas
- [x] `invitar-empleado.tsx` - Usa `branches`, `employees`
- [x] `profile-setup.tsx` - Usa `branch_id`
- [x] `arqueo-caja.tsx` - **VERIFICADO** - Usa actions migrados (formato legacy compatible)
- [x] `asignar-mision.tsx` - **VERIFICADO** - Delega a `missions.actions.ts` migrado
- [x] `misiones-empleado.tsx` - **VERIFICADO** - Delega a `missions.actions.ts` migrado
- [x] `vista-empleado.tsx` - **VERIFICADO** - Usa `user.actions.ts` migrado (formato legacy compatible)
- [x] `registrar-movimientos.tsx` - **ACTUALIZADO** - Usa nuevos campos (`description`, `amount`, `category`)

### Offline (`lib/offline/`)
- [x] `indexed-db.ts` - Payment methods en inglés (`cash`, `card`, `wallet`)

---

## Métodos de Pago (Estandarizados)

| Antiguo | Nuevo |
|---------|-------|
| `'efectivo'` | `'cash'` |
| `'tarjeta'` | `'card'` |
| `'transferencia'` | `'transfer'` |
| `'billetera'` | `'wallet'` |

---

## Nuevas Migraciones SQL

| Archivo | Descripción |
|---------|-------------|
| `00001_complete_schema.sql` | Schema completo V2 |
| `00002_mission_templates.sql` | Tabla `mission_templates` para rutinas recurrentes |

Los archivos de migración antiguos fueron movidos a:
```
supabase/migrations_backup/
```

---

## Compatibilidad Legacy

Para mantener la compatibilidad con componentes UI existentes, los actions mapean los datos del schema V2 a formatos legacy:

- **CashMovement**: Devuelve campos en inglés (`amount`, `description`, `type`)
- **Mission**: Mapea a formato legacy (`objetivo_unidades`, `es_completada`, etc.)
- **Profile**: Mapea `role` a `rol` (`owner`→`dueño`, `employee`→`empleado`)
- **Shift**: Mapea `opening_amount`→`monto_inicial`, `opened_at`→`fecha_apertura`

---

## Verificación del Build

```bash
npm run build
# ✓ Compiled successfully in 13.4s
# ✓ Generating static pages (7/7)
```

---

## Próximos Pasos

1. ~~Revisar componentes pendientes~~ **COMPLETADO**
2. **Probar en runtime** - Ejecutar `npm run dev` y probar flujos completos
3. **Aplicar migración en Supabase** - Ejecutar el SQL en el proyecto de Supabase
4. **Regenerar tipos** - `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.types.ts`

---

## Resumen de Cambios (2026-01-27)

### Archivos Creados
- `supabase/migrations/00002_mission_templates.sql`

### Archivos Modificados
- `lib/actions/cash.actions.ts` - Migrado a schema V2
- `lib/actions/missions.actions.ts` - Migrado a schema V2
- `lib/actions/user.actions.ts` - Migrado a schema V2
- `types/app.types.ts` - Nuevos tipos V2 + interfaces legacy
- `components/registrar-movimientos.tsx` - Campos de CashMovement actualizados

### Estrategia de Mapeo
Los actions en la capa de servidor:
1. Consultan las tablas V2 (inglés)
2. Mapean los resultados a interfaces legacy (español)
3. Devuelven datos compatibles con componentes UI existentes

Esto permite una migración gradual sin reescribir todos los componentes UI de una vez.
