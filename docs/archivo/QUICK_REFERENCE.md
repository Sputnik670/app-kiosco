# Kiosco SaaS - Quick Reference Guide

## App Architecture at a Glance

**Type:** Next.js 14 PWA with Supabase
**Auth:** Supabase Auth (password, magic link)
**Database:** PostgreSQL (Schema V2 - English names)
**Roles:** Owner, Employee, Admin

---

## Main Entry Points

| Route | Component | Shows | When |
|-------|-----------|-------|------|
| `/` | page.tsx | AuthForm | No session |
| `/` | ProfileSetup | Role selection | Session, no profile |
| `/` | OnboardingWizard | Create first branch | Owner, no branches |
| `/` | SeleccionarSucursal | Branch picker | Owner, multiple branches |
| `/` | DashboardDueno | Owner dashboard | Owner authenticated |
| `/` | VistaEmpleado | Employee dashboard | Employee authenticated |
| `/fichaje` | QR processor | Clock in/out | From QR scan |

---

## Owner Features (45+ actions)

### Dashboard Tabs
- **Alertas:** Low stock, expiring products, overdue payments
- **Inventario:** Products, stock batches, price history
- **Ventas:** Sales chart, payment breakdown, top products
- **Finanzas:** Revenue, profit, ROI, margin %
- **Supervisión:** Employee rankings, shift status

### Operations
| Feature | File | Action |
|---------|------|--------|
| Create Product | crear-producto.tsx | createFullProductAction |
| Add Stock | agregar-stock.tsx | Stock entry via DB |
| Generate QR | generar-qr-fichaje.tsx | updateBranchQRAction |
| Manage Providers | gestion-proveedores.tsx | getServiceProvidersAction |
| Invite Employees | invitar-empleado.tsx | inviteEmployeeAction |
| View Staff | invitar-empleado.tsx | getStaffManagementDataAction |
| Create Missions | asignar-mision.tsx | createMissionAction |
| View Reports | reports/index.tsx | getReportsAction |

---

## Employee Features (20+ actions)

### Dashboard Tabs
- **Caja:** Sales interface, current shift, arqueo
- **Misiones:** Assigned tasks, XP rewards, team ranking
- **Vencimientos:** Expiring products, batch info

### Operations
| Feature | File | Action |
|---------|------|--------|
| Clock In/Out | (QR redirects) | Attendance record created |
| Open Shift | arqueo-caja.tsx | abrirCajaAction |
| Search Products | caja-ventas.tsx | searchProductsAction |
| Add to Cart | caja-ventas.tsx | Cart hook |
| Confirm Sale | caja-ventas.tsx | confirmSaleAction |
| Record Movement | registrar-movimientos.tsx | createCashMovementAction |
| Close Shift | arqueo-caja.tsx | cerrarCajaAction |
| Complete Mission | misiones-empleado.tsx | completeMissionAction |

---

## Key Data Models

### User Hierarchy
```
auth.users (Supabase)
└── memberships (Links user to org + branch)
    ├── role: 'owner' | 'employee' | 'admin'
    ├── organization_id (FK)
    ├── branch_id (FK, nullable)
    └── xp: Integer (for gamification)
```

### Transaction Hierarchy
```
sales (Transaction header)
└── sale_items (Individual products sold)
└── cash_registers (Active shift)
    └── cash_movements (Income/expense records)
└── attendance (Work hours tracking)
```

### Inventory Hierarchy
```
products (Catalog)
└── stock_batches (FIFO queue)
    ├── quantity (Tracked individually)
    ├── cost_per_unit
    ├── expiration_date
    └── branch_id (Location-specific)
└── price_history (Price changes over time)
```

---

## Critical Flows

### 1. Owner Signup → Dashboard
```
SignUp Email → Link click → ProfileSetup (owner)
→ setup_organization() RPC
→ Creates: Organization + Branch + Membership
→ OnboardingWizard (optional)
→ DashboardDueno
```

### 2. Employee Invite → Dashboard
```
Owner invites email → inviteEmployeeAction
→ pending_invites created, email sent
→ Employee clicks magic link → ProfileSetup (employee)
→ accept_invite() RPC
→ Membership created
→ Login → VistaEmpleado
```

### 3. Employee Attendance
```
QR scan
→ /fichaje page processes
→ Validates branch + user + logic
→ Creates/updates attendance record
→ Redirects to /?sucursal_id=X
```

### 4. Complete Sale
```
Employee searches product
→ Adds to cart (quantity × price)
→ Selects payment method
→ Confirms → confirmSaleAction
→ RPC: process_sale
  - Validates stock (FIFO)
  - Creates sales record
  - Deducts stock_batches
  - Records cash_movement
  - Awards XP
→ Optional: Print receipt
```

### 5. Close Shift (Arqueo)
```
Employee clicks "Cerrar Caja"
→ Enters final amount
→ cerrarCajaAction calculates:
  - opening_amount
  - + cash_sales_total
  - + income_movements
  - - expense_movements
  - = expected_amount
→ Compare expected vs declared
→ Flag discrepancy
→ Mark shift closed
```

---

## Database Schema Quick View

### Core Tables
```
organizations
- id, name, owner_id, created_at

memberships
- id, user_id, organization_id, branch_id, role, xp, is_active

branches
- id, organization_id, name, address, qr_entry_url, qr_exit_url

products
- id, organization_id, name, barcode, category, price_venta, costo, emoji

stock_batches
- id, product_id, branch_id, quantity, cost_per_unit, expiration_date

sales
- id, organization_id, branch_id, cash_register_id, payment_method, total

sale_items
- id, sale_id, product_id, quantity, unit_price

cash_registers (Shifts)
- id, organization_id, branch_id, opened_by, opening_amount, is_open

cash_movements
- id, cash_register_id, amount, type, description

attendance
- id, organization_id, branch_id, user_id, check_in, check_out

missions
- id, organization_id, employee_id, descripcion, puntos, es_completada

suppliers (Providers)
- id, organization_id, branch_id, name, balance, is_active
```

