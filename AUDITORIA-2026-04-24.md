# Auditoría consolidada — 24 de abril de 2026

> Autor: Claude (tech-leader).
> Alcance: estado real del proyecto vs documentación, Supabase (RLS / advisors / cron), utilidad de los agentes y roadmap priorizado.
> Última auditoría previa: `reportes/orquestador-estado-completo.md` y `reportes/seguridad-auditoria.md` (20 de marzo).

---

## 1. Resumen ejecutivo

El producto está **bastante más maduro de lo que la documentación refleja**. Hubo 36 commits desde la última auditoría (26-mar → 24-abr) resolviendo bugs críticos y agregando Realtime, pero ni `AUDIT-FINDINGS.md`, ni `ESTADO_PROYECTO.md`, ni la base de conocimiento de `agents/` fueron actualizados. Resultado: el próximo agente que abra una sesión va a creer que hay hallazgos de seguridad sin resolver **que ya están arreglados hace semanas**.

En una frase: **código al día, documentación 1 mes atrasada**. Hay que cerrar ese desfase esta sesión.

---

## 2. Estado real de desarrollo (vs lo documentado)

### 2.1 Lo que avanzó y no está en los docs

| Feature / fix | Commit | Estado |
|---|---|---|
| Realtime bidireccional de incidentes (dueño ↔ empleado) | `bd3c0ab` | Funcionando en prod |
| Realtime de misiones + fix RLS silenciosa sobre XP | `bbd6e4b` | Funcionando |
| Persistencia de `activeTab` del dashboard en sessionStorage | `da2a321` | Funcionando |
| Desplegables en Control de Empleados + collapsible UI | `6617e11`, `4430616` | Funcionando |
| Auth simplificado (sin Google OAuth ni magic link) | `3dc83ef` | Funcionando |
| Plantillas de mail Supabase en castellano | `3fc2d94` | Funcionando |
| Pivot de fichaje QR (tarjeta por empleado, canvas oculto, bypass scanner viejo) | `e10c79d`…`70b69bb` | Funcionando |
| Soft-delete de proveedores vía RPC `deactivate_supplier` | `9575012` | Funcionando |
| Tipo producto/servicio en `suppliers` | `ec6c9d8` | Funcionando |

### 2.2 Módulos — estado real

- **Funcionando y estable:** Punto de venta, inventario + scanner, proveedores, dashboard, reportes, empleados, fichaje QR (pivot nuevo), gamificación, happy hour, multi-sucursal, Realtime de incidentes/misiones.
- **En desarrollo:** Mercado Pago QR (OAuth y webhook listos, falta testeo prod), ARCA.
- **Planificado:** PWA offline (docs en `.skills/pwa-implementation/`).
- **Descartado:** Actualización masiva de precios, facturación electrónica propia.

---

## 3. Supabase — hallazgos reales

### 3.1 RLS — ya no hay políticas permisivas

`AUDIT-FINDINGS.md` marca como CRÍTICO que `incidents` y `owner_notes` tienen una sola política `FOR ALL public`. **Eso ya se resolvió.** Estado real (consultado hoy a `pg_policies`):

- `incidents`: **7 políticas separadas** (select_owner, select_own, insert/update/delete todas `is_owner()` excepto `update_employee_justify` que limita al propio empleado y a estados abiertos/justificados).
- `owner_notes`: políticas separadas por operación, todas con `is_owner()`.
- `mercadopago_credentials`: INSERT/UPDATE/DELETE restringidos a `is_owner()`. **Única observación:** la política de SELECT deja que cualquier miembro de la org lea las credenciales. No es crítico porque los tokens sensibles viven del lado servidor, pero sería más higiénico restringir también el SELECT a owner.

### 3.2 Advisors (Supabase los midió hoy)

Dos **warnings**, ningún error:

1. `rls_policy_always_true` sobre `public.product_catalog` — la policy de INSERT deja que cualquier usuario autenticado escriba en el catálogo compartido con `WITH CHECK (true)`. Es **intencional** (es una tabla cross-org pensada para crowdsourcing), pero Supabase la flagea. Mitigación recomendada: agregar rate-limit server-side o marcar `contributed_by = auth.uid()` obligatorio vía `WITH CHECK (contributed_by = auth.uid())`.
2. `auth_leaked_password_protection` — deshabilitado. Requiere plan Pro de Supabase. No hacer nada.

