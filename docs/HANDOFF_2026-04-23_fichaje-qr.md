# Handoff — Próxima sesión (23 abril 2026, tarde)

> Cerramos el pivot de fichaje QR por empleado (estaba estático por sucursal y era fotografiable). UI ya renderiza las tarjetas, falta validar el scan end-to-end y tapar un gap de atribución de ventas.

## Prompt para pegar en nueva sesión

```
Contexto: soy Ramiro, no soy developer, vos sos mi tech leader. Continúo desde una sesión del 23 de abril 2026 donde pivotamos el sistema de fichaje de KioscoApp.

Proyecto: App Kiosco — SaaS Next.js 16 + React 19 + Supabase para cadenas de kioscos argentinos. Repo en C:\Users\Rram\Desktop\App-kiosco-main. Lee CLAUDE.md primero (stack, convenciones, reglas técnicas) y docs/HANDOFF_2026-04-23_fichaje-qr.md (este archivo) para contexto completo.

QUÉ SE HIZO EN LA SESIÓN ANTERIOR (ya en disco, migración ya aplicada a Supabase):

Pivot de fichaje. Antes: QR estático por sucursal (branches.qr_entrada_url/qr_salida_url), empleado lo escaneaba con su celular. Problema: fotografiable → empleado ficha desde su casa. Después: cada empleado (membership) tiene qr_code UUID único, el kiosco tiene un scanner que lee la tarjeta del empleado y abre/cierra turno.

Cambios concretos:
- Migración Supabase: memberships.qr_code UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(). Ya aplicada (migration name: add_qr_code_to_memberships_for_employee_fichaje). Backfill corrió, las 5 filas existentes tienen QR.
- Server actions nuevas en lib/actions/attendance.actions.ts:
  - processEmployeeQRScanAction(qrCode, branchId): resuelve QR → membership same-org → abre o cierra turno → devuelve {action, employeeName, hoursWorked, minutesWorked}.
  - listEmployeeQRCardsAction(): lista empleados + QR (solo owner).
- Componentes nuevos:
  - components/tarjetas-qr-empleados.tsx — panel con grid de empleados, cada tarjeta tiene QR + botón descargar PNG, además CTA grande "Abrir scanner" y botón "Imprimir todas" (window nuevo con 1 tarjeta por hoja A4).
  - components/qr-empleado-scanner.tsx — scanner html5-qrcode que parsea UUID + llama action + muestra UI de resultado (verde entrada, azul salida con horas, rojo error).
- Dashboard del dueño (components/dashboard-dueno.tsx): pestaña Equipo ahora renderiza TarjetasQREmpleados en lugar de GenerarQRFichaje. Scanner montado a nivel dashboard.
- components/generar-qr-fichaje.tsx marcado @deprecated pero funcional (transición).

Estado git al cierre: Ramiro tenía pendiente limpiar .git/index.lock y hacer commit + push. Confirmale.

UI validada visualmente: Ramiro me pasó captura con las 3 tarjetas renderizando bien (entornomincyt + Maxi WA + PlanetaZ). El flujo del scan NO se probó end-to-end todavía.

LO QUE HAY QUE HACER EN ESTA SESIÓN, EN ORDEN:

PASO 1 — Validar el scan end-to-end (15-30 min):
Pregúntale a Ramiro si hizo el commit + push y si probó escanear una tarjeta. Si no, pedile:
1. Descargar la tarjeta de un empleado de prueba desde el panel.
2. Abrir scanner con el botón azul.
3. Escanear la tarjeta con la cámara del celular/webcam.
4. Confirmar: primera vez abre turno, segunda vez cierra + muestra horas trabajadas.
Si falla, triage: ¿el QR no parsea? ¿La action devuelve error? ¿RLS rechaza el lookup?

PASO 2 — Gap crítico: atribución de cashier_id en ventas (1-2 hs, P0):
Descubierto en sesión anterior. Cuando el kiosco está logueado como dueño y un empleado ficha entrada vía scan de tarjeta, el turno queda abierto para el empleado (user_id correcto en attendance). Pero cuando desde esa misma tablet (sesión del dueño) se hace una venta, cashier_id de sales = auth.uid() = el dueño, no el empleado que está de caja.

Dos opciones de fix:
(a) Cambiar sesión al fichar: más invasivo, requiere refactor de auth flow, fragil.
(b) Leer el turno activo de la sucursal para derivar cashier_id en process_sale: más pragmático. El RPC process_sale actualmente hace cashier_id = auth.uid(). Modificar para: SELECT user_id FROM attendance WHERE branch_id = X AND check_out IS NULL ORDER BY check_in DESC LIMIT 1. Si no hay turno abierto, fallback a auth.uid() + warning.

Mi recomendación antes de ir: (b). Pedile confirmación a Ramiro, ahí haces la migración SQL que modifica process_sale.

PASO 3 — Fixes pendientes del audit de plomería (si hay tiempo):
La sesión anterior hizo auditoría del flujo empleado→dueño. Hallazgos pendientes:
- P1 Cierre de caja: no hay RPC centralizado. Puede estar calculando diferencia en cliente. Auditar arqueo-caja.tsx y crear RPC close_shift si corresponde.
- P2 Misiones: no hay action completeMissionAction. El empleado no puede marcar misión cumplida → la gamificación está a medias. Crear action + smoke test del loop completo.

PASO 4 — Recién después de esto, gamificación + PWA:
Una vez que la plomería esté impoluta:
- Wiring de components/capital-badges.tsx en vista-empleado.tsx (componente existe pero nunca se importó).
- PWA Fase 2a: cablear lib/offline/product-cache.ts al buscador de productos. Ver docs/HANDOFF_2026-04-22_pwa.md para el plan PWA completo.

DECISIONES YA TOMADAS, PARKED:
- MP QR: repensar como conciliación automática (leer pagos MP via API, matchear con ventas por monto+horario), NO como QR dinámico. Task #9.
- ARCA / facturación electrónica: deprioritizada. Si cliente la pide, Facturalo Simple o Alegra.

PRINCIPIOS DE COLABORACIÓN:
- Ramiro revisa y aprueba antes de implementar. Si analizás y hay <3% de chance de error, procedé. Si no, pedí OK.
- PowerShell en Windows. Sin && en git, espacio obligatorio en git commit -m.
- Ramiro trabaja desde dos compus. Usá git-sync si es relevante al arrancar.
- Respuestas directas, no murallas de bullets salvo que agreguen valor. Tech leader, no pleaser.
- Issue conocido: sandbox Linux (bash mount) a veces ve archivos Windows viejos. Si hay errores de tsc extraños, pediles validar con npx tsc --noEmit desde PowerShell en la tablet de Ramiro antes de asumir que el código está roto.

REFERENCIAS TÉCNICAS:
- Supabase Project ID: vrgexonzlrdptrplqpri (sa-east-1)
- Vercel Team ID: team_sPJMb8vptJoaoXAlJOwFDS7d
- Producción: https://app-kiosco-chi.vercel.app
- Archivo de migración local: supabase/migrations/00009_employee_qr_fichaje.sql

PRIMERA ACCIÓN: saludá a Ramiro, preguntale si commiteó + pusheó los cambios de fichaje y si llegó a probar el scan. Después del status, proponele el PASO 2 (fix de cashier_id en process_sale) con las dos opciones (a)/(b) y tu recomendación.
```

