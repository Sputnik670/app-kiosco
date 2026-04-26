# Auditoría de Seguridad y Performance — App Kiosco

> Última revisión: 26 de abril de 2026
> Auditoría original: marzo 2026
> Este archivo refleja el estado REAL hoy, no la foto histórica. Para ver el detalle histórico ver `agents/reportes/seguridad-auditoria.md`.

---

## Estado general

- **Seguridad DB:** BUENO. 27 tablas con RLS. Sin tablas bloqueadas. Todas las políticas críticas están separadas por operación.
- **Performance frontend:** BUENO. Dynamic imports aplicados en reports, MP, ARCA, recharts y tab components.
- **Hallazgos abiertos hoy:** 1 no accionable (plan paid de Supabase) + 2 menores de performance.

---

## Hallazgos abiertos (26 de abril)

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

### MP webhook secret NULL post-OAuth — RESUELTO (26-abr, migración 00014)

- Causa: `app/api/mercadopago/oauth/callback/route.ts:198` grababa `webhook_secret_encrypted: null` en cada upsert OAuth, sobreescribiendo el secret que el user había guardado por separado vía form de configuración.
- Síntoma: HMAC mismatch perpetuo del webhook → tuvo que activarse `SKIP_SIGNATURE_HARDCODE = true` como bypass temporal.
- Comentario que motivó el bug: "OAuth no necesita webhook secret manual" — falso. OAuth da access_token + collector_id; el webhook secret se obtiene aparte del panel de developers MP.
- Fix: omitir la columna del upsert. El upsert PostgREST sólo toca columnas presentes en el objeto, así que ahora UPDATE preserva el valor existente y INSERT lo deja NULL (la columna es nullable; el user lo completa por separado).
- Pendiente para próximo deploy: bajar `SKIP_SIGNATURE_HARDCODE` a `false` en `app/api/mercadopago/webhook/route.ts:268` después de verificar que se pegó el webhook_secret en el form de configuración.

### `process_sale_from_webhook` ejecutable por authenticated — RESUELTO (26-abr, hotfix MCP)

- La migración original `mp_orders_add_cart_snapshot_and_webhook_rpc` aplicada vía Supabase MCP el 26-abr no incluyó los `REVOKE EXECUTE` correspondientes — `authenticated` y `anon` podían llamar al RPC desde el browser pasando un `p_org_id` arbitrario y crear sales en cualquier organización ajena.
- Hotfix aplicado vía MCP: `REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT TO service_role`.
- Versionado en `supabase/migrations/00013_mp_cart_snapshot_plan_b.sql` (ya incluye los REVOKE).
- Riesgo: alto. Cualquier user autenticado podía mover dinero contable a otra org.

### `mp_creds_select` abierto a toda la org — RESUELTO (26-abr, migración 00014)

- Antes: SELECT policy filtraba sólo por `organization_id = get_my_org_id()` — cualquier miembro de la org leía credenciales encriptadas.
- Ahora: `USING ((organization_id = get_my_org_id()) AND is_owner())`.
- Los tokens nunca llegaban al cliente igual (uso server-side), pero la superficie es menor.

### `mercadopago_credentials` con GRANTs amplios para anon — RESUELTO (26-abr, migración 00014)

- Anon tenía SELECT/INSERT/UPDATE/DELETE/etc en la tabla. RLS lo filtraba a nivel de fila pero el GRANT no debería existir — defensa en profundidad.
- Fix: `REVOKE ALL ON mercadopago_credentials FROM anon`.

### `product_catalog` INSERT con WITH CHECK (true) — RESUELTO (26-abr, migración 00014)

- Antes: cualquier authenticated podía insertar setando `contributed_by` a otro UUID, impersonando contribuciones de otro user.
- Ahora: `WITH CHECK (contributed_by = auth.uid())`. La tabla sigue siendo cross-organización (efecto red del catálogo compartido) pero las contribuciones quedan atadas al user real.

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
