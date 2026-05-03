# App Kiosco — Instrucciones del Proyecto

> Última actualización: 3 de mayo de 2026

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

## Fixes y Features (sesión 1 mayo 2026)

### EMVCo definitivo — fin de la odisea Mercado Pago

**Punto de partida:** El deploy del 27-abr llamaba a `PUT /instore/orders/qr/seller/collectors/{id}/pos/{external_pos_id}` para registrar el POS, pero **ese endpoint no existe**. MP devolvía 404, el código capturaba el error y devolvía éxito al usuario, y MP igual generaba un `qr_data` degradado al cobrar — solo legible por la app de Mercado Pago. **Bro detectó el problema cuando intentó cobrar con Naranja X y le saltó "el código no es para pagar".**

**Bugs encontrados (en orden):**

1. **POS nunca se registraba realmente** — el endpoint `PUT /instore/.../pos/{id}` no existe. Implementación deployada como "exitosa" sin probar contra MP real con billetera no-MP.
2. **MP rechaza `external_id` con underscore en `POST /pos`** — error 400 "external_id must be alphanumeric". Inconsistencia con `POST /users/{id}/stores`, que sí acepta underscore (validado el mismo día con un store creado OK con `external_id = KIOSCO_<hex>`).
3. **El logger genérico de `callMercadoPagoAPI`** truncaba el body de error de MP, escondiendo detalles útiles. Resuelto leyendo logs de Vercel directamente.

**Fixes deployados (commits `727189f`, posterior fix del underscore):**

- **Migration `00016_branches_mp_store_id.sql`** — agrega columna `mp_store_id` a `branches` con índice UNIQUE por organización. Necesaria para el flujo Stores+POS y el recovery (si la creación del Store pasa pero falla el POS, el reintento reusa el Store en vez de duplicarlo en MP).
- **`registerMercadoPagoPosForBranchAction` reescrita** (en `lib/actions/mercadopago.actions.ts`) al flujo correcto:
  1. Si la sucursal ya tiene `mp_external_pos_id`, skip (idempotencia local).
  2. Si no tiene `mp_store_id`, crear Store en MP via `POST /users/{collector_id}/stores` y persistir el ID **antes** de seguir.
  3. Crear POS via `POST /pos` con `store_id` numérico, `external_id` alfanumérico, `category: 621102`.
  4. Persistir `mp_external_pos_id` en `branches`.
- **Borrado de código de probe del 27-abr** — `probeMercadoPagoApiAction`, sus interfaces, los useStates y la card "🔬 Diagnóstico API" en `configuracion-mercadopago.tsx`.
- **Prefijo `external_id` cambiado de `KIOSCO_` a `KIOSCO`** (puramente alfanumérico) tanto para Store como para POS.
- **Plan `docs/PLAN_VIERNES_EMVCO.md` ejecutado** — borrar el archivo cuando se cierre la validación.

**Validación:**

- ✅ Registro de POS exitoso (badge "Registrada" en verde).
- ✅ QR generado es **EMVCo válido** — confirmado porque MP responde "Este QR solo sirve para cobrar en tu negocio" cuando el dueño intenta escanear su propio QR (señal de QR de comercio bien formado, no de QR degradado).
- ⏳ **Pendiente prueba final con cuenta externa** — Bro no tiene segunda cuenta hoy. Confirmar el 2-may-2026 con: (1) MP de otra persona = regresión obligatoria, (2) Naranja X / MODO / Cuenta DNI = validación crítica EMVCo interop.

### Reglas técnicas nuevas

- **Mercado Pago — `external_id` en `POST /pos` debe ser puramente `[A-Za-z0-9]`.** Sin underscore, sin guion, sin punto. El endpoint `POST /users/{id}/stores` sí acepta underscore — son inconsistentes entre sí. Default del proyecto: prefijo `KIOSCO` (sin underscore) seguido del UUID sin guiones.
- **Validar integraciones de cobro con AL MENOS dos billeteras distintas antes de declarar "funciona".** El bug del 27-abr quedó dos semanas oculto porque solo se probó con la app de MP, que tiene un fallback que enmascara cuando el POS no está bien registrado. Validar SIEMPRE con MP + una billetera no-MP (Naranja X, MODO, Cuenta DNI).
- **`callMercadoPagoAPI` lossy en logs:** si necesitás el body de error completo de MP, leer logs de Vercel directamente — el logger del proyecto solo guarda `error.message` que MP a veces deja vago. Mejora pendiente: capturar `response.text()` en el throw cuando es non-2xx.

### Hallazgo lateral

- **Migration `00010_payment_methods_expansion` está aplicada en Supabase producción** (24-abr-2026) pero el archivo SQL no está en `supabase/migrations/` — vive solo en la rama `feature/metodos-cobro` sin mergear. Cuando se retome esa feature (Posnet / QR fijo / Alias para cobros manuales), no hace falta re-aplicar la migration. Las columnas de DB ya están en producción esperando al código que las use.

## Fixes y Features (sesión 2 mayo 2026)

### Tarea #10 — QR EMVCo CERRADA definitivamente

**Validación de campo completa:**
- Test A (regresión con app de MP de otra cuenta): pasó. Cobro entró, dialog se cerró solo, venta apareció en dashboard como "Pago QR Mercado Pago".
- Test B (interop con billetera no-MP — Naranja X / MODO / Cuenta DNI): pasó. El QR EMVCo es genuinamente interoperable.

