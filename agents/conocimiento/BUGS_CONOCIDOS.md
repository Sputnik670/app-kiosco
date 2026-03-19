# Bugs Conocidos y Patrones de Corrección

## 1. Columnas DECIMAL de Supabase llegan como strings

**Problema**: Las columnas DECIMAL/NUMERIC de PostgreSQL en Supabase llegan al cliente JavaScript como strings (`"100.00"` en lugar de `100`), causando comparaciones incorrectas y cálculos inesperados.

**Síntomas**:
- Comparaciones con `!==` no funcionan como se espera
- Cálculos de precios dan resultados raros
- Filtraciones de datos falsas en reportes

**Dónde se encontró**:
- `lib/actions/product.actions.ts` — caché de precios en bulk updates
- `lib/actions/reports.actions.ts` — suma de ingresos por período
- `lib/actions/inventory.actions.ts` — costo total de compras
- `lib/actions/cash.actions.ts` — diferencia de caja

**Patrón de corrección**:

```typescript
// MALO
if (product.sale_price !== oldPrice) { // falla porque "100.00" !== "100"
  updatePrice(product.id, newPrice)
}

// CORRECTO
if (Math.abs(Number(product.sale_price) - Number(oldPrice)) > 0.01) {
  updatePrice(product.id, newPrice)
}

// Para sumas
const total = rows.reduce((sum, row) => sum + Number(row.price), 0)
```

**Regla**: SIEMPRE castear con `Number()` ANTES de comparar o calcular valores DECIMAL. Para comparaciones de igualdad, usar `Math.abs(a - b) > 0.01` (tolerancia de 1 centavo).

---

## 2. Browser client importado en server actions

**Problema**: Importar `@/lib/supabase` (browser client) dentro de un server action causa fallos silenciosos por RLS. El cliente del navegador no tiene credenciales de servidor y las políticas de RLS fallan.

**Dónde se encontró**:
- `lib/actions/user.actions.ts` — importación sin usar

**Patrón correcto**:

```typescript
// lib/actions/user.actions.ts
'use server'

import { verifyAuth, verifyOwner } from '@/lib/actions/auth-helpers'

export async function getUserProfile() {
  try {
    const { supabase, orgId, user } = await verifyAuth()

    // AQUÍ: usar supabase (server client)
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

**Regla**: Los server actions SOLO usan:
- `verifyAuth()` para cualquier usuario autenticado
- `verifyOwner()` para acciones solo del dueño
- El cliente Supabase devuelto por estas funciones

NUNCA importar `@/lib/supabase` dentro de `lib/actions/`.

---

## 3. Búsqueda de proveedor para servicios virtuales

**Problema**: El filtrado de proveedores por tipo de servicio (SUBE vs Cargas Virtuales) no coincidía porque buscaba por `%servicio%` en el nombre, sin considerar el campo específico.

**Dónde se encontró**:
- `lib/actions/service.actions.ts` — `fetchProviders()`

**Patrón antiguo (falla)**:

```typescript
const { data } = await supabase
  .from('providers')
  .select('*')
  .ilike('name', `%${serviceType}%`) // falla: "SUBE San Isidro" no contiene "Cargas Virtuales"
```

**Patrón correcto**:

```typescript
let query = supabase.from('providers').select('*')

if (isSube) {
  query = query.ilike('name', '%SUBE%') // para SUBE
} else {
  query = query.not('name', 'ilike', '%SUBE%') // para Cargas Virtuales, excluir SUBE
}

const { data } = await query
```

---

## 4. OAuth callback usaba tabla incorrecta

**Problema**: El callback de OAuth de Mercado Pago buscaba la membresía del usuario en la tabla `profiles` en lugar de `memberships`, causando error 404.

**Dónde se encontró**:
- `lib/actions/oauth.actions.ts` — `handleMercadoPagoCallback()`

**Patrón antiguo (falla)**:

```typescript
const { data: profile } = await supabase
  .from('profiles') // MALO: tabla equivocada
  .select('org_id')
  .eq('user_id', user.id)
  .single()
