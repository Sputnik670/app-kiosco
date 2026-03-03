"use server"

import { createClient } from "@/lib/supabase-server"
import { resolveJoin } from "@/types/supabase-joins"

// ============================================================================
// HELPERS DE SEGURIDAD
// ============================================================================

/**
 * Verifica si el usuario actual tiene rol de owner o admin
 * Los reportes contienen información sensible y solo deben ser accesibles por roles elevados
 */
async function verifyReportAccess(): Promise<{
  authorized: boolean
  error?: string
  supabase?: Awaited<ReturnType<typeof createClient>>
}> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { authorized: false, error: "No autenticado" }
  }

  // Verificar rol del usuario
  const { data: role } = await supabase.rpc('get_my_role')

  // Solo owner y admin pueden acceder a reportes
  if (!role || (role !== 'owner' && role !== 'admin')) {
    return { authorized: false, error: "No tienes permisos para acceder a reportes" }
  }

  return { authorized: true, supabase }
}

// ============================================================================
// TIPOS
// ============================================================================

export interface SalesReportData {
  sales: {
    id: string
    date: string
    total: number
    paymentMethod: string
    itemCount: number
    employeeName: string | null
  }[]
  summary: {
    totalSales: number
    totalAmount: number
    byPaymentMethod: Record<string, { count: number; amount: number }>
  }
  period: {
    from: string
    to: string
  }
}

export interface CashRegisterReportData {
  register: {
    id: string
    date: string
    openedAt: string
    closedAt: string | null
    openingAmount: number
    closingAmount: number | null
    employeeName: string | null
  }
  movements: {
    id: string
    type: "ingreso" | "egreso"
    amount: number
    category: string
    description: string | null
    createdAt: string
  }[]
  sales: {
    total: number
    cash: number
    card: number
    other: number
  }
  summary: {
    expectedAmount: number
    actualAmount: number | null
    variance: number | null
  }
}

export interface StockReportData {
  products: {
    id: string
    name: string
    category: string | null
    barcode: string | null
    stock: number
    cost: number
    salePrice: number
    stockValue: number
    potentialRevenue: number
  }[]
  summary: {
    totalProducts: number
    totalUnits: number
    totalStockValue: number
    totalPotentialRevenue: number
  }
}

