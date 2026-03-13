# Plan de Integración: Mercado Pago QR Dinámico

**Fecha:** 2026-03-12
**Estado:** Investigación + Especificación
**Prioridad:** P1 - Capacidad de cobro crítica
**Proyecto ID Supabase:** vrgexonzlrdptrplqpri

---

## 1. Resumen Ejecutivo

Integración de Mercado Pago QR dinámico para permitir que cada kiosco genere códigos QR únicos por venta y reciba notificaciones de pago en tiempo real. Esta es una capacidad crítica para monetización: los kiosqueros podrán cobrar sin depender de máquinas de tarjeta ni efectivo.

**Modelo de negocio:** Mercado Pago cobra 0.8% - 6.29% según provincia (variable desde julio 2025 por Ingresos Brutos).

---

## 2. Flujo Completo del Pago QR

### 2.1 Secuencia de eventos

```
┌─────────────────────────────────────────────────────────────────────┐
│ USUARIO EN CAJA (CajaVentas.tsx)                                   │
└─────────────────────────────────────────────────────────────────────┘
         │
         ├─ Busca productos y agrega al carrito (EXISTE)
         │
         ├─ Selecciona método de pago: "QR Mercado Pago" (NUEVO)
         │
         └─ Presiona "CONFIRMAR VENTA"
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SERVER ACTION: createMercadoPagoOrder()                            │
│ └─ validateMercadopagoCredentials(orgId)                            │
│ └─ Call API MP: PUT /instore/orders/qr/seller/collectors/{user_id} │
│   Payload: {                                                         │
│     "external_pos_id": cashRegisterId,                              │
│     "total_amount": 1500.50,                                        │
│     "description": "Venta desde kiosco",                            │
│     "external_reference": saleId (idempotencia)                     │
│   }                                                                   │
│ ◄─ Response: { "qr_data": "00020126..." }  (QR EMVCo)              │
│                                                                       │
│ └─ Save en tabla `mercadopago_orders`:                              │
│   {                                                                   │
│     id: UUID,                                                        │
│     organization_id: orgId,                                         │
│     sale_id: saleId,                                                │
│     external_reference: saleId,                                     │
│     amount: 1500.50,                                                │
│     qr_data: "00020126...",                                         │
│     status: "pending",                                              │
│     created_at: now(),                                              │
│     expires_at: now() + 30min                                       │
│   }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ UI MUESTRA QR (new PaymentQRDisplay component)                     │
│ └─ Genera imagen QR con qr_data (qr-code library)                  │
│ └─ Polling cada 2 seg: checkPaymentStatus(orderId)                │
│ └─ Timeout de 5 min → cancela y vuelve a caja                     │
└─────────────────────────────────────────────────────────────────────┘
         │
    CLIENTE ESCANEA Y PAGA
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ WEBHOOK: POST /api/mercadopago/webhook                            │
│ ├─ Verificar x-signature header (HMAC-SHA256)                      │
│ ├─ Parsear payload: { action: "payment.created", data: { id, ... }} │
│ ├─ Buscar external_reference (sale_id) en mercadopago_orders      │
│ ├─ Update status: "pending" → "confirmed"                          │
│ └─ Trigger: actualizar sale_items con payment_method = "qr"      │
│                                                                       │
│ SEGURIDAD:                                                           │
│ └─ Validar firma: HMAC-SHA256(ts + request-id + "{secret}")        │
│ └─ Rechazar si timestamp > 5 min (replay attack)                   │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ UI DETECTA CONFIRMACIÓN → Muestra "PAGO RECIBIDO" ✓               │
│ └─ Genera comprobante                                               │
│ └─ Registra venta final                                            │
│ └─ Retorna a estado inicial de caja                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estados del pago QR

- **pending**: QR generado, esperando pago
- **confirmed**: Mercado Pago confirmó el pago (webhook recibido)
- **completed**: Venta completada en sistema (dinero acreditado)
- **failed**: Pago rechazado o expirado
- **cancelled**: Usuario canceló en la app de MP

---

## 3. Endpoints de la API Mercado Pago

### 3.1 Crear orden de pago QR (dinámico)

```
PUT https://api.mercadopago.com/instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs
Authorization: Bearer {access_token}
Content-Type: application/json
Idempotency-Key: {uuid}

Request Body:
{
  "external_pos_id": "caja-sucursal-1",        // Caja ID
  "total_amount": 1500.50,                    // Monto total
  "description": "Venta desde kiosco",        // Descripción
  "external_reference": "sale-uuid-123"       // ID de venta (para idempotencia)
}

