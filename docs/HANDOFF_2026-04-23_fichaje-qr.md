# Handoff — Próxima sesión (post 23 abril 2026, tarde)

> Refactor del fichaje QR: el scanner pasó del dashboard del dueño a la vista del empleado. Cada empleado escanea SU propia tarjeta desde SU interfaz. Server-side validamos ownership (membership.user_id === user.id). El dashboard del dueño quedó limpio — solo imprime tarjetas.

## Prompt para pegar en nueva sesión

```
Contexto: soy Ramiro, no soy developer, vos sos mi tech leader. Continúo desde una sesión del 23 de abril 2026 donde refinamos el modelo de fichaje por tarjeta QR.

Proyecto: App Kiosco — SaaS Next.js 16 + React 19 + Supabase para cadenas de kioscos argentinos. Repo en C:\Users\Rram\Desktop\App-kiosco-main. Lee CLAUDE.md primero (stack, convenciones, reglas técnicas) y docs/HANDOFF_2026-04-23_fichaje-qr.md (este archivo) para contexto completo.

MODELO ACTUAL DEL FICHAJE (ya implementado en disco, falta validar end-to-end):

- Cada empleado tiene una membership con qr_code UUID único (migración 00009 ya aplicada en Supabase).
- El dueño imprime las tarjetas desde Dashboard → Equipo → "Tarjetas QR de Fichaje" y las deja físicamente en el local (colgadas al costado de la caja, pegadas en la pared, como prefiera). La tarjeta NO se la lleva el empleado a la casa.
- El empleado tiene cuenta (email + password) y se loguea en su app como siempre. Aterriza en VistaEmpleado con la interfaz BLOQUEADA (candado gris) hasta que fiche.
- Dentro de VistaEmpleado, RelojControl muestra un botón grande "ESCANEAR QR ENTRADA" (o "ESCANEAR QR SALIDA" si ya fichó). El botón abre el modal QREmpleadoScanner (cámara).
- El empleado apunta la cámara a SU PROPIA tarjeta QR. Server-side processEmployeeQRScanAction valida:
  1. UUID válido + membership activa de la misma org.
  2. OWNERSHIP: membership.user_id === user.id del logueado. Si escanea la tarjeta de otro, rechaza con "Esta tarjeta no es tuya".
  3. Si no hay fichaje activo → abre turno. Si hay → cierra turno.
- showHoursOnExit={false} en la vista del empleado: al cerrar turno NO le mostramos las horas (decisión de producto — el empleado ya sabe cuánto trabajó, el dueño lo ve en sus reportes).
- El scanner YA NO vive en el dashboard del dueño. El dashboard solo imprime las tarjetas.
- El empleado NO pierde su cuenta: la gamificación (misiones, ranking, capital-badges) requiere que cada empleado tenga identidad propia.

QUÉ HAY QUE HACER EN ESTA SESIÓN, EN ORDEN:

PASO 1 — Smoke test end-to-end del fichaje (prioridad máxima, 15-30 min):

1. Preguntale a Ramiro si commiteó + pusheó los cambios (comandos al pie de este prompt). Si no, pedile que lo haga.

2. Flujo feliz en staging:
   a. Login como empleado (ej: Maxi WA).
   b. Entrar a VistaEmpleado. Verificar candado + mensaje "DEBES FICHAR TU ENTRADA".
   c. Tocar "ESCANEAR QR ENTRADA" → abre modal con cámara.
   d. Escanear la tarjeta de Maxi → "Entrada registrada" en verde.
   e. La UI se desbloquea: aparecen tabs Ventas/Misiones/Alertas.
   f. Hacer una venta de prueba → confirmar que cashier_id queda con user.id del empleado (no del dueño).
   g. Tocar "ESCANEAR QR SALIDA" → escanear la tarjeta de Maxi → "Turno finalizado" en azul. NO mostrar horas (showHoursOnExit=false).
   h. UI vuelve al estado bloqueado.

3. Caso anti-fraude:
   a. Login como Maxi.
   b. Intentar escanear la tarjeta de OTRO empleado (ej: entornomincyt).
   c. Debe rechazar con "Esta tarjeta no es tuya. Usá tu propia tarjeta para fichar."

Triage si falla:
- QR no parsea → regex UUID en qr-empleado-scanner.tsx (línea ~38).
- Action devuelve error genérico → log server-side temporal en processEmployeeQRScanAction.
- Ownership rechaza al propio dueño → validar que membership.user_id está bien poblado en DB.

PASO 2 — Fix cashier_id en process_sale (P0, 1-2 hs):

Contexto: si la tablet del local queda logueada con la cuenta del DUEÑO y un empleado vende sin loguearse con su cuenta, cashier_id queda atribuido al dueño. Con el modelo nuevo esto se mitiga (el empleado se loguea con su cuenta), pero queda como hueco si se usa la tablet del dueño.

Opciones de fix:
(a) Cambiar sesión al fichar — invasivo, refactor de auth flow, frágil.
(b) Modificar RPC process_sale para derivar cashier_id del turno activo en la sucursal: SELECT user_id FROM attendance WHERE branch_id = X AND check_out IS NULL ORDER BY check_in DESC LIMIT 1. Si no hay turno abierto, rechazar con "Abrí tu turno para vender" o fallback a auth.uid() + warning.

Recomendación: (b). Antes de tocar, pedile OK a Ramiro.

PASO 3 — Fixes del audit de plomería (si queda tiempo):
- P1: RPC close_shift centralizado. Hoy arqueo-caja.tsx calcula la caja esperada en cliente. Auditar y extraer a RPC para evitar divergencia cliente/servidor.
- P2: completeMissionAction. No existe. Crear action + UI para que el empleado marque misión cumplida + smoke test del loop de gamificación.

PASO 4 — Recién después de esto, gamificación + PWA:
- Wiring de components/capital-badges.tsx en vista-empleado.tsx (componente existe pero nunca se importó).
- PWA Fase 2a: cablear lib/offline/product-cache.ts al buscador de productos. Ver docs/HANDOFF_2026-04-22_pwa.md para el plan PWA completo.

DECISIONES YA TOMADAS, PARKED:
- MP QR: repensar como conciliación automática (leer pagos MP via API, matchear con ventas por monto+horario), NO como QR dinámico. Task #9.
- ARCA / facturación electrónica: deprioritizada. Si cliente la pide, Facturalo Simple o Alegra.
- Empleados CONSERVAN cuenta propia: se evaluó pasar a "empleado sin cuenta, solo tarjeta" pero se descartó porque la gamificación (misiones, ranking, capital) necesita identidad del empleado en la app. La tarjeta es su llave de fichaje, no su identidad.

PRINCIPIOS DE COLABORACIÓN:
- Ramiro revisa y aprueba antes de implementar. Si analizás y hay <3% de chance de error, procedé. Si no, pedí OK.
- PowerShell en Windows. Sin && en git, espacio obligatorio en git commit -m.
- Ramiro trabaja desde dos compus. Usá git-sync si es relevante al arrancar.
- Respuestas directas, sin murallas de bullets. Tech leader, no pleaser.
- Issue conocido: sandbox Linux (bash mount) a veces ve archivos Windows viejos. Si hay errores de tsc extraños, pediles validar con npx tsc --noEmit desde PowerShell en la tablet de Ramiro antes de asumir que el código está roto.

REFERENCIAS TÉCNICAS:
- Supabase Project ID: vrgexonzlrdptrplqpri (sa-east-1)
- Vercel Team ID: team_sPJMb8vptJoaoXAlJOwFDS7d
- Producción: https://app-kiosco-chi.vercel.app
- Archivo de migración local: supabase/migrations/00009_employee_qr_fichaje.sql

PRIMERA ACCIÓN: saludá a Ramiro, preguntale si commiteó + pusheó y si corrió el smoke test del PASO 1. Después del status:
- Si todo pasó: proponer PASO 2 (fix cashier_id) con opciones (a)/(b) y recomendación.
- Si algo falló: triage en vivo sobre el punto específico que falló.
```

