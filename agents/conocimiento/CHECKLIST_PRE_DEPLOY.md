# Checklist Pre-Deploy

Ejecutar ANTES de cualquier push a `main`. El deploy automático en Vercel se activa al push, así que esto debe pasar 100%.

---

## 1. Verificación TypeScript

```bash
# En el directorio raíz del proyecto
node_modules/.bin/tsc --noEmit
```

**Debe**: 0 errores
**Nota**: No ejecutar `npm run build` en el entorno VM (fallará por .fuse_hidden y Google Fonts). TypeScript check es suficiente.

**Si falla**: Revisa los errores, corrige tipos, reintenta.

---

## 2. Revisa Server Actions

```bash
# Buscar importación incorrecta del cliente
grep -r "from '@/lib/supabase'" lib/actions/
```

**Debe**: Cero resultados (0 matches)

**Si encuentra algo**:
```typescript
// Reemplazar esto:
import { supabase } from '@/lib/supabase'

// Con esto:
import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'
```

---

## 3. Revisa Nuevas Tablas Supabase

Para cada tabla nueva en esta sesión:

- [ ] RLS ENABLED en Supabase
- [ ] Política SELECT: `(auth.uid() = user_id AND get_my_org_id() = org_id)`
- [ ] Política INSERT: `(auth.uid() = user_id AND get_my_org_id() = org_id)`
- [ ] Política UPDATE: `(auth.uid() = user_id AND get_my_org_id() = org_id)`
- [ ] Política DELETE: `(auth.uid() = user_id AND get_my_org_id() = org_id)`

**Cómo verificar en Supabase**:
1. Authentication > Policies
2. Seleccionar tabla
3. Verificar que hay 4 policies (una para cada operación)

---

## 4. Auditoría DECIMAL

Encuentra todas las comparaciones de precios/dinero:

```bash
grep -r "sale_price\|cost_price\|amount\|price" lib/actions/ | grep -E "!==|===|[<>=]{1,2}" | head -20
```

Para cada resultado, verifica:

```typescript
// MALO
if (product.sale_price !== oldPrice) { ... }

// CORRECTO
if (Math.abs(Number(product.sale_price) - Number(oldPrice)) > 0.01) { ... }
```

Asegúrate que todos los DECIMALs:
- [ ] Se castean con `Number()` antes de comparar
- [ ] Se castean con `Number()` antes de sumar/restar
- [ ] Usan `Math.abs(a - b) > 0.01` para igualdad

---

## 5. Variables de Entorno en Vercel

Verifica que TODOS los env vars nuevos están en Vercel:

```bash
# Variables necesarias (completa según nuevas features)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_VERCEL_URL
MP_APP_ID
MP_CLIENT_SECRET
MP_REDIRECT_URI
MP_ENCRYPTION_KEY
MP_WEBHOOK_SECRET
```

**Cómo verificar en Vercel**:
1. Settings > Environment Variables
2. Verificar que cada var está en: Production, Preview, Development
3. Si es secret (como `MP_CLIENT_SECRET`), debe decir "⚫ secret"

---

## 6. Migraciones Supabase Aplicadas

Si creaste nuevas tablas o columnas en esta sesión:

- [ ] SQL ejecutado en Supabase SQL Editor O
- [ ] Migración aplicada vía MCP `apply_migration`

Verifica en Supabase:
1. Database > Tables
2. Nueva tabla debe existir con columnas correctas
3. RLS debe estar ENABLED

**Ejemplo de migración manual**:
```sql
-- Si agregaste una columna:
ALTER TABLE products ADD COLUMN sku VARCHAR(50);

-- Si creaste una tabla:
CREATE TABLE my_new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY my_new_table_org_isolation ON my_new_table
  FOR ALL USING (get_my_org_id() = org_id);
```

---

## 7. Console.log y Logging

```bash
# Buscar console.log en archivos de producción (NO tests)
grep -r "console.log" app/ lib/ --include="*.ts" --include="*.tsx" | grep -v "test\|spec\|__tests__"
```

**Debe**: Cero resultados

**Permitido**:
- `console.log` en `__tests__/` y `.spec.ts`
- Logs vía `logger` de `@/lib/logging`

**Si encuentra algo**: Reemplazar con logger:

```typescript
// Reemplazar:
console.log('User created:', userId)

// Con:
logger.info('user_created', { userId })
```