Response 201:
{
  "qr_id": "00020126580014br.gov.bcb.brcode010702...",
  "qr_data": "00020126...",                   // QR EMVCo string
  "status": "active",
  "created_at": "2026-03-12T10:30:00Z"
}
```

**Notas:**
- `{user_id}`: ID de usuario de Mercado Pago (seller_id en MP)
- `{external_pos_id}`: ID único del terminal/caja (para auditoría)
- `Idempotency-Key`: Previene duplicados si se reintenta
- `external_reference`: CRÍTICO para asociar QR ↔ Venta en Supabase

### 3.2 Obtener estado de la orden

```
GET https://api.mercadopago.com/instore/orders/qr/seller/collectors/{user_id}/pos/{external_pos_id}/qrs/{external_reference}
Authorization: Bearer {access_token}

Response 200:
{
  "external_reference": "sale-uuid-123",
  "total_amount": 1500.50,
  "status": "active",  // active, expired, paid
  "qr_data": "00020126...",
  "created_at": "2026-03-12T10:30:00Z"
}
```

### 3.3 Webhook de notificación

```
POST {tu_url}/api/mercadopago/webhook
Content-Type: application/json
X-Signature: ts={timestamp},v1={signature}

Body:
{
  "id": "webhook-id-123",
  "type": "payment.created",      // También: payment.updated
  "action": "payment.created",
  "data": {
    "id": "mp-payment-id",
    "status": "approved",
    "status_detail": "accredited",
    "transaction_amount": 1500.50,
    "external_reference": "sale-uuid-123",  // VINCULACIÓN
    "payer": {
      "id": "payer-mp-id",
      "email": "cliente@example.com"
    }
  }
}
```

**Signature verification:**
```
Template: {id}|{ts}|{v1}
HMAC-SHA256(template, webhook_secret) == v1
```

---

## 4. Credenciales de Mercado Pago

### 4.1 Tipos de credenciales necesarias

| Tipo | Descripción | Dónde obtener |
|------|-------------|---------------|
| `access_token` | Token Bearer para autenticar requests | MP Dashboard > Credenciales > Access Token |
| `public_key` | Clave pública para client-side (no aplica aquí) | MP Dashboard > Credenciales |
| `user_id` / `collector_id` | ID de la cuenta de MP | MP API /oauth/token response |
| `webhook_secret` | Secret para verificar firma de webhooks | MP Dashboard > Webhooks > Secreto |

### 4.2 Almacenamiento en Supabase

Nueva tabla: `mercadopago_credentials`

```sql
CREATE TABLE mercadopago_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL ENCRYPTED,              -- PII: Encriptar
  public_key TEXT NOT NULL,
  collector_id TEXT NOT NULL,                        -- user_id de MP
  webhook_secret TEXT NOT NULL ENCRYPTED,            -- PII: Encriptar
  is_sandbox BOOLEAN DEFAULT false,                  -- Testing vs Production
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)                           -- Una config por org
);
```

**Seguridad:**
- `access_token` y `webhook_secret` deben estar encriptados en BD (usar `pgcrypto`)
- Server actions desencriptan solo cuando es necesario
- NUNCA devolver tokens completos al cliente (solo últimos 4 chars para debugging)

---

## 5. Schema de Supabase Requerido

### 5.1 Tabla: mercadopago_orders

```sql
CREATE TABLE mercadopago_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  external_reference TEXT NOT NULL,                 -- sale_id (para idempotencia en MP)
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'ARS',
  qr_data TEXT NOT NULL,                           -- EMVCo QR string
  qr_image_url TEXT,                               -- URL si se almacena en storage
  status TEXT DEFAULT 'pending',                   -- pending, confirmed, failed, expired
  mp_payment_id TEXT,                              -- ID del pago en MP (una vez confirmado)
  mp_transaction_id TEXT,                          -- Detalles de transacción
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 minutes'),
  confirmed_at TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(organization_id, external_reference),   -- Una orden por venta
  INDEX(organization_id, status),
  INDEX(sale_id)
);
```

### 5.2 Tabla: mercadopago_credentials (ya mencionada arriba)

### 5.3 Cambios a tabla sales (existente)

```sql
ALTER TABLE sales
  ADD COLUMN mp_order_id UUID REFERENCES mercadopago_orders(id);