**Cierre formal de 2 semanas de trabajo iniciado el 12-mar-2026.** El goal original del proyecto Mercado Pago — "cualquier billetera virtual de Argentina puede pagar en el kiosco" — está cumplido. Borrado `docs/PLAN_VIERNES_EMVCO.md` (estaba marcado para borrarse al cerrar la validación).

### Mejora del logger de `callMercadoPagoAPI`

Antes: el catch de errores hacía `response.json().catch(() => ({}))` y solo guardaba `errorData.message`. Si MP devolvía HTML (gateway error), plain text, o JSON con detalles en `cause` / `error` / arrays de validación, todo eso se perdía y los logs quedaban con mensajes genéricos tipo "MP API error 400: Bad Request" — inútiles para diagnóstico.

Ahora (`lib/actions/mercadopago.actions.ts`):
- Lee body con `response.text()` primero (siempre funciona)
- Intenta parsearlo como JSON para extraer fields estructurados (`message`, `error`, `cause[].description`)
- Construye mensaje de error rico que incluye status + summary + body truncado a 1500 chars
- Adjunta `mpStatus`, `mpRawBody`, `mpParsed` como properties del Error
- El `logger.error` final (cuando agotó los 3 retries) extrae el body completo (sin truncar) en meta para diagnóstico exhaustivo

Cierra la deuda técnica que venía del bug del 1-may-2026 (`external_id must be alphanumeric` que solo se vio leyendo logs de Vercel directamente).

### Auditoría reveló bug en reporting al dueño para los 3 métodos manuales

**Cómo apareció:** Ram quería probar Posnet con el del negocio. Antes de mandarlo a probar, audit end-to-end del feature. La parte de "configurar y vender con Posnet" funciona bien — la migration `00010` agrega `posnet_mp` al CHECK constraint, `process_sale` lo acepta, el dialog de confirmación es claro, no hay filtraciones de datos sensibles. **Pero el reporting al dueño tenía 5 (después 8) lugares donde los métodos nuevos aparecían mal categorizados o con label feo.**

**Bug raíz:** la interface `PaymentBreakdown` solo tenía 4 keys (`cash`, `card`, `transfer`, `wallet`). El código de dashboard hacía `if (paymentBreakdown.hasOwnProperty(method)) paymentBreakdown[method] += amount` — para `posnet_mp` / `qr_static_mp` / `transfer_alias` (y `mercadopago`, bug colateral preexistente) la condición fallaba y la venta se descartaba del breakdown silenciosamente. El total bruto sí las contaba (porque era previo al filtro), pero el desglose por método marcaba todo en cero. Una venta de $100 por Posnet aparecía como "Ventas totales: $100, Tarjeta: $0, Efectivo: $0".

**Bug colateral:** `mercadopago` (introducido hace mucho con el QR dinámico) también estaba siendo descartado del breakdown — venía cargando ventas en gross pero no en el desglose. Nunca lo notamos porque el dueño venía mirando solo el total bruto.

**Fixes deployados** (8 archivos):
- `lib/actions/dashboard.actions.ts` — `PaymentBreakdown` interface ampliada con 4 keys nuevas (`mercadopago`, `posnet_mp`, `qr_static_mp`, `transfer_alias`); inicialización + fallback de error actualizados; `traceable` expandido para incluir todos los métodos electrónicos.
- `types/dashboard.types.ts` — interface duplicada (consumida por hooks) sincronizada.
- `components/dashboard/use-dashboard-data.ts` — `emptyPaymentBreakdown` y `svcBreakdown` literales actualizados con 8 keys.
- `components/dashboard/tab-sales.tsx` — agregado label helper `paymentBreakdownLabel` para que el render de `Object.entries` no muestre `qr_static_mp` como "QR STATIC_MP" (el `replace("_", " ")` solo cambiaba el primer underscore).
- `components/dashboard/tab-historial.tsx` — `paymentLabel` emojis ampliado.
- `lib/actions/timeline.actions.ts` — `paymentLabel` strings legibles ampliado.
- `components/facturacion/sales-selector.tsx` — `paymentMethodLabels` + `paymentMethodIcons` ampliados.
- `lib/actions/reports.actions.ts` — `salesSummary` re-mapea: todo electrónico (card/transfer/wallet/mercadopago/posnet_mp/qr_static_mp/transfer_alias) cae en bucket "card"; "other" queda para legacy/desconocidos.

**Decisiones de diseño tomadas:**
1. `PaymentBreakdown` se amplía con 4 keys nuevas en vez de consolidar — mejor granularidad para reportes futuros.
2. `traceable` se expande a todos los electrónicos — conceptualmente todo lo no-cash deja traza en banco/MP/posnet. Cambia un número que el dueño venía viendo, pero ahora tiene significado real (y QR MP por fin lo está alimentando con ventas reales).
3. `salesSummary` queda simple (cash/card/other) — todo electrónico se consolida en "card" para mantener compatibilidad con reportes existentes.

**Validación:** `tsc --noEmit` exit 0; `vitest run tests/unit/` pasa todos los tests de payments (las 2 fallas que aparecen son preexistentes y no relacionadas — `inventory.actions.test` sobre actualización de costo y `indexed-db.test` sobre versión de schema offline).

### Discusión de producto: método "Alias / Transferencia" pausado

Ram intentó probar Alias y detectó un riesgo de seguridad concreto: el dialog del cobro mostraba el CBU/alias del dueño al empleado. Riesgo real (rotación de personal, fotos, screenshots).