## Tasks abiertos

- #10 pending — Smoke tests E2E de flujos de negocio (genérico, incluye lo de abajo)
- #9 pending — MP QR como conciliación (parked)
- #17 in_progress — Validar fichaje QR empleado end-to-end (descargar tarjeta + escanear + confirmar apertura/cierre)
- [nuevo] — Fix cashier_id en process_sale cuando el que scan-ea no es el que ficha
- [nuevo] — P1 del audit: RPC close_shift centralizado
- [nuevo] — P2 del audit: action completeMissionAction
- [nuevo] — Wiring capital-badges.tsx en vista-empleado.tsx

## Commits pendientes (Ramiro)

Al momento del handoff todo está en working copy, sin push. Pendiente:

```powershell
cd C:\Users\Rram\Desktop\App-kiosco-main
Remove-Item .git\index.lock -Force
npx tsc --noEmit
git add -A
git commit -m "feat(fichaje): tarjeta QR por empleado en lugar de QR por sucursal"
git push origin main
```

Mensaje de commit sugerido más largo:

```
feat(fichaje): tarjeta QR por empleado en lugar de QR por sucursal

Pivot de seguridad: el QR viejo era estático por sucursal y fotografiable.
Ahora cada empleado tiene qr_code UUID único en su membership; el kiosco
escanea la tarjeta desde su dispositivo para abrir o cerrar turno.

- migración 00009: memberships.qr_code UUID UNIQUE (backfill automático)
- processEmployeeQRScanAction + listEmployeeQRCardsAction en attendance.actions
- componentes tarjetas-qr-empleados.tsx + qr-empleado-scanner.tsx
- dashboard dueño: pestaña Equipo usa el nuevo flujo
- generar-qr-fichaje.tsx marcado @deprecated (transición)

Gap conocido: cashier_id de sales todavía viene de auth.uid(). Si la sesión
de la tablet es del dueño, las ventas del empleado fichado quedan atribuidas
al dueño. Se fixea en próxima sesión modificando process_sale para derivar
cashier_id del turno activo en la sucursal.
```

## Estado del proyecto al cierre

- Auditoría de plomería empleado→dueño: completada. Resultado 6.5/10 con 3 gaps (QR fichaje fraud — este pivot lo cierra, cierre de caja sin RPC, misiones sin action de completar).
- Fichaje QR por empleado: implementado, UI validada visualmente, scan pendiente validar.
- PWA: infra construida, UI sin cablear (4500 LOC en lib/offline + components/pwa). Plan completo en docs/HANDOFF_2026-04-22_pwa.md.
- Mercado Pago: parked como módulo de conciliación.
- ARCA: deprioritizado.

## Referencias

- `CLAUDE.md` — instrucciones del proyecto + stack + reglas técnicas
- `docs/HANDOFF_2026-04-22_pwa.md` — handoff previo con estado PWA + smoke tests
- `supabase/migrations/00009_employee_qr_fichaje.sql` — migración del pivot
- `AUDIT-FINDINGS.md` — pendientes de seguridad/performance generales del proyecto
