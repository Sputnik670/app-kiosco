# Performance Audit Report - App Kiosco

> Agente: kiosco-performance
> Fecha: 2026-02-26
> Target device: Samsung A14, 3GB RAM, Chrome 90+, 4G connection

---

## 1. Bundle Analysis

### BEFORE (Baseline)

| Metric | Value |
|--------|-------|
| Build time | ~9.5s (Turbopack) |
| Total chunks | 3.3MB |
| Largest chunk | 1.9MB (monolithic - contains jsPDF + xlsx + html5-qrcode + app code) |
| Static pages generated | 7/7 in 2.4s |

### AFTER (Post-optimization)

| Metric | Value |
|--------|-------|
| Build time | ~6.1s (Turbopack) |
| Total chunks | 3.5MB (more chunks but split for lazy loading) |
| Largest chunk | 792KB (lazy-loaded, not in critical path) |
| Static pages generated | 7/7 in 666ms |

**Key observation**: The total disk size increased slightly because dynamic imports create additional chunk wrappers, but the **initial load bundle** is significantly smaller. The heavy libraries (jsPDF ~300KB, xlsx ~400KB, html5-qrcode ~200KB, canvas-confetti ~30KB) are now loaded on demand instead of upfront.

---

## 2. Changes Made (Lazy Loading)

### 2.1 jsPDF + jspdf-autotable (~300KB + ~50KB)

**Files modified:**

- `lib/generar-ticket.ts` - Removed top-level `import jsPDF` and `import autoTable`. Added `const { jsPDF } = await import("jspdf")` and `const { default: autoTable } = await import("jspdf-autotable")` inside both `generarTicketPDF()` and `generarTicketVenta()`. Made both functions async.

- `lib/services/pdf-generator.ts` - Removed top-level imports. Added dynamic imports inside all 4 exported functions: `generateSalesReportPDF()`, `generateCashRegisterReportPDF()`, `generateStockReportPDF()`, `generateExpiringProductsReportPDF()`. Made all async returning `Promise<void>`.

**Callers updated:**

- `components/caja-ventas.tsx` - Added `await` to `generarTicketVenta()` call (already inside async function)
- `components/dashboard-dueno.tsx` - Made `handlePrintTurno` async, added `await` to `generarTicketPDF()` call
- `components/reports/index.tsx` - Added `await` to all 8 generate calls (4 PDF + 4 Excel, all already inside async handler)

**Impact**: ~350KB removed from initial bundle. jsPDF is only loaded when user clicks "Print" or "Export PDF".

### 2.2 xlsx (~400KB)

**Files modified:**

- `lib/services/excel-generator.ts` - Removed top-level `import * as XLSX`. Added `const XLSX = await import("xlsx")` inside all 4 exported functions. Updated `downloadExcel()` helper to receive XLSX module as parameter. Made all exported functions async returning `Promise<void>`.

**Impact**: ~400KB removed from initial bundle. xlsx is only loaded when user clicks "Export Excel".

### 2.3 html5-qrcode (~200KB)

**Files modified:**

- `components/barcode-scanner.tsx` - Removed top-level import. Added `const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")` inside `useEffect` callback (already async via setTimeout). Changed `scannerRef` type from `Html5Qrcode` to `any`.

- `components/crear-producto.tsx` - Same pattern as barcode-scanner. Dynamic import inside the inline BarcodeScanner component's `useEffect`.

- `components/qr-fichaje-scanner.tsx` - Same pattern. Dynamic import inside `useEffect` after DOM element check.

**Impact**: ~200KB removed from initial bundle. html5-qrcode is only loaded when user opens a scanner dialog.

### 2.4 canvas-confetti (~30KB)

**Files modified:**

- `components/confetti-trigger.tsx` - Removed top-level `import confetti`. Added `const { default: confetti } = await import("canvas-confetti")` inside `triggerConfetti()`. Made function async.

**Callers**: `arqueo-caja.tsx` and `misiones-empleado.tsx` call `triggerConfetti()` as fire-and-forget (visual effect), so no `await` needed.

**Impact**: ~30KB removed from initial bundle.

---