## Qué cambió en la última iteración (23 abril, tarde)

Corrección arquitectónica: en la sesión de la mañana habíamos montado el scanner en el dashboard del dueño. Ramiro levantó la mano — "el que escanea debería ser el empleado, desde su propia app". Coincide con el modelo viejo (QR por sucursal en la entrada del local), solo que ahora la tarjeta es por empleado y tiene ownership enforced.

**Archivos modificados en esta iteración:**

- `lib/actions/attendance.actions.ts`
  - `processEmployeeQRScanAction` ahora extrae `user` de `verifyAuth()` y valida `membership.user_id === user.id`. Si no matchea: `"Esta tarjeta no es tuya. Usá tu propia tarjeta para fichar."`
- `components/vista-empleado.tsx`
  - Importa `QREmpleadoScanner` via `dynamic({ ssr: false })`.
  - Estado nuevo: `fichajeScannerOpen`.
  - `RelojControl` recibe `onScanQR={() => setFichajeScannerOpen(true)}` — eso hace que el botón cambie automáticamente a "ESCANEAR QR ENTRADA/SALIDA".
  - Scanner montado al final con `showHoursOnExit={false}` y `onResult` que refresca contexto si fue success.
- `components/tarjetas-qr-empleados.tsx`
  - Eliminado el CTA azul "Abrir scanner de fichaje" y la prop `onOpenScanner`.
  - Card header reescrita: ahora explica que el empleado ficha desde SU app.
  - Removido `ScanLine` del import (unused).
