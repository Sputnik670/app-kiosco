# Auditoría Externa — App Kiosco

> **Fecha:** 8 de mayo de 2026
> **Auditor:** Staff SWE / CTO / Product Auditor (sesión externa, sin contexto previo del equipo)
> **Encargo:** Evaluar el repo como si fuera due-diligence pre-inversión. Brutalmente honesto.
> **Veredicto rápido:** **No está listo para venderse a clientes reales todavía. Sí está listo para piloto controlado de 1 cliente. Para 5 clientes ya rompería en varios frentes.**

---

## 0. Resumen ejecutivo (TL;DR)

App Kiosco es un proyecto técnicamente más serio que la mayoría de los SaaS de su segmento (RLS bien hecho, server actions consistentes, PWA, integraciones reales con MP y AFIP), pero **está atravesado por deuda técnica grave, tres bombas de tiempo legales/comerciales, y un modelo operativo que no escala más allá de Bro sentado al lado del cliente**.

El producto resuelve un problema real (Sistar y similares cobran 75x más por menos), tiene diferenciadores genuinos (servicios virtuales + gamificación + cloud), y la arquitectura base es razonable. **El problema no es que esté mal hecho. El problema es que está hecho a la velocidad de un piloto y vendido como un SaaS multi-tenant. Esa brecha es la que rompe primero.**

Los **5 problemas que romperían YA si subís el segundo cliente:**

1. Los **términos legales** dicen "PlanetaZEGA", precio "USD $30/sucursal", email `soporte@planetazega.com`. Marca, precio y contacto incorrectos. **Riesgo legal y comercial inmediato.**
2. **Multi-tenant de Mercado Pago está roto.** El propio CLAUDE.md lo documenta: WebHook v1.0 falla HMAC, el fallback Feed v2 funciona porque busca "la única organización con credenciales activas". Con dos clientes, falla.
3. **`database.types.ts` está congelado en migración 00001.** Faltan 16 de 26 tablas. Eso explica los 73 `as any` y 54 `: any` repartidos por el código. La mitad del proyecto avanza sin chequeo de tipos real.
4. **`process_sale` tiene un bug de FIFO**: si vendés más unidades de las que tiene el batch más viejo, la venta falla entera en lugar de seguir descontando del siguiente batch. Sin `FOR UPDATE`, dos cajas concurrentes corren race condition.
5. **No hay sistema de billing.** El precio "$199/mes por cadena" existe en CLAUDE.md y en el doc comercial, pero **no hay nada en el código que cobre, suspenda, o haga gating del plan**. La columna `organizations.plan` es texto libre y nunca se valida.

Si arreglás esos 5 antes de cualquier cliente nuevo, tenés un MVP serio. Si los ignorás, el primer mes con 3 clientes te explota.

---

## 1. Arquitectura general

### Lo que está bien

El stack es razonable para el problema (Next.js App Router + Supabase + Vercel). La separación entre `app/`, `components/`, `lib/actions/`, `lib/services/`, `lib/repositories/`, `types/`, `supabase/migrations/` es la convención que un dev nuevo entendería en una hora. Los server actions tienen un patrón uniforme (`{ success, error?, ...data }`), `verifyAuth() / verifyOwner()` está centralizado y se usa consistentemente. Las migrations están versionadas con números secuenciales y tienen verificación final con `RAISE NOTICE`. RLS está en todas las tablas y las decisiones están documentadas en AUDIT-FINDINGS con fecha y commit (esto es mejor que el 90% de los SaaS argentinos que vi).

### Problemas serios

**Patrón Repository abandonado a medias.** `lib/repositories/README.md` describe un "Estándar Maestro" de capa de acceso a datos con respuesta `{ data, error }`, sin lógica de negocio. Existen 3 repos (`organization.repository.ts`, `producto.repository.ts`, `stock.repository.ts`). El resto del código va directo a `supabase.from(...)` desde server actions. **Esto es deuda arquitectónica formal**: o se completa el patrón o se borra la carpeta. Tener ambos confunde al próximo dev (humano o IA) y duplica conocimiento de schema.

**Acoplamiento alto entre server actions y schema directo.** No hay capa de abstracción real. Cuando agregás una columna o renombrás una tabla, tenés que cazar referencias en 25 archivos `lib/actions/*.ts`. Lo viste en concreto el 2-may con `PaymentBreakdown` (el bug de los 8 lugares mal categorizados): la misma lógica de "qué métodos de pago existen" vive en 8 archivos sin ningún punto único de verdad. La regla técnica que anotaste ("auditar todo el reporting cuando se amplía el enum") es un parche cultural — la solución estructural es centralizar el catálogo en una constante única importada en todos lados.

**Archivos monstruo.** `lib/actions/mercadopago.actions.ts` tiene **1.676 líneas**. `lib/actions/auth.actions.ts` tiene 1.096. `components/configuracion-arca.tsx` tiene 978. `components/configuracion-mercadopago.tsx` 842. `components/caja-ventas.tsx` 729. Esto no es necesariamente malo en sí (un POS puede ser complejo), pero es un signo de que **no se separan responsabilidades**. `mercadopago.actions.ts` hace OAuth + Stores + POS + crear orden + verificar firma + sanitización de secrets + parsear respuestas — eso son 5 archivos en una arquitectura limpia.

**Schema bilingüe.** El código vive en inglés (`organizations`, `branches`, `products`), pero hay restos visibles de un proyecto anterior en español (`productos`, `perfiles`, `nombre`). Lo más feo: `package.json` línea 26 hace `npx supabase gen types typescript --project-id cwuzcdzjkmgodgtkekbd > types/tipos-db.ts` — ese **NO es el project_id de producción** (es `vrgexonzlrdptrplqpri`). Si alguien (vos, otra sesión de Claude, un futuro dev) corre `npm run generate-types:cli`, sobreescribe los tipos con un schema de un proyecto distinto. **Bomba esperando.**

