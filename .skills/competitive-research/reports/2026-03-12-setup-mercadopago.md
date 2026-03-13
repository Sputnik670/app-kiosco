# Setup: Integración Mercado Pago QR

**Guía para implementar la integración de Mercado Pago QR en App-Kiosco**

---

## 1. Prerequisitos

- Cuenta de Mercado Pago como vendedor (Argentina)
- Acceso al dashboard de Mercado Pago Developers
- Supabase project: `vrgexonzlrdptrplqpri`
- CLI de Supabase instalado: `npm install -g supabase`

---

## 2. Configuración en Mercado Pago

### 2.1 Crear aplicación de prueba (Sandbox)

1. Ir a: https://www.mercadopago.com.ar/developers/panel
2. Click en "Mis aplicaciones" > "Crear aplicación"
3. Nombre: `App-Kiosco-Test`
4. Tipo: `Integraciones`
5. Aceptar términos y crear

### 2.2 Obtener credenciales

En el panel de tu aplicación:

**Para TESTING (Sandbox):**
1. Ir a "Credenciales" > "Testing"
2. Copiar:
   - `access_token` (sandbox)
   - `public_key`
   - Ver "Mi usuario ID" → `collector_id`

**Para PRODUCCIÓN:**
1. Completar verificación de cuenta (KYC)
2. Ir a "Credenciales" > "Producción"
3. Copiar:
   - `access_token` (prod)
   - `public_key`

### 2.3 Configurar Webhook

1. Ir a "Webhooks" en panel de desarrolladores
2. Click en "Agregar webhook"
3. **URL:** `https://tu-dominio.com/api/mercadopago/webhook`
4. **Eventos a recibir:**
   - `payment.created`
   - `payment.updated`
   - `order.updated`
5. Guardar
6. **Copiar "Webhook Secret"** (lo necesitarás en Supabase)

---

## 3. Configuración en Supabase

### 3.1 Crear tabla de credenciales

```sql
-- Habilitar extensión pgcrypto (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Crear tabla de credenciales encriptadas
CREATE TABLE mercadopago_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Datos encriptados
  access_token TEXT NOT NULL,  -- Se encriptará automáticamente en BD
  webhook_secret TEXT NOT NULL,

  -- Datos en texto plano
  public_key TEXT NOT NULL,
  collector_id TEXT NOT NULL,

  is_sandbox BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_mercadopago_creds_org ON mercadopago_credentials(organization_id);
```

### 3.2 Crear tabla de órdenes QR

```sql
CREATE TABLE mercadopago_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,

  external_reference TEXT NOT NULL,  -- sale_id para idempotencia
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'ARS',

  qr_data TEXT NOT NULL,             -- EMVCo string para generar imagen
  qr_image_url TEXT,                 -- URL en Storage (opcional)

  status TEXT DEFAULT 'pending',     -- pending, confirmed, failed, expired, cancelled

  mp_payment_id TEXT,                -- ID del pago en MP
  mp_transaction_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 minutes'),
  confirmed_at TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,

  notes TEXT,

  UNIQUE(organization_id, external_reference),
  INDEX(organization_id, status),
  INDEX(sale_id)
);
```

### 3.3 Alteraciones a tabla sales

```sql
-- Agregar referencia a orden de MP
ALTER TABLE sales
  ADD COLUMN mp_order_id UUID REFERENCES mercadopago_orders(id);

-- Índice para búsquedas rápidas
CREATE INDEX idx_sales_mp_order_id ON sales(mp_order_id);
```

### 3.4 Insertar datos encriptados

