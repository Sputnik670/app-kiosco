# Reporte: Bug Fixes Pre-Piloto Controlado

> Fecha: 2026-03-02
> Estado: P0 + P1 + P2 COMPLETADOS
> Tests: 146/146 passing
> Build: OK (Next.js production build clean)

---

## Resumen Ejecutivo

Se corrigieron los 5 bugs TOP detectados por los agentes antes del piloto controlado.
Todos los cambios compilan sin errores y los 146 tests existentes siguen pasando.

---

## FIX 1: Margen hardcodeado al 60%

**Archivo:** `lib/actions/dashboard.actions.ts`
**Problema:** El costo estimado estaba fijo en 60% del bruto (`gross * 0.6`), lo cual no refleja la realidad de cada kiosco.
**Solución:**
- Se creó la constante `DEFAULT_COST_RATIO = 0.55` (55% costo, 45% margen bruto).
- La función `getOwnerStatsAction()` ahora acepta un parámetro opcional `costRatio` que permite configurar el ratio por cliente.
- Se agregó clamping (`Math.max(0, Math.min(1, costRatio))`) para evitar valores inválidos.
- Default ajustado de 60% a 55% (más representativo del margen típico de kiosco argentino).

**Impacto:** Los KPIs de utilidad neta y ROI ahora son configurables por organización.

---

## FIX 2: Nombre "Kiosco 24hs" hardcodeado en tickets

**Archivos:** `lib/generar-ticket.ts`, `components/dashboard-dueno.tsx`
**Problema:** El nombre "Kiosco 24hs" aparecía fijo en 3 lugares del PDF de ticket (encabezado, pie, ticket de venta), sin importar la sucursal real.
**Solución:**
- Se agregó campo opcional `sucursalNombre` a la interface `DatosReporte`.
- Los 3 textos hardcodeados ahora usan `datos.sucursalNombre || "Mi Kiosco"` como fallback.
- El ticket de venta (térmica 80mm) ya usaba `datos.organizacion` correctamente; se corrigió el footer que seguía con "Kiosco 24hs".
- En `dashboard-dueno.tsx`, se pasa `sucursalNombre` al generar el PDF de cierre de caja.

**Impacto:** Cada sucursal muestra su nombre real en tickets y reportes PDF.

---

## FIX 3: Dashboard del dueño de 9 tabs a 5 tabs

**Archivos:** `components/dashboard/dashboard-header.tsx`, `components/dashboard-dueno.tsx`, `components/dashboard/use-dashboard-state.ts`, `types/dashboard.types.ts`
**Problema:** El dashboard tenía 9 tabs (Caja y Ventas, Stock, Panel de Utilidades, Supervision 360, Reportes, Alta de Catalogo, Proveedores, Mi Equipo, Advertencias de Stock). Beto se perdía navegando.
**Solución:** Consolidado a 5 tabs siguiendo SPECIFICATIONS.md secciones 5:

| Tab nuevo | Tabs anteriores combinados | Contenido |
|-----------|---------------------------|-----------|
| **Ventas** | sales | Ventas del dia, desglose pagos, grafico |
| **Stock** | inventory + alerts + catalog | Listado productos, alertas stock bajo/vencimientos, alta de producto |
| **Proveedores** | suppliers | Gestion proveedores, saldos |
| **Control Empleados** | supervision + team | Turnos/caja, asistencia, ranking equipo, invitar, QR fichaje |
| **Analisis** | finance + reports | Metricas BI (utilidad, ROI, margen), reportes PDF/Excel |

- `DashboardTab` type actualizado: `"stock" | "ventas" | "proveedores" | "equipo" | "analisis"`
- Tab default cambiado a `"ventas"` (lo primero que Beto quiere ver).
- Filtro de fecha aplica a: ventas, equipo, analisis.

**Impacto:** UX simplificada. Beto encuentra todo en 5 taps maximo.

---

## FIX 4: Sin resumen consolidado de KPIs en landing

**Archivos:** `lib/actions/dashboard.actions.ts`, `app/page.tsx`, `types/dashboard.types.ts`
**Problema:** El dueño logueado llegaba a la pantalla de seleccion de sucursal sin ver ningun dato. No sabia si el dia iba bien o mal hasta elegir sucursal.
**Solución:**
- Se creo la server action `getQuickSnapshotAction(organizationId)` que consulta datos consolidados de TODAS las sucursales.
- Se creo el componente `QuickKPISnapshot` que muestra 3 cards:
  - **Ventas hoy**: monto total + cantidad de operaciones
  - **Operaciones**: cantidad de transacciones del dia
  - **Stock bajo**: cantidad de productos bajo minimo (con highlight rojo si > 0)