```

**Patrón correcto**:

```typescript
const { data: membership } = await supabase
  .from('memberships')
  .select('org_id')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single()

const orgId = membership.org_id
```

---

## 5. Derivación de clave de cifrado débil

**Problema**: La variable de entorno `MP_ENCRYPTION_KEY` aceptaba strings cortos sin validar, causando fallos silenciosos de cifrado/descifrado en credenciales de Mercado Pago.

**Dónde se encontró**:
- `lib/actions/mercadopago.actions.ts` — `encryptCredentials()`, `decryptCredentials()`

**Patrón antiguo (falla)**:

```typescript
const key = process.env.MP_ENCRYPTION_KEY // acepta cualquier string corto
const derivedKey = Buffer.from(key).subarray(0, 32) // insuficiente

// Resultado: descifrado falla silenciosamente
```

**Patrón correcto**:

```typescript
const key = process.env.MP_ENCRYPTION_KEY
if (!key || !/^[a-f0-9]{64}$/.test(key)) {
  throw new Error(
    'MP_ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales (32 bytes). ' +
    'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  )
}

const derivedKey = Buffer.from(key, 'hex')
```

**Cómo generar una clave válida**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6... (64 caracteres hex)
```

---

## 6. Git lock files no se pueden eliminar del entorno VM

**Problema**: Los archivos `.git/index.lock` y `.git/HEAD.lock` no se pueden eliminar desde Node.js o Bash en el entorno VM, bloqueando operaciones de git.

**Síntomas**:
- `fatal: Unable to write new index file`
- No se puede hacer push/pull/commit

**Solución**: El usuario debe ejecutar desde PowerShell en Windows:

```powershell
Remove-Item .git/index.lock -Force
Remove-Item .git/HEAD.lock -Force
```

Esta no es un bug de código, es una limitación del entorno.

---

## 7. Build de Next.js falla en VM por .fuse_hidden y Google Fonts

**Problema**: El build de Next.js falla en el entorno VM due a:
- Archivos `.fuse_hidden*` generados por el sistema de archivos
- Intentos de descargar Google Fonts sin conexión

**Síntoma**:
```
Error: ENOENT: no such file or directory, stat '/root/.next/.fuse_hidden...'
```

**Solución**: NO es un bug de código. La verificación confiable es:

```bash
node_modules/.bin/tsc --noEmit
```

TypeScript compilation (`tsc`) valida todo el código sin generar artefactos de build, y es la forma recomendada en el checklist pre-deploy.

---

## 8. Supabase `.single()` lanza error si no hay filas

**Problema**: Usar `.single()` cuando una fila ES OPCIONAL causa excepción no capturada.

**Síntoma**:
```
Error: JSON object requested, multiple (actually zero) rows returned
```

**Patrón incorrecto**:

```typescript
const { data } = await supabase
  .from('providers')
  .select('*')
  .eq('id', providerId)
  .single() // FALLA si el proveedor no existe
```

**Patrón correcto**:

```typescript
const { data } = await supabase
  .from('providers')
  .select('*')
  .eq('id', providerId)
  .maybeSingle() // retorna null si no existe, sin error
```

**Regla**:
- `.single()` → para lookups donde la fila DEBE existir (user by id, org config)
- `.maybeSingle()` → para lookups opcionales (provider, credential)

---

## Checklist de Auditoría

Cuando hagas cambios con DECIMAL o server actions, verifica:

1. ¿Hay comparaciones `!==` o `===` con valores DECIMAL? → Reemplazar con `Math.abs(a - b) > 0.01`
2. ¿Hay sumas/restas de DECIMAL sin `Number()`? → Wrappear todos los valores
3. ¿Hay importación de `@/lib/supabase` en `lib/actions/`? → Eliminar, usar `verifyAuth()` en su lugar
4. ¿Hay `.single()` en un lookup opcional? → Cambiar a `.maybeSingle()`
5. ¿Hay búsquedas de proveedores por nombre? → Verificar que usen ILIKE correctamente según tipo de servicio
6. ¿Se duplica la obtención de `orgId` llamando a `get_my_org_id()` cuando `verifyAuth()` ya lo provee? → Usar siempre el `orgId` retornado por `verifyAuth()`

---

## 9. Componentes "use client" con queries directas a Supabase browser client

**Problema**: Algunos componentes (como `tab-historial.tsx`) hacen queries directas usando el browser client de Supabase en vez de server actions. Esto funciona gracias a RLS pero rompe el patrón de seguridad defense-in-depth y dificulta el mantenimiento.

**Dónde se encontró**:
- `components/dashboard/tab-historial.tsx` — queries a sales, stock_batches, attendance, memberships

**Patrón incorrecto**:

```typescript
'use client'
import { supabase } from '@/lib/supabase'

// Query directa desde componente
const { data } = await supabase.from('sales').select('*').eq('branch_id', branchId)
```

**Patrón correcto**:

```typescript
'use client'
import { getSalesHistory } from '@/lib/actions/ventas.actions'

// Usar server action
const result = await getSalesHistory(branchId)
```

**Regla**: Los componentes `"use client"` deberían usar server actions para queries complejas. Solo usar browser client para queries simples y en tiempo real (subscriptions, realtime).

---

## 10. RPC redundante de `get_my_org_id()` en server actions

**Problema**: Algunas funciones obtienen `orgId` de `verifyAuth()` pero luego vuelven a llamar a `supabase.rpc('get_my_org_id')` innecesariamente. Esto es redundante y crea un riesgo de race condition si la sesión expira entre ambas llamadas.

**Dónde se encontró**:
- `lib/actions/dashboard.actions.ts:228` — `getOwnerStatsAction()`

**Patrón incorrecto**:

```typescript
const { supabase, orgId } = await verifyAuth()
// ...más tarde...
.eq('organization_id', (await supabase.rpc('get_my_org_id')).data || '') // REDUNDANTE
```

**Patrón correcto**:

```typescript
const { supabase, orgId } = await verifyAuth()
// ...más tarde...
.eq('organization_id', orgId) // Usar el que ya tenemos
```

---

## 11. Dashboard margen hardcodeado (CORREGIDO 2026-03-19)

**Problema**: El dashboard calculaba el margen de ganancia usando `DEFAULT_COST_RATIO = 0.55` (55%) para TODOS los productos, ignorando el `unit_cost` real guardado en `sale_items`.

**Dónde se encontró**: `lib/actions/dashboard.actions.ts`

**Fix aplicado**: Ahora lee `unit_cost` de `sale_items`. Si `unit_cost > 0`, usa el costo real. Solo aplica el ratio como fallback cuando `unit_cost === 0`.

**Estado**: CORREGIDO

---

## 12. Filter injection en búsqueda de ventas (CORREGIDO 2026-03-19)

**Problema**: El input de búsqueda en ventas se pasaba directo al filtro `.or()` de PostgREST sin sanitizar. Un usuario malicioso podía inyectar caracteres como `,()` para manipular la query.

**Dónde se encontró**: `lib/actions/ventas.actions.ts:153`

**Fix aplicado**: `.replace(/[,()]/g, '').trim()` antes de usar en el filtro.

**Regla**: Siempre sanitizar inputs antes de usar en `.or()`, `.filter()` o cualquier query PostgREST que acepte operadores.

**Estado**: CORREGIDO

---

## 13. N+1 queries en historial de empleados (CORREGIDO 2026-03-19)

**Problema**: `tab-historial.tsx` hacía 3 queries por empleado dentro de un loop (3N+1 queries totales). Con 10 empleados = 31 queries.

**Fix aplicado**: Batch queries con `.in("user_id", userIds)` + `Promise.all` + agregación en memoria. Ahora: 3 queries totales sin importar cantidad de empleados.

**Estado**: CORREGIDO