---

## 8. Server Actions Return Pattern

```bash
# Buscar server actions que NO retornan { success, error }
grep -r "export async function" lib/actions/ | head -10
```

Verifica cada server action retorna:

```typescript
// SIEMPRE
Promise<{ success: boolean; error?: string; data?: any }>

// NUNCA
Promise<DataType> // sin success/error

// NUNCA
void // sin return
```

---

## 9. Responsive Design en 360px

Abre Chrome DevTools y simula Pixel 5 (360x640):

```
Chrome DevTools > Device Toolbar > Pixel 5
```

O manualmente:
```
Chrome DevTools > Dimensions... > 360 x 640
```

Recorre cada página nueva:
- [ ] Los botones son clickeables (mínimo 44x44px)
- [ ] No hay overflow horizontal
- [ ] El texto es legible (mínimo 12px, ideal 16px+)
- [ ] No hay elementos cortados
- [ ] Los inputs tienen padding suficiente

---

## 10. Después del Push a Main

Verifica en Vercel que el deploy es green:

1. Vercel > Deployments
2. Buscar el nuevo deployment (debe ser automático)
3. Estado debe ser ✅ "Ready"
4. Si está 🔄 "Building": espera
5. Si está ❌ "Failed": revisa logs, corrige, haz push de nuevo

**Logs de Vercel**:
- Haz clic en el deployment fallido
- Vercel > Build Logs
- Busca el error (generalmente TypeScript o Next.js)

---

## Checklist Rápido (antes de `git push main`)

```bash
# 1. TypeScript
node_modules/.bin/tsc --noEmit

# 2. Supabase imports en actions
grep -r "from '@/lib/supabase'" lib/actions/ || echo "✓ OK"

# 3. console.log en producción
grep -r "console.log" app/ lib/ --include="*.ts" --include="*.tsx" | grep -v test || echo "✓ OK"

# 4. DECIMAL handling (muestra solo los problemas)
grep -r "sale_price\|cost_price\|amount" lib/actions/ | grep -E "!==|===" || echo "✓ OK (revisar manualmente)"

# 5. Env vars en .env.local (vs Vercel)
echo "⚠️ Verifica manualmente en Vercel que todas las env vars están"

# 6. Si todo está ✓, estás listo para push
git push main
```

---

## Troubleshooting

### TypeScript falla con errores raros

```bash
# Limpiar caché
rm -rf .next node_modules/.typescript
npm install
node_modules/.bin/tsc --noEmit
```

### Vercel deploy fallido pero `tsc` passa

Posibles causas:
1. `@/lib/supabase` en un lugar que `grep` no encontró → buscar manualmente
2. Env var faltante → verificar en Vercel Settings
3. Supabase migration no aplicada → verificar tabla en Supabase
4. RLS policy bloqueando la query → revisar logs de Supabase

### Cambios en .env.local después de deploy

```bash
# .env.local es local, NO se sube a git
# Para actualizar Vercel:
1. Ir a Vercel > Settings > Environment Variables
2. Actualizar variable
3. Haz push de cualquier cambio de código (para re-deploy)
```

---

## Qué Verificar en Cada Tipo de Feature

### Si agregaste columna DECIMAL
- [ ] Todas las comparaciones usan `Math.abs(a - b) > 0.01`
- [ ] Todas las sumas usan `Number()` casteo
- [ ] Tests verifican valores como `199.99` no `"199.99"`

### Si agregaste tabla nueva
- [ ] RLS enabled
- [ ] 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] `org_id` en la tabla (si es multi-org)
- [ ] Migration aplicada en Supabase

### Si agregaste server action
- [ ] Usa `verifyAuth()` o `verifyOwner()`
- [ ] No importa `@/lib/supabase`
- [ ] Retorna `{ success, error? }`
- [ ] Incluye `org_id` en WHERE

### Si agregaste componente con datos
- [ ] Es `'use client'`
- [ ] Usa `useState` para estado
- [ ] Usa `useCallback` + `useEffect` para fetch
- [ ] Llama server action, no Supabase directo
- [ ] Responsive en 360px

### Si conectaste integración (MP, etc.)
- [ ] Env vars en .env.local Y Vercel
- [ ] Webhook handler con verificación HMAC
- [ ] Encryption key 64 hex chars (`MP_ENCRYPTION_KEY`)
- [ ] Tests de callback handler

