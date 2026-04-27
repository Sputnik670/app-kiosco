# App Kiosco — Instrucciones del Proyecto

> Última actualización: 27 de abril de 2026

## Qué es esto

SaaS de gestión para cadenas de kioscos en Argentina. El objetivo es convertir una app de prueba en un producto útil para una industria que se maneja con cuadernos y calculadoras.

**Posicionamiento:** "El sistema de gestión cloud para cadenas de kioscos que integra ventas, servicios virtuales y gestión de equipo en una sola app desde el celular."

**Para el estado completo del proyecto, módulos, pendientes y decisiones, ver `ESTADO_PROYECTO.md`.**

## El dueño del proyecto

- No es desarrollador. Claude actúa como tech-leader.
- Trabaja en **VSCode** con terminal **PowerShell** en Windows. Los comandos git deben ser compatibles con PowerShell (no usar `&&`, poner espacio en `git commit -m`).
- Trabaja desde **una sola PC**, pero con **dos cuentas de Claude Code** simultáneas. Cada sesión arranca fría leyendo el repo: el repo es la fuente de verdad compartida entre ambas — todo cambio de schema o convención debe quedar versionado, no aplicado solo en runtime.
- Revisa y aprueba antes de implementar. No se meten features sin su visto bueno.
- Ofrece onboarding personalizado a clientes ("te ayudo a cargar el stock y manejar la app").

## Stack Técnico

- **Frontend:** Next.js App Router + React 19 + TypeScript
- **UI:** shadcn/ui + Tailwind + lucide-react + sonner (toasts)
- **Backend:** Supabase (Auth PKCE + PostgreSQL + RLS)
- **Deploy:** Vercel (push a main = deploy automático)
- **Testing:** Vitest (unit) + Playwright (e2e smoke)
- **Supabase Project ID:** `vrgexonzlrdptrplqpri` (región: sa-east-1)
- **Vercel Team ID:** `team_sPJMb8vptJoaoXAlJOwFDS7d`
- **URL producción:** https://app-kiosco-chi.vercel.app

## Reglas Técnicas Críticas

### Server Actions vs Browser Client
- Los server actions (`'use server'`) usan `verifyAuth()` o `verifyOwner()` de `@/lib/actions/auth-helpers` para obtener el cliente Supabase autenticado del servidor.
- **NUNCA** importar `@/lib/supabase` (browser client) dentro de un server action. Causa fallos silenciosos por RLS.
- Los repositorios en `lib/repositories/` usan el browser client — no llamarlos desde server actions.

### Tipos DECIMAL de Supabase
- Las columnas DECIMAL/NUMERIC de PostgreSQL llegan como **strings** al cliente JS (`"100.00"` en vez de `100`).
- **SIEMPRE** castear con `Number()` antes de comparar o calcular.
- Para comparar decimales usar `Math.abs(a - b) > 0.01`, nunca `!==`.

### Patrones de código
- Server actions retornan `{ success: boolean, error?: string, ...data }`.
- UI components: `"use client"`, estados con useState, fetching con useCallback + useEffect.
- Colores por sección: indigo/violet para comisiones y precios, rojo para eliminación, esmeralda para dinero.
- Mobile-first: el kiosquero usa celular (360px mínimo).
- Sanitizar inputs en queries `.or()` de PostgREST con `.replace(/[,()]/g, '')` para evitar filter injection.

### Validaciones de seguridad en server actions
- Siempre verificar ownership de branchId: si el action recibe un branchId, validar que pertenece a la organización del usuario con `validateBranchOwnership()`.
- No exponer datos de usuario en console.log (emails, IDs).

## Módulos Existentes

### Core (funcionando)
- **Punto de Venta** — `caja-ventas.tsx` / `ventas.actions.ts`
- **Inventario + Scanner Barcode** — `agregar-stock.tsx`, `crear-producto.tsx` / `inventory.actions.ts`, `product.actions.ts` (scanner ZBar WASM + lookup server-side en catálogo compartido + OpenFoodFacts)
- **Proveedores** — `gestion-proveedores.tsx`, `control-saldo-proveedor.tsx` / `provider.actions.ts`
- **Dashboard Dueño** — `dashboard-dueno.tsx` / `dashboard.actions.ts` (margen real con unit_cost, no hardcodeado)
- **Reportes** — `reports/` / `reports.actions.ts` + `pdf-generator.ts` + `excel-generator.ts`
- **Facturación interna** — `facturacion/` / `invoicing.actions.ts` (NO fiscal)