-- Índice para búsquedas rápidas
CREATE INDEX idx_sales_mp_order_id ON sales(mp_order_id);
```

---

## 6. Cambios en componentes y server actions

### 6.1 `components/caja-ventas.tsx`

**Cambios necesarios:**
1. Agregar opción "QR Mercado Pago" a los métodos de pago (línea 356)
2. Si se selecciona MP:
   - Show loading state durante creación de QR
   - Display `<PaymentQRDisplay>` component (nuevo)
   - Polling para verificar estado
   - Manejo de timeout/cancelación

```typescript
// Pseudocódigo
if (metodoPago === 'mercadopago') {
  const { qrData, orderId } = await createMercadoPagoOrder(...)

  // Mostrar QR modal
  return <PaymentQRDisplay
    qrData={qrData}
    orderId={orderId}
    onConfirmed={() => completeSale()}
    onTimeout={() => cancelQR()}
  />
}
```

### 6.2 `lib/actions/ventas.actions.ts`

**Integración:**
- Modificar `confirmSaleAction` para aceptar `payment_method = 'mercadopago'`
- Si es MP: No confirmar automáticamente; crear orden MP primero
- Tabla `sales` tendrá estado inicial `pending_payment` hasta webhook

```typescript
// Nuevo enum para métodos de pago
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet' | 'mercadopago'

// Modificar ConfirmSaleParams
interface ConfirmSaleParams {
  ...
  paymentMethod: PaymentMethod
  mpOrderId?: string  // Si es mercadopago
}
```

### 6.3 `lib/actions/mercadopago.actions.ts` (NUEVO)

Ver sección 7 para especificación completa.

### 6.4 API Route: `app/api/mercadopago/webhook/route.ts` (NUEVO)

Ver sección 8 para especificación completa.

---

## 7. Especificación: lib/actions/mercadopago.actions.ts

### 7.1 Tipos

```typescript
// Configuración de MP
export interface MercadoPagoConfig {
  accessToken: string
  collecterId: string
  webhookSecret: string
  isSandbox: boolean
}

// Resultado de crear orden QR
export interface CreateMercadoPagoOrderResult {
  success: boolean
  orderId?: string      // ID en Supabase
  qrData?: string      // EMVCo string
  qrImageUrl?: string
  error?: string
  retryable?: boolean  // ¿Reintentar?
}

// Resultado de verificar pago
export interface CheckPaymentStatusResult {
  success: boolean
  status?: 'pending' | 'confirmed' | 'failed' | 'expired'
  mpPaymentId?: string
  error?: string
}

// Resultado de obtener credenciales
export interface GetMercadoPagoConfigResult {
  success: boolean
  config?: MercadoPagoConfig
  error?: string
}
```

### 7.2 Server Actions

```typescript
/**
 * Obtener configuración de MP de la organización
 * Solo owner/admin
 */
export async function getMercadoPagoConfigAction(
): Promise<GetMercadoPagoConfigResult>

/**
 * Guardar/actualizar credenciales de MP
 * Solo owner
 * TODO: Usar método OAuth de MP para evitar pedir token directo
 */
export async function saveMercadoPagoCredentialsAction(
  config: { accessToken: string; webhookSecret: string }
): Promise<{ success: boolean; error?: string }>

/**
 * Crear orden de pago QR dinámico
 * Se llama desde caja-ventas.tsx después de seleccionar MP
 */
export async function createMercadoPagoOrderAction(
  saleId: string,
  amount: number,
  description: string
): Promise<CreateMercadoPagoOrderResult>

/**
 * Verificar estado de pago (polling desde UI)
 * Se llama cada 2 seg desde <PaymentQRDisplay>
 */
export async function checkMercadoPagoPaymentStatusAction(
  orderId: string
): Promise<CheckPaymentStatusResult>

/**
 * Obtener detalle de una orden de MP
 * Para debugging y auditoría
 */
export async function getMercadoPagoOrderDetailAction(
  orderId: string
): Promise<{ success: boolean; order?: any; error?: string }>

/**
 * Cancelar una orden QR expirada
 * Se llama si timeout de 5 min sin pago
 */
export async function cancelMercadoPagoOrderAction(
  orderId: string
): Promise<{ success: boolean; error?: string }>
```

### 7.3 Funciones internas (no exportadas)

```typescript
// Obtener credenciales desencriptadas (solo en servidor)
async function getDecryptedMercadoPagoConfig(orgId: string)

// Llamar API de MP
async function callMercadoPagoAPI(
  method: string,
  path: string,
  body?: any,
  accessToken?: string
)