export interface ExpiringProductsReportData {
  products: {
    id: string
    productName: string
    batchId: string
    quantity: number
    expirationDate: string
    daysUntilExpiry: number
    cost: number
    valueAtRisk: number
  }[]
  summary: {
    totalBatches: number
    totalUnits: number
    totalValueAtRisk: number
  }
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Obtiene datos para el reporte de ventas por período
 */
export async function getSalesReportAction(
  branchId: string,
  fromDate: string,
  toDate: string
): Promise<{ success: true; data: SalesReportData } | { success: false; error: string }> {
  try {
    // Verificar permisos de acceso a reportes
    const access = await verifyReportAccess()
    if (!access.authorized || !access.supabase) {
      return { success: false, error: access.error || "Sin permisos" }
    }
    const supabase = access.supabase

    // Obtener ventas del período
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select(`
        id,
        total,
        payment_method,
        created_at,
        sale_items(quantity),
        cash_registers(memberships(display_name))
      `)
      .eq("branch_id", branchId)
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .order("created_at", { ascending: false })

    if (salesError) {
      return { success: false, error: salesError.message }
    }

    // Procesar datos
    const sales = (salesData || []).map((s) => {
      const items = s.sale_items
      const cashReg = resolveJoin<{ memberships: { display_name: string }[] }>(s.cash_registers)
      const membership = resolveJoin<{ display_name: string }>(cashReg?.memberships)
      return {
        id: s.id,
        date: s.created_at,
        total: s.total || 0,
        paymentMethod: s.payment_method || "unknown",
        itemCount: items?.reduce((sum: number, i: { quantity: number }) => sum + (i.quantity || 0), 0) || 0,
        employeeName: membership?.display_name || null,
      }
    })

    // Calcular resumen
    const byPaymentMethod: Record<string, { count: number; amount: number }> = {}
    sales.forEach((s) => {
      if (!byPaymentMethod[s.paymentMethod]) {
        byPaymentMethod[s.paymentMethod] = { count: 0, amount: 0 }
      }
      byPaymentMethod[s.paymentMethod].count++
      byPaymentMethod[s.paymentMethod].amount += s.total
    })

    return {
      success: true,
      data: {
        sales,
        summary: {
          totalSales: sales.length,
          totalAmount: sales.reduce((sum, s) => sum + s.total, 0),
          byPaymentMethod,
        },
        period: { from: fromDate, to: toDate },
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

/**
 * Obtiene datos para el reporte de caja diaria
 */
export async function getCashRegisterReportAction(
  cashRegisterId: string
): Promise<{ success: true; data: CashRegisterReportData } | { success: false; error: string }> {
  try {
    // Verificar permisos de acceso a reportes
    const access = await verifyReportAccess()
    if (!access.authorized || !access.supabase) {
      return { success: false, error: access.error || "Sin permisos" }
    }
    const supabase = access.supabase

    // Obtener caja
    const { data: registerData, error: registerError } = await supabase
      .from("cash_registers")
      .select(`
        id,
        date,
        opened_at,
        closed_at,
        opening_amount,
        closing_amount,
        branch_id,
        memberships(display_name)
      `)
      .eq("id", cashRegisterId)
      .single()

    if (registerError || !registerData) {
      return { success: false, error: registerError?.message || "Caja no encontrada" }
    }

    // Obtener movimientos
    const { data: movementsData } = await supabase
      .from("cash_movements")
      .select("id, type, amount, category, description, created_at")
      .eq("cash_register_id", cashRegisterId)
      .order("created_at", { ascending: true })

    // Obtener ventas de la caja
    const { data: salesData } = await supabase
      .from("sales")
      .select("total, payment_method")
      .eq("cash_register_id", cashRegisterId)

    // Calcular totales de ventas
    const salesSummary = {
      total: 0,
      cash: 0,
      card: 0,
      other: 0,
    }
    ;(salesData || []).forEach((s) => {
      salesSummary.total += s.total || 0
      if (s.payment_method === "cash") salesSummary.cash += s.total || 0
      else if (s.payment_method === "card") salesSummary.card += s.total || 0
      else salesSummary.other += s.total || 0
    })

    // Procesar movimientos
    const movements = (movementsData || []).map((m) => ({
      id: m.id,
      type: m.type as "ingreso" | "egreso",
      amount: m.amount || 0,
      category: m.category || "",
      description: m.description,
      createdAt: m.created_at,
    }))

    // Calcular esperado
    const totalIngresos = movements
      .filter((m) => m.type === "ingreso")
      .reduce((sum, m) => sum + m.amount, 0)
    const totalEgresos = movements
      .filter((m) => m.type === "egreso")
      .reduce((sum, m) => sum + m.amount, 0)

    const expectedAmount =
      (registerData.opening_amount || 0) + salesSummary.cash + totalIngresos - totalEgresos

    const membership = resolveJoin<{ display_name: string }>(registerData.memberships)

    return {
      success: true,
      data: {
        register: {
          id: registerData.id,
          date: registerData.date,
          openedAt: registerData.opened_at,
          closedAt: registerData.closed_at,
          openingAmount: registerData.opening_amount || 0,
          closingAmount: registerData.closing_amount,
          employeeName: membership?.display_name || null,
        },
        movements,
        sales: salesSummary,
        summary: {
          expectedAmount,
          actualAmount: registerData.closing_amount,
          variance:
            registerData.closing_amount !== null
              ? registerData.closing_amount - expectedAmount
              : null,
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

/**
 * Obtiene datos para el reporte de stock
 */
export async function getStockReportAction(
  branchId: string
): Promise<{ success: true; data: StockReportData } | { success: false; error: string }> {
  try {
    // Verificar permisos de acceso a reportes
    const access = await verifyReportAccess()
    if (!access.authorized || !access.supabase) {
      return { success: false, error: access.error || "Sin permisos" }
    }
    const supabase = access.supabase

    // Obtener productos con stock
    const { data: productsData, error: productsError } = await supabase
      .from("v_products_with_stock")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("name")

    if (productsError) {
      return { success: false, error: productsError.message }
    }

    const products = (productsData || []).map((p) => ({
      id: p.id || "",
      name: p.name || "",
      category: p.category,
      barcode: p.barcode,
      stock: Number(p.stock_available) || 0,
      cost: Number(p.cost) || 0,
      salePrice: Number(p.sale_price) || 0,
      stockValue: (Number(p.stock_available) || 0) * (Number(p.cost) || 0),
      potentialRevenue: (Number(p.stock_available) || 0) * (Number(p.sale_price) || 0),
    }))

    return {
      success: true,
      data: {
        products,
        summary: {
          totalProducts: products.length,
          totalUnits: products.reduce((sum, p) => sum + p.stock, 0),
          totalStockValue: products.reduce((sum, p) => sum + p.stockValue, 0),
          totalPotentialRevenue: products.reduce((sum, p) => sum + p.potentialRevenue, 0),
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

/**
 * Obtiene datos para el reporte de productos por vencer
 */
export async function getExpiringProductsReportAction(
  branchId: string,
  daysAhead: number = 15
): Promise<{ success: true; data: ExpiringProductsReportData } | { success: false; error: string }> {
  try {
    // Verificar permisos de acceso a reportes
    const access = await verifyReportAccess()
    if (!access.authorized || !access.supabase) {
      return { success: false, error: access.error || "Sin permisos" }
    }
    const supabase = access.supabase

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysAhead)

    const { data: batchesData, error: batchesError } = await supabase
      .from("stock_batches")
      .select(`
        id,
        quantity,
        cost_per_unit,
        expiration_date,
        products(name)
      `)
      .eq("branch_id", branchId)
      .gt("quantity", 0)
      .not("expiration_date", "is", null)
      .lte("expiration_date", futureDate.toISOString().split("T")[0])
      .order("expiration_date", { ascending: true })

    if (batchesError) {
      return { success: false, error: batchesError.message }
    }

    const today = new Date()
    const products = (batchesData || []).map((b) => {
      const product = resolveJoin<{ name: string }>(b.products)
      const expiryDate = new Date(b.expiration_date!)
      const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: b.id,
        productName: product?.name || "Producto",
        batchId: b.id,
        quantity: b.quantity || 0,
        expirationDate: b.expiration_date!,
        daysUntilExpiry: daysUntil,
        cost: b.cost_per_unit || 0,
        valueAtRisk: (b.quantity || 0) * (b.cost_per_unit || 0),
      }
    })

    return {
      success: true,
      data: {
        products,
        summary: {
          totalBatches: products.length,
          totalUnits: products.reduce((sum, p) => sum + p.quantity, 0),
          totalValueAtRisk: products.reduce((sum, p) => sum + p.valueAtRisk, 0),
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

/**
 * Obtiene lista de cajas para seleccionar en reporte
 */
export async function getCashRegistersListAction(
  branchId: string,
  fromDate: string,
  toDate: string
): Promise<
  | { success: true; data: { id: string; date: string; employeeName: string | null; isClosed: boolean }[] }
  | { success: false; error: string }
> {
  try {
    // Verificar permisos de acceso a reportes
    const access = await verifyReportAccess()
    if (!access.authorized || !access.supabase) {
      return { success: false, error: access.error || "Sin permisos" }
    }
    const supabase = access.supabase

    const { data, error } = await supabase
      .from("cash_registers")
      .select("id, date, closed_at, memberships(display_name)")
      .eq("branch_id", branchId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    const registers = (data || []).map((r) => {
      const membership = resolveJoin<{ display_name: string }>(r.memberships)
      return {
        id: r.id,
        date: r.date,
        employeeName: membership?.display_name || null,
        isClosed: r.closed_at !== null,
      }
    })

    return { success: true, data: registers }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}