```sql
-- Template para insertar credenciales (con encriptación)
-- Nota: Reemplazar valores con tus credenciales reales
-- IMPORTANTE: Encriptar access_token y webhook_secret

INSERT INTO mercadopago_credentials (
  organization_id,
  access_token,
  webhook_secret,
  public_key,
  collector_id,
  is_sandbox,
  is_active
) VALUES (
  'YOUR_ORG_ID_HERE',
  'TEST-ACCESS-TOKEN-123...',  -- Se encriptará automáticamente
  'YOUR-WEBHOOK-SECRET-HERE',   -- Se encriptará automáticamente
  'TEST-PUBLIC-KEY-456...',
  '123456789',
  true,
  true
);
```

---

## 4. Variables de Entorno

### 4.1 En `.env.local` (desarrollo)

```env
# Mercado Pago (Testing)
MERCADOPAGO_WEBHOOK_SECRET=your_webhook_secret_here
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=test_public_key_123...

# Database
DATABASE_URL=postgresql://...your_supabase_url...
```

### 4.2 En Vercel (producción)

En el dashboard de Vercel:
1. Settings > Environment Variables
2. Agregar:
   - `MERCADOPAGO_WEBHOOK_SECRET` = secret desde MP
   - `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` = public key desde MP

---

## 5. Archivos Creados

```
lib/actions/mercadopago.actions.ts          (300 líneas)
  ├─ getMercadoPagoConfigAction()
  ├─ saveMercadoPagoCredentialsAction()
  ├─ createMercadoPagoOrderAction()
  ├─ checkMercadoPagoPaymentStatusAction()
  ├─ getMercadoPagoOrderDetailAction()
  └─ cancelMercadoPagoOrderAction()

app/api/mercadopago/webhook/route.ts        (400 líneas)
  ├─ POST handler
  ├─ Verificación de firma HMAC-SHA256
  ├─ handlePaymentNotification()
  └─ handleOrderNotification()

types/mercadopago.types.ts                  (300+ líneas)
  ├─ MercadoPagoCredentials
  ├─ MercadoPagoOrder
  ├─ MercadoPagoWebhookPayload
  └─ Tipos auxiliares
```

---

## 6. Test End-to-End

### 6.1 Test unitario: Crear orden QR

```typescript
// test/mercadopago.test.ts
import { createMercadoPagoOrderAction } from '@/lib/actions/mercadopago.actions'

describe('Mercado Pago', () => {
  it('should create QR order in sandbox', async () => {
    const result = await createMercadoPagoOrderAction(
      'sale-123',
      1500.50,
      'Test sale'
    )

    expect(result.success).toBe(true)
    expect(result.qrData).toBeDefined()
    expect(result.orderId).toBeDefined()
  })

  it('should reject negative amount', async () => {
    const result = await createMercadoPagoOrderAction(
      'sale-123',
      -100,
      'Invalid'
    )

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
  })
})
```

### 6.2 Test de webhook

```typescript
// test/webhook.test.ts
import { POST } from '@/app/api/mercadopago/webhook/route'

describe('Webhook', () => {
  it('should accept valid payment notification', async () => {
    const request = new Request('http://localhost:3000/api/mercadopago/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'ts=1234567890,v1=abc123...',
        'x-request-id': 'req-123',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: '123456',
        action: 'payment.created',
        data: {
          id: 'payment-123',
          status: 'approved',
          external_reference: 'sale-uuid',
          transaction_amount: 1500.50,
        },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it('should reject invalid signature', async () => {
    const request = new Request('http://localhost:3000/api/mercadopago/webhook', {
      method: 'POST',
      headers: {
        'x-signature': 'ts=1234567890,v1=wrong_signature',
        'x-request-id': 'req-123',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ /* ... */ }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})
```

### 6.3 Test manual en Sandbox

1. **Crear cuenta de comprador de prueba en MP:**
   - Dashboard MP > Herramientas de prueba > Crear usuario de prueba

2. **Generar QR:**
   ```bash
   curl -X PUT \
     "https://api.mercadopago.com/instore/orders/qr/seller/collectors/1234567890/pos/caja-1/qrs" \
     -H "Authorization: Bearer TEST-ACCESS-TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "external_pos_id": "caja-1",
       "total_amount": 100,
       "description": "Test",
       "external_reference": "sale-uuid-123"
     }'
   ```