## 3. Estimated Impact on Performance Targets

| Metric | Target | Before (est.) | After (est.) | Status |
|--------|--------|---------------|--------------|--------|
| Initial JS bundle | < 300KB | ~900KB+ (monolithic) | ~300-400KB | Close to target |
| FCP on 4G | < 1.5s | ~2.5-3s | ~1.5-2s | Improved |
| Build time | < 60s | 9.5s | 6.1s | Well within target |
| Search product | < 300ms | N/A (not bundle-related) | N/A | N/A |
| Add to sale | < 100ms | N/A (local state) | N/A | N/A |

**Estimated bundle reduction from initial load**: ~980KB of heavy libraries moved to on-demand loading.

---

## 4. Verification

- Build: PASSED (Next.js 16.0.10 Turbopack, compiled in 6.1s)
- Tests: 146/146 PASSED (7 test files, zero failures)
- No new packages installed
- No functionality removed

---

## 5. Remaining Optimization Opportunities

### P1 - High Impact

1. **Use `next/dynamic` for page-level code splitting** in `app/page.tsx`
   - Currently imports `DashboardDueno`, `VistaEmpleado`, `AuthForm`, `ProfileSetup`, `SeleccionarSucursal`, `QRFichajeScanner` all at top level
   - User only sees ONE of these based on auth state
   - Use `dynamic(() => import("..."), { ssr: false })` for all except AuthForm
   - Estimated savings: ~200-400KB from initial load

2. **recharts (~200KB)** in `components/dashboard/tab-sales.tsx`
   - Only used in one tab of the dashboard
   - Could be lazy loaded with `next/dynamic` when TabSales is rendered
   - Not critical for initial load since dashboard is a secondary view

### P2 - Medium Impact

3. **Remove unused dependency `react-zxing`**
   - Listed in package.json but not imported anywhere
   - Run `npm uninstall react-zxing` to clean up

4. **Use `next/image` for product images**
   - Currently no usage of `next/image` in the app (only in middleware.ts for matchers)
   - Would benefit from automatic optimization, lazy loading, and WebP conversion

5. **Add bundle analyzer**
   - Install `@next/bundle-analyzer` as devDependency
   - Add `ANALYZE=true` support in `next.config.ts`
   - Would enable precise measurement of chunk composition

### P3 - Lower Impact

6. **Font optimization**
   - Verify using `next/font` instead of Google Fonts CDN for critical fonts
   - Reduces external network requests on initial load

7. **Consider React.Suspense** for dashboard data loading
   - `dashboard-dueno.tsx` loads multiple data sources
   - Streaming with Suspense would show content progressively

8. **Large Radix UI dependency count (19 packages)**
   - Evaluate if all are needed or if some can be removed
   - Each Radix component adds to the tree-shakeable but still-present bundle

---

## 6. Files Modified

| File | Change |
|------|--------|
| `lib/generar-ticket.ts` | Dynamic import of jsPDF + autotable |
| `lib/services/pdf-generator.ts` | Dynamic import of jsPDF + autotable (4 functions) |
| `lib/services/excel-generator.ts` | Dynamic import of xlsx (4 functions + helper) |
| `components/barcode-scanner.tsx` | Dynamic import of html5-qrcode in useEffect |
| `components/crear-producto.tsx` | Dynamic import of html5-qrcode in useEffect |
| `components/qr-fichaje-scanner.tsx` | Dynamic import of html5-qrcode in useEffect |
| `components/confetti-trigger.tsx` | Dynamic import of canvas-confetti |
| `components/caja-ventas.tsx` | Added await for async generarTicketVenta |
| `components/dashboard-dueno.tsx` | Made handlePrintTurno async, added await |
| `components/reports/index.tsx` | Added await for all 8 generate calls |

---

## 7. Summary

The main optimization target (P1 item #6 from SPECIFICATIONS.md: "lazy load de jsPDF, xlsx, html5-qrcode") has been completed. Approximately **980KB** of heavy library code has been moved from the initial bundle to on-demand loading, which should significantly improve FCP and TTI on the Samsung A14 target device over 4G connections.

All changes compile without errors and all 146 existing tests continue to pass.
