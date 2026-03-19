# Agente: Pre-Deploy

> **Cuándo:** ANTES de pushear a main (que dispara deploy automático a Vercel).
> **Objetivo:** Verificar que no rompemos producción ni dejamos vulnerabilidades.

## Checklist obligatorio

### 1. Compilación
```bash
node_modules/.bin/tsc --noEmit --skipLibCheck
```
Si hay errores de TypeScript, NO pushear. Corregir primero.

### 2. Tests unitarios
```bash
npm test
```
Si fallan tests, NO pushear. Investigar y corregir.

### 3. Revisión de seguridad rápida

Verificar en los archivos modificados:
- [ ] ¿Algún server action nuevo usa `verifyAuth()` o `verifyOwner()`?
- [ ] ¿Se agregaron queries con `.or()` o `.filter()`? → ¿Inputs sanitizados?
- [ ] ¿Se creó alguna tabla nueva? → ¿Tiene RLS activado con políticas?
- [ ] ¿Hay console.log con datos de usuario (email, userId)?
- [ ] ¿Se modificó algo en `app/api/`? → ¿Tiene validación de auth?

### 4. Revisión de performance

En los archivos modificados:
- [ ] ¿Se importan componentes pesados (jspdf, xlsx, recharts)? → ¿Usan dynamic import?
- [ ] ¿Hay queries dentro de loops? → Convertir a batch
- [ ] ¿Se agregaron componentes nuevos al dashboard? → ¿Lazy-loaded?

### 5. Archivos sensibles
- [ ] Verificar que `.env`, `.env.local`, `.env.test` NO están en el commit
- [ ] Verificar que no hay credenciales hardcodeadas en el código

### 6. Verificación final
```bash
git status
git diff --stat
```
Revisar que solo van los archivos que esperamos. Nada raro.

## Pendientes de seguridad conocidos

Estos están documentados en `AUDIT-FINDINGS.md` y deben resolverse cuando se pueda:
- RLS de `incidents`: separar políticas por operación (CRUD)
- RLS de `owner_notes`: restringir a owner
- `mercadopago_credentials`: restringir escritura a owner
- `service_sales` y `service_purchases`: agregar políticas DELETE/UPDATE false
- `SET search_path` en `expire_pending_mp_orders()` y `process_sale()`

## Qué hacer si algo falla
1. No pushear
2. Avisar al dueño qué falló y por qué
3. Proponer fix
4. Esperar aprobación antes de corregir

## Archivos de referencia
- `AUDIT-FINDINGS.md` — Lista completa de hallazgos pendientes
- `agents/conocimiento/CHECKLIST_PRE_DEPLOY.md` — Checklist detallado
- `agents/conocimiento/BUGS_CONOCIDOS.md` — Errores que pueden reaparecer
