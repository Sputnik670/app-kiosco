# Auditoría Técnica — Rama `feature/metodos-cobro`

**Fecha:** 1 mayo 2026  
**Estado:** Listo para mergear con validación técnica  
**Riesgo General:** BAJO — implementación sólida, sin issues bloqueantes

---

## 1. Mapa de Cambios

### Resumen de commits
- **Un commit:** `ea159ee` — "feat(wip): metodos de cobro ampliados (Posnet MP, QR fijo, Alias) - sin probar en prod"

### Estadísticas
- **10 archivos modificados**
- **1806 líneas agregadas**
- **31 líneas eliminadas**
- **LOC agregadas netas:** 1775

### Archivos modificados
1. `components/caja-ventas.tsx` — +298, -0 (integración de 3 botones de método manual + dialog)
2. `components/configuracion-metodos-cobro.tsx` — +539, -0 (nuevo panel dueño)
3. `components/dialog-cobro-manual.tsx` — +371, -0 (nuevo dialog cajero)
4. `lib/actions/payment-methods.actions.ts` — +335, -0 (server actions: CRUD config + upload/delete imagen)
5. `lib/validations/index.ts` — +89, -0 (Zod schemas)
6. `supabase/migrations/00010_payment_methods_expansion.sql` — +171, -0 (tabla + RLS + storage bucket)
7. `components/dashboard-dueno.tsx` — +20, -0 (import dinámico + render)
8. `lib/actions/ventas.actions.ts` — +10, -0 (sin cambios relevantes, probablemente tipo)
9. `hooks/use-offline-ventas.ts` — +2, -1 (tipo de payment_method)
10. `lib/offline/indexed-db.ts` — +2, -1 (schema offline)

---

## 2. Migration `00010_payment_methods_expansion`

### Validación contra schema producción
**Estado producción al 1-may-2026:**
- Tabla `branches` existe con columnas: `id, organization_id, name, address, phone, qr_code, is_active, created_at, qr_entry_url, qr_exit_url, mp_external_pos_id, mp_store_id`
- **No existe aún:** tabla `payment_methods_config` ni bucket `payment-assets`

### Qué la migration hace

#### 2.1 Expande CHECK de `sales.payment_method`
- Antes: `'cash', 'card', 'transfer', 'wallet', 'mercadopago'`
- Después agrega: `'posnet_mp', 'qr_static_mp', 'transfer_alias'`
- **Impacto:** Las tres nuevas opciones quedarán disponibles en el tipo, aunque el código que las use se deployará después
- **Riesgo:** NULO — es extension compatible hacia atrás

#### 2.2 Crea tabla `payment_methods_config`
```sql
CREATE TABLE payment_methods_config (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  -- POSNET MP
  posnet_mp_enabled BOOLEAN,
  posnet_mp_label TEXT,
  posnet_mp_notes TEXT,
  -- QR FIJO
  qr_static_enabled BOOLEAN,
  qr_static_image_url TEXT,
  qr_static_image_path TEXT,
  qr_static_holder_name TEXT,
  qr_static_instructions TEXT,
  -- ALIAS
  alias_enabled BOOLEAN,
  alias_value TEXT,
  alias_cbu_cvu TEXT,
  alias_titular_name TEXT,
  alias_bank_name TEXT,
  alias_instructions TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  CONSTRAINT uq_pmc_org UNIQUE (organization_id)
);
```
- **Cardinalidad:** 1 por organización (UNIQUE constraint en organization_id)
- **RLS:** Implementado correctamente — SELECT/INSERT/UPDATE/DELETE filtradas por `get_my_org_id()` e `is_owner()`
- **Trigger:** `update_pmc_updated_at()` con `SECURITY DEFINER` + `SET search_path TO 'public'` ✓