### Servicios Virtuales (funcionando)
- **SUBE** — `widget-sube.tsx`
- **Cargas Virtuales** — `widget-servicios.tsx`
- Server actions en `service.actions.ts`
- Tabla `service_sales` para tracking de ventas de servicios
- Comisión configurable por proveedor (`markup_type`: percentage/fixed, `markup_value`)

### Gestión de Equipo (funcionando)
- **Empleados** — `invitar-empleado.tsx`, `vista-empleado.tsx`
- **Fichaje QR** — `generar-qr-fichaje.tsx`, `qr-fichaje-scanner.tsx`, `reloj-control.tsx`
- **Gamificación** — `misiones-empleado.tsx`, `asignar-mision.tsx`, `team-ranking.tsx`, `capital-badges.tsx`
- **Happy Hour** — `happy-hour.tsx`

### Multi-sucursal (funcionando)
- `gestion-sucursales.tsx`, `seleccionar-sucursal.tsx`
- `branch.actions.ts`

### En desarrollo
- **Mercado Pago QR EMVCo interoperable** — `mercadopago.actions.ts`, `configuracion-mercadopago.tsx`, `mercadopago-qr-dialog.tsx`, `app/api/mercadopago/` (OAuth + webhook + endpoint EMVCo funcionando para single-tenant; multi-tenant pendiente — ver deuda técnica abajo). El QR generado es interoperable con cualquier billetera virtual de Argentina (MP, Naranja X, Brubank, Ualá, Cuenta DNI, MODO, Santander, Galicia, BBVA, etc.). Falta validación de campo en producción con billeteras alternativas.
- **ARCA** — `configuracion-arca.tsx` / `arca.actions.ts`, `arca.service.ts`

### Descartado
- **Actualización masiva de precios** — DESCARTADO por Ram (2026-03-17). Componente stubbed.
- **Facturación electrónica AFIP/ARCA** — Si se necesita, integrar con Facturalo Simple/Alegra.
- Hardware propietario, ERP contable, integración con balanzas.

## Decisiones de Producto

### Roadmap
1. **Integración Mercado Pago QR** — EN CURSO
2. **ARCA** — EN CURSO
3. **Modo offline / PWA con sync** — PLANIFICAR (docs en `.skills/pwa-implementation/`)

### Pospuesto
- Catálogo precargado de productos (cubierto por onboarding personalizado)
- Cuentas corrientes de clientes / fiado (evaluar post-piloto)

## Estructura del Proyecto

```
App-kiosco-main/
├── app/                    → Rutas Next.js + API routes
├── components/             → 74 componentes React
├── lib/actions/            → 23 server actions (lógica de negocio)
├── lib/offline/            → Módulo offline (IndexedDB, sync)
├── hooks/                  → Custom React hooks
├── agents/                 → Agentes de Claude (4 activos)
│   ├── inicio-sesion/      → Sync + estado al abrir sesión
│   ├── revision-codigo/    → Reglas antes de tocar código
│   ├── pre-deploy/         → Checklist antes de push a main
│   ├── comercial/          → Competencia, onboarding, demos
│   ├── conocimiento/       → Base de conocimiento (9 archivos)
│   ├── reportes/           → Reportes de auditorías (histórico)
│   └── archivo/            → 17 agentes viejos (archivados)
├── .skills/                → Skills del proyecto
│   ├── competitive-research/ → Análisis de competidores
│   ├── git-sync/            → Sincronización al inicio de sesión (pull antes de empezar)
│   └── pwa-implementation/  → Docs para implementar offline
├── docs/
│   ├── comercial/          → Guión demo, ventajas, legales (.docx)
│   └── archivo/            → Docs archivados
├── e2e/                    → Tests E2E: smoke-01 a smoke-04 (activos)
├── tests/unit/             → Tests unitarios Vitest (7 tests)
├── ESTADO_PROYECTO.md      → Mapa completo del proyecto
├── AUDIT-FINDINGS.md       → Pendientes de seguridad y performance
└── CLAUDE.md               → ESTE ARCHIVO
```

## Fixes Aplicados (sesión 19 marzo 2026)

- **Dashboard margen hardcodeado** → Ahora lee `unit_cost` real de `sale_items`, fallback a ratio solo si cost=0
- **N+1 queries en tab-historial** → Batch queries con `.in("user_id", userIds)` + Promise.all
- **Filter injection en ventas** → Sanitizado de input en `.or()` query
- **BranchId validation en reports** → `validateBranchOwnership()` en 3 actions de reportes
- **Console.log con datos de usuario** → Eliminados 2 logs que exponían emails
- **Código muerto** → 420 líneas de actualización masiva de precios eliminadas
- **Touch targets mobile** → Botones y textos de tab-timeline ampliados a mínimo 36px