// Generar imagen QR y subirla a storage (opcional)
async function generateAndStoreQRImage(qrData: string, orderId: string)
```

---

## 8. Especificación: app/api/mercadopago/webhook/route.ts

### 8.1 Estructura

```typescript
export async function POST(request: Request) {
  try {
    // 1. Parsear headers y body
    const signature = request.headers.get('x-signature')
    const requestId = request.headers.get('x-request-id')
    const body = await request.json()

    // 2. Verificar firma HMAC-SHA256
    if (!verifyMercadoPagoSignature(signature, requestId, body)) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401 }
      )
    }

    // 3. Verificar timestamp (< 5 min)
    const timestamp = extractTimestamp(signature)
    if (isOldTimestamp(timestamp)) {
      return new Response(
        JSON.stringify({ error: 'Expired notification' }),
        { status: 400 }
      )
    }

    // 4. Procesar según tipo de evento
    switch (body.action) {
      case 'payment.created':
      case 'payment.updated':
        await handlePaymentNotification(body)
        break
      case 'order.updated':
        await handleOrderNotification(body)
        break
      default:
        logger.warn('Unknown webhook action', body.action)
    }

    // 5. Responder con 200 OK (confirmar recepción)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    )
  } catch (error) {
    logger.error('Webhook error', error)
    // Retornar 200 de todas formas (MP reintentará)
    return new Response(
      JSON.stringify({ error: 'Processing failed' }),
      { status: 200 }
    )
  }
}
```

### 8.2 Manejo de notificaciones

**handlePaymentNotification:**
1. Extraer `external_reference` (sale_id)
2. Buscar en `mercadopago_orders`
3. Actualizar status: pending → confirmed
4. Guardar `mp_payment_id`, `mp_transaction_id`
5. **NO actualizar `sales` aún** (podría fallar en siguiente paso)
6. Trigger: notificar a UI mediante polling o WebSocket (future)

**Manejo de errores:**
- Si no encuentra la orden: log e ignorar (posible pago duplicado)
- Si falla actualización: no retornar 200 (MP reintentará)
- Si DB error persistente: alertar a owner

---

## 9. Estructura de directorio y archivos

```
app-kiosco-main/
├── app/api/
│   └── mercadopago/
│       └── webhook/
│           └── route.ts          # (NUEVO) Webhook handler
├── lib/actions/
│   └── mercadopago.actions.ts    # (NUEVO) Server actions
├── components/
│   └── payment-qr-display.tsx    # (NUEVO) UI para mostrar QR y polling
├── types/
│   └── mercadopago.types.ts      # (NUEVO) Tipos TS
└── .skills/competitive-research/reports/
    └── 2026-03-12-plan-mercadopago-qr.md  # (ESTE ARCHIVO)
```

---

## 10. Consideraciones de Seguridad

### 10.1 Almacenamiento de credenciales

- ✅ Encriptar `access_token` y `webhook_secret` en Supabase
- ✅ Usar `pgcrypto` extension (ya debe estar habilitada en Supabase)
- ✅ NUNCA retornar tokens completos al cliente
- ✅ Rotar credentials anualmente
- ❌ NO guardar en variables de entorno (sería compartido entre orgs)

### 10.2 Webhook

- ✅ Verificar firma HMAC-SHA256 en CADA notificación
- ✅ Validar timestamp (rechazar > 5 min)
- ✅ Usar idempotencia: `external_reference` debe ser ÚNICO
- ✅ Logging de TODOS los webhooks recibidos
- ✅ Alertar si webhook recibido pero venta no existe
- ❌ NO actualizar `sales` directamente desde webhook (solo marcar pago confirmado)

### 10.3 Manejo de dinero

- ✅ Validar monto en servidor ANTES de crear orden MP
- ✅ Reconciliación diaria: comparar `sales` ↔ `mercadopago_orders`
- ✅ Reportar inconsistencias a owner
- ✅ PCI DSS: No almacenar datos de tarjeta del payer

---

## 11. Testing y Validación

### 11.1 Entorno Sandbox

Mercado Pago ofrece sandbox para testing:
- Access Token de sandbox diferente
- Test user sellers/payers en panel de MP
- QR generados funcionan solo en app MP de prueba

**Setup:**
1. Crear app de test en MP dashboard
2. Generar access_token de sandbox
3. Flag `is_sandbox = true` en credenciales
4. URL API: `https://api.mercadopago.com` (igual en prod y sandbox)

### 11.2 Test cases