---

## Validation Checklist

### Before Creating Product
- [ ] Barcode not duplicate in organization
- [ ] Name minimum 3 characters
- [ ] Price > 0
- [ ] Cost > 0

### Before Creating Sale
- [ ] Product has available stock
- [ ] Payment method selected
- [ ] Sale total > 0
- [ ] Cash register is open

### Before Closing Shift
- [ ] All movements recorded
- [ ] Final count completed
- [ ] Discrepancy noted if > threshold

### Before Inviting Employee
- [ ] Email valid format
- [ ] Branch selected
- [ ] Email not already invited
- [ ] Branch exists and is active

### Before Attendance
- [ ] User is employee (not owner)
- [ ] Branch exists and is active
- [ ] QR parameters valid
- [ ] No conflicting attendance

---

## XP & Gamification

**Formula:** Level = ⌊XP ÷ 3000⌋ + 1

**XP Sources:**
- Sale: +10 XP (automatic)
- Mission: +50 to +500 XP (varies)
- Shift closure: +50 XP (if arqueo successful)

**Display:**
- Progress bar: (XP % 3000) ÷ 3000 × 100%
- Current level shown in header
- Team ranking shows all employees sorted by XP

---

## Offline Mode

**Scope:** Sales, product search, cart management
**Storage:** IndexedDB (browser storage)
**Sync:** Auto-sync when online, manual "Forzar sincronización"

**Limitations:**
- Cannot search products offline (uses local cache)
- Cannot confirm sale offline if staff changes
- Queue shown in status bar

---

## Common Errors & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| "Ya tienes una entrada activa" | Clocked in elsewhere | Clock out from other branch first |
| "Producto no encontrado" | Wrong barcode | Check barcode format (EAN-13 standard) |
| "Stock insuficiente" | No available quantity | Add stock batch or reduce qty |
| "Invitación expirada" | Token > 7 days old | Owner sends new invite |
| "No tienes acceso a esta sucursal" | User not assigned | Owner must assign branch |
| "Discrepancia en arqueo" | Cash doesn't match | Check all movements recorded |

---

## File Location Guide

| Feature | Component | Action | Service |
|---------|-----------|--------|---------|
| Auth | auth-form.tsx | auth.actions.ts | Supabase Auth |
| Profile | profile-setup.tsx | auth.actions.ts | setup_organization RPC |
| Dashboard Owner | dashboard-dueno.tsx | dashboard.actions.ts | v_daily_sales view |
| Dashboard Employee | vista-empleado.tsx | user.actions.ts | memberships table |
| Sales | caja-ventas.tsx | ventas.actions.ts | process_sale RPC |
| Inventory | agregar-stock.tsx | inventory.actions.ts | stock_batches table |
| Attendance | fichaje/page.tsx | attendance.actions.ts | attendance table |
| Missions | misiones-empleado.tsx | missions.actions.ts | missions table |
| Providers | gestion-proveedores.tsx | provider.actions.ts | suppliers table |
| Reports | reports/index.tsx | reports.actions.ts | v_daily_sales view |

---

## Testing Quick Checklist

### Owner Path (15 min)
- [ ] Sign up
- [ ] Complete onboarding
- [ ] Create product
- [ ] Add stock
- [ ] Invite employee
- [ ] View dashboard

### Employee Path (10 min)
- [ ] Accept invite
- [ ] Scan QR (clock in)
- [ ] Open shift
- [ ] Search product
- [ ] Confirm sale
- [ ] Close shift
- [ ] Scan QR (clock out)

### Edge Cases (20 min)
- [ ] Duplicate barcode
- [ ] Insufficient stock
- [ ] Clock in twice
- [ ] Expired invite
- [ ] Offline sale queueing
- [ ] Arqueo discrepancy

---

## API & RPC Reference

### Critical RPCs
- `setup_organization(name, user_name, email)` → Creates org + branch
- `accept_invite(token, user_name, email)` → Joins org via invite
- `process_sale(...)` → Atomic sale with stock deduction
- `get_my_org_id()` → Returns user's org
- `is_owner()` → Checks if user is owner

### Search Views
- `v_products_with_stock` - Products with available qty
- `v_daily_sales` - Sales grouped by day/method
- `v_expiring_stock` - Products expiring < 7 days

---

## Key Dependencies

- **Framework:** Next.js 14+ (App Router)
- **UI:** Radix UI + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **State:** React hooks + Context
- **Offline:** IndexedDB + Service Workers
- **Barcode:** html5-qrcode library
- **PDF:** jsPDF + html2canvas
- **Forms:** React Hook Form (implied)
- **Validation:** Zod schemas

---

## Performance Notes

- Dashboard polls every 30 seconds
- Stock view is optimized (uses view, not full join)
- Offline mode uses IndexedDB for fast retrieval
- Product search debounced (prevents excessive queries)
- Pagination on sales lists (50 items/page)

---

## Security Highlights

- RLS enforced on all tables
- Soft deletes (is_active flag) instead of hard deletes
- Invite tokens are time-limited (7 days)
- Magic link expires after 24 hours
- Email normalized (prevents case issues)
- Organization isolation (users only see own org data)
- Password reset via magic link (Supabase handles)

---

**For detailed information, see:** `/FEATURE_MAPPING_E2E.md`

