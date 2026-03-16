# Estado de Integraciones

Documento actualizado al 15 de marzo 2026. Incluye endpoints, tablas, variables de entorno y estado de cada integración.

---

## Mercado Pago QR (v1.0 — Implementado Marzo 2026)

**Estado**: IMPLEMENTADO, testing E2E pendiente

### Características
- OAuth flow para usuarios normales (no developers)
- QR dinámico para pagos in-situ
- Webhook handler con verificación HMAC-SHA256
- Polling client para confirmar pago (2s, timeout 5min, expiry 30min)

### Variables de Entorno

```env
# .env.local y Vercel (todos requeridos)

# OAuth
MP_APP_ID=3117685726294823
MP_CLIENT_SECRET=<64 char secret>
MP_REDIRECT_URI=https://app-kiosco-chi.vercel.app/api/mercadopago/oauth/callback

# Encryption (32 bytes = 64 hex characters)
MP_ENCRYPTION_KEY=<generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# Webhook
MP_WEBHOOK_SECRET=<token secreto para HMAC verification>
```

**Cómo generar `MP_ENCRYPTION_KEY`**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6... (64 caracteres exactos)
```

### Tablas

#### `mercadopago_credentials`
```sql
CREATE TABLE mercadopago_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  access_token_encrypted TEXT NOT NULL,
  user_id_mp BIGINT NOT NULL,
  email_mp VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP,
  UNIQUE(org_id, user_id)
);

ALTER TABLE mercadopago_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY mercadopago_credentials_org_isolation ON mercadopago_credentials
  FOR ALL USING (get_my_org_id() = org_id);
```

#### `mercadopago_orders`
```sql
CREATE TABLE mercadopago_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  external_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  qr_data TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, expired
  payment_id BIGINT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP,
  UNIQUE(org_id, external_id)
);

ALTER TABLE mercadopago_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY mercadopago_orders_org_isolation ON mercadopago_orders
  FOR ALL USING (get_my_org_id() = org_id);
```

### Endpoints

#### OAuth Flow
```
GET /api/mercadopago/oauth/authorize
  → Redirige a https://auth.mercadopago.com/oauth/authorize?...
  → Usuario autoriza
  → Callback: /api/mercadopago/oauth/callback?code=CODE

/api/mercadopago/oauth/callback
  Method: GET
  Query: code (authorization code)
  Response: { success: boolean; orgId: string; error?: string }
  Acción: Intercambia code por access_token, lo cifra, lo guarda en DB
```

**Archivo**: `app/api/mercadopago/oauth/callback/route.ts`

#### QR Creation
```
POST /api/mercadopago/qr/create
  Body: { amount: number; description?: string }
  Response: { success: boolean; qrData: string; externalId: string; error?: string }
  Acción: Crea orden en MP con Wallet Connect, obtiene QR, lo guarda en DB
```

**Archivo**: `lib/actions/mercadopago.actions.ts` → `createMercadoPagoQr()`

#### Webhook
```
POST /api/mercadopago/webhook
  Header: x-signature (HMAC-SHA256)
  Body: { action: "payment.created", data: { id: ..., status: ... }, ... }
  Response: { received: true }
  Acción: Verifica firma HMAC, actualiza orden en DB a "approved"
```

**Archivo**: `app/api/mercadopago/webhook/route.ts`

**Verificación HMAC**:
```typescript
import crypto from 'crypto'

const signature = req.headers['x-signature'] as string
const secret = process.env.MP_WEBHOOK_SECRET

const computed = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(body))
  .digest('hex')

if (computed !== signature) {
  return new Response('Unauthorized', { status: 401 })
}
```

### Componentes UI

#### Dialog QR (`components/mercadopago-qr-dialog.tsx`)
```typescript
<MercadoPagoQRDialog
  amount={1500}
  description="Venta en caja"
  onSuccess={(orderId) => console.log('Pagado:', orderId)}
  onCancel={() => console.log('Cancelado')}
/>
```

**Comportamiento**:
- Abre modal con QR
- Polling cada 2s para status
- Timeout: 5 minutos
- QR expira: 30 minutos
- Cierra automático al confirmar pago

#### Configuration Form (hidden in Settings)
```typescript
// app/dashboard/ajustes/page.tsx
// Sección "Configuración avanzada" (hidden)
// Botón: "Conectar con Mercado Pago"
// Flujo: Redirige a /api/mercadopago/oauth/authorize
```

### Flujo Completo de Pago

```
1. Usuario toca botón "Pagar con MP" en caja
   ↓