## Fixes y Features (sesión 25 marzo 2026)

### Scanner Barcode — Fix crítico + Feature catálogo compartido
- **Bug: OpenFoodFacts no respondía desde el celular** → El `fetch()` se hacía desde el browser del usuario. El header `User-Agent` es prohibido en fetch del browser (se ignora silenciosamente) y OpenFoodFacts rechazaba la request. SOLUCIÓN: Movido a server action `lookupOpenFoodFactsAction()` que corre en Vercel (server-to-server, sin CORS, con User-Agent).
- **Feature: Catálogo compartido `product_catalog`** → Nueva tabla Supabase compartida entre TODAS las organizaciones. Cuando un usuario escanea un barcode y crea un producto manualmente, la info se guarda en esta tabla. El próximo usuario que escanee el mismo código lo obtiene auto-completado.
- **Feature: Mapeo de categorías OpenFoodFacts → kiosco** → `CATEGORY_MAP` en `lookupOpenFoodFactsAction()` traduce categorías en inglés de OFF a categorías útiles (Bebidas, Golosinas, Snacks, etc.).
- **Nuevo flujo de escaneo**: `checkExistingProductAction()` → `lookupCatalogAction()` → `lookupOpenFoodFactsAction()` → manual.
- **Nuevos server actions**: `lookupCatalogAction()`, `lookupOpenFoodFactsAction()`, `saveToCatalogAction()` en `product.actions.ts`.
- **Nueva tabla**: `product_catalog` (barcode UNIQUE, name, brand, category, emoji, source, contributed_by).
- **Scanner**: ZBar WASM (`web-wasm-barcode-reader` v1.5.0) — funciona en iOS Safari + Android Chrome. Archivos WASM en `/public/a.out.js` y `/public/a.out.wasm`.

### Regla técnica nueva
- **NUNCA hacer fetch a APIs externas desde componentes client en mobile.** Usar server actions. Razón: headers prohibidos (`User-Agent`), CORS, timeouts en redes móviles. El fetch desde el servidor de Vercel es confiable.

## Fixes y Features (sesión 29 marzo 2026)

### Revisión sistema de registro y auth
- Revisión completa del flujo: Supabase Auth (email/password, PKCE, confirmación), RLS de memberships, server actions de onboarding. Sin problemas críticos.
- Leaked Password Protection requiere plan Pro de Supabase — no aplicado.

### Fixes de seguridad DB
- Vistas `v_products_with_stock` y `v_expiring_stock` cambiadas a `security_invoker = on`.
- `update_mp_creds_updated_at()` y `update_owner_notes_updated_at()` recibieron `SET search_path TO 'public'`.
- Audit trigger en `memberships`.
- pg_cron: job diario a 03:00 UTC para `cleanup_expired_invites()`.

### Proveedores: diferenciación producto/servicio
- Nueva columna `supplier_type` en `suppliers`: `'product'` | `'service'`, NOT NULL DEFAULT `'product'`.
- `getServiceProvidersAction` ahora filtra `.eq('supplier_type', 'service')`.
- `createProviderAction` incluye `supplier_type` en el INSERT.
- `gestion-proveedores.tsx`: selector de tipo al crear, lista agrupada por sección, badge de tipo en tarjetas.

### Fix definitivo de soft-delete de proveedores
- Causa: SELECT policy `is_active = true` aplicada al RETURNING del UPDATE → rechazaba filas recién desactivadas.
- Solución: función `deactivate_supplier(uuid)` SECURITY DEFINER con validación de ownership interna.
- `deleteProviderAction` usa `.rpc('deactivate_supplier', ...)`.

### Regla técnica nueva
- **Soft-delete con SELECT policy restrictiva**: Si la SELECT policy filtra por un campo que el UPDATE modifica, usar función SECURITY DEFINER para el soft-delete. UPDATE directo falla en PostgREST por el RETURNING check.

## Fixes y Features (sesión 27 abril 2026)

### Webhook Mercado Pago — bug crítico de webhooks perdidos

**Síntoma:** Pagos QR de Mercado Pago se cobraban OK en MP, pero las ventas nunca aparecían en el dashboard. El handler de webhook devolvía 200 silencioso y la orden quedaba sin actualizar.

**Causas raíz (tres bugs encadenados):**