**`my-v0-project`.** El nombre del proyecto en `package.json` sigue siendo el template default de v0.dev. No es crítico pero es una señal: nadie revisó el manifiesto del paquete desde el día 1.

### Calificación arquitectura: **6/10**

---

## 2. Backend (server actions, secretos, webhooks)

### Lo que está bien

`verifyAuth()` y `verifyOwner()` están bien diseñados: nunca aceptan `organizationId` del cliente, todo se deriva de la sesión vía `get_my_org_id()` RPC. Eso es la regla de oro de multi-tenancy y la cumplen. La encriptación AES-256-GCM de credenciales MP en `mercadopago_credentials.access_token_encrypted` está bien implementada. El webhook de MP tiene verificación HMAC + control de timestamp anti-replay (5 min). El handler de webhook se reescribió bien después del bug del 27-abr (rutea por User-Agent + shape, sanitiza secrets contra bytes de control).

### Problemas serios

**`SKIP_SIGNATURE_HARDCODE` sigue en el código.** `app/api/mercadopago/webhook/route.ts:259`:
```ts
const SKIP_SIGNATURE_HARDCODE = false // ⚠️ subir a true sólo si volvés al estado de bypass
```
Está en `false` hoy (bien). Pero **dejar la palanca cableada en producción es una invitación a apretarla mal por accidente**. Cualquier sesión futura que vea este archivo puede cambiar `false → true` "para debugear" y quedar deployado. La forma correcta: borrar la rama del bypass y usar el control via env var (`MP_WEBHOOK_SKIP_SIGNATURE` ya existe y está hard-bloqueada en prod). Hoy tenés dos mecanismos de bypass: uno responsable y uno foot-gun.

**Pérdida silenciosa de eventos.** `route.ts:294-302`:
```ts
if (!webhookSecret) {
  logger.error(...)
  return jsonResponse({ error: 'Servidor no configurado' }, 200)
}
```
Si por cualquier razón se pierde el `webhook_secret` (lo que pasó el 27-abr con bytes de control), MP devuelve 200 OK y **el evento se pierde para siempre** — MP no reintenta porque cree que llegó. La regla técnica que anotaste lo reconoce. Esto debería retornar 503 o 500 para forzar reintento. Aceptaste el trade-off una vez ("dos ventas perdidas hoy"), pero si esto pasa con un cliente que no es vos, perdiste su plata sin enterarte.

**Multi-tenant MP roto y documentado como tal.** El propio CLAUDE.md dice: "WebHook v1.0 sigue fallando HMAC consistentemente. Para piloto single-tenant funciona porque el fallback Feed v2 lo cubre. Antes de habilitar multi-tenant: rotar secret en panel MP + re-pegar con sanitize bulletproof." **No tenés multi-tenant funcional hoy.** Si el segundo cliente paga por QR MP, el webhook va al primer cliente que tenga credenciales activas, o falla.

**No hay rate limit en el webhook de MP.** El middleware aplica `RATE_LIMITS.API` (60 req/min por IP) a todas las rutas `/api/*`, pero **el webhook está en `PUBLIC_API_ROUTES`** y no tiene su propio limit. Si MP tiene un bug y manda 1000 eventos/seg, o si alguien spamea POSTs falsos a la URL, vas a saturar el endpoint y eventualmente la DB. Mitigación parcial: la firma HMAC fuerza al atacante a tener el secret. Pero eventos válidos masivos (loop de MP) no están limitados.

**`rateLimitAction` existe pero no se usa.** `lib/rate-limit.ts` tiene una función `rateLimitAction` documentada para server actions ("Ventas: 30 ventas/min por usuario"). Cero archivos en `lib/actions/*.ts` la importan. **Tenés rate limiting solo en el borde, no en lógica de negocio.** Un usuario autenticado puede llamar `confirmSaleAction` 1000 veces/seg desde un script.

**Rate limiter en memoria.** `lib/rate-limit.ts:71` lo dice: "En memoria = no persiste entre cold starts. Cada instancia serverless tiene su propio contador." Vercel serverless con 5 instancias → cada una permite 60 req/min → en realidad permitís 300 req/min por IP. Para escalar de verdad migrá a Vercel KV o Upstash.

**`process_sale_from_webhook` ya está bien protegido**, pero su versionado en `00013_mp_cart_snapshot_plan_b.sql` ocurre **después** de que se aplicó el hotfix MCP. Hubo un gap de horas con la función `EXECUTE TO PUBLIC` y `authenticated`. **No hay log de auditoría de quién pudo haberla ejecutado en ese gap**. Si alguien creó sales fantasma en orgs ajenas durante ese tiempo, lo descubrís cuando un cliente llame.

**`MP_ENCRYPTION_KEY` es una sola env var.** Si se filtra (logs accidentales, env var leak, ex-dev malicioso, breach Vercel), TODOS los tokens MP de TODOS los kioscos quedan desencriptables. No hay envelope encryption (KEK + DEK), no hay rotación, no hay HSM ni KMS. Para 1 cliente es aceptable; para escala cualquier auditor de seguridad te lo levanta.

**32 `as any` en `invoicing.actions.ts`, 14 en webhook MP, 6 en `mercadopago.actions.ts`.** No es estilo, es **falta de tipos generados**. `database.types.ts` está congelado en el schema de la primera migración. Las tablas `invoices`, `invoice_sales`, `arca_config`, `arca_invoices`, `mercadopago_credentials`, `mercadopago_orders`, `payment_methods_config`, `product_catalog`, `incidents`, `owner_notes`, `service_sales`, `audit_logs`, `mission_templates`, `employee_qr` — todas las tablas modernas — **no están tipadas**. Por eso el código usa `'use server'` con `.from('invoices' as any)`. **El compilador no te protege en la mitad operativa del producto.**