2. Dialog abre, llama createMercadoPagoQr()
   ↓
3. Server action: crear orden en MP, obtener QR
   ↓
4. QR se muestra en dialog
   ↓
5. Cliente hace scan del QR con su celular
   ↓
6. MP procesa pago
   ↓
7. MP envía webhook a /api/mercadopago/webhook
   ↓
8. Handler verifica HMAC, actualiza orden a "approved"
   ↓
9. Cliente polling detecta status=approved, cierra dialog
   ↓
10. Venta se registra como "pagada"
```

### Testing

**Manual E2E**:
1. Crear organización de prueba
2. Conectar con Mercado Pago (cuenta test)
3. Crear una venta
4. Pagar con QR desde app test MP (usar app celular)
5. Verificar que orden pasa a "approved" en 2-5s

**Para verificar webhook**:
```bash
# Simular webhook localmente
curl -X POST http://localhost:3000/api/mercadopago/webhook \
  -H "Content-Type: application/json" \
  -H "x-signature: <HMAC computed>" \
  -d '{"action": "payment.created", "data": {...}}'
```

---

## SUBE (Virtual Service)

**Estado**: FUNCIONAL desde febrero 2026

### Descripción
Integración con servicio de recarga SUBE (transporte público en Argentina). Permite cargar tarjetas SUBE directamente desde la app.

### Tablas

#### `service_sales` (compartida con Cargas Virtuales)
```sql
CREATE TABLE service_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID REFERENCES branches(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  amount DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'completed', -- completed, pending, failed
  reference_code VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE service_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_sales_org_isolation ON service_sales
  FOR ALL USING (get_my_org_id() = org_id);
```

### Provider Lookup

```typescript
// lib/actions/service.actions.ts → fetchProviders()
const { data: providers } = await supabase
  .from('providers')
  .select('*')
  .eq('org_id', orgId)
  .ilike('name', '%SUBE%') // buscar por SUBE
```

### Componente

```typescript
// components/widget-sube.tsx
<SUBEWidget
  onSuccess={(sale) => console.log('SUBE cargada:', sale)}
/>
```

**Flujo**:
1. Usuario abre widget SUBE
2. Ingresa monto a cargar
3. Selecciona proveedor (si hay múltiples)
4. Confirma
5. Venta se registra en service_sales
6. Comisión se calcula automáticamente según proveedor.markup_type/markup_value

### Comisión

```typescript
// Cada proveedor de SUBE tiene:
// markup_type: 'percentage' | 'fixed'
// markup_value: number (ej: 2.5 para 2.5%, o 50 para $50 fijo)

const commission = isSUBE
  ? provider.markup_type === 'percentage'
    ? (amount * Number(provider.markup_value)) / 100
    : Number(provider.markup_value)
  : 0
```

---

## Cargas Virtuales (Recargas Telefónicas y más)

**Estado**: FUNCIONAL desde enero 2026

### Descripción
Recargas de crédito telefónico (Claro, Movistar, Personal), datos, servicios de streaming, etc. Permitirá que el kiosquero venda servicios virtuales con comisión.

### Tablas

**Compartida con SUBE**: `service_sales` (ver arriba)

### Provider Lookup

```typescript
// lib/actions/service.actions.ts → fetchProviders()
// Cargas Virtuales = todos excepto SUBE

const { data: providers } = await supabase
  .from('providers')
  .select('*')
  .eq('org_id', orgId)
  .not('name', 'ilike', '%SUBE%') // excluir SUBE
```

### Componente

```typescript
// components/widget-servicios.tsx
<VirtualServicesWidget
  onSuccess={(sale) => console.log('Servicio vendido:', sale)}
/>
```

**Flujo**:
1. Usuario abre widget de servicios
2. Selecciona tipo (Recarga claro/movistar/personal, datos, etc.)
3. Ingresa número y monto
4. Confirma
5. Venta se registra con comisión

### Comisión

```typescript
// Idéntico a SUBE
const commission = provider.markup_type === 'percentage'
  ? (amount * Number(provider.markup_value)) / 100
  : Number(provider.markup_value)
```

### Providers Ejemplo

| Nombre | Tipo | Comisión | Status |
|--------|------|----------|--------|
| Claro Recargas | Recarga | 2.5% | Activo |
| Movistar Recargas | Recarga | 2.5% | Activo |
| Personal Recargas | Recarga | 2.5% | Activo |
| Netflix | Streaming | 2% | Activo |
| Spotify | Streaming | 2% | Activo |

---

## Supabase

**Estado**: FUNCIONAL (production-ready)

### Project Details
```
Project ID: vrgexonzlrdptrplqpri
Región: sa-east-1 (São Paulo)
Organization: App Kiosco
```

### Auth
```
Flow: PKCE (Proof Key for Code Exchange)
Provider: Supabase Auth con OAuth2
Session: Cookies (HttpOnly, Secure)
```

### RLS (Row Level Security)

Todas las 23 tablas tienen RLS enabled con política de `org_id`:

```sql
-- Patrón estándar
CREATE POLICY table_name_org_isolation ON table_name
  FOR ALL USING (get_my_org_id() = org_id);

-- Función helper
CREATE OR REPLACE FUNCTION get_my_org_id() RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'app_metadata')::json ->> 'org_id'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Tablas Principales