- Se integro en `app/page.tsx` encima de `SeleccionarSucursal` cuando el usuario es dueno.
- Type `QuickSnapshot` definido en `types/dashboard.types.ts` (no en server action, para evitar issues de import client/server).

**Impacto:** El dueño ve el pulso del negocio apenas entra, antes de elegir sucursal.

---

## FIX 5: Sin catalogo pre-cargado de productos

**Archivos nuevos:** `supabase/seeds/kiosco-productos-default.sql`, `lib/actions/seed-default-products.ts`
**Problema:** Un cliente nuevo empezaba con catalogo vacio. Cargar 100+ productos a mano toma horas.
**Solución:**
- Se creo `supabase/seeds/kiosco-productos-default.sql` con funcion `seed_default_products(org_id)` que inserta ~130 productos tipicos de kiosco argentino organizados por categoria:
  - Bebidas sin alcohol (18): Coca, Sprite, agua, energizantes, jugos
  - Bebidas alcoholicas (14): Cervezas (Quilmes, Brahma, Stella), Fernet Branca/1882, vino, vodka
  - Cigarrillos (10): Marlboro, Camel, Lucky Strike, Philip Morris, encendedores
  - Golosinas y alfajores (18): Havanna, Cachafaz, Jorgito, Guaymallen, chocolates, chicles
  - Snacks (10): Lays, Doritos, Cheetos, mani
  - Galletitas (8): Oreo, Toddy, Criollitas, Pepitos
  - Lacteos (8): Leche, yogur, queso crema, dulce de leche
  - Panaderia y fiambres (8): Pan, facturas, jamon, queso
  - Almacen (12): Yerba, azucar, aceite, fideos, mayonesa
  - Limpieza (8): Papel higienico, jabon, lavandina
  - Helados/Congelados (5): Frigor, hamburguesas, empanadas
  - Servicios (5): Recarga SUBE, Claro, Personal, Movistar, DirecTV
  - Varios (9): Pilas, hielo, carbon, preservativos
- Se creo `lib/actions/seed-default-products.ts` como wrapper TypeScript que:
  - Verifica autenticacion
  - Obtiene org_id automaticamente
  - Previene duplicados (no ejecuta si ya hay >10 productos)
  - Invoca la funcion SQL via RPC
- Todos los INSERT usan `ON CONFLICT DO NOTHING` para idempotencia.
- Precios orientativos en ARS (marzo 2026), el dueño los ajusta.

**Impacto:** Onboarding < 30 minutos. Cliente nuevo empieza con catalogo funcional desde el dia 1.

---

## Verificacion Final

| Check | Estado |
|-------|--------|
| `npm run build` | OK - Build clean |
| `npm run test` | OK - 146/146 tests passing |
| TypeScript (`tsc --noEmit`) | OK - Sin errores de tipo |
| Tests rotos por cambios | 0 - Ningun test existente afectado |
| Archivos nuevos | 2 (`seeds/kiosco-productos-default.sql`, `lib/actions/seed-default-products.ts`) |
| Archivos modificados | 7 |

### Archivos modificados:
1. `lib/actions/dashboard.actions.ts` - FIX 1 (margen) + FIX 4 (snapshot)
2. `lib/generar-ticket.ts` - FIX 2 (nombre ticket)
3. `components/dashboard-dueno.tsx` - FIX 2 (pasar nombre) + FIX 3 (tabs)
4. `components/dashboard/dashboard-header.tsx` - FIX 3 (5 tabs)
5. `components/dashboard/use-dashboard-state.ts` - FIX 3 (default tab)
6. `types/dashboard.types.ts` - FIX 3 (DashboardTab type) + FIX 4 (QuickSnapshot type)
7. `app/page.tsx` - FIX 4 (KPI snapshot en landing)

---

## Proximos pasos para piloto controlado

1. Aplicar migration `00003_invoicing.sql` + `00004_audit_logs.sql` si no estan en DB
2. Ejecutar `seed_default_products(org_id)` para el primer cliente piloto
3. Configurar `costRatio` si el cliente tiene margen distinto al default (55%)
4. Verificar que los tickets PDF muestren el nombre correcto de sucursal
5. Capacitar a Beto en los 5 tabs del dashboard
