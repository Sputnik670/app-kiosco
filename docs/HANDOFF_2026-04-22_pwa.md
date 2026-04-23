# Handoff — Próxima sesión

> Generado al final de la sesión del 22 de abril de 2026.
> La sesión anterior cerró 4 bugs de auth + simplificó login + subió templates de mail. Esta próxima sesión arranca con smoke tests y después PWA/offline.

## Prompt para pegar en nueva sesión

```
Contexto: continúo desde una sesión del 22 de abril de 2026 donde cerramos 4 bugs de auth y simplificamos el login de KioscoApp. Sesión nueva para el próximo tramo de trabajo. No soy developer — vos sos mi tech leader.

El proyecto es App Kiosco: SaaS Next.js 16 + React 19 + Supabase para cadenas de kioscos argentinos. Está en C:\Users\Rram\Desktop\App-kiosco-main. Leé CLAUDE.md primero: tiene stack, convenciones técnicas, decisiones y estructura del repo. También hay un handoff en docs/HANDOFF_2026-04-22_pwa.md con el detalle completo de cómo quedó la sesión anterior.

ESTADO AL ARRANCAR:

- 4 bugs originales resueltos y pusheados a main. Últimos commits: 3a4a38a (auth PKCE/implicit + redirect a dashboard + UTF-8 en script), 3dc83ef (sacar Google OAuth y magic link del login), 9454c51 (tsconfig baseUrl deprecated).
- Plantillas de mail Supabase subidas con acentos españoles OK. Script en docs/email-templates/push-to-supabase.ps1.
- PAT de Supabase ya revocado.
- Producción: https://app-kiosco-chi.vercel.app (Vercel deploya auto en push a main).

DOS VALIDACIONES ASÍNCRONAS QUE YO ESTOY HACIENDO EN PARALELO (baja prioridad, si vengo y las menciono bien, si no asumilas como pendientes):
- Visual del HTML de un recovery mail.
- Install del PWA en mobile desde producción.

PLAN DE ESTA SESIÓN, EN ORDEN:

PASO 1 — Smoke tests baseline (30-60 min):

Razonamiento: tocamos mucho auth pero los flujos de negocio (venta, inventario, empleados, reportes, servicios) no los volvimos a validar hace semanas. Antes de cablear PWA encima, confirmamos que lo online funciona. Hay tests smoke en e2e/ — smoke-01 a smoke-04 activos y trackeados, más tres nuevos untracked (smoke-05-empleados.spec.ts, smoke-06-misiones.spec.ts, smoke-07-reportes.spec.ts).

Acción concreta:
1. Leer los 7 smoke tests. Entender qué cubre cada uno.
2. Preguntame: ¿contra producción o local dev server? (Estoy en Windows + PowerShell.)
3. Correrlos. Capturar failures.
4. Triage: ¿bug de test o bug de producto? Fix producto, decime si el test está mal. Si los tests fallan por cosas triviales que bloquean el MVP, pedime permiso para puntearlo.

PASO 2 — Cableado PWA (multi-sesión, empezar acá después del smoke):

Una sesión anterior shippeó ~4500 líneas de infraestructura PWA (ver lib/offline/* y components/pwa/*), pero NADA está cableado a la UI. Esa es la brecha. Decisión ya tomada: conflict resolution = Opción 1 (write queue simple). Si hay discrepancia de stock al sincronizar, flagear en el dashboard para revisión manual. NO implementar CRDT.

Fases del MVP:
2a. Cablear lib/offline/product-cache.ts al buscador de productos. Online popula IndexedDB, offline lee de IndexedDB.
2b. Cablear venta offline a ventas-pendientes (IndexedDB). Badge "N ventas pendientes de sincronizar".
2c. Listener online/offline en app/layout.tsx. Cuando navigator.onLine pasa a true, dispara syncManager.syncAll(). Toast con progreso.
2d. Dashboard de ventas pendientes para el dueño (lista + botón retry manual).

Cada fase es ½-1 día. Propone de a una, esperá mi OK antes de seguir.

DECISIONES YA TOMADAS, PARKED:

- Mercado Pago QR necesita repensar. El uso real en kiosco nocturno argentino es QR estático impreso pegado en la vidriera + POS Point de MP — NO QR dinámico acercado al cliente (peligroso). El dialog actual (mercadopago-qr-dialog.tsx) sólo cubre ~5% del caso real. Cuando volvamos a MP, hay que armar un módulo de conciliación automática (leer pagos entrantes via API MP, matchearlos con ventas por monto+horario). Task #9 lo documenta.
- ARCA / facturación electrónica: deprioritizada indefinidamente. Si un cliente paga lo pide, integramos con Facturalo Simple o Alegra.

PRINCIPIOS DE NUESTRA COLABORACIÓN (extraídos de CLAUDE.md):

- Yo reviso y apruebo antes de implementar. No se meten features sin mi OK.
- Si analizás y hay <3% de chance de error, procedé. Si no, corré dev server o preguntá.
- PowerShell en Windows. Sin && en git commands, espacio obligatorio en git commit -m.
- Trabajo desde dos compus. Al arrancar, usa el skill git-sync si es relevante.
- Respuestas directas, no muros de bullet points salvo que agreguen valor. Tech leader, no pleaser.

PRIMERA ACCIÓN: leer CLAUDE.md y el handoff (docs/HANDOFF_2026-04-22_pwa.md). Después leer los 7 smoke tests. Después proponeme: "Estos son los tests, esto cubre cada uno, ¿corremos contra prod o local?"
```

## Checklist mío pendiente (async)

- [ ] Mandarse un recovery real y confirmar que el HTML del mail se ve bien (tildes, ñ, colores del botón).
- [ ] Instalar el PWA desde mobile (Android preferentemente) y confirmar que aparece ícono en home + abre.

## Tasks abiertos al cierre

- #5 completed — Bug 4 templates (técnico). Visual check pendiente.
- #6 completed — caminos de invitación validados via Bugs 1-3.
- #9 pending — MP QR repensar como conciliación.
- #10 pending — smoke tests + triage.

## Commits de la sesión

```
9454c51 chore(tsconfig): remover baseUrl deprecado en TS 6
3dc83ef feat(auth): simplificar login - remover Google OAuth y magic link
3a4a38a fix(auth): recovery PKCE/implicit + redirect a dashboard + UTF-8 en push script
```

## Referencias técnicas clave

- **Supabase Project ID:** vrgexonzlrdptrplqpri (sa-east-1)
- **Vercel Team ID:** team_sPJMb8vptJoaoXAlJOwFDS7d
- **Producción:** https://app-kiosco-chi.vercel.app
- **PWA infra ya construida:** `lib/offline/` (indexed-db.ts 787 LOC, sync-manager.ts 393, product-cache.ts 275, turno-cache-service.ts 260) + `components/pwa/` + `public/sw.js` v4.2.0 + `public/manifest.json` + next-pwa configurado.
- **Lo que falta:** wiring de esa infra a la UI.