La conversación que siguió derivó en una decisión de producto más profunda:
- **Alias-MP** es redundante con QR EMVCo dinámico (que ya cubre todas las billeteras). Pedirle al cliente que tipee el alias cuando puede escanear el QR es estrictamente peor UX.
- **Alias bancario** (Galicia, BBVA, Santander, etc.) es donde el método tiene utilidad real — para clientes que pagan desde home-banking sin pasar por wallets. Pero requiere flujo "dueño confirma desde su app del banco" porque no podemos integrarnos con APIs de bancos argentinos (no hay Open Banking maduro). Y los comprobantes de transferencia que muestra el cliente no son confiables (estafas con apps falsas son comunes).
- Confirmación manual del dueño + realtime in-app (Supabase Realtime) sería la primera implementación viable. Push notifications (que requiere infra de service worker + VAPID + persistencia de subscripciones) queda como v2.

**Decisión:** Alias pausado por ahora. Quedó deshabilitado desde Ajustes. Cuando se retome, el flujo será: empleado selecciona Alias → dialog "esperando confirmación del dueño" sin datos bancarios → dueño recibe aviso → mira su banco/MP → confirma → dialog del empleado se cierra solo. **QR fijo y Posnet siguen viables y son los próximos en la lista.**

### Reglas técnicas nuevas

- **Cuando se amplía el enum de `payment_method`, auditar TODO el reporting al dueño además del flujo de venta.** El bug fixeado hoy quedó oculto desde el 24-abr-2026 cuando se mergeó la migration `00010` y se implementó el flujo de venta — pero el reporting al dueño es un consumidor independiente del enum (dashboard, reports, timeline, historial, facturación tienen cada uno sus propios maps de labels). Validar uno no valida los otros.
- **Cuando hay duplicación de interfaces** (como `PaymentBreakdown` viviendo en `types/dashboard.types.ts` y `lib/actions/dashboard.actions.ts`), un cambio en una requiere cambio sincronizado en la otra. Por ahora se dejaron las dos en sync con un comentario `// mantener en sync con...` apuntando a la otra. Considerar consolidar a futuro.
- **No mostrar datos sensibles del dueño (CBU, alias, datos bancarios) al empleado en el flujo operativo.** Aunque el dueño los configure en Ajustes para uso interno, el flujo de cobro debe abstraerlos (mostrar solo monto + estado de "esperando confirmación").

### Aprendizaje de proceso (institucional ya)

**Tercera vez en 5 días que aparece la misma regla** (12-mar QR pivote a Preferences, 27-abr QR EMVCo "registrado" sin probar con billetera no-MP, 1-may Alias deployado con security issue). El patrón es siempre el mismo: la implementación parece andar en el happy path, alguien empieza a usarla en serio, aparecen huecos. **Cualquier feature de cobro / reporting / integración tiene que tener una validación end-to-end con el rol completo (caja → reporting → dashboard) antes de declarar done.** No alcanza con "se graba la venta OK".

### Estado actual del repo después de esta sesión

- 9 archivos modificados (8 reporting + `mercadopago.actions.ts` con la mejora del logger)
- 1 archivo borrado (`docs/PLAN_VIERNES_EMVCO.md`)
- Migration `00010_payment_methods_expansion.sql` ya está en el branch — el comentario "Hallazgo lateral" del 27-abr ya es obsoleto, el archivo está versionado.
- `feature/metodos-cobro` ya merge-compatible con main: este push deja el feature de Posnet/QR fijo/Alias visible, con Alias deshabilitado por defecto, Posnet y QR fijo activables.

## Fixes y Features (sesión 2 mayo 2026 — parte 2: sprint ARCA con SDK directo)

Sesión doble en paralelo (las dos cuentas de Claude Code de Ram). Cierre del sprint offline (T1+T5+T9+T10) por la sesión gemela y arranque del sprint ARCA con AFIP directo (T12+T14a+T14b). Commits `1fab7a1` y `6a2fe15` en main.

### T1 + T5 — Sprint offline cerrado

- **T1**: bump esperado de versión IndexedDB schema offline 2 → 4 en `tests/unit/offline/indexed-db.test.ts`. Coherencia con migraciones de schema offline acumuladas.
- **T5**: guardrail offline en `components/qr-empleado-scanner.tsx` (Opción B = bloquear, NO guardar offline). Vista "Sin conexión" con botón Reintentar usando `useOnlineStatus`. Razón: `processEmployeeQRScanAction` es server-stateful, guardar offline crea riesgo de duplicar entradas o cerrar turnos por error. Opción A (guardar offline + sync con dedupe) queda parked.

### T9 — Migration 00017 versiona tablas ARCA preexistentes

`supabase/migrations/00017_arca_tables.sql` versiona en git las tablas `arca_config` y `arca_invoices` que ya existían en producción (`vrgexonzlrdptrplqpri`) pero nunca habían sido versionadas. Idempotente con `CREATE TABLE IF NOT EXISTS` y policies con `DROP POLICY IF EXISTS`. Sirve tanto para fresh setups como para entornos donde ya existen.

### T10 — Decisión tomada: ARCA con SDK AFIP directo, NO TusFacturasAPP

**Descartado TusFacturasAPP** por costo recurrente ($20-50K ARS/mes por org) que rompía el modelo de costos del SaaS ($199/mes por toda la cadena). Vamos con `@afipsdk/afip.js` directo.