3. **Simular pago:**
   - Usar app de MP con usuario de prueba
   - Escanear QR generado
   - Completar pago

4. **Verificar webhook:**
   - Logs en Supabase (tabla mercadopago_orders)
   - Status debe cambiar de `pending` a `confirmed`

---

## 7. Seguridad: Checklist

- [ ] Access token encriptado en Supabase con pgcrypto
- [ ] Webhook secret encriptado en Supabase
- [ ] Firma de webhook verificada con HMAC-SHA256
- [ ] Validación de timestamp en webhook (< 5 min)
- [ ] Idempotencia: external_reference es ÚNICO
- [ ] Validación de monto en servidor (antes de API call)
- [ ] NO guardar credenciales en .env (excepto webhook_secret)
- [ ] Logs de TODOS los webhooks recibidos
- [ ] Reconciliación diaria: sales ↔ mercadopago_orders
- [ ] Alertas: pago sin confirmación en 2 min

---

## 8. Troubleshooting

### Error: "Credenciales no configuradas"

**Causa:** mercadopago_credentials vacío o desencriptación falla

**Solución:**
```sql
SELECT * FROM mercadopago_credentials WHERE organization_id = 'YOUR_ORG_ID';
-- Si está vacío, insertar con INSERT ... VALUES (...)
```

### Error: "Firma inválida"

**Causa:** webhook_secret no coincide

**Solución:**
1. Obtener secret de MP dashboard
2. Actualizar en Supabase:
```sql
UPDATE mercadopago_credentials
SET webhook_secret = 'new_secret'
WHERE organization_id = 'YOUR_ORG_ID';
```
3. Verificar que env var coincide:
```bash
echo $MERCADOPAGO_WEBHOOK_SECRET
```

### Error: "QR expirado"

**Causa:** QR fue generado hace > 30 minutos

**Solución:**
- La app automáticamente cancela y propone generar nuevo QR
- Check en mercadopago_orders si status = 'expired'

### Webhook no llega

**Causa:** URL de webhook incorrecta o MP no puede conectar

**Solución:**
1. En sandbox, usar ngrok para testing local:
```bash
ngrok http 3000
# Usar https://xxxx.ngrok.io/api/mercadopago/webhook en MP
```

2. En producción, verificar:
```bash
curl -I https://tu-dominio.com/api/mercadopago/webhook
# Debe retornar 405 (Method Not Allowed), no 404
```

3. Revisar logs en Vercel:
```bash
vercel logs --tail
```

---

## 9. Roadmap de Implementación

**Fase 1: Base (Esta tarea)**
- [x] Tipos TypeScript
- [x] Server actions (stubs)
- [x] Webhook route (stubs)
- [x] Plan detallado

**Fase 2: Backend (2-3 días)**
- [ ] Implementar `createMercadoPagoOrderAction()`
- [ ] Implementar webhook handlers
- [ ] Implementar `checkMercadoPagoPaymentStatusAction()`
- [ ] Testing con sandbox MP

**Fase 3: Frontend (1-2 días)**
- [ ] Componente `<PaymentQRDisplay>`
- [ ] Polling en UI
- [ ] Timeout + reintento
- [ ] Integración con caja-ventas.tsx

**Fase 4: Auditoría y Producción (1 día)**
- [ ] Audit de seguridad (credenciales, firma, etc.)
- [ ] Load testing (rate limiting)
- [ ] Deploy a producción
- [ ] Monitoreo 24/7

---

## 10. Contacto y Soporte

- **Documentación oficial:** https://www.mercadopago.com.ar/developers
- **Estado de la API:** https://status.mercadopago.com
- **Support:** developers@mercadopago.com

---

**Última actualización:** 2026-03-12
**Estado:** Listo para Fase 2
