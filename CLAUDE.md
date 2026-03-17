# App Kiosco — Instrucciones del Proyecto

## Qué es esto

SaaS de gestión para cadenas de kioscos en Argentina. El objetivo es convertir una app de prueba en un producto útil para una industria que se maneja con cuadernos y calculadoras.

**Posicionamiento:** "El sistema de gestión cloud para cadenas de kioscos que integra ventas, servicios virtuales y gestión de equipo en una sola app desde el celular."

## El dueño del proyecto

- No es desarrollador. Claude actúa como tech-leader.
- Trabaja en **VSCode** con terminal **PowerShell** en Windows. Los comandos git deben ser compatibles con PowerShell (no usar `&&`, poner espacio en `git commit -m`).
- Revisa y aprueba antes de implementar. No se meten features sin su visto bueno.
- Ofrece onboarding personalizado a clientes ("te ayudo a cargar el stock y manejar la app").

## Stack Técnico

- **Frontend:** Next.js App Router + React 19 + TypeScript
- **UI:** shadcn/ui + Tailwind + lucide-react + sonner (toasts)
- **Backend:** Supabase (Auth PKCE + PostgreSQL + RLS)
- **Deploy:** Vercel (push a main = deploy automático)
- **Supabase Project ID:** `vrgexonzlrdptrplqpri` (región: sa-east-1)
- **Vercel Team ID:** `team_sPJMb8vptJoaoXAlJOwFDS7d`

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
- Mobile-first: el kiosquero usa celular.

## Módulos Existentes

### Core
- **Punto de Venta** — `caja-ventas.tsx` / `ventas.actions.ts`
- **Inventario** — `agregar-stock.tsx`, `crear-producto.tsx` / `inventory.actions.ts`, `product.actions.ts`
- **Proveedores** — `gestion-proveedores.tsx`, `control-saldo-proveedor.tsx` / `provider.actions.ts`
- **Dashboard Dueño** — `dashboard-dueno.tsx` / `dashboard/use-dashboard-data.ts`
- **Reportes** — `reports/` / `reports.actions.ts` + `pdf-generator.ts` + `excel-generator.ts`
- **Facturación** — `facturacion/` / `invoicing.actions.ts`

### Servicios Virtuales
- **SUBE** — `widget-sube.tsx`
- **Cargas Virtuales** — `widget-servicios.tsx`
- Server actions en `service.actions.ts`
- Tabla `service_sales` para tracking de ventas de servicios
- Comisión configurable por proveedor (`markup_type`: percentage/fixed, `markup_value`)

### Gestión de Equipo
- **Empleados** — `invitar-empleado.tsx`, `vista-empleado.tsx`
- **Fichaje QR** — `generar-qr-fichaje.tsx`, `qr-fichaje-scanner.tsx`, `reloj-control.tsx`
- **Gamificación** — `misiones-empleado.tsx`, `asignar-mision.tsx`, `team-ranking.tsx`, `capital-badges.tsx`
- **Happy Hour** — `happy-hour.tsx`

### Multi-sucursal
- `gestion-sucursales.tsx`, `seleccionar-sucursal.tsx`
- `branch.actions.ts`

### Nuevos (en desarrollo)
- **Mercado Pago QR** — `mercadopago.actions.ts`, `configuracion-mercadopago.tsx`, `mercadopago-qr-dialog.tsx`, `app/api/mercadopago/` (OAuth + webhook implementados)
- **ARCA** — `configuracion-arca.tsx` / `arca.actions.ts`, `arca.service.ts` (en desarrollo activo)

### Descartado / Suspendido
- **Actualización masiva de precios** — `actualizacion-masiva-precios.tsx` — DESCARTADO por Ram (2026-03-17). El componente existe en el código pero no se continúa desarrollando.

## Decisiones de Producto

### Roadmap Aprobado
1. **Integración Mercado Pago QR** — EN CURSO (OAuth implementado, webhook activo)
2. **ARCA** — EN CURSO (en desarrollo activo)
3. **Modo offline / PWA con sync** — PLANIFICAR

### Pospuesto (cubierto por onboarding personalizado)
- Catálogo precargado de productos
- Cuentas corrientes de clientes (fiado)

### Descartado por ahora
- **Facturación electrónica AFIP/ARCA** — La app es herramienta de gestión y visibilidad, no de facturación fiscal. Si se necesita, se integrará con servicios existentes (Facturalo Simple, Alegra), no se construye desde cero.
- Hardware propietario (impresoras fiscales)
- ERP contable completo
- Integración con balanzas

## Ventajas Competitivas (lo que nadie más tiene)

1. **Servicios virtuales con comisión integrada** — Ningún competidor argentino integra SUBE/recargas con gestión de stock.
2. **Gamificación de empleados** — Misiones, ranking, badges. Único en el segmento a nivel mundial.
3. **Cloud + PWA + Multi-sucursal** — La mayoría de competidores son Windows local.

## Competidor más cercano

**Sistar Simple** (sistar.com.ar) — También cloud, también multi-sucursal, también argentino. Pero no tiene servicios virtuales ni gamificación. Nos gana en facturación AFIP y cuentas corrientes.

Análisis completo en: `.skills/competitive-research/reports/`

## Skills / Agentes

- `.skills/competitive-research/` — Agente de investigación competitiva. Produce reportes de análisis, no toca código.

**Cada agente responde a una característica concreta del proyecto, hay de arquitectura, ventas, desarrollo, seguridad, corrección, etc.
Usarlos de manera congruente que cada uno haga su tarea, y genere actualización y mejora permanente haciendo que su sinergia haga mas facil las mejoras y modificaciones.
