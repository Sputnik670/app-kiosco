# Auditoría de Seguridad y Performance — Marzo 2026

## SEGURIDAD DE BASE DE DATOS

### Estado general: BUENO
- 27 tablas, TODAS con RLS activado
- 0 tablas con RLS activado sin políticas (no hay tablas "bloqueadas")
- Todas las funciones SECURITY DEFINER tienen `SET search_path TO 'public'` (excepto 2, ver abajo)

### Hallazgos de seguridad

#### CRÍTICO: 2 tablas con políticas demasiado permisivas

1. **`incidents`** — Política `incidents_org_policy` usa `FOR ALL` con rol `public`
   - Problema: Cualquier usuario autenticado de la org puede crear, editar y eliminar incidentes de otros
   - Fix: Separar en SELECT/INSERT/UPDATE/DELETE con restricciones:
     - INSERT: solo dueño (`is_owner()`)
     - UPDATE: empleado solo su justificación, dueño puede resolver
     - DELETE: solo dueño
     - SELECT: toda la org

2. **`owner_notes`** — Política `owner_notes_org_access` usa `FOR ALL` con rol `public`
   - Problema: Un empleado de la org podría leer/modificar/eliminar las notas del dueño
   - Fix: Agregar `AND is_owner()` para INSERT/UPDATE/DELETE

#### MEDIO: Funciones SECURITY DEFINER sin search_path

1. **`expire_pending_mp_orders()`** — Falta `SET search_path`
2. **`process_sale()`** — Falta `SET search_path`
   - Riesgo: search_path poisoning teórico (bajo riesgo práctico en Supabase)
   - Fix: Agregar `SET search_path TO 'public'` a ambas

#### MEDIO: Tablas sensibles sin restricción de escritura por rol

1. **`mercadopago_credentials`** — Cualquier miembro puede INSERT/UPDATE/DELETE credenciales
   - Fix: Restringir INSERT/UPDATE/DELETE a `is_owner()`

2. **`service_sales`** — Sin políticas de UPDATE ni DELETE
   - Actualmente solo tiene INSERT y SELECT, lo cual está bien para inmutabilidad
   - Pero no hay política explícita bloqueando DELETE/UPDATE (un cliente malicioso podría intentar)
   - Fix: Agregar políticas `DELETE false` y `UPDATE false`

3. **`service_purchases`** — Falta política de UPDATE
   - Fix: Agregar `UPDATE false` o restringir a owner

#### BAJO: Observaciones menores

- `arca_config` y `arca_invoices` usan rol `public` en vez de `authenticated` (funciona, pero `authenticated` es más explícito)
- `memberships` no permite DELETE (correcto, protege integridad), pero no hay forma de desactivar desde RLS (se hace via `is_active = false` en UPDATE)

---

## PERFORMANCE FRONTEND

### Hallazgos críticos

1. **Dashboard carga 8+ queries simultáneas al abrir**
   - `useDashboardData` dispara ventas, productos, servicios, turnos, asistencias, etc. todo junto
   - Fix: Diferir queries no-críticas (asistencias, turnos) a lazy load cuando se abre el tab "equipo"

2. **Reports/PDF/Excel no usan dynamic import a nivel componente**
   - jspdf (~200KB), xlsx (~1.2MB) se bundlean aunque el usuario no vaya a generar reportes
   - Fix: `next/dynamic(() => import('@/components/reports'), { ssr: false })`

3. **Recharts importado siempre en TabSales**
   - ~50KB de librería que solo se usa en una pestaña
   - Fix: Dynamic import del chart component

### Hallazgos medios

4. **Todos los componentes de tabs se importan eagerly en dashboard-dueno**
   - 10+ componentes importados al top del archivo, solo 1 visible a la vez
   - Fix: `next/dynamic` para cada tab content

5. **VistaEmpleado carga 9 componentes aunque el empleado no haya fichado**
   - CajaVentas, WidgetServicios, WidgetSube, etc. se importan incluso con interfaz bloqueada
   - Fix: Dynamic import condicional

6. **`formatMoney` se re-crea en cada render del dashboard**
   - Fix: useCallback o extraer fuera del componente

### Hallazgos bajos

7. Sin Next.js Image component (no hay imágenes actualmente, solo SVG/emoji)
8. PWA bien configurada, podría agregar preload de chunks críticos
9. Sin Web Vitals monitoring custom

---

## PLAN DE ACCIÓN PARA PRÓXIMA SESIÓN

### Prioridad 1 — Seguridad DB (hacer primero)
- [ ] Fix RLS de `incidents`: separar políticas por operación
- [ ] Fix RLS de `owner_notes`: restringir a owner
- [ ] Fix RLS de `mercadopago_credentials`: restringir escritura a owner
- [ ] Agregar DELETE/UPDATE false a `service_sales`
- [ ] Agregar `SET search_path` a `expire_pending_mp_orders` y `process_sale`

### Prioridad 2 — Performance (quick wins)
- [ ] Dynamic import de Reports, ConfiguracionMercadoPago, ConfiguracionArca
- [ ] Dynamic import de Recharts en TabSales
- [ ] Memoizar formatMoney con useCallback

### Prioridad 3 — Performance (medio plazo)
- [ ] Lazy-load todos los tab components con next/dynamic
- [ ] Diferir queries no-críticas en useDashboardData
- [ ] Dynamic imports en VistaEmpleado para componentes post-fichaje

### Completado (sesión 19 marzo 2026)
- [x] Políticas de uso para clientes → `docs/comercial/documentacion-legal.docx`
- [x] Precio definido: $199/mes por cadena, primer mes gratis
- [x] Legales (términos, privacidad, SLA) → `docs/comercial/documentacion-legal.docx`
- [x] Filter injection en ventas.actions.ts → sanitizado `.replace(/[,()]/g, '')`
- [x] BranchId validation en reports.actions.ts → `validateBranchOwnership()`
- [x] Console.log con datos de usuario en user.actions.ts → eliminados
- [x] Dashboard margen hardcodeado → lee unit_cost real de sale_items
- [x] N+1 queries en tab-historial.tsx → batch con .in() + Promise.all
- [x] Touch targets en tab-timeline.tsx → mínimo 36px
- [x] Código muerto de actualización masiva → 420 líneas eliminadas