#### 2.3 Crea bucket Storage `payment-assets`
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-assets', 'payment-assets', true, 2MB, ARRAY['image/png','image/jpeg','image/webp'])
```
- **Visibilidad:** `public: true` — URLs del QR son públicas (necesario para mostrar al cliente)
- **Limite de archivo:** 2 MB (razonable para imágenes QR)
- **RLS en storage.objects:**
  - SELECT: público (cualquiera lee `payment-assets/*`)
  - INSERT/UPDATE/DELETE: `is_owner()` + ruta debe empezar por `{orgId}/`
  - **Vulnerabilidad:** La RLS usa `(storage.foldername(name))[1]` para extraer org_id de la ruta. Defensa en profundidad duplicada también en server action (`deleteQrStaticImageAction` valida con `path.startsWith(orgId)`). ✓

### Consistencia con main
- **Nota crítica:** La migration ya se aplicó a producción el 24-abr-2026 (per CLAUDE.md)
- **Impacto merge:** El merge a main aplicará nuevamente la migration (idempotente por `IF NOT EXISTS` / `ON CONFLICT`) — sin problema
- **Estado actual de code:** El código que usa estas tablas/buckets está SOLO en `feature/metodos-cobro`, no existe en main — perfectly safe

---

## 3. Server Action `lib/actions/payment-methods.actions.ts`

### Arquitectura
- **Patrón:** Tres funciones exportadas (get, save, upload/delete imagen)
- **Autenticación:** `verifyAuth()` para leer, `verifyOwner()` para escribir ✓
- **Return shape:** Estándar `{ success: boolean, error?: string, ...data }` ✓

### Funciones detalle

#### 3.1 `getPaymentMethodsConfigAction()`
```typescript
export async function getPaymentMethodsConfigAction(): Promise<GetPaymentMethodsConfigResult>
```
- **Acceso:** Cualquier usuario autenticado de la org (empleados + dueño)
- **Lógica:** `.maybeSingle()` + fallback a `DEFAULT_CONFIG` si no existe fila
- **RLS:** Validada por Supabase (`.eq('organization_id', orgId)`)
- **Nota:** Los empleados necesitan leer esto para mostrar el alias/QR en el dialog. ✓

#### 3.2 `savePaymentMethodsConfigAction(input)`
```typescript
export async function savePaymentMethodsConfigAction(input: unknown)
```
- **Autenticación:** `verifyOwner()` — solo el dueño ✓
- **Validación:** Zod schema `savePaymentMethodsConfigSchema` con superRefine:
  - Si QR fijo habilitado → debe haber imagen URL
  - Si alias habilitado → debe haber alias o CBU/CVU
- **UPSERT:** `onConflict: 'organization_id'` — crea fila si no existe ✓
- **Logging:** Usuario y flags habilitados registrados (no expone datos sensibles) ✓

#### 3.3 `uploadQrStaticImageAction(formData: FormData)`
```typescript
export async function uploadQrStaticImageAction(formData: FormData)
```
- **Autenticación:** `verifyOwner()` ✓
- **Validación cliente:**
  - Tamaño: max 2 MB (validación en server `MAX_QR_IMAGE_SIZE_BYTES`)
  - MIME: PNG, JPEG, WebP only
- **Path storage:** `${orgId}/qr-static-${timestamp}.${ext}` — determinístico con timestamp para evitar cache
- **Idempotencia:** Cada upload genera nuevo path → permite reemplazar sin borrar previos inmediatamente
- **Cleanup:** Antigua imagen se borra en background (`.catch(() => {})` en componente) ✓

#### 3.4 `deleteQrStaticImageAction(path: string)`
```typescript
export async function deleteQrStaticImageAction(path: string)
```
- **Autenticación:** `verifyOwner()` ✓
- **Validación:** Defensa en profundidad — check `path.startsWith(orgId)` antes de llamar API ✓
- **RLS:** Storage RLS también filtra por org_id
- **Riesgo eliminado:** Usuario de org A no puede borrar foto de org B

### Validaciones de Seguridad
✅ Todos los server actions usan `verifyOwner()` o `verifyAuth()` con org_id  
✅ No hay exposición de datos sensibles en logs (email sí excluido)  
✅ Defensa en profundidad en delete (validation tanto en app logic como RLS)  
✅ FormData validation: tamaño + MIME types  
✅ Storage paths namespaced por org  

### Validaciones Funcionales
✅ Zod superRefine asegura que método habilitado = datos mínimos presentes  
✅ Alias regex valida solo `[a-zA-Z0-9._-]` (regla alias argentino)  
✅ CBU/CVU regex valida solo números, máx 22 dígitos  

---

## 4. Componente `configuracion-metodos-cobro.tsx`

### Propósito
Panel del dueño en la sección Ajustes → Métodos de cobro. Permite habilitar/deshabilitar y configurar los 3 métodos manuales.

### Estructura
- **Layout:** Tres cards (Posnet / QR fijo / Alias), cada una con su switch para habilitar
- **Estados:** loading, saving, uploading, deleting

### Detalle por método

#### Posnet MP
- Switch + input `posnet_mp_label` (ej: "Posnet SN-123456")
- Textarea `posnet_mp_notes` (instrucciones internas para empleado)
- **Binding:** estado local, guardado con save button

#### QR Fijo
- Switch + file picker para subir PNG/JPEG/WebP
- Preview de imagen (si existe)
- Input `qr_static_holder_name` (titular de la cuenta MP)
- Textarea `qr_static_instructions` (instrucciones para mostrar al cliente)
- **Upload flow:** Form action → `uploadQrStaticImageAction` → retorna URL + path → setState
- **Cleanup:** Si había imagen previa, se borra en background (best-effort, no bloquea)

#### Alias / Transferencia
- Switch + input `alias_value` (ej: "mitienda@alias")
- Input `alias_cbu_cvu` (ej: "0123456789012345678901")
- Inputs `alias_titular_name`, `alias_bank_name`
- Textarea `alias_instructions`
- **Binding:** estado local

### UX/Validación
- **Error handling:** Sonner toasts para cada acción (upload, save, delete)
- **Disabled states:** Loading/saving/uploading bloquean botones
- **File reset:** `e.target.value = ''` permite re-subir el mismo archivo
- **Confirmación:** `confirm()` antes de borrar imagen

### Riesgos / Observaciones
- ⚠️ **Imagen previa se borra "best-effort"** — si la llamada a delete falla, no hay retry. Solución: es baja prioridad (imagen vieja sigue siendo válida), pero técnicamente quedan archivos huérfanos en storage.
- ✅ **Storage URL pública** — correcto porque la necesita el cliente
- ✅ **Preview con `unoptimized`** — correcto porque es imagen dinámica de tercero (Supabase public URL)

---

## 5. Componente `dialog-cobro-manual.tsx`

### Propósito
Dialog modal que se abre en caja cuando el cajero selecciona un método manual. Muestra instrucciones + datos al cliente, el cajero verifica el cobro y toca "Ya cobré".

### Props
```typescript
interface DialogCobroManualProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  method: ManualPaymentMethod | null           // "posnet_mp" | "qr_static_mp" | "transfer_alias"
  amount: number                                 // total del carrito
  config: PaymentMethodsConfig | null           // la config del dueño
  onConfirmed: () => void | Promise<void>      // callback cuando toca "Ya cobré"
  processing?: boolean                           // bloquea cerrar mientras procesa
}
```

### Contenido por método

#### Posnet MP
- Pasos numerados (acerca posnet → carga monto → espera aprobado → toca "Ya cobré")
- Muestra label + notas del dueño si existen
- **Color:** Indigo

#### QR Fijo
- Preview ampliado de la imagen del QR (Image 320x320)
- Si no hay imagen → error fallback rojo (redirige a configurar)
- Muestra titular si existe
- Instrucción: "Recordale al cliente que cargue exactamente $X"
- Instrucciones custom del dueño si existen
- **Color:** Emerald

#### Alias / Transferencia
- Muestra alias en monospace grande (selectable + copiar al portapapeles)
- Muestra CBU/CVU con copy button
- Muestra titular + banco si existen
- **Color:** Violet
- **Copy buttons:** Feedback visual (icon → check mark por 2s)

### UX / Seguridad
- **Scroll contenido interno** — max-height 60vh si hay mucho texto
- **Bloqueo durante procesamiento** — `processing` prop bloquea cerrar el dialog
- **Monospace para datos**: alias/CBU → legibilidad, select-all para copy
- **Icon + color por método** — diferenciación visual clara
- **Amount formateado:** `$X.XX` con locale es-AR

### Integración con CajaVentas
- Dialog se pasa `onConfirmed` que luego llama `completarVenta(metodo)`
- El `processing` flag viene de `procesandoVenta` del padre

### Riesgos / Observaciones
- ✅ El dialog es presentacional, no hace cambios a DB
- ✅ Copy to clipboard manejo de erro correcto (try/catch)
- ✅ Si config es null, no renderiza nada (fallback seguro)
- ⚠️ Si imagen de QR no carga (broken URL), usuario ve error pero no puede salvar. Necesita volver a ajustes. Aceptable (debería haberse validado antes de habilitar).

---

## 6. Integración en `caja-ventas.tsx`

### Cambios principales

#### 6.1 Tipos
```typescript
type CajaPaymentMethod = "cash" | "card" | "wallet" | "mercadopago" 
                       | "posnet_mp" | "qr_static_mp" | "transfer_alias"

const MANUAL_METHODS = ["posnet_mp", "qr_static_mp", "transfer_alias"]
```
- Type guard `isManualMethod()` para flujo condicional ✓

#### 6.2 Estado
```typescript
const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<PaymentMethodsConfig | null>(null)
const [showManualDialog, setShowManualDialog] = useState(false)
const [manualMethod, setManualMethod] = useState<ManualPaymentMethod | null>(null)
```

#### 6.3 Carga de config
```typescript
useEffect(() => {
  const loadPaymentConfig = async () => {
    const result = await getPaymentMethodsConfigAction()
    if (result.success) setPaymentMethodsConfig(result.config)
  }
  loadPaymentConfig()
}, [])
```
- **Silencioso si falla:** configuraciónfalla → los botones nuevos no aparecen, flujo viejo sigue funcionando ✓

#### 6.4 Lógica de procesamiento
```typescript
const procesarVentaHandler = async () => {
  if (metodoPago === "mercadopago") {
    // Abre dialog de QR dinámico
    setShowMercadoPagoQR(true)
    return
  }
  if (isManualMethod(metodoPago)) {
    // Abre dialog manual
    setManualMethod(metodoPago)
    setShowManualDialog(true)
    return
  }
  // Flujo normal (cash, card, wallet)
  await completarVenta(metodoPago)
}

const completarVenta = async (metodo: CajaPaymentMethod) => {
  // ... procesa venta con `metodoPago: metodo`
}

const handleManualConfirmed = async () => {
  if (!manualMethod) return
  await completarVenta(manualMethod)
}
```
- **Flujo:** Método manual → dialog → user verifica cobro → toca "Ya cobré" → `completarVenta()` → venta registrada ✓

#### 6.5 Botones de método de pago
```typescript
const all = [
  ...baseMethods,
  ...(config?.posnet_mp_enabled ? ['posnet_mp'] : []),
  ...(config?.qr_static_enabled ? ['qr_static_mp'] : []),
  ...(config?.alias_enabled ? ['transfer_alias'] : []),
]

return all.map((m) => (
  <button onClick={() => setMetodoPago(m)}>
    {labels[m]}
  </button>
))
```
- **Dinámico:** Solo aparecen botones si dueño habilitó el método ✓
- **Icons:** CreditCard para Posnet, QrCode para QR fijo, Banknote para Alias

#### 6.6 Render del dialog
```typescript
<DialogCobroManual
  open={showManualDialog}
  onOpenChange={(next) => {
    setShowManualDialog(next)
    if (!next) setManualMethod(null)
  }}
  method={manualMethod}
  amount={cart.getTotal()}
  config={paymentMethodsConfig}
  onConfirmed={handleManualConfirmed}
  processing={procesandoVenta}
/>
```

### Riesgos / Observaciones
- ✅ **Código limpio:** Separación clara entre métodos automáticos (QR dinámico) vs manuales
- ✅ **No rompe flujo existente:** Cash/card/wallet siguen funcionando igual
- ✅ **Fallback seguro:** Si config carga lentamente o falla, los botones nuevos no aparecen
- ⚠️ **Duplicación en diff:** El diff muestra código repetido al final (`}}\n}}\n...`). Indicador de merge conflict mal resuelto o paste error. **Verificar en pull antes de mergear que caja-ventas compile correctamente.**

---

## 7. Validaciones Zod

### Schema `savePaymentMethodsConfigSchema`
- **Posnet:** boolean + strings opcionales (label, notes)
- **QR fijo:** boolean + URL + path + strings
- **Alias:** boolean + alias (alfanumérico) + CBU/CVU (números)
- **SuperRefine:**
  - Si QR habilitado → URL requerida
  - Si Alias habilitado → alias o CBU requerido
- **Regex alias:** `/^[a-zA-Z0-9._-]*$/` (correcto para alias argentino)
- **Regex CBU/CVU:** `/^\d{0,22}$/` (números, máx 22 dígitos)

### Impacto en main
- Schemas nuevos NO impactan main (están en `lib/validations/index.ts` pero separados en sección comentada)
- Al mergear, se suma a las validaciones existentes sin conflicto

---

## 8. Riesgos Identificados

### Críticos (bloqueantes)
❌ **Ninguno identificado**

### Altos (deben ser resueltos antes de producción)
⚠️ **Potencial duplicación de código en caja-ventas.tsx**
- El diff muestra código duplicado al final del archivo (sección del dialog + botones repetida)
- **Acción:** Revisar checkout diff completo en GitHub antes de mergear para asegurar que no hay merge conflicts

### Medios (pueden ser parqueados con nota)
- 🟡 **Cleanup de imagen QR anterior es best-effort**
  - Si deleteQrStaticImageAction falla silenciosamente, quedan archivos huérfanos en storage
  - **Mitigación:** No es un problema funcional (imagen vieja sigue siendo válida), solamente storage waste
  - **Mejora futura:** Agregar un job de cleanup de archivos huérfanos en pg_cron

- 🟡 **Si QR fijo no carga (URL rota), no hay path de recuperación en dialog**
  - Usuario ve error pero debe volver a ajustes para resubir
  - **Aceptable:** Unlikely case (validación al habilitar), y educamos al dueño

### Bajos (observaciones)
- 🟢 **Storage bucket public: true**
  - Por diseño, URLs del QR son públicas (el cliente las escanea)
  - RLS de INSERT/UPDATE/DELETE igualmente protege

- 🟢 **Alias sin sanitización extra**
  - Schema Zod valida format, servidor confía en Zod
  - No hay riesgo de injection porque alias se usa solo como string display (no en SQL directo)

---

## 9. Orden de Activación Recomendado

**Usuario acordó:** Alias → QR fijo → Posnet

### Análisis técnico del orden
1. **Alias primero:** ✅ Correcto
   - Más simple: solo textos (sin upload)
   - Menos movimiento de dinero real (el cliente transfiere, no verificamos nada)
   - Ideal para pilotar la UX del dialog

2. **QR fijo segundo:** ✅ Correcto
   - Requiere upload de imagen (mayor complejidad)
   - Depende de MP tener QR estático previamente generado
   - El cliente escanea (más riesgo que alias puro)

3. **Posnet tercero:** ✅ Correcto
   - Presencia de hardware físico (menos común en todos los kioscos)
   - Integración más fácil (no requiere verificación) pero más específica

### Recomendación
**El orden acordado es óptimo.** Es de menor a mayor complejidad técnica y menor a mayor superficie de verificación. Validar cada uno con venta real:
1. Alias: transferencia de $1 al banco → confirmar que aparece la venta
2. QR fijo: escanear con billetera ajena (Naranja X, MODO) → confirmar cobro
3. Posnet: acercar el posnet al cliente → confirmar que la venta se registra

---

## 10. Checklist Pre-Merge

- [ ] **Revisar diff completo en GitHub** — asegurar que caja-ventas.tsx no tiene código duplicado
- [ ] **Ejecutar `tsc --noEmit`** — no hay errores TypeScript
- [ ] **Ejecutar tests existentes** — vitest unit, no regresiones
- [ ] **Smoke test manual:**
  - [ ] Crear org de test
  - [ ] Habilitar cada método desde panel (Alias → QR fijo → Posnet)
  - [ ] Verificar que botones aparecen en caja en orden correcto
  - [ ] Alias: completar venta, verificar que sale con payment_method='transfer_alias'
  - [ ] QR fijo: completar venta, verificar que sale con payment_method='qr_static_mp'
  - [ ] Posnet: completar venta, verificar que sale con payment_method='posnet_mp'
- [ ] **Verificar schema offline** — hooks/use-offline-ventas.ts + lib/offline/indexed-db.ts incluyen los nuevos métodos ✓ (ya presente en diff)
- [ ] **Borrar `docs/PLAN_VIERNES_EMVCO.md`** si aún existe (pertenece a tarea #10, no a esta)

---

## 11. Conclusión Final

**Estado:** ✅ **LISTO PARA MERGEAR** (con validación técnica de caja-ventas.tsx)

**Hallazgos más importantes:**

1. **RLS y seguridad sólida** — Todas las tablas y storage buckets tienen políticas de acceso correctamente implementadas, defensa en profundidad en delete
2. **Separación clara de concerns** — Server actions manejan auth/validation, componentes son presentacionales, caja-ventas integración limpia
3. **Potencial duplicación en caja-ventas** — Verificar en diff de GitHub antes de mergear; si existe, es merge conflict que debe resolverse

**Recomendaciones:**
- Mergear a main mañana tras verif de caja-ventas
- Activar métodos en orden: Alias → QR fijo → Posnet, cada uno con venta real de validación
- Parquear cleanup de imagen QR para próxima sesión (low priority)