- `components/dashboard-dueno.tsx`
  - Removido el estado `fichajeScannerOpen`.
  - Removido el `dynamic(() => import("@/components/qr-empleado-scanner"))`.
  - `<TarjetasQREmpleados />` sin props.
  - Removido el bloque `{fichajeScannerOpen && <QREmpleadoScanner ... />}` al final del return.

**Archivos sin cambios en esta iteración (ya estaban bien):**

- `components/reloj-control.tsx` — ya soportaba `onScanQR`, solo había que pasárselo desde `VistaEmpleado`.
- `components/qr-empleado-scanner.tsx` — el scanner como tal estaba correcto; la action server-side fue la que recibió el fix.
- `supabase/migrations/00009_employee_qr_fichaje.sql` — sin cambios.

## Estado del flujo esperado (para validar en staging)

1. Empleado abre la app → login con email + password.
2. Aterriza en `VistaEmpleado`. Ve el candado "INTERFAZ BLOQUEADA — DEBES FICHAR TU ENTRADA".
3. Toca `ESCANEAR QR ENTRADA` → se abre modal con cámara (`QREmpleadoScanner`).
4. Apunta a su propia tarjeta → el server valida UUID + org + ownership → abre `attendance` row → modal muestra "Entrada registrada" en verde → se cierra.
5. `handleDataUpdated()` refresca el contexto → `isClockedIn=true` → UI se desbloquea → aparece caja + misiones + alertas.
6. Empleado opera normalmente. Toda venta queda con `cashier_id = user.id` del empleado (porque es su sesión).
7. Al final del día toca `ESCANEAR QR SALIDA` → escanea su tarjeta → server cierra el `attendance` con `check_out` → modal muestra "Turno finalizado" en azul SIN horas (showHoursOnExit=false) → se cierra.
8. UI vuelve a estar bloqueada con el candado.

Caso error: si el empleado escanea la tarjeta de un compañero → modal muestra "Esta tarjeta no es tuya. Usá tu propia tarjeta para fichar." en rojo.

## Tasks abiertos

- #9 pending — MP QR como conciliación (parked)
- #10 pending — Smoke tests E2E de flujos de negocio (genérico)
- [crear en próxima sesión] — Smoke test fichaje con ownership (PASO 1 del prompt)
- [crear en próxima sesión] — Fix cashier_id en process_sale (PASO 2)
- [crear en próxima sesión] — P1 del audit: RPC close_shift centralizado
- [crear en próxima sesión] — P2 del audit: action completeMissionAction
- [crear en próxima sesión] — Wiring capital-badges.tsx en vista-empleado.tsx

