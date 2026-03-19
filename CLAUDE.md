# App Kiosco — Instrucciones del Proyecto

> Última actualización: 19 de marzo de 2026

## Qué es esto

SaaS de gestión para cadenas de kioscos en Argentina. El objetivo es convertir una app de prueba en un producto útil para una industria que se maneja con cuadernos y calculadoras.

**Posicionamiento:** "El sistema de gestión cloud para cadenas de kioscos que integra ventas, servicios virtuales y gestión de equipo en una sola app desde el celular."

**Para el estado completo del proyecto, módulos, pendientes y decisiones, ver `ESTADO_PROYECTO.md`.**

## El dueño del proyecto

- No es desarrollador. Claude actúa como tech-leader.
- Trabaja en **VSCode** con terminal **PowerShell** en Windows. Los comandos git deben ser compatibles con PowerShell (no usar `&&`, poner espacio en `git commit -m`).
- Trabaja desde **dos computadoras** (notebook y desktop). Usar skill `git-sync` al inicio de cada sesión.
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
- **Inventario** — `agregar-stock.tsx`, `crear-producto.tsx` / `inventory.actions.ts`, `product.actions.ts`
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
- **Mercado Pago QR** — `mercadopago.actions.ts`, `configuracion-mercadopago.tsx`, `mercadopago-qr-dialog.tsx`, `app/api/mercadopago/` (OAuth + webhook implementados, testing en prod pendiente)
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
│   ├── git-sync/            → Sincronización multi-PC
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

## Pendientes Prioritarios de Seguridad

Ver `AUDIT-FINDINGS.md` para la lista completa. Los más importantes:
- Fix RLS de `incidents` y `owner_notes` (políticas demasiado permisivas)
- Restringir `mercadopago_credentials` a owner
- Agregar `SET search_path` a 2 funciones SECURITY DEFINER

## Ventajas Competitivas

1. **Servicios virtuales con comisión integrada** — Único en Argentina
2. **Gamificación de empleados** — Único en el segmento a nivel mundial
3. **Cloud + PWA + Multi-sucursal** — La mayoría de competidores son Windows local

**Competidor principal:** Sistar Simple (sistar.com.ar) — cloud y multi-sucursal, pero sin servicios virtuales ni gamificación. Precio estimado $15k/mes por sucursal vs nuestros $199/mes por toda la cadena.

Análisis completo en `.skills/competitive-research/reports/`
