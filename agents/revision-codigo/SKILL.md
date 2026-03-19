# Agente: Revisión de Código

> **Cuándo:** ANTES de escribir o modificar código. Claude debe consultar esto internamente.
> **Objetivo:** Evitar errores conocidos y mantener la consistencia del código.

## Reglas que siempre aplican

### Server Actions
- Usar `verifyAuth()` o `verifyOwner()` de `@/lib/actions/auth-helpers`
- NUNCA importar `@/lib/supabase` (browser client) en server actions
- Retornar siempre `{ success: boolean, error?: string, ...data }`
- Si el action recibe un branchId, validar con `validateBranchOwnership()`
- No exponer datos de usuario en console.log

### Tipos de datos
- Columnas DECIMAL/NUMERIC de Supabase llegan como strings → castear con `Number()`
- Comparar decimales con `Math.abs(a - b) > 0.01`, nunca `!==`

### Queries
- Sanitizar inputs en `.or()` con `.replace(/[,()]/g, '')` para evitar filter injection
- Evitar N+1: si necesitás datos de N usuarios, usar `.in("user_id", userIds)` en vez de un loop
- Preferir `Promise.all()` para queries paralelas independientes

### UI / Componentes
- Siempre `"use client"` para componentes interactivos
- Mobile-first: mínimo 360px, touch targets ≥ 36px
- Colores: indigo/violet (comisiones), rojo (eliminación), esmeralda (dinero)
- Estados con useState, fetching con useCallback + useEffect

### Seguridad
- No commitear archivos .env ni credenciales
- Las API keys van en variables de entorno de Vercel, nunca en código
- RLS es la primera línea de defensa — toda tabla debe tener políticas

## Checklist rápido antes de cada cambio

1. ¿El server action usa `verifyAuth()`? ¿No importa browser client?
2. ¿Los valores DECIMAL se castean con `Number()`?
3. ¿Los inputs de búsqueda están sanitizados?
4. ¿No hay console.log con datos sensibles?
5. ¿Los botones son touch-friendly (≥ 36px)?

## Archivos de referencia
- `agents/conocimiento/PATRONES_CODIGO.md` — Patrones completos aprobados
- `agents/conocimiento/BUGS_CONOCIDOS.md` — Errores documentados y cómo evitarlos
- `agents/conocimiento/INTEGRACIONES.md` — Estado de Mercado Pago, ARCA, etc.
