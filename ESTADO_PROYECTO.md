# Estado del Proyecto — App Kiosco

> **Este es tu mapa. Cuando te sientas perdido, vení acá.**
> Última actualización: 30 de marzo de 2026

---

## Qué es esto

SaaS de gestión para cadenas de kioscos en Argentina. Cloud, mobile-first, con servicios virtuales integrados y gamificación de empleados. Único en el mercado.

**URL producción:** https://app-kiosco-chi.vercel.app
**Repo:** https://github.com/Sputnik670/app-kiosco.git
**Supabase:** proyecto `vrgexonzlrdptrplqpri` (sa-east-1)

---

## Módulos y su Estado

### FUNCIONANDO (listos para demo/piloto)

| Módulo | Qué hace | Archivos clave |
|--------|----------|----------------|
| **Punto de Venta** | Vender productos, scanner, métodos de pago | `caja-ventas.tsx` / `ventas.actions.ts` |
| **Inventario + Scanner** | Productos, stock, scanner barcode con auto-fill OpenFoodFacts + catálogo compartido | `crear-producto.tsx` / `product.actions.ts` |
| **Proveedores** | Alta con tipo producto/servicio, saldo, historial, soft-delete | `gestion-proveedores.tsx` / `provider.actions.ts` |
| **Dashboard Dueño** | Ventas del día, margen, tendencias, timeline | `dashboard-dueno.tsx` / `dashboard.actions.ts` |
| **Reportes** | PDF y Excel de ventas, stock, vencimientos | `reports/` / `reports.actions.ts` |
| **Empleados** | Invitar, roles, permisos por sucursal | `invitar-empleado.tsx` / `employee.actions.ts` |
| **Fichaje QR** | Control de asistencia con QR impreso | `generar-qr-fichaje.tsx` / `qr-fichaje-scanner.tsx` |
| **Misiones** | Misiones manuales + vencimientos + arqueo de cierre | `misiones-empleado.tsx` / `missions.actions.ts` |
| **Multi-sucursal** | Crear/gestionar sucursales, datos aislados | `gestion-sucursales.tsx` / `branch.actions.ts` |
| **Servicios Virtuales** | SUBE + recargas con comisión configurable | `widget-sube.tsx` / `service.actions.ts` |
| **Facturación interna** | Comprobantes internos (NO fiscal) | `facturacion/` / `invoicing.actions.ts` |

### IMPLEMENTADO — PENDIENTE TESTEO EN PRODUCCIÓN

| Módulo | Qué hace | Archivos clave | Estado |
|--------|----------|----------------|--------|
| **Sistema XP automático** | Apertura puntual (+20), cierre limpio (+30), tardanza (-25/-50), diferencia caja (-40), misiones incumplidas (-10) | `xp.actions.ts` | Backend + UI completos, compila OK |
| **Descargo de empleado** | Empleado justifica tardanza/error, dueño resuelve con tipo formal | `incidents.actions.ts` + `mis-incidentes.tsx` | Flujo completo implementado |
| **Ajuste manual XP** | Dueño da premio o sanción con mensaje obligatorio | `ajuste-manual-xp.tsx` + `xp.actions.ts` | UI integrada en dashboard |
| **Analytics de rendimiento** | Resumen diario/semanal/mensual por empleado | `xp-analytics.tsx` + `xp.actions.ts` | UI integrada en dashboard |
| **Configuración de rendimiento** | Dueño configura valores XP + horarios de sucursal | `configuracion-rendimiento.tsx` | UI integrada en dashboard |

### EN DESARROLLO

| Módulo | Estado | Qué falta |
|--------|--------|-----------|
| **Mercado Pago QR** | OAuth implementado, webhook activo | Testear flujo completo de pago en producción |
| **ARCA** | Configuración y servicio base | Completar flujo de facturación electrónica |

### PLANIFICADO (no arrancado)

| Módulo | Prioridad | Nota |
|--------|-----------|------|
| **Modo offline / PWA** | Alta | Docs de implementación listos en `.skills/pwa-implementation/` |

### DESCARTADO

| Módulo | Por qué | Fecha |
|--------|---------|-------|
| Actualización masiva de precios | Decisión de Ram | 17 marzo 2026 |
| Facturación fiscal AFIP | Se integrará con servicios existentes si hace falta | Marzo 2026 |
| Hardware propietario | No es nuestro modelo | Marzo 2026 |