- [ ] Crear QR con monto válido
- [ ] Crear QR con monto inválido (< 1 ARS)
- [ ] Webhook con firma inválida → rechazar
- [ ] Webhook con timestamp > 5 min → rechazar
- [ ] Pago confirmado → actualizar estado
- [ ] Timeout sin pago → cancelar QR
- [ ] Reintento de crear QR (idempotencia) → devolver orden existente
- [ ] Org sin credenciales → error claro

### 11.3 Monitoreo en producción

- [ ] Alertas: webhook no recibido en 2 min
- [ ] Alertas: venta con estado incoherente (sale ≠ mp_order)
- [ ] Dashboard: resumen de pagos MP por día/semana
- [ ] Logs: TODOS los llamados a API MP (amount, status, errors)

---

## 12. Estimación de Esfuerzo

| Componente | Horas | Notas |
|-----------|-------|-------|
| Investigación API MP | ✅ Done | |
| Crear schema Supabase | 2h | Migración, índices, encryption |
| Implementar server actions | 6h | 5 actions + manejo de errores |
| API webhook route | 3h | Signature verification crítico |
| UI PaymentQRDisplay component | 4h | Polling, timeout, error states |
| Integración con caja-ventas | 2h | Agregar método de pago |
| Testing (manual + e2e) | 6h | Sandbox MP, diferentes montos, edge cases |
| Documentación | 2h | README, troubleshooting |
| **TOTAL** | **25h** | ~3-4 días dev |

---

## 13. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Webhook no entregado (timeout) | CRÍTICO: dinero perdido | Polling con checkPaymentStatus cada 2 seg + reintento de webhook por 24h |
| Firma de webhook inválida (ataque) | CRÍTICO: pago falso | Validar HMAC-SHA256 en TODOS los webhooks |
| Rate limiting de MP | ALTO: operación lenta | Implementar exponential backoff + queue para reintentaos |
| Credenciales expiradas | MEDIO: no genera QR | Validar token antes de usar, cache de 1h |
| Discrepancia dinero | CRÍTICO: auditoría | Job nocturno que reconcilia sales ↔ mp_orders |
| Vercel cold start + webhook | MEDIO: delay de confirmación | Usar long polling del cliente (ya mitigado) |
| Usuario cierra app antes de pagar | BAJO: QR expira | QR expira en 30 min automáticamente |

---

## 14. Próximos pasos (roadmap)

1. **MVP (esta tarea):** Code base + plan
2. **Fase 1:** Implementar credenciales + create QR action
3. **Fase 2:** Webhook + confirmación de pago
4. **Fase 3:** UI en caja (PaymentQRDisplay)
5. **Fase 4:** Testing end-to-end con sandbox
6. **Fase 5:** Auditoría de seguridad (CRÍTICO)
7. **Fase 6:** Producción con monitoreo 24/7

---

## 15. Referencias y URLs

- [Documentación oficial QR Dinámico - Mercado Pago Argentina](https://www.mercadopago.com.ar/developers/es/docs/qr-code/overview)
- [API Reference: Create Order QR](https://www.mercadopago.com.ar/developers/es/reference/qr-dynamic/_instore_orders_qr_seller_collectors_user_id_pos_external_pos_id_qrs/post)
- [Webhooks y Notificaciones](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks)
- [Credenciales y OAuth](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials)
- [Testing Sandbox](https://www.mercadopago.com.br/developers/en/docs/qr-code/integration-test/dynamic-model/test-purchase)

---

## 16. FAQ

**P: ¿Qué pasa si Mercado Pago no confirma el pago?**
R: El QR expira en 30 min automáticamente. UI tiene timeout de 5 min y propone reintentar. Si venta nunca se confirma, queda en estado `pending_payment` (no genera ingreso).

**P: ¿Se puede usar el mismo código QR múltiples veces?**
R: NO. Cada venta = QR único. Eso es la gracia del "dinámico".

**P: ¿Qué pasa con el dinero?**
R: MP retiene dinero por T+1 o T+2 según cuenta. Aparece en "Saldos" en dashboard de MP. Kiosquero debe retirar manualmente (fuera del scope de esta app).

**P: ¿Se puede integrar Mercado Pago Flex (cuotas)?**
R: NO en esta fase. Solo pago inmediato. Flex requiere configuración adicional.

**P: ¿Y si hay fraudulentes?**
R: MP tiene sistema anti-fraude. Si rechaza pago, el webhook así lo indica (status: rejected). Venta queda como fallida.

---

**Documento compilado:** 2026-03-12
**Revisado por:** Tech Lead
**Estado:** Listo para implementación