## Commits pendientes (Ramiro)

```powershell
cd C:\Users\Rram\Desktop\App-kiosco-main
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
npx tsc --noEmit
git add -A
git commit -m "refactor(fichaje): scanner QR en vista-empleado + ownership check"
git push origin main
```

Mensaje de commit largo sugerido:

```
refactor(fichaje): scanner QR en vista-empleado + ownership check

El scanner estaba montado en el dashboard del dueño, lo cual rompía
el modelo de roles: el dueño no debería fichar a nadie; cada empleado
ficha con su propia tarjeta desde SU interfaz.

Cambios:
- QREmpleadoScanner se monta en vista-empleado.tsx, conectado al
  botón de RelojControl vía la prop onScanQR (que ya existía).
- processEmployeeQRScanAction valida ownership: membership.user_id
  === user.id. Rechaza con mensaje claro si un empleado intenta
  escanear la tarjeta de otro.
- Dashboard del dueño queda limpio: solo imprime tarjetas, ya no
  ficha. TarjetasQREmpleados pierde el CTA "Abrir scanner".
- showHoursOnExit=false en la vista del empleado: al cerrar turno
  no mostramos horas trabajadas (las ve el dueño en reportes).

Gap conocido: si la tablet del local está logueada con la cuenta
del DUEÑO y un empleado vende sin loguearse, cashier_id queda mal
atribuido al dueño. Se fixea en próxima sesión modificando
process_sale para derivar cashier_id del turno activo en la
sucursal.
```

## Estado del proyecto al cierre

- Auditoría de plomería empleado→dueño: completada. Resultado 6.5/10 con 3 gaps (QR fichaje fraud — este pivot lo cierra, cierre de caja sin RPC, misiones sin action de completar).
- Fichaje QR por empleado: implementado + refactor arquitectónico + validación de ownership. Scan end-to-end pendiente validar en staging.
- PWA: infra construida, UI sin cablear (4500 LOC en lib/offline + components/pwa). Plan completo en docs/HANDOFF_2026-04-22_pwa.md.
- Mercado Pago: parked como módulo de conciliación.
- ARCA: deprioritizado.

## Verificación 23 abril (cierre de sesión)

Al retomar la sesión se revisaron los 4 archivos involucrados:

- `components/dashboard-dueno.tsx` — limpio, solo renderiza `<TarjetasQREmpleados />`. Sin scanner.
- `components/tarjetas-qr-empleados.tsx` — sin botón "Abrir scanner", sin import de QREmpleadoScanner. Se quitó un re-export huérfano de `ProcessEmployeeQRScanResult` que ya no consumía nadie.
- `components/vista-empleado.tsx` — `QREmpleadoScanner` montado vía `dynamic({ ssr: false })` + `fichajeScannerOpen` + `RelojControl` recibiendo `onScanQR`. Confirmado.
- `lib/actions/attendance.actions.ts` — ownership check (`membership.user_id !== user.id`) confirmado en las líneas ~467-473. Se reescribió el docstring de `processEmployeeQRScanAction` para reflejar el modelo correcto (el docstring previo decía "el kiosco bajo sesión del dueño lo escanea").

## Descartado en esta iteración

- **Modo kiosco dedicado `/kiosco/[branchId]`** — se había empezado a prototipar un scanner fullscreen montado en un device anclado al local. Abandonado: el modelo correcto es que cada empleado scanee desde SU celular con SU sesión. El archivo `components/kiosco-fichaje-screen.tsx` quedó como stub deprecated con explicación al inicio.

## Referencias

- `CLAUDE.md` — instrucciones del proyecto + stack + reglas técnicas
- `docs/HANDOFF_2026-04-22_pwa.md` — handoff previo con estado PWA + smoke tests
- `supabase/migrations/00009_employee_qr_fichaje.sql` — migración del pivot
- `AUDIT-FINDINGS.md` — pendientes de seguridad/performance generales del proyecto
