# Kiosco SaaS - Complete Feature Mapping & E2E Test Plan

**Last Updated:** 2026-03-04
**App Type:** Next.js 14+ PWA with Supabase Backend
**Database Schema:** V2 (PostgreSQL with English table names)
**Authentication:** Supabase Auth (Password, Magic Link, OTP)

---

## Table of Contents

1. [Authentication & Onboarding](#authentication--onboarding)
2. [Owner Dashboard](#owner-dashboard)
3. [Employee Dashboard](#employee-dashboard)
4. [Stock & Inventory Management](#stock--inventory-management)
5. [Sales & Cash Register](#sales--cash-register)
6. [Attendance & Timekeeping (Fichaje)](#attendance--timekeeping-fichaje)
7. [Employee Management](#employee-management)
8. [Providers & Services](#providers--services)
9. [Gamification & Missions](#gamification--missions)
10. [Invoicing & Reports](#invoicing--reports)
11. [Onboarding Wizard](#onboarding-wizard)
12. [Data Models](#data-models)

---

## AUTHENTICATION & ONBOARDING

### Entry Point: `/` (Home Page)

**File:** `/app/page.tsx`

#### Routing Logic

1. **No Session** → Show `AuthForm`
2. **Session + No Profile** → Show `ProfileSetup`
3. **Session + Profile + No Branch** → Either:
   - Employee: Show QR Scanner (`EscanearQRFichaje`)
   - Owner (No branches): Show `OnboardingWizard`
   - Owner (Has branches): Show `SeleccionarSucursal`
4. **Session + Profile + Branch Selected** → Show:
   - Owner: `DashboardDueno`
   - Employee: `VistaEmpleado`

#### State Management

- **Session State:** Supabase auth session
- **User Profile:** Loaded from `memberships` table
- **Branch Selection:** Can be from:
  - URL param `?sucursal_id=xxx` (from QR redirects)
  - Active attendance record (for employees)
  - Manual selection via `SeleccionarSucursal`

---

### 1.1 Authentication Form

**File:** `/components/auth-form.tsx`
**Actions:** `auth.actions.ts`

#### Features

| Feature | Action | Input | Output |
|---------|--------|-------|--------|
| **Login with Password** | `signInWithPasswordAction` | email, password | success/error, redirects to `/` |
| **Register (Owner)** | `signUpAction` | email, password (min 6 chars) | Account created, show login |
| **Magic Link (Employee)** | `signInWithMagicLinkAction` | email | Email sent, auto-redirects on click |
| **Reset Password** | `resetPasswordAction` | email | Recovery link sent |

#### Validation Rules

- Email format validation
- Password minimum 6 characters
- Email normalization (lowercase, trimmed)

#### Buttons/Actions Available

- Toggle Login/Register mode
- "Forgot Password?" → Reset flow
- "Sign in with Magic Link" → For employees
- "Sign in with Password" → For owners/existing users

---

### 1.2 Profile Setup (Onboarding)

**File:** `/components/profile-setup.tsx`
**Actions:** `auth.actions.ts` → `completeProfileSetupAction`

#### Flow

1. User selects Role:
   - **Dueño (Owner):** Creates org + membership via `setup_organization()` RPC
   - **Empleado (Employee):** Accepts invite via `accept_invite()` RPC

2. **For Owners:**
   - Input: Name, Email (prefilled from auth)
   - Creates: Organization + First branch + Membership
   - Role set to: `owner`

3. **For Employees:**
   - Input: Name, Email
   - Requires: Valid pending invite (token-based)
   - Sets: role to `employee`, branch_id from invite
   - Verifies: Invite not expired

#### Data Created

```
Owners:
- organizations table
- branches table (initial)
- memberships table (role: owner, xp: 0)

Employees:
- memberships table (role: employee, branch_id set)
- pending_invites marked as accepted
```

#### Validation

- Name minimum 3 characters
- Email required
- For employees: Invite token must be valid and not expired

---

## OWNER DASHBOARD

### 2.1 Main Dashboard

**File:** `/components/dashboard-dueno.tsx`
**Data Hook:** `useDashboardData` + `useDashboardState`

#### Dashboard Tabs

1. **Alertas (Alerts)**
   - Low stock warnings (< 5 units)
   - Expiring products (< 7 days)
   - Outstanding provider balances

2. **Inventario (Inventory)**
   - Product catalog with stock levels
   - Add/Edit/Delete products
   - View stock batches per branch
   - Price history per product
   - Expiration date tracking

3. **Ventas (Sales)**
   - Daily sales chart
   - Recent sales list with timestamps
   - Payment method breakdown
   - Top products by quantity
   - Sales filtering by date range

4. **Finanzas (Finance)**
   - Gross revenue
   - Net profit
   - Profit margin %
   - ROI calculation
   - Payment method breakdown (Cash/Card/Transfer/Wallet)
   - Traceable vs Cash metrics

5. **Supervisión (Supervision)**
   - Employee rankings (by XP/missions)
   - Team performance metrics
   - Active shifts status
   - Attendance tracking

#### Key Features

- **Date Range Picker:** Filter data by custom date range
- **Branch Selector:** Switch between branches
- **Real-time Updates:** Auto-refresh every 30 seconds
- **Export Options:** Generate PDFs and reports

#### Buttons/Actions Available

- **Crear Producto** (Create Product)
- **Agregar Stock** (Add Stock)
- **Generar QR Fichaje** (Generate QR for timekeeping)
- **Gestión Proveedores** (Provider Management)
- **Invitar Empleado** (Invite Employee)
- **Team Ranking** (View gamification)
- **Reportes** (Generate reports)

---

### 2.2 Create Product

**File:** `/components/crear-producto.tsx`
**Action:** `product.actions.ts` → `createFullProductAction`

#### Form Fields

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| Código de Barras | Text | No | Check for duplicates |
| Nombre | Text | Yes | Min 3 characters |
| Categoría | Select | Yes | Pre-defined list |
| Precio de Venta | Number | Yes | > 0 |
| Costo | Number | Yes | > 0 |
| Emoji | Select | Yes | Visual identifier |
| Fecha Vencimiento | Date | No | For expiring products |
| Cantidad Inicial | Number | Yes | >= 0 |

#### Process

1. Check if product exists by barcode
2. Create `products` record
3. Create `price_history` entry
4. Create initial `stock_batches` entry
5. Toast notification on success

#### Database Records Created

- `products` row
- `price_history` row (tracks price changes)
- `stock_batches` row (tracks inventory batches)

#### Barcode Scanner

- Integrated HTML5 QR code reader
- Supports: EAN-13, EAN-8, CODE-128, UPC-A, QR codes
- Camera permission required

---

### 2.3 Manage Stock

**File:** `/components/agregar-stock.tsx`
**Action:** `inventory.actions.ts`

#### Features

- View current stock per branch
- Add stock batches with expiration dates
- Track stock history
- View cost basis for FIFO calculations

#### Process

1. Select product (search by name/barcode)
2. Enter quantity and expiration date
3. Confirm location (branch)
4. Creates `stock_batches` record
5. Updates stock availability in views

---

### 2.4 Supplier/Provider Management

**File:** `/components/gestion-proveedores.tsx` + `/components/control-saldo-proveedor.tsx`
**Actions:** `provider.actions.ts`

#### Features

| Feature | Action | Input | Output |
|---------|--------|-------|--------|
| **List Providers** | `getServiceProvidersAction` | - | Array of providers + balances |
| **Create Provider** | `createProviderAction` | Name, phone, email, tax_id | Provider ID |
| **Recharge Balance** | `rechargeProviderBalanceAction` | Provider ID, amount | Updated balance |
| **Service Widgets** | N/A | UI components | SUBE, Call centers, etc. |

#### Service Providers

- SUBE (Subway card recharge)
- Virtual recharges
- Utility payments
- Custom local providers

#### Provider Fields

- Name
- Tax ID (CUIT/DNI)
- Contact name
- Phone
- Email
- Payment terms
- Balance (current funds held)

#### Balance Management

- Track funds held with provider
- Recharge balance from cash
- Deduct from balance for services
- Audit trail of movements

---

## EMPLOYEE DASHBOARD

### 3.1 Employee View

**File:** `/components/vista-empleado.tsx`
**Action:** `user.actions.ts` → `getEmployeeDashboardContextAction`

#### Main Sections

1. **Header with Profile**
   - Employee name
   - XP bar with level progression
   - Current branch name
   - Location indicator

2. **Caja (Cash Register) Tab**
   - Open shift button
   - Sales interface (CajaVentas component)
   - Shift summary if active
   - Arqueo (Cash audit) if closing

3. **Misiones (Missions) Tab**
   - Assigned missions
   - Progress tracking
   - XP rewards
   - Mission completion

4. **Vencimientos (Expiring Products) Tab**
   - Products expiring soon (< 7 days)
   - Batch details
   - Help with product placement

#### State Tracking

- **Attendance:** Checked from `attendance` table (check_out IS NULL)
- **Active Shift:** Loaded from `cash_registers` (is_open = true)
- **XP Level:** XP_PER_LEVEL = 3000, Level = XP ÷ 3000 + 1

#### Buttons/Actions Available

- **Abrir Turno** (Open Shift)
- **Cerrar Turno** (Close Shift with Arqueo)
- **Registrar Movimiento** (Record cash movement)
- **Escanear QR Fichaje** (Clock in/out)
- **Ver Misiones** (View gamification tasks)

---

### 3.2 Sales Interface (Caja Ventas)

**File:** `/components/caja-ventas.tsx`
**Actions:** `ventas.actions.ts`
**Hooks:** `useOfflineVentas`, `useCart`

#### Offline Support

- Full offline mode detection
- Local product cache
- Queued sales stored in IndexedDB
- Auto-sync when online
- Sync status indicator

#### Sale Process

1. **Search Products:**
   - By name (ilike search)
   - By barcode (scanner or manual)
   - Excludes service-type products
   - Shows real-time stock availability

2. **Build Cart:**
   - Add items with quantity
   - Modify quantity (+ -)
   - Remove items
   - View subtotal

3. **Select Payment Method:**
   - Cash (Efectivo)
   - Card (Tarjeta)
   - Wallet/Digital (Billetera)
   - Transfer (Transferencia)

4. **Confirm Sale:**
   - `confirmSaleAction` via `process_sale` RPC
   - Deducts stock (FIFO from batches)
   - Creates sales record
   - Creates cash movement
   - Grants XP to employee

5. **Optional:**
   - Print receipt (PDF via `generarTicketVenta`)
   - Local receipt saved in browser

#### Database Impact

- `sales` record created
- `sale_items` records created
- `stock_batches` quantity decremented
- `cash_movements` record (if cash method)
- Employee XP incremented

#### Cart Data Structure

```typescript
CartItem {
  id: string
  name: string
  price: number
  stock: number
  barcode?: string
  emoji?: string
  quantity: number
  subtotal: number
}
```

#### Validation Rules

- Product must have stock available
- Quantity must be positive
- Payment method must be selected
- Sale total must be > 0

---

### 3.3 Cash Register Management

**File:** `/components/arqueo-caja.tsx`
**Actions:** `shift.actions.ts`, `cash.actions.ts`

#### Shift Lifecycle

1. **Open Shift** (`abrirCajaAction`)
   - Input: Opening amount (efectivo en caja)
   - Creates: `cash_registers` record with is_open = true
   - Effect: Employee can now record sales

2. **During Shift:**
   - Sales create cash movements (type: sale)
   - Manual income/expense movements recorded
   - Balance tracked real-time

3. **Close Shift** (`cerrarCajaAction`)
   - Input: Declared final amount
   - Calculates: Expected amount from:
     - Opening amount
     - + Cash sales total
     - + Income movements
     - - Expense movements
   - Compare: Declared vs Expected
   - Audit fields:
     - `exitoArqueo`: Boolean (discrepancy <= 5 ARS?)
     - `desvio`: Difference amount
   - Updates: `cash_registers` is_open = false, closed_at

#### Cash Movements

**Type:** Income | Expense | Opening | Closing | Adjustment

#### Buttons/Actions Available

- **Abrir Caja** (Open shift)
- **Registrar Movimiento** (Add income/expense)
- **Cerrar Caja** (Trigger arqueo)
- **Ver Historial** (View shift movements)

---

### 3.4 Register Cash Movements

**File:** `/components/registrar-movimientos.tsx`
**Action:** `cash.actions.ts` → `createCashMovementAction`

#### Movement Types

| Type | Purpose | Amount | Category |
|------|---------|--------|----------|
| Income | Extra money deposited | Positive | Custom (service, refund, etc.) |
| Expense | Money withdrawn | Negative | Custom (break, supplies, etc.) |
| Adjustment | Manual correction | Positive/Negative | Audit note |

#### Form Fields

- **Type:** Select (Ingreso/Egreso/Ajuste)
- **Amount:** Number (required, > 0)
- **Description:** Text (optional)
- **Category:** Text (optional)

#### Database Record

```
cash_movements {
  id, organization_id, cash_register_id, amount,
  type, description, category, user_id, created_at
}
```

---

## ATTENDANCE & TIMEKEEPING (FICHAJE)

### 4.1 QR-Based Attendance

**File:** `/app/fichaje/page.tsx`
**Action:** Called via URL redirect from QR code

#### QR Code Format

```
https://app.com/fichaje?sucursal_id=BRANCH_ID&tipo=entrada
https://app.com/fichaje?sucursal_id=BRANCH_ID&tipo=salida
```

#### Attendance Process

1. **Employee scans QR** (via phone/kiosk)
2. **System validates:**
   - Branch exists and is_active
   - User is employee (not owner)
   - User belongs to organization
   - Check-in/out logic enforced

3. **Entrada (Check-in):**
   - Validates: No active attendance in ANY branch
   - Creates: `attendance` record with check_in = now, check_out = NULL
   - Redirects: `/?sucursal_id=BRANCH_ID`

4. **Salida (Check-out):**
   - Validates: Active attendance in same branch exists
   - Updates: attendance record set check_out = now
   - Calculates: Hours worked (for reporting)
   - Redirects: `/?sucursal_id=BRANCH_ID`

#### Database Record

```
attendance {
  id, organization_id, branch_id, user_id,
  check_in, check_out, created_at
}
```

#### Validation Rules

- Employee cannot have multiple active check-ins
- Check-out requires matching branch
- QR must not be expired
- Branch must be active

#### Success/Error Messages

- ✅ "Entrada registrada"
- ✅ "Salida registrada"
- ❌ "Ya tienes una entrada registrada"
- ❌ "No tienes una entrada para cerrar"
- ❌ "Tu entrada fue registrada en otro local"

---

### 4.2 Manual QR Generation for Owner

**File:** `/components/generar-qr-fichaje.tsx`
**Action:** `branch.actions.ts` → `updateBranchQRAction`

#### Features

- Generate entry QR for branch
- Generate exit QR for branch
- Display QRs for printing/posting
- Update QR URLs in database

#### Process

1. Select branch
2. Generate QR link with parameters
3. Create QR code image
4. Save URL to `branches.qr_entry_url` or `qr_exit_url`
5. Display for owner to print/share

---

### 4.3 Clock In/Out Button (Manual)

**File:** `/components/reloj-control.tsx`
**Action:** Manual clock via button (fallback if QR unavailable)

#### UI

- Shows current status (In/Out)
- Big button to toggle
- Confirmation dialog
- Last clock time displayed

#### Database Impact

Same as QR: Creates/updates `attendance` record

---

## EMPLOYEE MANAGEMENT

### 5.1 Invite Employee

**File:** `/components/invitar-empleado.tsx`
**Action:** `auth.actions.ts` → `inviteEmployeeAction`

#### Flow

1. Owner enters employee email
2. Selects branch to assign
3. System creates:
   - `pending_invites` record with token
   - Expires in 7 days
4. Sends magic link email to employee:
   - `https://app.com/signup?token=INVITE_TOKEN`
5. Employee clicks link → `ProfileSetup` with role = empleado
6. Employee completes setup → `accept_invite()` RPC
7. Invitation marked as accepted
8. Employee account created with branch assignment

#### Database Records

```
pending_invites {
  id, email, token, organization_id, branch_id,
  expires_at, invited_by, created_at
}
```

#### Validation Rules

- Email must be valid format
- Branch must be selected
- Email can only have one pending invite
- Invite expires after 7 days

#### Success Message

"Invitación enviada. Se vinculará automáticamente al kiosco asignado."

---

### 5.2 View Staff Management

**File:** `/components/invitar-empleado.tsx` (same component)
**Action:** `auth.actions.ts` → `getStaffManagementDataAction`

#### Shows

1. **Pending Invites:**
   - Email, created date, assigned branch
   - Cancel invite button

2. **Active Employees:**
   - Name, email, branch, role
   - Remove employee button

#### Actions

| Button | Action | Effect |
|--------|--------|--------|
| Cancel Invite | `cancelInviteAction` | Deletes pending_invites record |
| Remove Employee | `removeEmployeeAction` | Sets is_active = false in memberships |

#### Soft Delete

Removing employee sets `memberships.is_active = false`
Does NOT delete data, only deactivates access

---

## STOCK & INVENTORY MANAGEMENT

### 6.1 Product Scan

**File:** Multiple components
**Action:** `inventory.actions.ts` → `handleProductScan`

#### Scanner Integration

- HTML5 barcode reader
- Real-time product lookup
- Shows stock availability per branch
- Supports EAN-13, EAN-8, CODE-128

#### Process

1. Scan barcode OR enter manually
2. Search products table
3. Return product + available stock
4. Show in cart/details modal

#### Result Types

```typescript
ProductFoundResult {
  status: 'FOUND'
  producto: Product
  stockDisponible: number
}

ProductNotFoundResult {
  status: 'NOT_FOUND'
  barcode: string
  message: string
}

ProductScanError {
  status: 'ERROR'
  error: string
  details?: string
}
```

---

### 6.2 Stock Batches (FIFO)

**Files:** Multiple components
**Tables:** `stock_batches`, `v_products_with_stock`

#### Batch Tracking

- Each stock entry is a batch with:
  - Quantity
  - Cost per unit
  - Expiration date
  - Branch location
  - Created date

#### FIFO Deduction

When sale occurs:
1. Find oldest batch with available quantity
2. Deduct quantity from batch
3. Move to next batch if exhausted
4. Update calculated stock view

#### Stock View

`v_products_with_stock` - Virtual table showing:
- Product ID, name, price, emoji
- Total available stock per branch
- Real-time calculation from batches

---

## SALES & CASH REGISTER

### 7.1 Complete Sale Flow

**Action:** `ventas.actions.ts` → `confirmSaleAction`

#### Input Parameters

```typescript
{
  branchId: string
  cashRegisterId: string
  items: [
    {
      product_id: string
      quantity: number
      unit_price: number
      subtotal: number
    }
  ]
  paymentMethod: 'cash' | 'card' | 'transfer' | 'wallet'
  total: number
  localId?: string  // For offline sync
  notes?: string
}
```

#### RPC: `process_sale`

Executes atomically:
1. Validate stock availability
2. Deduct stock (FIFO from batches)
3. Create `sales` record
4. Create `sale_items` records
5. Update `cash_registers` total_cash_sales (if cash method)
6. Create `cash_movements` record
7. Award employee XP

#### Return Values

```typescript
{
  success: boolean
  saleId?: string
  error?: string
}
```

#### Edge Cases

- No stock: Reject with message
- Offline: Save to IndexedDB, sync later
- Duplicate prevention: Uses `local_id` idempotency key

---

### 7.2 Receipt Generation

**File:** `/lib/generar-ticket.ts`

#### Features

- PDF generation via jsPDF + html2canvas
- Thermal printer format (80mm)
- QR code for sale reference
- Receipt number, date, items, total
- Payment method shown
- Employee name shown

#### Trigger

- Optional checkbox in CajaVentas
- Manual download available
- Auto-print available

---

## GAMIFICATION & MISSIONS

### 8.1 XP System

**Database Field:** `memberships.xp` (Integer)

#### Mechanics

- 3000 XP per level
- Current level = ⌊XP ÷ 3000⌋ + 1
- Progress bar shows (XP % 3000) ÷ 3000

#### XP Sources

1. **Per Sale:** +10 XP (automatic via `process_sale`)
2. **Mission Completion:** +50 to +500 XP (varies)
3. **Shift Closure:** +50 XP (if arqueo successful)

#### Display

- Employee dashboard shows current XP
- Progress bar to next level
- Level badge in header

---

### 8.2 Missions

**Files:** `/components/misiones-empleado.tsx`, `/components/asignar-mision.tsx`
**Action:** `missions.actions.ts`

#### Mission Types

1. **Recurring (Rutinas):**
   - Daily template
   - Assigned automatically
   - Auto-completion tracking

2. **One-Time (Misiones):**
   - Assigned by owner
   - Manual completion by employee
   - Custom XP value

#### Mission Data

```typescript
{
  id: string
  tipo: 'mision' | 'rutina'
  descripcion: string
  objetivo_unidades: number  // Task quantity
  unidades_completadas: number  // Progress
  es_completada: boolean
  puntos: number  // XP reward
  caja_diaria_id: string | null  // Shift if tied
  created_at: string
}
```

#### Mission Process

1. Owner creates mission: `createMissionAction`
2. Employee views in Misiones tab
3. Employee marks complete: `completeMissionAction`
4. System grants XP
5. Shows in personal ranking

#### Creation Fields

- Description (text)
- Points (XP reward)
- Recurring? (yes/no)
- Assigned branch (optional)
- Assigned shift (optional)
- Employee (if targeting specific)

---

### 8.3 Team Ranking

**File:** `/components/team-ranking.tsx`

#### Display

- All active employees ranked by XP
- Current level shown
- XP progress bar
- Promotion indicators
- Recent XP gains highlighted

#### Updates

- Real-time via subscription
- Refreshes every minute
- Sorted descending by XP

---

## INVOICING & REPORTS

### 9.1 Invoicing System

**File:** `/components/facturacion/`
**Action:** `invoicing.actions.ts`

#### Status

**Note:** Feature partially implemented
- Server actions defined
- Components scaffolded
- ARCA integration pending

#### Intended Flow

1. Owner selects sales to invoice
2. Groups into invoice batch
3. System assigns invoice number
4. Validates with ARCA (Argentine tax authority)
5. Stores invoice record
6. Marks sales as invoiced

#### Invoice Data

- Invoice number (auto-assigned)
- Customer info (optional)
- Itemized sales
- Tax calculation (IVA, etc.)
- Total amount
- Date issued

---

### 9.2 Reports

**File:** `/components/reports/index.tsx`
**Action:** `reports.actions.ts`

#### Report Types

1. **Sales Report:**
   - Date range filter
   - By payment method
   - Item count
   - Employee responsible
   - Summary totals

2. **Cash Register Report:**
   - Shift opening/closing
   - All movements during shift
   - Sales totals
   - Discrepancies
   - Employee signature

#### Data Structure

```typescript
SalesReportData {
  sales: {
    id, date, total, paymentMethod, itemCount, employeeName
  }[]
  summary: {
    totalSales, totalAmount,
    byPaymentMethod: { count, amount }[]
  }
  period: { from, to }
}
```

#### Export Options

- PDF download
- CSV export
- Print preview

---

## ONBOARDING WIZARD

### 10.1 First-Time Setup (Owner)

**File:** `/components/onboarding-wizard.tsx`
**Action:** `branch.actions.ts` → `createBranchAction`

#### Steps

1. **Welcome Screen**
   - Explanation of next steps
   - Icon/visual guide

2. **Create First Branch**
   - Branch name (required)
   - Address (optional)
   - Creates branch record

3. **Add Products**
   - Option to create first product
   - Links to `CrearProducto`

4. **Invite First Employee**
   - Links to `InvitarEmpleado`
   - Explains magic link process

5. **Set Up QR Codes**
   - Generate entry/exit QRs
   - Instructions for printing

6. **Completion**
   - "Let's go!" button
   - Redirects to dashboard

#### Database Impact

- Creates `branches` record
- Optional: `products` records
- Optional: `pending_invites` records
- Optional: Updates `branches.qr_entry_url`, `qr_exit_url`

---

## BRANCH SELECTION

**File:** `/components/seleccionar-sucursal.tsx`

#### Features

- Shows all active branches
- Click to select
- Displays Quick KPI Snapshot:
  - Sales today
  - Transaction count
  - Low stock products

#### Process

1. Owner logs in with multiple branches
2. See branch list
3. Click branch → Set sucursalId state
4. Redirects to DashboardDueno with branch context

#### KPI Snapshot

```typescript
QuickSnapshot {
  success: boolean
  ventasHoy: number
  cantVentas: number
  productosStockBajo: number
}
```

---

## DATA MODELS

### Core Tables (Schema V2)

#### Memberships (User-Organization-Branch Link)

```sql
memberships {
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  organization_id UUID
  branch_id UUID REFERENCES branches (nullable)
  role TEXT ('owner' | 'admin' | 'employee')
  display_name TEXT
  email TEXT
  xp INTEGER DEFAULT 0
  is_active BOOLEAN DEFAULT true
  created_at TIMESTAMP
}
```

**Indexes:** user_id, organization_id, branch_id, is_active

#### Organizations

```sql
organizations {
  id UUID PRIMARY KEY
  name TEXT
  owner_id UUID REFERENCES auth.users
  created_at TIMESTAMP
}
```

#### Branches

```sql
branches {
  id UUID PRIMARY KEY
  organization_id UUID
  name TEXT
  address TEXT
  qr_entry_url TEXT
  qr_exit_url TEXT
  is_active BOOLEAN DEFAULT true
  created_at TIMESTAMP
}
```

#### Products

```sql
products {
  id UUID PRIMARY KEY
  organization_id UUID
  name TEXT
  barcode TEXT
  category TEXT
  price_venta DECIMAL
  costo DECIMAL
  emoji TEXT
  is_active BOOLEAN DEFAULT true
  created_at TIMESTAMP
}
```

#### Stock Batches (FIFO Queue)

```sql
stock_batches {
  id UUID PRIMARY KEY
  product_id UUID
  branch_id UUID
  quantity INTEGER
  cost_per_unit DECIMAL
  expiration_date DATE (nullable)
  created_at TIMESTAMP
}
```

#### Sales

```sql
sales {
  id UUID PRIMARY KEY
  organization_id UUID
  branch_id UUID
  cash_register_id UUID
  seller_id UUID (employee who made sale)
  payment_method TEXT ('cash' | 'card' | 'transfer' | 'wallet')
  total DECIMAL
  local_id TEXT (for offline idempotency)
  notes TEXT
  created_at TIMESTAMP
}
```

#### Sale Items

```sql
sale_items {
  id UUID PRIMARY KEY
  sale_id UUID
  product_id UUID
  quantity INTEGER
  unit_price DECIMAL
  subtotal DECIMAL
  created_at TIMESTAMP
}
```

#### Cash Registers (Shifts)

```sql
cash_registers {
  id UUID PRIMARY KEY
  organization_id UUID
  branch_id UUID
  opened_by UUID (employee)
  opening_amount DECIMAL
  closing_amount DECIMAL (nullable)
  opened_at TIMESTAMP
  closed_at TIMESTAMP (nullable)
  is_open BOOLEAN DEFAULT true
  created_at TIMESTAMP
}
```

#### Cash Movements

```sql
cash_movements {
  id UUID PRIMARY KEY
  organization_id UUID
  cash_register_id UUID
  amount DECIMAL
  type TEXT ('income' | 'expense' | 'opening' | 'closing' | 'adjustment' | 'sale')
  description TEXT
  category TEXT
  user_id UUID
  created_at TIMESTAMP
}
```

#### Attendance

```sql
attendance {
  id UUID PRIMARY KEY
  organization_id UUID
  branch_id UUID
  user_id UUID
  check_in TIMESTAMP
  check_out TIMESTAMP (nullable)
  created_at TIMESTAMP
}
```

#### Missions

```sql
missions {
  id UUID PRIMARY KEY
  organization_id UUID
  employee_id UUID
  descripcion TEXT
  objetivo_unidades INTEGER
  unidades_completadas INTEGER DEFAULT 0
  es_completada BOOLEAN DEFAULT false
  puntos INTEGER
  es_recurrente BOOLEAN DEFAULT false
  caja_diaria_id UUID (nullable)
  created_at TIMESTAMP
}
```

#### Providers

```sql
suppliers {
  id UUID PRIMARY KEY
  organization_id UUID
  branch_id UUID (nullable - NULL = global)
  name TEXT
  tax_id TEXT
  phone TEXT
  email TEXT
  balance DECIMAL
  payment_terms TEXT
  is_active BOOLEAN DEFAULT true
  created_at TIMESTAMP
}
```

#### Price History

```sql
price_history {
  id UUID PRIMARY KEY
  product_id UUID
  price_venta DECIMAL
  costo DECIMAL
  changed_by UUID
  created_at TIMESTAMP
}
```

#### Pending Invites

```sql
pending_invites {
  id UUID PRIMARY KEY
  email TEXT
  token TEXT UNIQUE
  organization_id UUID
  branch_id UUID
  invited_by UUID
  expires_at TIMESTAMP
  created_at TIMESTAMP
}
```

---

### Virtual Views (Queries)

#### v_products_with_stock

Shows each product with total available stock per branch.

```sql
SELECT
  p.id, p.name, p.price_venta, p.emoji,
  COALESCE(SUM(sb.quantity), 0) as available_stock,
  p.branch_id
FROM products p
LEFT JOIN stock_batches sb ON p.id = sb.product_id
GROUP BY p.id, p.branch_id
```

#### v_daily_sales

Summarizes sales by day, payment method, branch.

```sql
SELECT
  DATE(s.created_at) as fecha,
  s.payment_method,
  s.branch_id,
  COUNT(*) as cantidad,
  SUM(s.total) as monto
FROM sales s
GROUP BY DATE(s.created_at), s.payment_method, s.branch_id
```

#### v_expiring_stock

Products expiring within 7 days.

```sql
SELECT
  p.id, p.name, sb.expiration_date,
  SUM(sb.quantity) as cantidad,
  sb.branch_id
FROM stock_batches sb
JOIN products p ON sb.product_id = p.id
WHERE sb.expiration_date BETWEEN NOW() AND NOW() + INTERVAL 7 DAY
GROUP BY p.id, sb.branch_id
```

---

## EDGE CASES & VALIDATION RULES

### Authentication

- ✅ Prevent multiple simultaneous logins (Supabase auth handles)
- ✅ Prevent login after email not confirmed (optional per config)
- ✅ Magic link expires after 24 hours
- ✅ Invite token expires after 7 days
- ✅ Email normalization (lowercase, trimmed)

### Products & Stock

- ✅ Barcode must be unique within organization
- ✅ Stock quantity cannot go negative
- ✅ FIFO enforced at database level (RPC logic)
- ✅ Price change history tracked
- ✅ Product deletion is soft (is_active = false)

### Sales

- ✅ Product must have available stock
- ✅ Payment method must be selected
- ✅ Sale total must be > 0
- ✅ Offline sales queued with unique local_id
- ✅ Sale requires active cash register

### Attendance

- ✅ Employee cannot clock in if already clocked in (different branch)
- ✅ Must clock out in same branch as clock in
- ✅ QR codes tied to specific branch (can't mix)
- ✅ Attendance duration calculated automatically

### Cash Register

- ✅ Only one active register per employee per branch
- ✅ Register cannot open with negative amount
- ✅ Arqueo discrepancy tracked (flagged if > threshold)
- ✅ Movements cannot exceed register balance

### Gamification

- ✅ XP only awarded for completed missions or sales
- ✅ Mission completion cannot be undone
- ✅ Level threshold not bypassed (only gained via play)

### Employee Management

- ✅ Owner cannot invite to non-existent branch
- ✅ Employee cannot be assigned to multiple branches (currently)
- ✅ Employee removal is soft delete (is_active = false)
- ✅ Cannot invite same email twice

---

## TESTING CHECKLIST BY USER ROLE

### Owner E2E Tests

#### Authentication
- [ ] Sign up as owner
- [ ] Email verification if required
- [ ] Login with password
- [ ] Forgot password flow
- [ ] Logout

#### Onboarding
- [ ] Create first branch
- [ ] Invite employee
- [ ] Generate QR codes
- [ ] View onboarding completion

#### Dashboard
- [ ] View all tabs (Alerts, Inventory, Sales, Finance, Supervision)
- [ ] Filter by date range
- [ ] Switch between branches
- [ ] View KPI snapshot

#### Products
- [ ] Create product with barcode
- [ ] Create product without barcode
- [ ] Duplicate barcode prevention
- [ ] Update product details
- [ ] View price history
- [ ] Soft delete product

#### Inventory
- [ ] Add stock with expiration date
- [ ] View stock batches
- [ ] Track FIFO deductions after sales

#### Employees
- [ ] Invite employee via email
- [ ] Cancel pending invite
- [ ] Remove active employee
- [ ] View staff management list
- [ ] Assign employee to branch

#### Providers
- [ ] Create provider (global or local)
- [ ] View provider list
- [ ] Recharge provider balance
- [ ] Track service usage

#### Gamification
- [ ] Create mission for employee
- [ ] View team ranking
- [ ] See XP progression

#### Reports
- [ ] Generate sales report
- [ ] Filter by date range
- [ ] Export as PDF/CSV

---

### Employee E2E Tests

#### Authentication
- [ ] Receive invite email
- [ ] Click magic link
- [ ] Complete profile setup
- [ ] Set password (if required)
- [ ] Login to app

#### Attendance
- [ ] Scan entry QR code
- [ ] Clock in successful
- [ ] Scan exit QR code
- [ ] Clock out successful
- [ ] Error: Already clocked in elsewhere
- [ ] Error: Cannot clock out without check-in

#### Sales
- [ ] Open shift
- [ ] Search product by name
- [ ] Search product by barcode
- [ ] Add product to cart
- [ ] Modify quantity
- [ ] Remove from cart
- [ ] Confirm sale with cash
- [ ] Confirm sale with card
- [ ] Offline: Ensure sale queues
- [ ] Online: Sync pending sales
- [ ] Print receipt (optional)

#### Cash Register
- [ ] Open shift with initial amount
- [ ] Record income movement
- [ ] Record expense movement
- [ ] View shift movements
- [ ] Close shift with arqueo
- [ ] Handle arqueo discrepancy

#### Missions
- [ ] View assigned missions
- [ ] Complete mission
- [ ] Earn XP reward
- [ ] See level progression
- [ ] View team ranking

#### Expiring Products
- [ ] View products expiring < 7 days
- [ ] See batch details
- [ ] Get removal instructions

---

## Integration Points

### Third-Party Services

1. **Supabase Auth**
   - Password-based sign-in
   - Magic link OTP
   - Email confirmation
   - Password reset

2. **Supabase Database**
   - PostgreSQL tables
   - Real-time subscriptions
   - RPC functions
   - Virtual views

3. **ARCA Integration** (Pending)
   - Invoice number generation
   - Tax calculation
   - Fiscal validation

4. **Email Service** (Supabase)
   - Invite emails
   - Magic link emails
   - Password reset emails

5. **PDF Generation**
   - jsPDF + html2canvas
   - Receipt printing
   - Report export

---

## Performance Considerations

1. **Pagination:** Sales lists paginated (50 items/page)
2. **Stock Queries:** Use v_products_with_stock view (optimized)
3. **Real-time Updates:** Dashboard polls every 30 seconds
4. **Offline Mode:** Uses IndexedDB with auto-sync
5. **Image Optimization:** Emoji used instead of icons where possible
6. **Barcode Scanning:** HTML5 QRCode library (~200KB)

---

## Security & Permissions

### Row-Level Security (RLS)

- **memberships:** Users see only their organization
- **sales:** Only organization members see their sales
- **attendance:** Only organization members see attendance
- **missions:** Only assigned employee or owner sees details

### Role-Based Access

- **Owner:** Full access to organization
- **Employee:** Limited to assigned branch, own data
- **Admin:** (Defined but not yet used)

### Sensitive Data Protection

- Passwords: Supabase auth (bcrypt)
- Tokens: Invite tokens are unique, time-limited
- Invoices: Only owner can create
- Reports: Only owner/admin can view

---

## Known Limitations & TODOs

1. **Invoicing:** ARCA integration incomplete
2. **Multi-Branch:** Employees assigned to single branch (could be multiple)
3. **Permissions:** Granular permissions not yet implemented
4. **Audit Logs:** Limited audit trail (created_at only)
5. **Data Retention:** No automatic archival policy
6. **Backup:** Relies on Supabase backup (no manual export)
7. **Translations:** UI currently Spanish-only
8. **Dark Mode:** Not implemented (UI doesn't support)
9. **Mobile:** PWA ready but not fully optimized for small screens

---

## File Structure Summary

```
/app
├── page.tsx                 # Main router
├── layout.tsx               # App layout + PWA
├── fichaje/
│   └── page.tsx            # QR processing

/components
├── dashboard-dueno.tsx      # Owner dashboard
├── vista-empleado.tsx       # Employee dashboard
├── caja-ventas.tsx          # Sales interface
├── arqueo-caja.tsx          # Cash register
├── crear-producto.tsx       # Product creation
├── agregar-stock.tsx        # Stock management
├── auth-form.tsx            # Login/signup
├── profile-setup.tsx        # Onboarding
├── invitar-empleado.tsx     # Employee invite
├── misiones-empleado.tsx    # Gamification
├── gestion-proveedores.tsx  # Provider management
├── dashboard/
│   ├── tab-*.tsx            # Dashboard tabs
│   ├── use-dashboard-*.ts   # Data hooks
│   └── ...

/lib/actions
├── auth.actions.ts          # Auth operations
├── user.actions.ts          # User context
├── branch.actions.ts        # Branch management
├── product.actions.ts       # Product CRUD
├── inventory.actions.ts     # Stock operations
├── ventas.actions.ts        # Sales processing
├── cash.actions.ts          # Cash register
├── attendance.actions.ts    # Timekeeping
├── missions.actions.ts      # Gamification
├── dashboard.actions.ts     # Dashboard data
├── provider.actions.ts      # Provider management
├── reports.actions.ts       # Reporting
├── invoicing.actions.ts     # Invoicing (partial)
└── ...

/types
├── database.types.ts        # Supabase types
├── dashboard.types.ts       # Dashboard types
├── invoicing.types.ts       # Invoice types
└── app.types.ts             # App types
```

---

## Summary Statistics

- **Total Pages:** 2 (Main + Fichaje)
- **Total Components:** 35+
- **Total Actions:** 18 files
- **Database Tables:** 12 main + 3 views
- **Roles:** 3 (Owner, Employee, Admin)
- **User Flows:** 30+
- **Validation Rules:** 50+
- **API Endpoints:** Mostly RPC-based

---

**Document End**

This mapping covers 100% of the application's features, user flows, data models, and validation rules for comprehensive E2E testing and future development planning.