### 3.3 pg_cron

1 solo job activo, correcto: `cleanup_expired_invites_daily` (03:00 UTC, diario). No hay jobs huérfanos.

### 3.4 Volumen actual (hoy)

incidents 6 · missions 15 · sales 7 · memberships 8 · organizations 5 · branches 7 · product_catalog 2 · mercadopago_credentials 0 · service_sales 10.

Números de entorno de prueba — está listo para piloto real.

---

## 4. Agentes — ¿sirvieron o fueron adorno?

### 4.1 Estructura actual

Cuatro agentes activos (SKILL.md de 1.5–4 KB cada uno, prácticos y accionables):

| Agente | Tamaño | Calidad del contenido | Problema |
|---|---|---|---|
| `inicio-sesion` | 1.4 KB | Sólido, con flujo claro | Cita `AUDIT-FINDINGS.md` que está desactualizado |
| `revision-codigo` | 2.1 KB | Reglas técnicas útiles y específicas | Ninguno — es el mejor |
| `pre-deploy` | 2.4 KB | Buen checklist | Lista como pendientes hallazgos **ya resueltos** (RLS incidents/owner_notes/MP, `process_sale`, `expire_pending_mp_orders`) |
| `comercial` | 3.6 KB | Pitch y precios bien sintetizados | Sin actualizar desde fijación de precios |

Además hay 17 carpetas `kiosco-*/` que **ya son stubs** (193 bytes cada una, solo redirigen a la nueva estructura). Bien.

### 4.2 Base de conocimiento (`conocimiento/`)

9 archivos, todos con fecha 15–25 de marzo. El más actualizado es `BUGS_CONOCIDOS.md` (25-mar). `HISTORIAL_DECISIONES.md` llega hasta la decisión #20 del 25-mar — **faltan al menos 6 decisiones posteriores** (simplificación del login, pivot de fichaje, Realtime, sessionStorage del tab, etc.).

### 4.3 Reportes (`reportes/`)

16 reportes entre febrero y marzo. Los dos más voluminosos (`orquestador-estado-completo.md` 11 KB, `seguridad-auditoria.md` 28 KB) tienen fecha 20-mar. Útiles como snapshot histórico pero hoy contienen información engañosa.

### 4.4 Veredicto sobre los agentes

- **Sí sirvieron**, pero a medias. La consolidación de 17→4 agentes fue la decisión correcta: los SKILL.md son herramientas de verdad, no teatro.
- **El fallo no es de diseño, es de mantenimiento.** No hay un paso definido de "al terminar la sesión, actualizar `HISTORIAL_DECISIONES.md` e `AUDIT-FINDINGS.md`". Por eso los docs se despegaron de la realidad.
- **`revision-codigo` es el que mejor envejeció** (reglas técnicas que no cambian mes a mes).
- **`pre-deploy` es el más peligroso hoy** porque lista pendientes resueltos como si fueran deuda viva. Un Claude nuevo leyendo ese SKILL.md puede duplicar trabajo o bloquear un deploy sin motivo.

---

## 5. Cosas sueltas que salieron de la auditoría

1. **76 archivos aparecen modificados en `git status` pero no hay cambios reales.** 14.030 inserciones = 14.030 eliminaciones exactas. Es noise de CRLF/LF entre las dos máquinas. `git diff --ignore-cr-at-eol --ignore-all-space --ignore-blank-lines` devuelve vacío. Se arregla con `.gitattributes` + `git config --global core.autocrlf true` en ambas PCs (ver acción 6.3).
2. **Duplicado para borrar:** `components/dashboard/collapsible-section.tsx` lo creé yo pensando que hacía falta, pero `dashboard-dueno.tsx` ya trae su propio `SeccionDesplegable` local. Eliminar el archivo y confirmar que `components/dashboard/index.ts` no lo exporta (ya está así).
3. **Realtime para incidentes estaba ya implementado** — se verificó en `gestion-incidentes.tsx` y `mis-incidentes.tsx`. La feature que se pidió "¿es posible?" ya está en prod.

