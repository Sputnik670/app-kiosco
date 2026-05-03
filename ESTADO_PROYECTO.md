# Estado del Proyecto — App Kiosco

> **Este es tu mapa. Cuando te sientas perdido, vení acá.**
> Última actualización: 24 de abril de 2026

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

### IMPLEMENTADO — FUNCIONANDO, FALTA TESTEO FINAL EN PRODUCCIÓN

| Módulo | Qué hace | Archivos clave | Estado |
|--------|----------|----------------|--------|
| **Sistema XP automático** | Apertura puntual (+20), cierre limpio (+30), tardanza (-25/-50), diferencia caja (-40), misiones incumplidas (-10) | `xp.actions.ts` | Backend + UI + RLS fix 21-abr |
| **Descargo de empleado** | Empleado justifica tardanza/error, dueño resuelve con tipo formal | `incidents.actions.ts` + `mis-incidentes.tsx` | Flujo completo + Realtime 20-abr |
| **Ajuste manual XP** | Dueño da premio o sanción con mensaje obligatorio | `ajuste-manual-xp.tsx` + `xp.actions.ts` | UI integrada en dashboard |
| **Analytics de rendimiento** | Resumen diario/semanal/mensual por empleado | `xp-analytics.tsx` + `xp.actions.ts` | UI integrada en dashboard |
| **Configuración de rendimiento** | Dueño configura valores XP + horarios de sucursal | `configuracion-rendimiento.tsx` | UI integrada en dashboard |
| **Realtime bidireccional** | Incidents y misiones se actualizan sin F5 para dueño y empleado | `gestion-incidentes.tsx`, `mis-incidentes.tsx`, `misiones-empleado.tsx` | Commits `bd3c0ab` + `bbd6e4b` |
| **Fichaje QR por empleado (v2)** | Tarjeta QR individual, canvas oculto, bypass del scanner viejo | `generar-qr-fichaje.tsx`, migración `00009` | Pivot 23-abr, funcionando |
| **PWA + Offline sync** | Manifest, SW de 31KB, IndexedDB, sync endpoints para ventas y asistencia | `/lib/offline/*`, `/public/sw.js`, `/api/ventas/sync`, `/api/asistencia/sync` | Instalable en iOS/Android |
| **Métodos de cobro ampliados (Posnet / QR fijo / Alias)** | Los 3 métodos típicos de kioscos 24h con reja. Migración `00010`, bucket `payment-assets`, UI de config + dialog de cobro manual | `lib/actions/payment-methods.actions.ts`, `components/configuracion-metodos-cobro.tsx`, `components/dialog-cobro-manual.tsx` | Commit pendiente (24-abr) |

### EN DESARROLLO

| Módulo | Estado | Qué falta |
|--------|--------|-----------|
| **Mercado Pago QR** | OAuth implementado, webhook activo | Testear flujo completo de pago en producción |
| **ARCA** | T1+T5+T9+T10+T12+T14a+T14b+T15a cerradas (2-may). Fix condicion_iva CHECK (3-may). Cert homologación generado + cargado en app. | **T16 BLOQUEADA**: SDK `@afipsdk/afip.js` no es directo a AFIP (usa proxy `app.afipsdk.com` pago). Decisión pendiente: A=access_token gratis (30 min, deuda) o B=migrar a `@arcasdk/core` (1-2 días, definitivo). Ver bloque "sesión 3 mayo 2026" en CLAUDE.md. |

### PLANIFICADO (no arrancado)

| Módulo | Prioridad | Nota |
|--------|-----------|------|
| **Publicación en App Store y Play Store** | Media | Ver sección "Viabilidad App Store / Play Store" más abajo. PWA base lista, falta wrapper + contenido legal. |
| **Modo offline — endurecer** | Media | Base ya funcionando con sync endpoints. Falta cobertura de conflictos y UI de "pendiente de sincronizar" en todas las pantallas. |

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
1. **Testear sistema de XP/gamificación end-to-end** — configurar horar