**Capa pura compartida creada:**
- `lib/services/arca-cae.ts` — función `requestCAEFromInvoiceData()` centraliza la única llamada al SDK AFIP. Exporta `CBTE_TIPO_MAP`, `DOC_TYPES`, `IVA_RATES`. NO toca DB. NO es `'use server'` — invocable solo desde server actions que ya validaron auth.
- `lib/services/arca-credentials.ts` — `decryptArcaCredentials(organizationId)` lee `arca_config` y desencripta cert+key con AES-256-GCM. Reusa `MP_ENCRYPTION_KEY` (un solo secret por env evita rotación quirúrgica por feature).
- `lib/services/arca.service.ts` — vaciado (`export {}` + comentario deprecated). Era el mock anterior que nunca se conectaba a AFIP de verdad.

**Refactor de consumidores:**
- `lib/actions/arca.actions.ts` — `createInvoiceAction(saleId)` usa `requestCAEFromInvoiceData`.
- `lib/actions/invoicing.actions.ts` — facturación retroactiva legacy también usa la capa pura. NOTA: usa `organizations.fiscal_config` (legacy JSONB) para datos básicos pero cert+key desde `arca_config` via `decryptArcaCredentials`. Coexistencia intencional, no migrar `fiscal_config` a `arca_config` en esta sesión.

### T12 — Toggle sandbox / producción

`saveArcaConfigAction` antes hardcodeaba `is_sandbox: true` siempre — toda cuenta nueva quedaba en sandbox para siempre, sin forma de pasar a producción.

**Cambios:**
- `saveArcaConfigAction` acepta `isSandbox?: boolean` opcional con default `true` (sandbox-by-default).
- Nuevo server action `setArcaSandboxModeAction(isSandbox)` con validación de ownership y guardrail: bloquea pasar a producción sin certificado cargado.
- UI en `components/configuracion-arca.tsx`: nuevo `Switch` "Modo prueba (sandbox)" debajo del toggle "Facturación activa", en la card configurada.
- `Dialog` de confirmación rojo al pasar a producción explicando consecuencias fiscales (cuenta ante ARCA, suma a facturación anual, no se borra — solo nota de crédito).
- Badge muestra "Producción" en emerald cuando `is_sandbox=false`. Antes decía "Configurado" siempre, ocultando el modo real.

**Decisiones de UX consensuadas con Ram:**
- Switch al lado de "Facturación activa" en la card configurada (no en form de edición) — visible cada vez que toca ARCA.
- Sandbox como default siempre (lo más seguro, requiere acción explícita para producción).
- Volver a sandbox es directo (acción segura), pasar a producción exige Dialog de confirmación.

### T14a — Idempotencia local en arca_invoices

Migration `00018_arca_invoices_unique.sql` con dos UNIQUE INDEX parciales:
- `arca_invoices_sale_authorized_unique` ON (sale_id) WHERE sale_id IS NOT NULL AND status='authorized' — garantiza una venta = una factura.
- `arca_invoices_voucher_unique` ON (organization_id, cbte_tipo, punto_venta, cbte_numero) WHERE cbte_numero IS NOT NULL AND status='authorized' — blinda contra duplicación local de números (AFIP ya rechazaría duplicados, pero esto cubre nuestro lado por si hay race condition).

Por qué partial UNIQUE: `arca_invoices` guarda intentos fallidos (`status='error'`) sin `cbte_numero`. Esos rows NO deben competir contra el UNIQUE.

**`createInvoiceAction` ahora chequea idempotencia ANTES de pedir CAE:** si el `saleId` ya tiene factura `authorized`, devuelve `{success: true, alreadyInvoiced: true, cae: existente, ...}` sin llamar a AFIP ni desencriptar credenciales. Para corregir, se requiere nota de crédito (feature futura, no en este sprint).

**Validación previa a aplicar la migration:** corrida de query en Supabase para verificar 0 duplicados pre-existentes en `arca_invoices` (no había). Si hubiera habido duplicados, la migration habría fallado y había que limpiarlos manualmente primero.

### T14b — Retry con backoff en errores transitorios

Agregadas 3 funciones internas en `lib/services/arca-cae.ts`: `isTransientAfipError(msg)`, `sleep(ms)`, `callAfipWithRetry(fn)`. Wrappean la llamada `afip.ElectronicBilling.createNextVoucher`.

- 3 retries con delays 300ms / 1s / 3s.
- Solo retry en errores transitorios: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `socket hang up`, `network`, `502`, `503`, `504`, `timeout`, `service unavailable`, `gateway`, `temporar*`, `no disponible`.
- Errores de validación de AFIP (CUIT mal, importe negativo, doc malformado) NO se reintentan para evitar emisiones duplicadas.

### Hallazgos técnicos clave del sprint ARCA

1. **`createNextVoucher` del SDK AFIP maneja la numeración solo.** Internamente consulta `FECompUltimoAutorizado(PtoVta, CbteTipo)` y suma 1. AFIP es la fuente de verdad de qué número va — no llevamos contador local. Eso eliminó toda una rama de complejidad de T14 que parecía necesaria.

2. **UNIQUEs parciales en `arca_invoices` blindan contra duplicación local pero no contra "AFIP procesó / no nos llegó la respuesta".** Si AFIP recibe el pedido, emite el comprobante, pero la respuesta TCP no llega a nuestro lado y reintentamos, AFIP emite UN SEGUNDO comprobante con el número siguiente. La UNIQUE de T14a bloquea el INSERT del segundo CAE de nuestro lado, pero AFIP fiscalmente ya cuenta los dos. T14c (parked) cubre el recovery formal.