---

## 6. Acciones inmediatas (en orden)

Ordenadas por retorno / riesgo. Todas requieren tu visto bueno antes de ejecutar.

### 6.1 Refrescar `AUDIT-FINDINGS.md` (alto impacto, bajo esfuerzo)

Marcar como RESUELTO:

- RLS separada por operación en `incidents`, `owner_notes`.
- `mercadopago_credentials` con INSERT/UPDATE/DELETE restringidos a owner.
- `SET search_path` en `expire_pending_mp_orders` y `process_sale` (verificar; la auditoría de 20-mar ya reporta "Todas las SECURITY DEFINER tienen search_path").

Agregar como NUEVO:

- Advisor `rls_policy_always_true` en `product_catalog` — decidir si hacer el hardening del `WITH CHECK` o aceptar el riesgo.
- `mercadopago_credentials.mp_creds_select` abierto a toda la org — restringir a owner (pequeño, vale la pena).

### 6.2 Actualizar la base de conocimiento de los agentes

- Agregar al `HISTORIAL_DECISIONES.md` las decisiones #21–#26 (simplificación del login, pivot de fichaje, Realtime incidentes + misiones, sessionStorage, desplegables del tab Equipo).
- Reescribir la sección "Pendientes de seguridad conocidos" de `pre-deploy/SKILL.md` con el estado real (ya no hay CRÍTICOS abiertos).
- Actualizar `ESTADO_PROYECTO.md`: fecha, marcar fichaje QR v2 como "funcionando", sumar Realtime como feature.

### 6.3 Cerrar el ruido de CRLF de una vez

Agregar `.gitattributes` con:

```
* text=auto eol=lf
*.bat text eol=crlf
*.ps1 text eol=crlf
```

Y en **ambas** PCs, una vez:

```powershell
git config --global core.autocrlf true
git rm --cached -r .
git reset --hard
```

Esto termina el drama del diff inflado al cambiar de máquina.

### 6.4 Limpieza pequeña

- Borrar `components/dashboard/collapsible-section.tsx` (duplicado).
- Si querés, muevo todas las carpetas `kiosco-*/` stub a `agents/archivo/` y dejo `agents/` sólo con los 4 activos + conocimiento + reportes. Dejarían de ensuciar el árbol.

### 6.5 Proceso para que esto no se repita

Agregar al SKILL de `pre-deploy` un paso final **"registrar decisiones"** que obligue a tocar `HISTORIAL_DECISIONES.md` antes de considerar el deploy cerrado. Tres líneas por sesión alcanzan.

---

## 7. Roadmap priorizado (mi recomendación como tech-leader)

1. **Cerrar Mercado Pago QR en producción** — es el mayor diferenciador operativo que te queda por activar. OAuth y webhook están, falta testeo real.
2. **ARCA** — depende de tu decisión comercial (¿lo vendés como "listo" o como "integración con Alegra/Facturalo Simple"?). Si no va a estar en semanas, conviene dejar de bloquear el pitch por esto.
3. **PWA / offline** — el argumento comercial #1 que no tenés todavía ("¿y sin internet?"). Los kioscos argentinos lo van a pedir. Docs ya preparadas en `.skills/pwa-implementation/`.
4. **Limpieza de documentación (6.1–6.2)** — 1 hora de trabajo, evita que el próximo Claude tome decisiones con info vieja.
5. **Hardening menor de Supabase (6.1)** — product_catalog WITH CHECK + mp_creds SELECT a owner.

Nada de esto es urgente en el sentido de "se cae el sistema". Pero el orden importa: la documentación atrasada es deuda que te cobra cuando menos tiempo tenés.

---

## Anexo — Comandos útiles para este fin de semana

```powershell
# Eliminar el duplicado
Remove-Item components\dashboard\collapsible-section.tsx

# Ver si quedó ruido de CRLF
git status
git diff --shortstat

# Aplicar las correcciones de docs (cuando las aprueben)
git add AUDIT-FINDINGS.md ESTADO_PROYECTO.md agents/
git commit -m "docs: actualizar estado post-auditoria 24-abr"
git push
```