| Tabla | Rows | RLS | Status |
|-------|------|-----|--------|
| organizations | 1-10 | ✓ | Active |
| memberships | 5-50 | ✓ | Active |
| users | 5-50 | ✓ | Active |
| branches | 5-20 | ✓ | Active |
| products | 100-500 | ✓ | Active |
| inventory | 100-500 | ✓ | Active |
| sales | 1000+ | ✓ | Active |
| providers | 10-50 | ✓ | Active |
| service_sales | 100+ | ✓ | Active |
| mercadopago_credentials | 1-5 | ✓ | Active |
| mercadopago_orders | 100+ | ✓ | Active |
| ... | ... | ... | ... |

### Backups

Supabase realiza backups automáticos:
- Diarios (7 días de retención)
- Semanales (4 semanas de retención)
- Mensuales (12 meses de retención)

Ver en Supabase Dashboard > Backups

---

## Vercel

**Estado**: FUNCIONAL (production-ready)

### Detalles del Proyecto
```
Team: App Kiosco (team_sPJMb8vptJoaoXAlJOwFDS7d)
Project: app-kiosco-chi
Domain: app-kiosco-chi.vercel.app
Framework: Next.js App Router
```

### Deployment

```
Trigger: Push a main
Environment: Production
Build: ~2-3 minutos
Edge Network: Vercel's global CDN
```

### Variables de Entorno (en Vercel)

```
Environments: Production, Preview, Development
Secrets: MP_CLIENT_SECRET, MP_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY (encrypted)
```

### Logs

Acceder en Vercel Dashboard > app-kiosco-chi > Logs:
- **Build Logs**: errores durante build
- **Runtime Logs**: errores durante ejecución (Errors, Warnings)
- **Edge Network Logs**: requests a la CDN

---

## Resumen de Estado

| Integración | Estado | Crítica | Testing |
|-------------|--------|---------|---------|
| Supabase Auth | ✓ Production | ✓ Crítica | ✓ Manual |
| Supabase DB | ✓ Production | ✓ Crítica | ✓ Manual |
| Mercado Pago QR | ✓ Implementado | ✓ Crítica | ⚠️ E2E Pending |
| SUBE | ✓ Funcional | Opcional | ✓ Manual |
| Cargas Virtuales | ✓ Funcional | Opcional | ✓ Manual |
| Vercel Deploy | ✓ Production | ✓ Crítica | ✓ Automático |

---

## Próximas Integraciones (Roadmap)

### Facturación AFIP/ARCA (Descartado por ahora)
- Decisión: La app es gestión, no facturación fiscal
- Si se necesita: integrar con servicio existente (Facturalo Simple, Alegra)

### Offline + Sync (Planificado)
- PWA con service worker
- LocalStorage/IndexedDB para datos offline
- Sync automático al reconectar

### Balanzas de peso (No implementar)
- Hardware propietario
- Fuera de scope actual