**CSP laxa.** `vercel.json` define:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```
Esas dos directivas anulan la principal protección CSP contra XSS. En una app que muestra datos bancarios (alias, CBU del dueño en payment_methods_config), montos, datos de empleados, esto es serio. Next.js requiere `unsafe-inline` por defecto para algunos scripts de hidratación, pero `unsafe-eval` no debería estar.

### Calificación backend: **5/10**

---

## 3. Frontend

### Lo que está bien

Mobile-first deliberado (mínimo 360px), shadcn/ui dando consistencia visual sin esfuerzo. PWA configurada (manifest, service worker, runtime caching, offline.html). Lazy loading de Reports, MP, ARCA, recharts y tabs (post-fix performance). Toasts con sonner. Validación con react-hook-form + zod (en algunos forms). Touch targets mínimos 36px corregidos en tab-timeline.

### Problemas serios

**85 archivos `'use client'`.** Es razonable para una SPA, pero implica que **muchos componentes se renderizan en el cliente con datos que llegan vía server action**. La latencia inicial en redes 3G argentinas (que es la realidad del kiosquero promedio) va a doler. El dashboard del dueño, según AUDIT-FINDINGS, "carga ventas, productos, servicios, turnos y asistencias juntas al abrir" — eso es 5+ queries en serie antes de pintar nada útil. Lo tenés marcado como "prioridad baja", pero el primer click frío del cliente real va a ser su primera impresión.

**`VistaEmpleado` carga 9 componentes pesados sin dynamic imports.** Está marcado como pendiente. Para un empleado que solo ficha y opera caja, pagás bundle de WidgetSube + SUBE + Servicios + Misiones + Ranking + lo que sea, en cada cold start.

**Componentes monstruo en UI.** `configuracion-arca.tsx` 978 líneas, `configuracion-mercadopago.tsx` 842, `caja-ventas.tsx` 729. Hacer `Ctrl+F` en uno de esos archivos para arreglar un copy es un paseo. Refactor en piezas más chicas (form-arca, lista-sucursales-mp, dialogo-cobro) reduce el riesgo de que un cambio rompa otra parte.

**Accesibilidad: nadie la audita.** No hay tests de a11y, no veo `aria-*` consistente. Los kiosqueros laburan con celulares baratos, manos sucias, ruido — el target es **legibilidad y tamaño de toque**, no WCAG AAA. Pero si el ENACOM o algún programa de PyMEs te exige cumplimiento de accesibilidad para vender al estado, no estás listo.

**SEO no aplica a un POS, salvo la landing.** La home que hoy te muestra `app/page.tsx` (con `dashboardDueno + VistaEmpleado + AuthForm` mezclados) **no es una landing**, es la app misma post-login. Para vender, te falta una landing pública con SEO real, casos de éxito, demo, comparativa con Sistar. Eso no es deuda técnica, es deuda de go-to-market.

**Manejo de errores inconsistente.** Algunos sitios usan `toast.error`, otros silencian, otros loguean a `logger.error`, otros tiran `Error` para que el bound del componente lo capte. No hay error boundary centralizado para "algo falló, la app sigue viva, te avisamos a soporte". Para un cliente real que no es dev, "Error desconocido" es de zona de pánico.

**6 librerías de scanner.** En `package.json` veo: `@ericblade/quagga2`, `barcode-detector`, `html5-qrcode`, `react-zxing`, `web-wasm-barcode-reader`, `qrcode`, `qrcode.react`. Cinco scanners + dos generadores QR. El bundle paga por todas aunque uses una. Limpiar a 1 lector + 1 generador baja KBs y quita superficie de bugs.

### Calificación frontend: **6/10**

---

## 4. Base de datos

### Lo que está bien

**Esto es lo mejor del proyecto.** RLS en las 27 tablas, políticas separadas por operación (SELECT/INSERT/UPDATE/DELETE), funciones SECURITY DEFINER con `SET search_path TO 'public'` aplicado, audit triggers en memberships, pg_cron con cleanup diario de invites. El historial de hallazgos en AUDIT-FINDINGS muestra que **se auditaron y corrigieron incidents reales** (RLS soft-delete, GRANTs amplios para anon, search_path, vistas SECURITY INVOKER, REVOKE de RPC peligroso). Las 18 migraciones tienen estructura: BEGIN/COMMIT, idempotencia con `IF NOT EXISTS`, verificación al final.

44 foreign keys, 81 índices, 88 CHECK constraints. Esa relación FK/index/check es saludable.

`stock_batches` tiene `CHECK (quantity >= 0)` — eso es la red que evita que el bug de `process_sale` venda en negativo (te tira excepción y rollback). Buena defensa en profundidad.

### Problemas serios

**Bug de FIFO en `process_sale`.** En `00001_complete_schema.sql`, el LOOP por items hace:
```sql
UPDATE stock_batches
SET quantity = quantity - (v_item->>'quantity')::INTEGER
WHERE id = (
  SELECT id FROM stock_batches
  WHERE ... ORDER BY expiration_date NULLS LAST, created_at
  LIMIT 1
);
```
Esto **descuenta de UN solo batch — el más viejo**. Si querés vender 8 unidades y el batch más viejo tiene 5, el `CHECK (quantity >= 0)` rompe el UPDATE → la transacción falla → la venta entera se cae, **aunque tengas 12 unidades repartidas en 3 batches**. Es un bug operacional real. El kiosquero ve "Error al procesar venta" sin entender por qué (tiene stock, lo mira en pantalla). Solución: el LOOP tiene que ser por batches, no asumir que un batch alcanza.

**Sin `FOR UPDATE` en `process_sale`.** Dos cajeros venden el último item del batch a la vez, ambos leen `stock_available > 0`, ambos hacen UPDATE, uno falla por CHECK (gracias a la red de seguridad) y el otro vende. **No es overselling, pero es UX mala bajo concurrencia**, sobre todo en sucursales 24h con dos cajas abiertas.

**`unit_cost` registrado mal en FIFO.** El INSERT en `sale_items` toma `unit_cost = p.cost` (el costo actual del producto), no el costo del batch que se está descontando. Si un producto subió de costo entre batches viejos y nuevos, el margen registrado en el reporte es **el del costo nuevo siempre**, lo que infla el "margen real" cuando vendés stock viejo. Sutil pero real.

**`database.types.ts` está congelado en migración 00001.** Tablas que existen en producción y no están en types: `mission_templates`, `invoices`, `invoice_sales`, `audit_logs`, `mercadopago_credentials`, `mercadopago_orders`, `incidents`, `owner_notes`, `service_sales`, `employee_qr`, `payment_methods_config`, `product_catalog`, `arca_config`, `arca_invoices`. **14 tablas sin tipar = el TS no te avisa cuando hacés un typo en `.from()` o cuando un campo deja de existir.** El comando `npm run generate-types:cli` apunta al project_id equivocado, así que está roto silenciosamente.

**Migración `00010` versionada tarde.** El propio CLAUDE.md (sesión 27-abr) dice: "Migration 00010_payment_methods_expansion está aplicada en Supabase producción pero el archivo SQL no está en supabase/migrations/ — vive solo en la rama feature/metodos-cobro sin mergear." Y la sesión 2-may aclara que después se mergeó. **Pero eso significa que durante semanas, la DB de producción tenía un schema diferente al que el repo describía**. Si en ese gap alguien corre un migrate a entorno de staging desde el repo, le falta 00010 y rompe.

**Doble migración 00013.** Tenés `00013_branches_mp_external_pos_id.sql` Y `00013_mp_cart_snapshot_plan_b.sql`. Mismo número, dos archivos. Si tu sistema de migrations corre por orden alfabético, ok. Si corre por número, se pisan. Convención básica: cada migration tiene número único.

**Vista `v_products_with_stock` con `LEFT JOIN stock_batches` y `COALESCE(SUM(...) FILTER (...))`.** Cuando un producto tiene 1000 batches históricos, el SUM agregado por producto/branch puede pegar performance fuerte. El índice `idx_stock_fifo` está sobre `(product_id, branch_id, expiration_date)` pero la vista no usa el índice eficientemente porque agrupa todo. Para 100 productos × 50 batches por producto × 5 sucursales = 25.000 filas a sumar cada vez que abrís una caja. Hay que materializar la vista o cachearla a futuro.

**Sin backups verificados propios.** El doc legal promete "backup diario automático", Supabase free tier tiene backups básicos, pero **no hay job propio** que valide que los backups sean restaurables, no hay PITR (point-in-time recovery) en free, no hay export periódico a S3. Si Supabase te corta o te marca como abuso (le pasa a startups argentinas), perdiste todo. Para 1 cliente piloto OK, para 10 clientes pagando es negligencia.

### Calificación BD: **6.5/10**

---

## 5. DevOps / Infra

### Lo que está bien

CI con GitHub Actions corre `tsc --noEmit + vitest run + npm run build` en cada push. Vercel hace deploy automático en push a main. Vercel.json define security headers correctos (HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin). Cache headers diferenciados (immutable para JS/CSS, no-store para /api/*). Region `gru1` (São Paulo) razonable para Argentina. Concurrency group con `cancel-in-progress` previene gastar minutos en commits encadenados.

### Problemas serios

**Keep-alive workflow está roto.** `.github/workflows/keep-alive.yml` hace:
```bash
curl -X GET ".../rest/v1/productos?limit=1"
```
**La tabla se llama `products` (inglés), no `productos`.** La request pega 404 silencioso, el workflow marca success igual (curl no hace exit code != 0 por 404). Si Supabase free tier pausa el proyecto por inactividad (lo hace después de 7 días sin uso real), todos tus clientes ven la app caída un lunes a la mañana mientras vos pensás que el keep-alive está pegándole.

**Sin Sentry ni observabilidad.** `lib/logging.ts` tiene el placeholder de Sentry comentado. El comentario dice "Cuando se instale Sentry, descomentar". **Hoy no hay nada.** Si un cliente real tiene un error en producción a las 11 PM un sábado, te enterás cuando te llame el lunes (o nunca). Para vender, **observabilidad real es no negociable**. Sentry, Logtail, BetterStack, Honeycomb — algo. Y health checks externos (UptimeRobot).

**Vendor lock-in alto.** Supabase + Vercel + Mercado Pago + AFIP SDK. Cada uno te ata. Supabase puntualmente: si necesitás migrar a otro Postgres, vas a llorar con todas las funciones SECURITY DEFINER, RLS específico, pg_cron, vistas, tipos generados. **Eso no es necesariamente malo** (lock-in te permite ir rápido), pero el día que necesitás bajar costos o que Supabase te aumente precio, no es salida fácil.

**Costos no instrumentados.** Sin telemetría no sabés cuánto cuesta servir 1 cliente. Para piloto OK; para pricing real necesitás saber: GB de DB, MAUs Supabase, request count Vercel, builds CI, ancho de banda. Un cliente que mande 10.000 ventas/día puede costarte más de $199 ARS.

**`.env.local` con `SUPABASE_SERVICE_ROLE_KEY` en la PC de Bro.** No es vulnerabilidad por sí, pero es la clave nuclear que bypasea todo RLS. Si la PC se infecta, se roba, o se sube el `.env.local` por error a un repo público, **acceso total a la BD de todos los clientes**. Mitigación: rotar la service_role key cada 90 días, separar por entorno (staging vs prod), y mover service_role a Vercel env vars only — nadie la baja a su PC. Idealmente leerlo de un secret manager (Doppler, 1Password, Vercel encrypted env).

**Sin staging.** No veo proyecto Supabase de staging, no veo dominio staging.app-kiosco.vercel.app. Cada cambio probás contra prod. **Hoy no rompiste nada serio porque sos vos solo y revisás todo. El día que un dev jr toque, rompe.**

**Sin disaster recovery documentado.** ¿Qué hago si Supabase cae 4 horas? ¿Qué hago si Vercel cae? ¿Qué hago si MP cambia su API y rompe el webhook? No hay runbooks. Para 1 cliente "lo arreglo cuando pase". Para 10 es caos.

### Calificación devops: **5/10**

---

## 6. Producto y negocio

### Lo que está bien

Resuelve un problema **real, observable, no inventado**: kioscos argentinos manejan plata con cuaderno y calculadora, los SaaS competidores cobran $15.000/mes/sucursal o son Windows local. Tu posicionamiento ($199/mes por toda la cadena, cloud + mobile + servicios virtuales + gamificación) es genuinamente diferenciado. Sistar es viable competidor pero les falta servicios virtuales y gamificación. **El precio es agresivo en serio (75x más barato que Sistar)**, y el primer mes gratis baja la fricción.

La feature de Mercado Pago QR EMVCo interoperable (terminada 2-may después de 2 meses de combate) es una ventaja real: cualquier billetera de Argentina paga, no solo MP. Eso es competencia con bancos directamente.

La gamificación de empleados es el wedge que te diferencia. Nadie en el segmento ofrece ranking + misiones + capital badges. Es una buena hipótesis comercial.

### Problemas serios

**Términos legales con marca incorrecta.** `app/legal/terminos.md` y `privacidad.md` dicen "PlanetaZEGA", precio "USD $30/mes por sucursal", contacto `soporte@planetazega.com`. **No coincide con tu producto, tu pricing, ni tu email**. Riesgo: cliente lee, ve precio en USD, no se sabe a quién contactar, no consume → te pierdes la venta o (peor) acepta los términos pensando que paga otra cosa y te pelea por el precio cuando le facturás. **Es legal y comercial al mismo tiempo. Arreglar HOY.**

**Sin sistema de billing.** No hay Stripe, no hay MercadoPago Subscriptions, no hay nada. ¿Cómo cobrás los $199/mes? Manualmente. Por transferencia. **Eso no escala más allá de 10 clientes.** Y la columna `organizations.plan` (`'free' | 'basic' | 'premium' | 'enterprise'`) NO se usa en RLS ni en gating de features. Un cliente "free" puede usar todo. **Sin billing automatizado y sin gating, no es un SaaS, es un servicio gestionado disfrazado.**

**Onboarding manual.** Tu CLAUDE.md dice: "Ofrece onboarding personalizado a clientes ('te ayudo a cargar el stock y manejar la app')." Eso es **un valor en sí mismo** para tus primeros 10 clientes (te diferencia de Sistar que te tira el manual y chau). Pero **no escala**. A los 50 clientes sos un FTE de soporte. A los 200 necesitás tres personas. Y nada de eso está en el modelo de costos.

**Soporte técnico inexistente.** Los términos prometen "respuesta 24-48hs hábiles, lunes a viernes 9-18". ¿Quién responde? ¿Vos? ¿Vía qué canal? ¿Hay sistema de tickets? Si un kiosquero te llama un sábado a las 11 PM porque la caja no abre, **¿qué pasa?** No hay plan. El cliente puede vivir sin sistema un día, pero al tercero te cancela.

**Retención: no hay nada para evitar churn.** Sin emails de onboarding, sin métricas de uso del producto (¿cuántas ventas por día está cargando? ¿cuántos empleados usan misiones?), sin notificaciones cuando deja de usar la app, sin entrevistas de salida. El churn early-stage de SaaS argentinos es del 30-50% en 6 meses. No tenés cómo detectarlo ni cómo combatirlo.

**Inconsistencia de producto.** Empezaste con un alcance ("POS + inventario + dashboard"). Hoy hay: POS, inventario, scanner, proveedores, dashboard, reportes, facturación interna no fiscal, facturación fiscal AFIP, MP QR, Posnet MP, QR fijo MP, alias bancario (pausado), SUBE, recargas, empleados, fichaje QR, gamificación, misiones, XP, descargo de empleados, ajuste manual XP, analytics rendimiento, configuración rendimiento, multi-sucursal, PWA offline, sync de ventas y asistencia, audit logs, incidents, owner notes, badges, happy hour. **Eso son 25+ features para un MVP**. Cada una agrega superficie de bugs. Cada una tiene "implementado, pendiente validación end-to-end". **El producto está sobreextendido.**

**Foco difuso.** La regla institucional que vos mismo anotaste — "cuarta vez en 6 días que aparece la misma regla: deployás algo creyendo que anda hasta que un usuario real lo prueba" — es síntoma de **falta de QA estructural** y de **moverse demasiado rápido para validar**. Cada feature nueva agrega esa probabilidad. Si bajás el ritmo de features y dedicás 2 sesiones al mes a cerrar las "validaciones pendientes", lo arreglás.

**Riesgo regulatorio fiscal.** ARCA ya está code-complete pero pendiente validación end-to-end. CAEs en homologación, no en producción. Si arrancás a vender antes de validar el QR ARCA en una térmica real, y un cliente se la juega y emite facturas inválidas a Monotributo, **te pueden demandar**. Los términos tuyos dicen "no somos responsables", pero AFIP aplica al cliente y el cliente te aplica a vos.

**Alias / transferencia pausado por security issue.** Eso es una decisión correcta, pero indica que **diseñás features sin validar el flujo de seguridad antes**. Mostrar CBU del dueño al empleado nunca debería haber llegado al deploy. Pasar revisión "doctor + paciente" por roles es una práctica que falta.

### Calificación producto/negocio: **5/10** (fuerte en posicionamiento, débil en operación)

---

## 7. Código (calidad, deuda, testing)

### Lo que está bien

Código en general legible, comentarios útiles cuando la lógica es no obvia (especialmente en arca-cae.ts y webhook MP), uso disciplinado de async/await, server actions con shape consistente. La regla "NUNCA importar `@/lib/supabase` en server actions, usar `verifyAuth()`" está respetada.

### Problemas serios

**Tests son insuficientes.** Tenés 7 archivos de test unit (`auth-helpers, cash, inventory, mercadopago-webhook-signature, ventas, indexed-db, offline-flow, sync-manager`). **Cero tests para:** `arca, invoicing, dashboard, reports, missions, attendance, xp, branches, providers, services, payment-methods, notes, incidents, shift, stats, timeline, user, product`. Es decir: **el 75% de la lógica de negocio no tiene un solo test**. Tenés 8 e2e Playwright (smoke 01-04 activos), pero hacen click-test, no validan invariantes. **Cobertura real real estimo en <15%.**

**127 escapes de tipos.** 54 `: any` + 73 `as any`. Concentrados en invoicing (32) y webhook MP (14) por culpa de los tipos congelados, pero también en componentes (gestión-proveedores, gestión-incidentes, crear-producto, barcode-scanner). **El compilador TS no te ayuda donde más lo necesitás** (lógica fiscal y webhook).

**109 console.log/error en código de producción.** Sale por consola del navegador o de Vercel logs sin estructura. La mitad podría ser `logger.info/error` (que está implementado). Especialmente: `pwa-provider.tsx` (11), `qr-fichaje-scanner.tsx` (6), `qr-empleado-scanner.tsx` (5), `widget-servicios.tsx` (4). Si abrís devtools en producción ves log noise en lugar de un error tracker estructurado.

**29 TODO/FIXME en código.** Algunos triviales (descripciones de métodos), otros reales: "TODO: Implementar sistema de misiones en nuevo schema si es necesario" en `inventory.actions.ts:446`. **TODOs no resueltos en producción son deuda visible.**

**Componentes/server actions gigantes (ya mencionado).** `mercadopago.actions.ts` 1.676 líneas. Una función de 200 líneas en TS es compleja; un archivo de 1.676 con 15 funciones es un manual. Refactor en sub-archivos por concepto: `mercadopago-oauth.actions.ts`, `mercadopago-orders.actions.ts`, `mercadopago-stores-pos.actions.ts`, `mercadopago-credentials.ts`.

**Archivos zombies en root.** `create_rls_policy.js`, `execute_rls_fix.js`, `fix_rls_direct.js`, `EJECUTAR_AHORA.sql` (referencia project_id equivocado y tablas que no existen), `app/page.tsx.backup`, `nul` (archivo vacío de 0 bytes), `qa-auditor-eval-review.html` (304 KB), `README_RESEARCH.txt` (14 KB), `correct/`, `coverage/` viejo, `database/archive/` con 8 SQL scripts viejos, `.next_old/`. **Limpiar todo eso es una mañana.** Hoy contamina la búsqueda y mete project_ids viejos al alcance de cualquier `grep`.

**Plantilla `name: "my-v0-project"` sin renombrar.** Ya mencionado, simbólico.

**Auditoria-2026-04-24.md, AUDIT-FINDINGS.md, ESTADO_PROYECTO.md, CLAUDE.md, README.md, README_RESEARCH.txt, EJECUTAR_AHORA.sql, EJECUTAR_MIGRACIONES.md, FEATURE_MAPPING_E2E.md, QUICK_REFERENCE.md, RESEARCH_INDEX.md, SPECIFICATIONS.md, TEST_E2E_COMPLETO.md.** **13 archivos markdown en root** + uno en agents/ + carpetas docs/ + .skills/. La fragmentación de documentación es alta. Algunos están vacíos (69 bytes los que apuntan a removed). **Consolidar en CLAUDE.md + ESTADO_PROYECTO.md + AUDIT-FINDINGS.md + un README útil (no el de hoy que tiene 41 líneas).**

### Calificación código: **5/10**

---

## 8. Seguridad y cumplimiento

### Lo que está bien (de nuevo, lo mejor del proyecto)

**RLS riguroso**, separado por operación, con función SECURITY DEFINER cuando se necesita romper la regla, REVOKEs explícitos del flujo MP. Audit triggers en memberships. pg_cron para limpieza de invites. Encriptación AES-256-GCM de credenciales sensibles. HMAC anti-replay en webhook MP. Validación de ownership cruzada con `validateBranchOwnership` en reports. Sanitización de filter injection en `.or()` queries. Sin secretos hardcoded en el código.

### Problemas serios

**OWASP Top 10 — A01 Broken Access Control:** Riesgo bajo gracias a RLS. Punto débil: `process_sale_from_webhook` tuvo agujero de horas (ya cerrado pero sin auditoría).

**OWASP A02 Cryptographic Failures:** `MP_ENCRYPTION_KEY` única, sin rotación, sin envelope encryption. Tokens AFIP guardados en `arca_config` con la misma key (reuso de key cross-feature, decisión documentada el 2-may parte 2 con justificación, pero **es trade-off de seguridad real**: una sola filtración = todos los certificados AFIP comprometidos).

**OWASP A03 Injection:** Sanitización ad-hoc en `.or()` (`replace(/[,()]/g, '')`). Mejor que nada. No hay validación zod consistente en TODOS los inputs server-side. Algunos forms validan, otros pasan strings al servidor sin schema.

**OWASP A05 Security Misconfiguration:** CSP con `unsafe-eval` y `unsafe-inline`. CORS no se ve definido (Next.js por default). Headers ok.

**OWASP A07 Identification and Authentication Failures:** Leaked password protection deshabilitado (requiere Supabase Pro). Sin MFA. Sin política de contraseñas (largo mínimo, complejidad). El kiosquero pone "kiosko123" y se queda. Sin rate-limit por usuario en login (solo IP). Sin lockout tras N intentos.

**OWASP A09 Security Logging and Monitoring Failures:** **Crítico.** No hay alerting, no hay Sentry, los console.log no se exportan, los `logger.error` van solo a Vercel function logs. **Si alguien explota algo a las 3 AM, te enterás cuando lo descubrís manualmente.** Hay `audit_logs` table (00004) pero no se ve consumo activo.

**OWASP A10 SSRF:** El handler de OAuth de MP hace POST a `MP_TOKEN_URL`. Si esa URL viene de DB y se manipula, puede ser SSRF. No miré el código en detalle, vale la pena revisar.

**Datos personales y GDPR/Ley argentina 25.326:**
- El proyecto guarda emails de empleados, nombres, teléfonos (potencialmente), datos bancarios del dueño (CBU, alias en payment_methods), datos de venta (no PII del comprador en general — bien).
- Privacidad.md es de PlanetaZEGA, no aplica.
- No hay flujo de "borrar mi cuenta" ni "exportar mis datos" (derechos ARCO en Argentina, GDPR en Europa). Si vendés a Europa esto es litigation magnet.
- No hay registro en la AAIP (Agencia de Acceso a la Información Pública argentina) — obligatorio para responsables de bases de datos personales en Argentina. Para piloto pasa, para SaaS comercial es exigible.

**Manejo de pagos:**
- Vos no procesás tarjetas (correcto — eso te exige PCI-DSS).
- Pero guardás CBU/alias en `payment_methods_config` — eso es dato sensible bancario. RLS lo protege. **Encriptación at-rest de esa columna sería defensa en profundidad** (hoy está en plain text dentro de la fila).

**Riesgos legales:**
- Sin cumplimiento ARCO/Habeas Data → cliente puede demandar.
- Términos con marca equivocada → contrato inejecutable.
- "Backup diario" prometido pero no implementado realmente → incumplimiento contractual.

### Calificación seguridad: **5.5/10**

---

## 9. Escalabilidad real

### Hipótesis de carga

Asumo: 1 cadena = 1 organization, 3 sucursales promedio, 5 empleados/sucursal, 200 ventas/sucursal/día (kiosko mediano).

**100 clientes:** 300 sucursales, 1.500 empleados, 60.000 ventas/día = ~700 ventas/min en hora pico.

**1.000 clientes:** 3.000 sucursales, 15.000 empleados, 600.000 ventas/día = ~7.000 ventas/min en hora pico.

**10.000 clientes:** lo dejamos como ejercicio porque ya no llegás vivo a esto sin reescritura.

### Bottlenecks por nivel de carga

**1 cliente (hoy):** Todo OK. Vos sos el cuello.

**10 clientes:** `process_sale` empieza a tener race conditions visibles. Onboarding manual te come 100% del tiempo. Sin observabilidad real, errores empiezan a llegar tarde.

**100 clientes:** El rate-limit en memoria deja de proteger. Multi-tenant MP roto te explota. La vista `v_products_with_stock` con 1.000s de batches por org ralentiza el dashboard. El billing manual = full-time job. Soporte por email no escala. **Sin Sentry, ya no podés operar a ciegas.**

**1.000 clientes:** Supabase free tier muere. Necesitás plan paid (Pro o Team), proyecto separado por geografía o sharding. La keep-alive workflow está obsoleta. El bundle JS (5 librerías de scanner + recharts + jspdf) te penaliza performance en 3G. La tabla `sales` con 600M filas/año necesita particionamiento por mes/org. La tabla `audit_logs` explota.

**10.000+:** Reescribir o quebrar. RLS policy evaluation en queries complejas se vuelve ineficiente. Necesitás separar lectura/escritura, agregar read replicas, materialized views. Migrar el rate-limit a Redis. Probablemente migrar el processing pesado a workers async (BullMQ/Inngest). Tu único dev sigue siendo Bro + Claude, no llegás.

### Bottleneck principal hoy

**Onboarding manual y soporte humano.** No es técnico. Es operativo. **Hoy no sabés cuánto cuesta servir 1 cliente, así que no podés escalar vendiendo.**

### Calificación escalabilidad: **4/10** (técnica intermedia, operativa baja)

---

## 10. Evaluación final

### Scores

| Dimensión | Score |
|---|---|
| **Score general** | **5/10** |
| Score técnico | 5/10 |
| Score comercial | 5/10 |
| Score seguridad | 5.5/10 |
| Score mantenibilidad | 4.5/10 |
| Score arquitectura | 6/10 |
| Score base de datos | 6.5/10 |
| Score producto/negocio | 5/10 |
| Score testing | 3/10 |
| Score escalabilidad | 4/10 |

### ¿Listo para venderse a clientes reales?

**Para 1 piloto controlado con onboarding personalizado: SÍ**, con la condición de arreglar los términos legales y declararle al cliente que está en piloto.

**Para 5 clientes simultáneos: NO**, porque el multi-tenant MP no funciona y no tenés billing.

**Para 50 clientes: NO**, porque no tenés observabilidad, soporte estructurado, ni cobertura de tests.

### ¿Listo para producción?

Sí en el sentido técnico (deploya, anda, responde requests). No en el sentido operativo (sin runbooks, sin alertas, sin recovery).

### ¿Qué rompería primero?

En orden de probabilidad y consecuencia:

1. **Términos legales con marca PlanetaZEGA y precio en USD** — primer cliente que lea bien te pelea o se va. Daño: pérdida de venta o disputa legal.
2. **Multi-tenant MP** — segundo cliente con MP no recibe sus webhooks correctamente. Daño: pierde plata sin saberlo.
3. **Bug FIFO en `process_sale`** — kiosquero ve "Error" pese a tener stock. Daño: confusión, cancelación.
4. **Keep-alive Supabase roto** — proyecto Supabase pausa, app caída global. Daño: caída total un lunes a la mañana.
5. **`MP_ENCRYPTION_KEY` filtra** — todos los tokens MP comprometidos. Daño: catastrófico.
6. **Sin billing automatizado** — segundo mes, perdés tracking de quién pagó. Daño: pérdida de ingresos sin saber.
7. **Pérdida silenciosa de webhook MP por secret faltante** — venta cobrada, no registrada. Daño: confianza del cliente.

### Qué arreglar YA (esta semana)

1. Reescribir `app/legal/terminos.md` y `privacidad.md` con marca real, precio real, contacto real, fecha real. Validar con un abogado argentino para Ley 25.326.
2. Borrar archivos zombies: `EJECUTAR_AHORA.sql`, `app/page.tsx.backup`, `nul`, `create_rls_policy.js`, `execute_rls_fix.js`, `fix_rls_direct.js`, `correct/`, `.next_old/`, `coverage/` viejo, `qa-auditor-eval-review.html`, `README_RESEARCH.txt`. Reducir markdown roots a 4.
3. Arreglar `package.json:26` para que `generate-types:cli` apunte al project_id correcto (`vrgexonzlrdptrplqpri`), y CORRER `npm run generate-types` para regenerar `database.types.ts` completo. Eso elimina los 73 `as any`. **Eso vale por sí solo el día de trabajo.**
4. Arreglar `.github/workflows/keep-alive.yml`: cambiar `productos` por `products`. Y agregar verificación de status code != 200 → fail workflow.
5. Renombrar `name` en `package.json` de `my-v0-project` a `app-kiosco`.
6. Bajar el flag `SKIP_SIGNATURE_HARDCODE` y todo su código relacionado del webhook MP. Dejar solo el control vía env var bloqueado en prod.

### Roadmap priorizado

#### CRÍTICO (bloquea cualquier venta a 2do cliente)

1. **Términos legales correctos** con asesoría legal argentina. Coste: 1 día + abogado.
2. **Regenerar tipos DB con project_id correcto** y resolver los 73 `as any`. Coste: 1-2 días.
3. **Arreglar bug FIFO de `process_sale`** (LOOP por batches en lugar de descontar de uno solo). Coste: 1 día + tests.
4. **Cerrar multi-tenant MP**: rotar webhook secret, implementar resolución de credenciales por `collector_id` siempre (no por "única org activa"). Coste: 2-3 días.
5. **Agregar Sentry + UptimeRobot**. Coste: medio día.
6. **Validación end-to-end de T13 PDF fiscal y T16 ARCA en producción** (ya bloquea facturación real).
7. **Sistema de billing mínimo** (puede ser MercadoPago Subscriptions): organización suspende automáticamente si no paga al día 35. Coste: 5-7 días.
8. **Implementar gating del plan en RLS o helper**: una org "free" no puede crear más de N sucursales/empleados/productos. Coste: 2 días.

#### IMPORTANTE (escalar a 10-50 clientes)

9. **Refactor de archivos monstruo** (`mercadopago.actions.ts` → 4 archivos; `auth.actions.ts` → 3; `configuracion-arca/mp.tsx` → módulos). Coste: 3-5 días.
10. **Cobertura de tests al 50%** mínimo en server actions críticos: arca, invoicing, dashboard, reports, missions, attendance, xp, providers. Coste: 5-7 días.
11. **Eliminar 5 librerías de scanner duplicadas**, dejar 1. Coste: 1-2 días.
12. **Migrar rate-limit a Vercel KV o Upstash Redis**. Coste: 1 día.
13. **Aplicar `rateLimitAction` a server actions** críticos (ventas, login, sync). Coste: 1 día.
14. **Implementar staging environment** (proyecto Supabase staging + dominio Vercel staging). Coste: 2 días.
15. **Encriptar at-rest los datos sensibles bancarios** (`payment_methods_config.alias_value`, `cbu_cvu`). Coste: 1 día.
16. **Refactor a centralización del catálogo de payment methods** en una sola constante usada en todos lados (server actions, types, UI labels). Coste: 1 día.
17. **Health check externo** (UptimeRobot pingea `/api/health` cada 5 min, alerta a tu celular si falla). Coste: 30 min.
18. **Endurecer CSP**: quitar `unsafe-eval`. Reducir `unsafe-inline` a hashes específicos. Coste: 1-2 días.
19. **Backup propio diario a S3 o equivalente**, validado con restore mensual. Coste: 2 días.
20. **Onboarding semi-automatizado**: catálogo precargado de productos comunes argentinos, plantilla de sucursales típicas, video de 5 min explicando "cómo cargar tu primer producto". Coste: 3 días + producción de contenido.

#### OPCIONAL (escalar más allá de 100 clientes / madurez)

21. Migrar Repository pattern a todos los actions O borrarlo definitivamente del repo.
22. Materializar `v_products_with_stock` o cachear con triggers de stock.
23. Particionamiento de `sales` por mes.
24. Read replicas Supabase para reportes pesados.
25. Workers async (Inngest, BullMQ) para PDFs, sync masivo, etc.
26. Sentry + Datadog/Honeycomb para observability profunda.
27. Rotación automática de `MP_ENCRYPTION_KEY` con envelope encryption.
28. Auditoría externa de seguridad y registro AAIP.
29. Admin panel propio (hoy "panel de admin" = Bro escribiendo SQL en Supabase).
30. WCAG 2.1 AA básico.
31. Internacionalización (si vas a Uruguay, Chile, Paraguay).
32. App nativa real (wrapper PWA con Capacitor) para Play Store y App Store.

---

## Conclusión personal del auditor

Bro: el proyecto **no es amateur** — la auditoría de RLS está mejor que el promedio del segmento, las decisiones técnicas están documentadas con fechas y commits, y aprendiste de los bugs (las "reglas técnicas nuevas" en CLAUDE.md son la marca de alguien que toma notas serio). Pero **el ritmo de features está sobrepasando el ritmo de validación, y la diferencia entre "funcionalmente completo" y "production-validated" se está acumulando**. Esa frase la escribiste vos mismo el 3-may. Es la frase clave.

Mi recomendación dura: **detené features por 4 semanas**. Ese mes lo dedicás a:
- Limpiar deuda técnica (tipos, archivos zombies, refactor de monstruos).
- Validar end-to-end todo lo que está "code-complete" (T13, T15, T16, ARCA producción, Posnet, QR fijo).
- Cerrar legales, billing, observabilidad.
- Subir tests a 50%.

Y entonces, recién, agregás el segundo cliente.

Si en cambio seguís sumando features (modo offline endurecido, App Store wrapper, alias bancario v2), sumás también la deuda. Y a los 3 meses tenés un producto con 35 features, ninguna 100% validada, y el primer cliente real te lo dice antes que vos.

El producto tiene futuro genuino. **Pero hoy es una promesa, no un SaaS**.
