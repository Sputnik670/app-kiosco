# Auditoría de Seguridad y Performance — App Kiosco

> Última revisión: 24 de abril de 2026
> Auditoría original: marzo 2026
> Este archivo refleja el estado REAL hoy, no la foto histórica. Para ver el detalle histórico ver `agents/reportes/seguridad-auditoria.md`.

---

## Estado general

- **Seguridad DB:** BUENO. 27 tablas con RLS. Sin tablas bloqueadas. Todas las políticas críticas están separadas por operación.
- **Performance frontend:** BUENO. Dynamic imports aplicados en reports, MP, ARCA, recharts y tab components.
- **Hallazgos abiertos hoy:** 2 menores + 1 parcialmente pendiente.

---

## Hallazgos abiertos (24 de abril)

### BAJO — `product_catalog` con INSERT policy `WITH CHECK (true)`

- Advisor Supabase `rls_policy_always_true` lo flagea.
- Es **intencional**: `product_catalog` es una tabla cross-organización pensada para que cualquier usuario autenticado contribuya cuando escanea un producto nuevo (efecto red).
- Riesgo real: usuario malicioso podría spamear el catálogo con barcodes falsos.
- Mitigación recomendada: endurecer la policy para obligar `contributed_by = auth.uid()` en el INSERT:
  ```sql
  WITH CHECK (contributed_by = auth.uid())
  ```
  Esto permite sumar al catálogo pero ata la contribución al user real, y en el futuro se puede rate-limitar o revertir vandalismos.

### BAJO — `mercadopago_credentials` SELECT abierto a toda la org

- Políticas INSERT/UPDATE/DELETE restringidas a `is_owner()` ✅
- Política SELECT (`mp_creds_select`) sólo filtra por `organization_id = get_my_org_id()` — cualquier miembro de la org puede leer las credenciales.
- Los tokens sensibles no llegan al cliente (se usan server-side), pero es más higiénico restringir también SELECT a owner.
- Fix propuesto:
  ```sql
  ALTER POLICY mp_creds_select ON mercadopago_credentials
  USING ((organization_id = get_my_org_id()) AND is_owner());
  ```

### MEDIO — Auth leaked password protection deshabilitado

- Requiere plan Pro de Supabase.
- No accionable hasta upgrade. Sin acción.

### MEDIO — Queries no-críticas de `useDashboardData`

- Ventas, productos, servicios, turnos y asistencias se cargan juntas al abrir el dashboard.
- Pendiente diferir turnos/asistencias a cuando se abre el tab "Equipo".
- Prioridad: baja (no hay reportes de lentitud del cliente).

### MEDIO — `VistaEmpleado` importa 9 componentes siempre

- CajaVentas, WidgetServicios, WidgetSube etc. se importan aunque el empleado no haya fichado.
- Pendiente dynamic import condicional.
- Prioridad: baja.

---

## Hallazgos resueltos entre marzo y abril

### Seguridad DB — RESUELTO en migración 00007–00008 (confirmado 24-abr)

- `incidents` — 7 políticas separadas por operación. INSERT/DELETE solo `is_owner()`; UPDATE diferenciado entre empleado (sólo su justificación, estados abiertos/justificados) y owner.
- `owner_notes` — políticas separadas, todas con `is_owner()`.
- `mercadopago_credentials` — INSERT/UPDATE/DELETE restringidos a `is_owner()` (SELECT sigue abierto — ver abiertos).
- `service_sales` — inmutabilidad protegida (sin UPDATE/DELETE policy = denegadas por default).
- `expire_pending_mp_orders()` y `process_sale()` — `SET search_path TO 'public'` aplicado.

### Soft-delete de proveedores — RESUELTO (29-mar, commit `9575012`)

- Causa: SELECT policy `is_active = true` rechazaba el RETURNING del UPDATE.
- Fix: función `deactivate_supplier(uuid)` SECURITY DEFINER.

### Vistas y funciones con search_path — RESUELTO (29-mar)

- `v_products_with_stock` y `v_expiring_stock` → `security_invoker = on`.
- `update_mp_creds_updated_at()`, `update_owner_notes_updated_at()` → `SET search_path TO 'public'`.

### Performance frontend — RESUELTO

- Dynamic import de Reports, ConfiguracionMercadoPago, ConfiguracionArca en `dashboard-dueno.tsx`.
- Dynamic import de Recharts en `tab-sales.tsx`.
- `formatMoney` extraído fuera del componente.
- Lazy-load de todos los tab components con `next/dynamic`.

### Validaciones server-side — RESUELTO

- `validateBranchOwnership()` aplicado en reports.actions.ts.
- Sanitización de `.or()` con `.replace(/[,()]/g, '')` en ventas.actions.ts.
- Console.log de emails/IDs eliminados de user.actions.ts.

### Dashboard — RESUELTO

- Margen real con `unit_cost` de `sale_items`.
- N+1 queries en `tab-historial.tsx` batchadas con `.in()` + `Promise.all()`.
- Touch targets ≥ 36px en tab-timeline.

### Realtime bidireccional — RESUELTO (13-abr, commits `bd3c0ab` y `bbd6e4b`)

- `incidents`: suscripción `postgres_changes` filtrada por `branch_id` / `employee_id`. Dueño y empleado ven cambios sin F5.
- `missions`: mismo patrón + fix de RLS silenciosa que impedía sumar XP.

---

## Observaciones

- `arca_config` y `arca_invoices` usan rol `public` en lugar de `authenticated` (funciona pero es menos explícito). No urgente.
- `memberships` no permite DELETE por diseño (desactivación vía `is_active = false`).

---

## Policy

Cuando aparezca un hallazgo nuevo, se agrega en "Hallazgos abiertos". Cuando se resuelve, se mueve a "Resueltos" con fecha y commit. No se borra — es el registro que protege del mismo bug dos veces.