3. **`logger.warn` en INSERT failed post-CAE** captura la race entre dos requests con la misma sale. Útil para diagnóstico cuando arranque el piloto: si aparecen warnings, hay race en el flujo de venta.

### Reglas técnicas nuevas

- **SDK AFIP — `createNextVoucher` ya maneja numeración.** No implementar contadores locales ni `CbteDesde/CbteHasta` propios. Si en el futuro hace falta numeración manual (notas de crédito con gap, por ejemplo), usar `getLastVoucher(PtoVta, CbteTipo)` del SDK para consultar el último número antes de armar el voucher.
- **Retries en integraciones de cobro/fiscal: solo errores transitorios.** Errores de validación NUNCA reintentar — la integración remota puede haber procesado y reintentar duplica. Heurística para clasificar transitorio vs fatal: errores de red (ECONN*, ENOTFOUND, timeout, socket hang up) + 5xx HTTP → transitorio. Errores 4xx + mensajes de validación de campos → fatal.
- **Idempotencia local con UNIQUE INDEX parcial cuando hay rows "intento" y rows "exitosos" en la misma tabla.** En `arca_invoices` los intents `status='error'` no tienen `cbte_numero` y NO deben competir contra el UNIQUE de comprobantes autorizados. Si la tabla mezcla estados, partial index es la forma correcta.

### Estado del sprint ARCA al cierre del 2-may parte 2

| Tarea | Estado |
|-------|--------|
| T1 — Bump version IndexedDB tests | ✅ commiteada |
| T5 — Guardrail QR offline | ✅ commiteada |
| T9 — Migration 00017 versionando arca tables | ✅ commiteada y aplicada |
| T10 — Capa pura ARCA (arca-cae + arca-credentials) | ✅ commiteada |
| T12 — Toggle sandbox/producción | ✅ commiteada (validación end-to-end pendiente) |
| T14a — Idempotencia local | ✅ commiteada y migration aplicada en prod |
| T14b — Retry con backoff | ✅ commiteada (validación pendiente) |
| T6 — Tests guardrail QR offline | ⏳ pending |
| T7 — Validación device real Ram | ⏳ pending |
| T11 — Opción A offline QR | 🅿️ parked |
| T13 — PDF fiscal compliant | ⏳ próxima sesión dedicada (~1 semana) |
| T14c — Recovery CAE huérfano | 🅿️ parked hasta data del piloto |
| T15 — Hook ARCA al flujo de venta | ⏳ recomendado antes de T13 |
| T16 — Tests + smoke sandbox AFIP | ⏳ depende de T15 |

### Validación pendiente (regla institucional 2-may)

T12 y T14 están **code-complete** (tsc verde, migration aplicada en prod, commits pusheados, deploy automático en Vercel) pero NO **production-validated**. Falta el smoke contra sandbox AFIP real:
1. Ram genera certificado de homologación AFIP en el portal y lo carga en la app vía la nueva UI de ARCA en modo sandbox.
2. Hace una venta de prueba.
3. Llama a `createInvoiceAction(saleId)` (vía un endpoint manual o el hook automático de T15 cuando esté).
4. Verifica que el CAE viene OK y se guarda en `arca_invoices` con `status='authorized'`.
5. Reintenta `createInvoiceAction(mismoSaleId)` — debe devolver `alreadyInvoiced=true` con el CAE original, sin tocar AFIP.

Mi recomendación al próximo agente: **T15 antes que T13.** Hookear `createInvoiceAction` al flujo de caja deja la integración funcionalmente completa y permite validar el sandbox AFIP en piloto antes de invertir la semana del PDF fiscal de T13.

### Aprendizajes de proceso

- **2 sesiones simultáneas de Claude Code requieren `git pull` antes de empezar y commit + push antes de cerrar.** En este sprint la sesión gemela cerró sin commitear T1+T5+T9+T10 y la siguiente sesión las heredó como cambios sin trackear. Funcionó porque ambas eran de Ram, pero el patrón es frágil.
- **Para evitar mezclas en archivos compartidos:** cuando una tarea (T14b) toca un archivo creado por otra sesión sin commit (`arca-cae.ts` creado por T10), el commit honesto incluye una nota en el mensaje aclarando la mezcla. Mejor que esconderla.

## Fixes y Features (sesión 3 mayo 2026)

### Sprint T16 — smoke sandbox AFIP. CERRADA con bloqueo arquitectónico.

Sesión dedicada a validar end-to-end ARCA contra sandbox AFIP. Avanzó hasta el último metro y descubrió que la stack elegida el 2-may NO es lo que creímos. T16 queda **funcionalmente bloqueada** hasta resolver el bloqueo. Lo que sí cerró:

**Cert AFIP de homologación generado y cargado:**
- OpenSSL key RSA 2048 + CSR (subject `C=AR, O=CARLOS RAMIRO IRAZOQUI SOLER, CN=appkiosco-homo, serialNumber=CUIT 20371472208`).
- Subido al portal `wsass-homo.afip.gob.ar`, descargado .crt firmado por AFIP (CA "Computadores Test", AFIP normalizó CN a `appkiosco`, vence 2-may-2028).
- Autorización del DN al servicio `wsfe` creada en WSASS.
- Cert + key viven en `C:\Users\Rram\Desktop\arca-cert-homo\` (FUERA del repo).
- Cargados en la app via UI ARCA, encriptados en `arca_config`. Sandbox toggle ON.

**Bug fix: condicion_iva no matcheaba CHECK constraint.**

`saveArcaConfigAction` fallaba con PG error 23514 ("violates check constraint arca_config_condicion_iva_check") porque el form mandaba `'monotributista'` / `'responsable_inscripto'` / `'exento'` como `condicion_iva` pero el CHECK de `00017_arca_tables.sql:33` exige strings AFIP canónicos: `'Monotributo'`, `'IVA Responsable Inscripto'`, `'IVA Exento'`, `'Responsable No Inscripto'`. Ningún consumidor externo del campo (ni `arca-cae.ts` ni `invoicing.actions.ts`), fix limitado a 3 strings + comentario inline en `components/configuracion-arca.tsx:83-103` apuntando al constraint para evitar drift futuro. Commit pusheado a main.

**HALLAZGO CRÍTICO — `@afipsdk/afip.js` NO es directo a AFIP.**

Al intentar la primera venta de prueba, error 401 con stacktrace apuntando a `app.afipsdk.com/api/v1/afip/...`. Investigación: el SDK npm `@afipsdk/afip.js` que la sesión 2-may parte 2 eligió creyendo que era "SDK AFIP directo" en realidad **es un wrapper que hace POST a `app.afipsdk.com`** (servicio de terceros). El cert+key del usuario sale de tu server hacia un proveedor externo. Para autenticarse necesita un `access_token` generado en `app.afipsdk.com` (14 días trial → suscripción mensual + cuota de facturas/mes).

**Esto invalida la "decisión inalterable" #1 del 2-may parte 2** ("ARCA con SDK AFIP directo, NO TusFacturasAPP"). La premisa de "directo" estaba mal. La decisión hay que reabrirla.

3 caminos posibles, en orden de preferencia:
- **A — Diagnóstico rápido (30 min):** generar access_token gratis en `app.afipsdk.com`, pasarlo al constructor del SDK, reintentar smoke. Valida la cadena hasta `afipsdk.com` (NO hasta AFIP real). NO cierra T16, queda como "validada funcionalmente con dependencia inaceptable, migración pendiente".
- **B — Migración correcta (1-2 días):** reemplazar por `@arcasdk/core` (npm, TS-first, mantenido 2025, conexión SOAP DIRECTA a AFIP). Refactor contenido en `lib/services/arca-cae.ts` (la capa pura existe para esto). T14a + T14b + T15a no se tocan.
- **C — SOAP a mano (3-5 días):** descartado salvo que A y B fallen.

**Decisión propuesta para próxima sesión:** A primero (15-30 min de diagnóstico) para validar que el cert+key + flujo end-to-end están OK. Si A pasa → declarar T16 funcionalmente validada con deuda anotada, después agendar sprint para B. Si A falla → ir directo a B.

### Reglas técnicas nuevas

- **Bibliotecas npm que dicen "SDK AFIP" merecen leer su README antes de elegirlas.** `@afipsdk/afip.js` no es directo; varias librerías similares también usan proxies. Para conexión directa real verificar que la lib hable SOAP contra `wsaa.afip.gov.ar` / `servicios1.afip.gov.ar` desde tu server, no contra un endpoint del autor.
- **Cuando un enum vive en frontend Y como CHECK constraint en DB, agregar comentario inline en ambos lados apuntándose entre sí.** Ya hay precedente (`PaymentBreakdown` en `dashboard.types.ts`/`dashboard.actions.ts`). Mismo patrón ahora con `condicion_iva`. Reduce el costo de drift cuando alguien cambia un lado sin saber del otro.

### Aprendizaje institucional reforzado

Cuarta vez en 6 días que aplica el mismo patrón (12-mar QR pivote a Preferences, 27-abr QR EMVCo "registrado" sin probar, 1-may Alias deployado con security issue, 2-may parte 2 SDK "directo" sin validar el adjetivo). Hoy se confirma con T16: la implementación parece andar en el happy path (config se guarda, cert se carga, toggle en sandbox ámbar, todo verde) hasta que se hace la primera operación real y aparece el agujero. **Cualquier integración fiscal/cobro/externa se valida END-TO-END contra el sistema real antes de declarar done — incluso cuando "obviamente" debería andar porque elegimos el SDK oficial.**

### Estado del sprint ARCA al cierre del 3-may

| Tarea | Estado |
|-------|--------|
| T1, T5, T9, T10, T12, T14a, T14b, T15a | ✅ commiteadas |
| Fix condicion_iva CHECK | ✅ commiteada |
| Cert AFIP homologación generado + autorizado wsfe | ✅ |
| Cert + key cargados en app, config guardada en prod | ✅ |
| T16 smoke sandbox | 🚫 BLOQUEADA — 401 desde `app.afipsdk.com`. Decisión A vs B pendiente |
| T6, T7, T13, T15b, T15c, T16 cierre | ⏳ pending (algunos dependen de T16) |
| T11, T14c | 🅿️ parked |

## Fixes y Features (sesión 3 mayo 2026 — parte 2: T16-B CERRADA)

### Pivote del SDK + cierre del sprint

Sesión continuó la decisión OPCIÓN B del bloque previo. Se descartó OPCIÓN A (token gratis en `app.afipsdk.com`) porque el modelo de costos del SaaS ($199/mes por toda la cadena) no soporta una dependencia de un proveedor pago externo aunque sea gratis 14 días. Se migró a `@arcasdk/core` v0.3.6 — SOAP DIRECTO contra `wsaa.afip.gov.ar` / `servicios1.afip.gov.ar` (prod) y `wsaahomo.afip.gov.ar` / `wswhomo.afip.gov.ar` (homologación). Confirmado leyendo `enums.js` del package: cero llamadas HTTP a proxies.

Refactor contenido en la capa pura `lib/services/arca-cae.ts`. Contrato `RequestCAEParams` / `RequestCAEResult` preservado, los consumers (`arca.actions.ts`, `invoicing.actions.ts`) NO se tocaron. Borrado `types/afipsdk.d.ts`. `package.json` con `@arcasdk/core ^0.3.6` (`@afipsdk/afip.js` removido).

Constructor con `useHttpsAgent: true` (REQUERIDO en Vercel/Node — sin esto los WSDL legacy de AFIP rechazan handshake TLS) y `CondicionIVAReceptorId: 5` default (Consumidor Final, RG 5616/2024).

### Bugs descubiertos al smoke real (en orden)

**Bug 1 — toggle is_sandbox quedó en false.** Al smoke contra el deploy nuevo, WSAA producción rechazó con `cms.cert.untrusted: Certificado no emitido por AC de confianza`. Causa: el toggle UI se había movido inadvertidamente a producción en sesiones previas, y el cert cargado es de homologación (CA "Computadores Test"). Fix: `UPDATE arca_config SET is_sandbox = true` (vía toggle UI esta vez, después de verificar que el código de `setArcaSandboxModeAction` es seguro). Bug que motivó implementar Task #6 (ver más abajo).

**Bug 2 — `@arcasdk/core` filesystem default falla en Vercel serverless.** Después de bajar a sandbox, segundo error: `Failed to create tickets directory: ENOENT: no such file or directory, mkdir '/ROOT'`. Causa: el SDK por default resuelve `ticketPath` con `path.resolve(__dirname, "..", "..", "storage", "auth", "tickets")` donde `__dirname` en Vercel con turbopack se bundlea a `/ROOT/...` que es read-only. **Vercel solo permite escritura en `/tmp`** (efímero per-lambda-instance). Fix: pasar `ticketPath: '/tmp/arca-tickets'` al constructor `Arca({...})` en `lib/services/arca-cae.ts`. Una línea + comentario explicativo.

**Bug 3 colateral — `coe.alreadyAuthenticated` por TA huérfano.** Después del Bug 2, el SDK había llamado a WSAA y emitido un Ticket de Acceso, pero al fallar el `mkdir` el TA se perdió. WSAA retiene el TA hasta su expiración (~12hs típicas) y rechaza re-emitir con `coe.alreadyAuthenticated`. Workaround: esperar. En la práctica WSAA homologación liberó el TA en ~1hr, no fue necesario esperar 12hs. Solución correcta a futuro: storage adapter custom contra Supabase para que el TA persista entre cold starts (T16-B Task #8 parked).

### Validación end-to-end completa

| Item | Resultado |
|------|-----------|
| Smoke aislado (script `scripts/smoke-arca.mjs`) | ✅ CAE 86180058628627 vto 20260513 cbte 1 |
| Smoke real desde caja (post-fix /tmp) | ✅ Toast verde "Factura emitida — CAE 86180058628213 (N° 2)" |
| `arca_invoices` row | ✅ status=authorized, cae=86180058628213, vto=2026-05-13, cbte_numero=2, imp_total=$6 |
| Idempotencia T14a | ✅ SELECT por sale_id retorna row existente; código devuelve `{alreadyInvoiced: true, cae}` sin llamar AFIP |
| UNIQUE constraints en arca_invoices | ✅ `arca_invoices_sale_authorized_unique` + `arca_invoices_voucher_unique` aplicados |

### Task #6 — Guardrail de issuer del cert al activar producción

Implementado en `lib/actions/arca.actions.ts:setArcaSandboxModeAction`. Antes del UPDATE a `is_sandbox=false`, desencripta el cert y llama a `isCertHomologation(certPem)` (helper nuevo cerca del `decrypt`). Usa `X509Certificate` de `node:crypto` (sin agregar deps). Patrones de issuer detectados como homologación: `computadores test`, `ac afip test`, `wsaahomo`, `homo` (substring case-insensitive sobre el DN). Si match, devuelve error claro: "El certificado cargado es de homologación (testing). Para activar producción necesitás generar un nuevo certificado en el portal de AFIP en modo PRODUCCIÓN y subirlo en Ajustes." Errores de inspección (cert mal formado) NO bloquean — se logean y se deja que falle WSAA después con mensaje más claro.

### Reglas técnicas nuevas

- **`@arcasdk/core` requiere `ticketPath: '/tmp/arca-tickets'` en Vercel/serverless.** El default usa `__dirname` que en bundles serverless resuelve a paths read-only. `/tmp` es el único directorio escribible (efímero, 512MB, per-instance).
- **`coe.alreadyAuthenticated` de WSAA = TA emitido pero perdido.** Si el SDK llama a `LoginCms` exitosamente pero falla al persistir el TA, WSAA lo retiene hasta expiración (~12hs). No hay endpoint para "rescatarlo". Para evitarlo: garantizar que la persistencia del TA NO falle (storage adapter robusto, o `/tmp` en serverless).
- **Cert de homologación AFIP NO sirve contra WSAA producción** y devuelve `cms.cert.untrusted` con `LoginFault`. Issuer del cert de homologación: "Computadores Test" / "AC AFIP TEST". Validar issuer antes de activar producción es defensa barata contra el side-effect del toggle (regla institucional refuerza la del 2-may).
- **Cuando una integración serverless guarda estado en filesystem, asumir que falla.** El SDK arcasdk no documenta el requerimiento de configurar `ticketPath` para serverless — hay que leer el código fuente. Aplicable a cualquier SDK que use `__dirname` o `process.cwd()`.

### Decisiones del cierre

- **`scripts/smoke-arca.mjs` se commitea.** El script ya demostró su valor (cierre del bloqueo del 3-may parte 1) y deja capacidad de diagnóstico AFIP independiente del deploy. Para próximas sesiones que toquen ARCA, es la primera línea de defensa.
- **Task #8 — Storage adapter custom contra Supabase para persistir el TA cross-instance — parked.** El cache `/tmp` per-lambda-instance funciona para piloto single-tenant low-traffic. Cuando aparezcan errores recurrentes de `coe.alreadyAuthenticated` en producción real, levantar la prioridad.
- **Task #15b/c (PDF fiscal compliant + recovery CAE huérfano) — quedan pendientes.** T16 funcional cerrada habilita T13 (PDF fiscal con QR ARCA según https://www.afip.gob.ar/fe/qr/) como próximo sprint dedicado (~1 semana).

### Tabla del sprint ARCA actualizada

| Tarea | Estado |
|-------|--------|
| T1, T5, T9, T10, T12, T14a, T14b, T15a | ✅ commiteadas (sesiones previas) |
| Fix condicion_iva CHECK | ✅ commiteada |
| **T16 — Pivote SDK + smoke + validación end-to-end** | ✅ **CERRADA hoy** |
| **Task #6 — Guardrail issuer cert** | ✅ commiteada hoy |
| **Task #7 — Fix ticketPath /tmp** | ✅ commiteada hoy |
| T6 (tests guardrail QR offline), T7 (validación device real Ram) | ⏳ pending |
| T13 (PDF fiscal + QR ARCA), T15b, T15c | ⏳ próximo sprint dedicado |
| T11, T14c, **Task #8 (storage adapter Supabase)** | 🅿️ parked |

## Pendientes Prioritarios de Seguridad

Ver `AUDIT-FINDINGS.md` para la lista completa. Al 27-abr-2026 todos los pendientes críticos están cerrados. Los abiertos son no-accionables o de baja prioridad:
- Auth leaked password protection deshabilitado (requiere plan Pro de Supabase).
- Dos optimizaciones de performance frontend (queries no-críticas en dashboard, dynamic imports en VistaEmpleado).

## Pendientes Prioritarios de Producto

0. **Sprint ARCA T13 — PDF fiscal compliant con QR ARCA.** T16 cerrada el 3-may parte 2 (CAE real + arca_invoices.authorized + idempotencia validados end-to-end). Próximo sprint dedicado (~1 semana): generar PDF de factura con QR según especificación AFIP (https://www.afip.gob.ar/fe/qr/) que el cliente pueda escanear para validar contra ARCA. Hookeable después de `createInvoiceAction` exitoso. Considerar Task #8 (storage adapter custom contra Supabase para persistir TA cross-instance) si en piloto aparecen errores recurrentes de `coe.alreadyAuthenticated` por cold starts.
1. **Probar Posnet con el del negocio.** Próximo método de cobro en validación de campo. La implementación está cerrada (configuración + flujo de venta + reporting al dueño todo verde después de los fixes del 2-may). El test real es: configurar el Posnet del negocio en Ajustes → Métodos de cobro, hacer una venta de prueba en Caja seleccionando "Posnet", confirmar que aparece en el dashboard del dueño categorizada como Tarjeta y con label/emoji correctos.
2. **Probar QR fijo** después de cerrar Posnet. Mismo patrón: subir imagen del QR fijo de MP en Ajustes, hacer venta de prueba, validar reporting.
3. **Retomar Alias / Transferencia con flujo "dueño confirma".** Pausado el 2-may-2026 por riesgo de seguridad (mostraba datos bancarios al empleado) y por análisis de producto que mostró que alias-MP es redundante con QR EMVCo. Cuando se retome, el flujo debe ser: empleado selecciona Alias → dialog "esperando confirmación del dueño" sin datos bancarios → dueño confirma desde su app del banco/MP → realtime cierra el dialog del empleado → venta queda como `transfer_alias`. Implementación: 1 día de Realtime Supabase + UI de confirmación. Push notifications (web push + service worker + VAPID + persistencia de subscripciones por usuario) queda como v2 si se valida que mantener app abierta es molesto en el piloto.
4. **Webhook secret multi-tenant.** Antes de subir a multi-tenant: rotar el secret en panel MP + re-pegar con sanitize bulletproof. WebHook v1.0 hoy falla HMAC; el fallback Feed v2 single-tenant lo tapa.
5. **Bajar `SKIP_SIGNATURE_HARDCODE = true` a `false`** en `app/api/mercadopago/webhook/route.ts:268` cuando se haya re-pegado el webhook secret limpio. Hoy está en bypass por el bug del secret contaminado.
6. **Borrar `TEST_PROBE_DELETE_ME` del panel de MP** — store id `81655138`, creado por el probe del 27-abr-2026.

## Ventajas Competitivas

1. **Servicios virtuales con comisión integrada** — Único en Argentina
2. **Gamificación de empleados** — Único en el segmento a nivel mundial
3. **Cloud + PWA + Multi-sucursal** — La mayoría de competidores son Windows local

**Competidor principal:** Sistar Simple (sistar.com.ar) — cloud y multi-sucursal, pero sin servicios virtuales ni gamificación. Precio estimado $15k/mes por sucursal vs nuestros $199/mes por toda la cadena.

Análisis completo en `.skills/competitive-research/reports/`