1. **Webhook secret contaminado en DB** → La fila `mercadopago_credentials.webhook_secret_encrypted` tenía un byte de control `0x83` (control C1) embebido. El sanitize viejo no lo detectaba, y el HMAC fallaba en cada request firmada.
2. **Mercado Pago manda DOS formatos al mismo endpoint** → Feed v2.0 (IPN viejo, sin firma) + WebHook v1.0 (formato nuevo, firmado). El handler asumía siempre el formato nuevo y crasheaba con `TypeError` al recibir Feed v2, devolviendo 200 silencioso por el catch genérico.
3. **Feed v2 IPN no siempre manda `user_id`** → No podíamos identificar al seller para buscar sus credenciales en multi-tenant.

**Fixes deployados (commits `678ba2d`, `8a1e521`, `f9aa499`):**

- **Sanitize bulletproof** del webhook secret: `replace(/[^0-9a-f]/gi, '')` strip todo carácter no-hex. Cubre control chars, espacios invisibles, BOM, etc.
- **Ruteo por User-Agent + shape del body** en `app/api/mercadopago/webhook/route.ts`: WebHook v1.0 va al handler firmado (HMAC); Feed v2.0 va a un handler dedicado que sintetiza el payload al formato nuevo internamente.
- **Guard en `getWebhookSecretForPayload`** contra `data` undefined cuando llega un payload sin estructura esperada.
- **Fallback single-tenant en Feed v2 IPN**: Si no viene `user_id`, busca la única organización con credenciales MP activas. Funciona para piloto, no escalable a multi-tenant.
- **Texto en libro de ventas**: "Pago QR Mercado Pago" en vez del UUID interno feo.
- **Limpieza** del código DEBUG-HMAC que había quedado de la sesión de diagnóstico.

**Validado en producción:** Pago de prueba $3 con app Mercado Pago → QR cierra → venta aparece en dashboard.

### Reglas técnicas nuevas

- **Webhooks de Mercado Pago: rutear por User-Agent + shape del body.** MP manda dos formatos al mismo endpoint (Feed v2.0 sin firma, WebHook v1.0 con firma). No asumir formato único — si el handler crashea, devuelve 200 silencioso y el evento se pierde para siempre.
- **Sanitizar secrets/tokens leídos de DB con `replace(/[^0-9a-f]/gi, '')` (o el charset que corresponda).** Bytes de control invisibles (0x83 y similares) pueden filtrarse en pegados desde el panel de proveedores y romper HMAC sin error visible.

### Deuda técnica conocida (próxima sesión)

- **WebHook v1.0 sigue fallando HMAC** consistentemente. El secret en DB sigue probablemente contaminado. Para piloto single-tenant funciona porque el fallback Feed v2 lo cubre. **Antes de habilitar multi-tenant: rotar secret en panel MP + re-pegar con sanitize bulletproof.**
- **Dos ventas perdidas hoy** ($6 y $9 de las pruebas) no se recuperan por decisión del dueño. La plata entró a MP, pero no hay registro de `sale` en el sistema.

### Migración a QR EMVCo interoperable (parte 2 del 27-abr-2026)

**Problema:** Hasta hoy generábamos el QR a partir de un `init_point` URL devuelto por `/checkout/preferences`. Solo lo leía la app de Mercado Pago — Naranja X, MODO, Brubank, Ualá, Cuenta DNI, etc., no escanean URLs propietarias.

**Solución:** Migrar al endpoint **`POST /instore/orders/qr/seller/collectors/{collector_id}/pos/{external_pos_id}/qrs`**, que devuelve un `qr_data` en formato **EMVCo** (estándar interoperable). Lo escanea cualquier billetera virtual de Argentina/LATAM.

**Cambios deployados:**

- **Migration `00013_branches_mp_external_pos_id.sql`** → nueva columna `branches.mp_external_pos_id` (text, nullable) con índice UNIQUE por organización. Decisión clave: 1 POS de MP = 1 sucursal (no 1 cash_register, que es per-día).
- **Server action `registerMercadoPagoPosForBranchAction`** → llama `PUT /instore/orders/qr/seller/collectors/{collector_id}/pos/{external_pos_id}` con `name`, `category=621102` (kiosco), `fixed_amount=false`. external_pos_id determinístico: `KIOSCO_<branch_id sin guiones>`. Idempotente.
- **Server action `getBranchesMpRegistrationStatusAction`** → lista sucursales con su estado de registro. Usada por el panel de configuración para mostrar "registrada/pendiente" por sucursal.
- **Refactor `createMercadoPagoOrderAction`** → cambia el endpoint de `/checkout/preferences` a `/instore/orders/qr/.../qrs`. Validación previa: la sucursal tiene que tener `mp_external_pos_id` o el action devuelve error claro ("Registrá la sucursal en MP antes de cobrar QR"). Body con `external_reference`, `total_amount`, `notification_url`, `items[]`. Persiste el `qr_data` EMVCo en la columna `qr_data` (mismo nombre, distinto formato — string EMVCo en vez de URL).
- **UI `configuracion-mercadopago.tsx`** → nueva card "Sucursales en Mercado Pago" con badge de estado por sucursal y botón "Registrar todas las pendientes". Solo aparece cuando hay credenciales MP cargadas.
- **Auto-registro en `branch.actions.ts:createBranchAction`** → al crear una sucursal, intenta registrar el POS automáticamente si la org tiene MP conectado. Best-effort: no bloquea la creación si falla, dejando el botón manual de retry.
- **Copy del `mercadopago-qr-dialog.tsx`** → cambiado a "Escaneá con tu billetera virtual" con lista de billeteras compatibles (MP, Naranja X, MODO, Brubank, Ualá, Cuenta DNI, Santander, Galicia).
- **Webhook handler sin cambios** → sigue resolviendo por `external_reference = saleId`. EMVCo y Preferences usan el mismo flujo de notificación.