---

## Auditorías y Cobertura de Código

### Módulos auditados y corregidos (de mayor a menor intervención)

| Módulo | Qué se hizo | Sesión |
|--------|-------------|--------|
| **Proveedores** | RLS soft-delete, tipo producto/servicio, función SECURITY DEFINER, UI completa | 29 mar |
| **Dashboard** | Fix margen hardcodeado, N+1 queries, dynamic imports, performance | 19 mar |
| **Scanner barcode** | Fix OpenFoodFacts (movido a server), catálogo compartido, mapeo de categorías | 25 mar |
| **Seguridad DB general** | Views SECURITY INVOKER, audit trigger memberships, pg_cron cleanup, search_path en funciones | 25-29 mar |
| **Auth/Registro** | Revisión completa del flujo: Auth + código + Vercel. Sin problemas críticos. | 29 mar |
| **Gamificación/XP** | Sistema completo: backend + DB + UI + integración con caja. Falta testear. | 29 mar |

### Módulos SIN auditar

| Módulo | Riesgo | Nota |
|--------|--------|------|
| **Fichaje QR** | Medio | Nunca se revisó end-to-end desde código |
| **Facturación interna** | Bajo | Lógica de comprobantes y permisos no revisados |
| **Vista Empleado** | Medio | Carga 9 componentes sin dynamic imports (performance) |
| **Mercado Pago QR** | Alto | En desarrollo, no testeado en producción |
| **Misiones (templates)** | Medio | La tabla mission_templates existe pero verificar si la generación automática al abrir caja funciona |

---

## Decisiones Importantes Tomadas

| Fecha | Decisión | Por qué |
|-------|----------|---------|
| Mar 17 | Descartar actualización masiva de precios | Decisión de Ram |
| Mar 19 | Fixes: margen, N+1, injection, branchId, touch targets | Auditoría de código, 7 fixes aplicados |
| Mar 19 | Docs comerciales creados | Guión demo, ventajas competitivas, legales (.docx) |
| Mar 25 | Scanner barcode: fix OpenFoodFacts (server-side) | Fetch desde browser fallaba silenciosamente |
| Mar 25 | Catálogo compartido `product_catalog` | Tabla Supabase compartida para auto-fill por barcode |
| Mar 29 | Fixes de seguridad DB | Views SECURITY INVOKER, audit trigger, pg_cron |
| Mar 29 | `supplier_type` en proveedores | Diferencia productos vs servicios. UI: selector + agrupación |
| Mar 29 | Fix RLS soft-delete proveedores | `deactivate_supplier()` SECURITY DEFINER |
| Mar 29 | Sistema XP/gamificación completo | Backend + DB + UI implementados. Pendiente testeo. |
| Mar 30 | Descargo obligatorio para empleados | El empleado DEBE escribir justificación antes de que el dueño pueda resolver |
| Mar 30 | Dueño puede dar/quitar XP manual | Para premiar o sancionar con mensaje y registro formal |
| Mar 2026 | Precio $199/mes por cadena completa | Competencia cobra $15k/mes por sucursal |
| Mar 2026 | Primer mes gratis | Reducir barrera de entrada |

---

## Pendientes Concretos (en orden de prioridad)

### Para el piloto
1. **Testear sistema de XP/gamificación** — configurar horarios de sucursal, probar apertura→misiones→cierre→incidents→descargo
2. Testear Mercado Pago QR en producción con pago real
3. Probar con el primer cliente real

### Para después del piloto
4. Modo offline / PWA con sync
5. Evaluar cuentas corrientes (fiado) si hay demanda
6. Evaluar integración con facturación fiscal si hay demanda

### Infraestructura
7. Comprar dominio propio
8. Email profesional (soporte@)
9. Definir nombre de marca

---

## Competidor Principal

**Sistar Simple** (sistar.com.ar) — Cloud, multi-sucursal. Tiene AFIP y fiado, no tiene servicios virtuales ni gamificación. Precio estimado $15k/mes por sucursal vs nuestros $199/mes por toda la cadena.

Análisis completo en: `.skills/competitive-research/reports/`

---

> Si algo de acá no está claro o no coincide con la realidad, decile a Claude que lo actualice.