**Validación previa al deploy:**
- `tsc --noEmit` limpio.
- `vitest run tests/unit/actions/mercadopago-webhook-signature.test.ts` → 20 tests pasando.

**Validación de producción pendiente (Tarea #10 cierra cuando se confirme):**
1. Pago con app Mercado Pago → regresión, debería seguir andando igual.
2. Pago con MODO o Naranja X o Cuenta DNI → confirmación crítica de que el EMVCo es realmente interoperable.

**Reglas técnicas nuevas:**

- **1 POS de MP = 1 sucursal (`branches`), no 1 cash_register.** `cash_registers` es per-día/turno; los POS de MP son persistentes. Registrarlos por turno generaría caos en MP.
- **External pos_id determinístico desde branch_id:** formato `KIOSCO_<32 hex chars>`. Garantiza idempotencia local (la misma sucursal siempre genera el mismo POS) y ausencia de colisiones cross-org.
- **Categoría MP `621102`** = "Quiosco / Almacén general" en el catálogo MCC de MP. Si MP rechaza la categoría en alguna cuenta, ajustar acá.

### Aprendizajes del intento previo (12-mar-2026)

La sesión del 12-mar-2026 intentó este mismo camino y pivoteó a Preferences API porque el endpoint `POST /users/{id}/stores` rechazaba a apps OAuth recién creadas. Esta sesión lo logró skipeando Stores enteros — el endpoint `PUT /instore/.../pos/{external_pos_id}` no requiere Store previo, así que registramos POS directamente al nivel del seller. Las columnas legacy `mercadopago_credentials.mp_store_id` y `.mp_pos_external_id` (migration `00012`) quedan as-is — no se usan en el flujo nuevo (que es per-branch, no per-org).

## Pendientes Prioritarios de Seguridad

Ver `AUDIT-FINDINGS.md` para la lista completa. Al 27-abr-2026 todos los pendientes críticos están cerrados. Los abiertos son no-accionables o de baja prioridad:
- Auth leaked password protection deshabilitado (requiere plan Pro de Supabase).
- Dos optimizaciones de performance frontend (queries no-críticas en dashboard, dynamic imports en VistaEmpleado).

## Pendientes Prioritarios de Producto

1. **Tarea #10 — QR EMVCo: validación de campo (PRIORIDAD ALTA).** Código deployado y validado por typecheck + unit tests. Falta confirmar en producción real: (a) pago con app Mercado Pago como regresión, (b) pago con al menos una billetera alternativa (MODO / Naranja X / Cuenta DNI). Solo después de eso se considera la migración cerrada y se puede marketing-ear como diferenciador comercial.
2. **Webhook secret multi-tenant.** Antes de subir a multi-tenant: rotar el secret en panel MP + re-pegar con sanitize bulletproof. WebHook v1.0 hoy falla HMAC; el fallback Feed v2 single-tenant lo tapa.
3. **Bajar `SKIP_SIGNATURE_HARDCODE = true` a `false`** en `app/api/mercadopago/webhook/route.ts:268` cuando se haya re-pegado el webhook secret limpio. Hoy está en bypass por el bug del secret contaminado.

## Ventajas Competitivas

1. **Servicios virtuales con comisión integrada** — Único en Argentina
2. **Gamificación de empleados** — Único en el segmento a nivel mundial
3. **Cloud + PWA + Multi-sucursal** — La mayoría de competidores son Windows local

**Competidor principal:** Sistar Simple (sistar.com.ar) — cloud y multi-sucursal, pero sin servicios virtuales ni gamificación. Precio estimado $15k/mes por sucursal vs nuestros $199/mes por toda la cadena.

Análisis completo en `.skills/competitive-research/reports/`
