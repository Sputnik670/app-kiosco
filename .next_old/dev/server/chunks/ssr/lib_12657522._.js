module.exports = [
"[project]/lib/supabase.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-ssr] (ecmascript)");
;
;
let browserClient = null;
let serverClient = null;
function getSupabaseClient() {
    // En el browser, usar createBrowserClient para manejo de cookies
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // En el servidor (build/SSR), usar cliente básico
    if (!serverClient) {
        serverClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createClient"])(("TURBOPACK compile-time value", "https://cwefwathdodmaqnjjagt.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3ZWZ3YXRoZG9kbWFxbmpqYWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTUyNjIsImV4cCI6MjA4NTA3MTI2Mn0.kKnwAWVpj6WRbCfbVs6K0oXzmsza2MYzdEl3p11mJaY"));
    }
    return serverClient;
}
const supabase = new Proxy({}, {
    get (_, prop) {
        const client = getSupabaseClient();
        const value = client[prop];
        // Si es una función, bindearla al cliente
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});
}),
"[project]/lib/utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
}),
"[project]/lib/generar-ticket.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// jsPDF and jspdf-autotable are loaded dynamically inside each function
// to avoid adding ~300KB to the initial bundle (lazy load on demand)
// Auxiliar para formatear moneda en el PDF
__turbopack_context__.s([
    "generarTicketPDF",
    ()=>generarTicketPDF,
    "generarTicketVenta",
    ()=>generarTicketVenta
]);
const formatPDFMoney = (val)=>new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(val);
const generarTicketPDF = async (datos)=>{
    const { jsPDF } = await __turbopack_context__.A("[project]/node_modules/jspdf/dist/jspdf.node.min.js [app-ssr] (ecmascript, async loader)");
    const { default: autoTable } = await __turbopack_context__.A("[project]/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs [app-ssr] (ecmascript, async loader)");
    const doc = new jsPDF();
    // Encabezado
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(datos.sucursalNombre || "Mi Kiosco", 105, 20, {
        align: "center"
    });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte de Auditoría de Caja", 105, 30, {
        align: "center"
    });
    doc.line(20, 35, 190, 35);
    // Info General
    doc.setFontSize(10);
    doc.text(`AUDITOR: ${datos.empleado.toUpperCase()}`, 20, 45);
    doc.text(`APERTURA: ${datos.fechaApertura}`, 20, 50);
    doc.text(`CIERRE: ${datos.fechaCierre || 'TURNO EN CURSO'}`, 20, 55);
    // Tabla de Resumen Financiero (Matemática de Caja)
    autoTable(doc, {
        startY: 65,
        head: [
            [
                'CONCEPTO',
                'VALOR'
            ]
        ],
        body: [
            [
                '(+) CAJA INICIAL',
                formatPDFMoney(datos.montoInicial)
            ],
            [
                '(+) VENTAS EFECTIVO',
                formatPDFMoney(datos.totalVentasEfectivo)
            ],
            [
                '(+) INGRESOS MANUALES',
                formatPDFMoney(datos.totalIngresos)
            ],
            [
                '(-) GASTOS / RETIROS',
                `-${formatPDFMoney(datos.totalGastos)}`
            ],
            [
                '(=) TOTAL ESPERADO EN CAJA',
                formatPDFMoney(datos.cajaEsperada)
            ],
            [
                '(X) CAJA DECLARADA (REAL)',
                datos.cajaReal ? formatPDFMoney(datos.cajaReal) : '---'
            ],
            [
                '(Δ) DIFERENCIA',
                datos.diferencia !== null ? formatPDFMoney(datos.diferencia) : '---'
            ]
        ],
        theme: 'grid',
        styles: {
            fontStyle: 'bold'
        },
        headStyles: {
            fillColor: [
                15,
                23,
                42
            ]
        },
        columnStyles: {
            1: {
                halign: 'right'
            }
        },
        didParseCell: function(data) {
            if (data.row.index === 4) {
                data.cell.styles.fillColor = [
                    241,
                    245,
                    249
                ];
            }
            if (data.row.index === 6 && datos.diferencia !== null) {
                if (datos.diferencia < 0) data.cell.styles.textColor = [
                    220,
                    38,
                    38
                ];
                if (datos.diferencia > 0) data.cell.styles.textColor = [
                    22,
                    163,
                    74
                ];
            }
        }
    });
    // Detalle de Movimientos Manuales (Audit Trail)
    if (datos.gastos.length > 0) {
        // @ts-expect-error jspdf-autotable adds lastAutoTable property
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFont("helvetica", "bold");
        doc.text("DETALLE DE MOVIMIENTOS MANUALES:", 20, finalY);
        autoTable(doc, {
            startY: finalY + 5,
            head: [
                [
                    'HORA/CAT',
                    'DESCRIPCIÓN',
                    'MONTO'
                ]
            ],
            body: datos.gastos.map((g)=>[
                    g.categoria?.toUpperCase() || 'AJUSTE',
                    g.descripcion,
                    formatPDFMoney(g.monto)
                ]),
            theme: 'striped',
            headStyles: {
                fillColor: [
                    71,
                    85,
                    105
                ]
            },
            columnStyles: {
                2: {
                    halign: 'right'
                }
            }
        });
    }
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(`Documento oficial de auditoría - ${datos.sucursalNombre || "Mi Kiosco"}`, 105, pageHeight - 10, {
        align: "center"
    });
    const nombreArchivo = `Cierre_${datos.empleado}_${datos.fechaApertura.replace(/[\/\s:]/g, '-')}.pdf`;
    doc.save(nombreArchivo);
};
const generarTicketVenta = async (datos)=>{
    const { jsPDF } = await __turbopack_context__.A("[project]/node_modules/jspdf/dist/jspdf.node.min.js [app-ssr] (ecmascript, async loader)");
    const alturaBase = 100;
    // Agregar espacio extra si hay banner offline
    const alturaOffline = datos.offlinePending ? 25 : 0;
    const alturaTicket = alturaBase + datos.items.length * 7 + alturaOffline;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [
            80,
            alturaTicket
        ]
    });
    doc.setFont("Courier", "normal");
    let y = 10;
    // Banner de modo offline si está pendiente de sincronización
    if (datos.offlinePending) {
        doc.setFillColor(255, 237, 213); // Naranja claro
        doc.rect(0, y - 5, 80, 12, 'F');
        doc.setFontSize(8);
        doc.setFont("Courier", "bold");
        doc.setTextColor(194, 65, 12); // Naranja oscuro
        doc.text("*** PENDIENTE SYNC ***", 40, y, {
            align: "center"
        });
        y += 4;
        doc.setFontSize(6);
        doc.text(`ID: ${datos.localId || 'N/A'}`, 40, y, {
            align: "center"
        });
        doc.setTextColor(0, 0, 0); // Reset a negro
        y += 8;
    }
    doc.setFontSize(14);
    doc.setFont("Courier", "bold");
    doc.text(datos.organizacion.toUpperCase(), 40, y, {
        align: "center"
    });
    y += 5;
    doc.setFontSize(8);
    doc.setFont("Courier", "normal");
    doc.text("--------------------------------", 40, y, {
        align: "center"
    });
    y += 5;
    doc.text(`FECHA: ${datos.fecha}`, 5, y);
    y += 4;
    if (datos.vendedor) {
        doc.text(`VEND: ${datos.vendedor.toUpperCase()}`, 5, y);
        y += 4;
    }
    y += 2;
    doc.text("--------------------------------", 40, y, {
        align: "center"
    });
    y += 5;
    doc.setFont("Courier", "bold");
    doc.text("CANT", 5, y);
    doc.text("PRODUCTO", 20, y);
    doc.text("TOTAL", 75, y, {
        align: "right"
    });
    y += 4;
    doc.setFont("Courier", "normal");
    datos.items.forEach((item)=>{
        const nombre = item.producto.length > 18 ? item.producto.substring(0, 18) + ".." : item.producto;
        doc.text(item.cantidad.toString(), 5, y);
        doc.text(nombre, 20, y);
        doc.text(formatPDFMoney(item.subtotal), 75, y, {
            align: "right"
        });
        y += 5;
    });
    y += 2;
    doc.text("--------------------------------", 40, y, {
        align: "center"
    });
    y += 5;
    doc.setFontSize(14);
    doc.setFont("Courier", "bold");
    doc.text(`TOTAL: ${formatPDFMoney(datos.total)}`, 75, y, {
        align: "right"
    });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("Courier", "normal");
    doc.text(`PAGO: ${datos.metodoPago.toUpperCase()}`, 75, y, {
        align: "right"
    });
    y += 10;
    doc.setFontSize(8);
    doc.text("¡GRACIAS POR SU COMPRA!", 40, y, {
        align: "center"
    });
    y += 4;
    doc.text(datos.organizacion || "Mi Kiosco", 40, y, {
        align: "center"
    });
    // Nota al pie si está offline
    if (datos.offlinePending) {
        y += 6;
        doc.setFontSize(6);
        doc.setFont("Courier", "italic");
        doc.text("Venta registrada offline.", 40, y, {
            align: "center"
        });
        y += 3;
        doc.text("Se sincronizará automáticamente.", 40, y, {
            align: "center"
        });
    }
    const prefix = datos.offlinePending ? 'Offline_' : '';
    const nombreArchivo = `${prefix}Ticket_${datos.fecha.replace(/[\/\s:]/g, '-')}.pdf`;
    doc.save(nombreArchivo);
};
}),
"[project]/lib/services/pdf-generator.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Generador de reportes PDF para App-Kiosco
 * Usa jsPDF + jspdf-autotable para crear PDFs con tablas
 */ // jsPDF and jspdf-autotable are loaded dynamically inside each function
// to avoid adding ~300KB to the initial bundle (lazy load on demand)
__turbopack_context__.s([
    "generateCashRegisterReportPDF",
    ()=>generateCashRegisterReportPDF,
    "generateExpiringProductsReportPDF",
    ()=>generateExpiringProductsReportPDF,
    "generateSalesReportPDF",
    ()=>generateSalesReportPDF,
    "generateStockReportPDF",
    ()=>generateStockReportPDF
]);
// Configuración común
const COLORS = {
    primary: [
        15,
        23,
        42
    ],
    secondary: [
        100,
        116,
        139
    ],
    accent: [
        37,
        99,
        235
    ],
    success: [
        22,
        163,
        74
    ],
    danger: [
        220,
        38,
        38
    ],
    warning: [
        217,
        119,
        6
    ]
};
function formatMoney(amount) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    }).format(amount);
}
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}
function formatDateTime(dateStr) {
    return new Date(dateStr).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}
function addHeader(doc, title, subtitle) {
    doc.setFontSize(20);
    doc.setTextColor(...COLORS.primary);
    doc.text(title, 14, 20);
    if (subtitle) {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.secondary);
        doc.text(subtitle, 14, 28);
    }
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Generado: ${new Date().toLocaleString("es-AR")}`, 14, 35);
    // Línea separadora
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);
}
function addFooter(doc) {
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++){
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.secondary);
        doc.text(`Página ${i} de ${pageCount} | App-Kiosco`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, {
            align: "center"
        });
    }
}
async function generateSalesReportPDF(data, branchName) {
    const { jsPDF } = await __turbopack_context__.A("[project]/node_modules/jspdf/dist/jspdf.node.min.js [app-ssr] (ecmascript, async loader)");
    const { default: autoTable } = await __turbopack_context__.A("[project]/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs [app-ssr] (ecmascript, async loader)");
    const doc = new jsPDF();
    addHeader(doc, "REPORTE DE VENTAS", `${branchName} | ${formatDate(data.period.from)} - ${formatDate(data.period.to)}`);
    // Resumen
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text("Resumen", 14, 48);
    autoTable(doc, {
        startY: 52,
        head: [
            [
                "Métrica",
                "Valor"
            ]
        ],
        body: [
            [
                "Total de Ventas",
                data.summary.totalSales.toString()
            ],
            [
                "Monto Total",
                formatMoney(data.summary.totalAmount)
            ],
            ...Object.entries(data.summary.byPaymentMethod).map(([method, info])=>[
                    `${method.charAt(0).toUpperCase() + method.slice(1)}`,
                    `${info.count} ventas - ${formatMoney(info.amount)}`
                ])
        ],
        theme: "striped",
        headStyles: {
            fillColor: COLORS.primary
        },
        margin: {
            left: 14,
            right: 14
        }
    });
    // Detalle de ventas
    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text("Detalle de Ventas", 14, finalY + 15);
    autoTable(doc, {
        startY: finalY + 20,
        head: [
            [
                "Fecha",
                "Hora",
                "Items",
                "Método",
                "Total"
            ]
        ],
        body: data.sales.map((s)=>[
                formatDate(s.date),
                new Date(s.date).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit"
                }),
                s.itemCount.toString(),
                s.paymentMethod,
                formatMoney(s.total)
            ]),
        theme: "striped",
        headStyles: {
            fillColor: COLORS.primary
        },
        margin: {
            left: 14,
            right: 14
        },
        styles: {
            fontSize: 9
        }
    });
    addFooter(doc);
    doc.save(`ventas_${formatDate(data.period.from)}_${formatDate(data.period.to)}.pdf`);
}
async function generateCashRegisterReportPDF(data, branchName) {
    const { jsPDF } = await __turbopack_context__.A("[project]/node_modules/jspdf/dist/jspdf.node.min.js [app-ssr] (ecmascript, async loader)");
    const { default: autoTable } = await __turbopack_context__.A("[project]/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs [app-ssr] (ecmascript, async loader)");
    const doc = new jsPDF();
    addHeader(doc, "REPORTE DE CAJA", `${branchName} | ${formatDate(data.register.date)}`);
    // Info de la caja
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text("Información del Turno", 14, 48);
    autoTable(doc, {
        startY: 52,
        body: [
            [
                "Empleado",
                data.register.employeeName || "N/A"
            ],
            [
                "Apertura",
                formatDateTime(data.register.openedAt)
            ],
            [
                "Cierre",
                data.register.closedAt ? formatDateTime(data.register.closedAt) : "En curso"
            ],
            [
                "Monto Inicial",
                formatMoney(data.register.openingAmount)
            ]
        ],
        theme: "plain",
        columnStyles: {
            0: {
                fontStyle: "bold",
                cellWidth: 50
            }
        },
        margin: {
            left: 14,
            right: 14
        }
    });
    let currentY = doc.lastAutoTable.finalY + 10;
    // Ventas
    doc.setFontSize(12);
    doc.text("Ventas del Turno", 14, currentY);
    autoTable(doc, {
        startY: currentY + 5,
        body: [
            [
                "Total Ventas",
                formatMoney(data.sales.total)
            ],
            [
                "Efectivo",
                formatMoney(data.sales.cash)
            ],
            [
                "Tarjeta",
                formatMoney(data.sales.card)
            ],
            [
                "Otros",
                formatMoney(data.sales.other)
            ]
        ],
        theme: "striped",
        columnStyles: {
            0: {
                fontStyle: "bold",
                cellWidth: 50
            }
        },
        margin: {
            left: 14,
            right: 14
        }
    });
    currentY = doc.lastAutoTable.finalY + 10;
    // Movimientos
    if (data.movements.length > 0) {
        doc.text("Movimientos de Caja", 14, currentY);
        autoTable(doc, {
            startY: currentY + 5,
            head: [
                [
                    "Hora",
                    "Tipo",
                    "Categoría",
                    "Descripción",
                    "Monto"
                ]
            ],
            body: data.movements.map((m)=>[
                    new Date(m.createdAt).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit"
                    }),
                    m.type === "ingreso" ? "+" : "-",
                    m.category,
                    m.description || "-",
                    formatMoney(m.type === "egreso" ? -m.amount : m.amount)
                ]),
            theme: "striped",
            headStyles: {
                fillColor: COLORS.primary
            },
            margin: {
                left: 14,
                right: 14
            },
            styles: {
                fontSize: 9
            }
        });
        currentY = doc.lastAutoTable.finalY + 10;
    }
    // Resumen final
    doc.setFontSize(12);
    doc.text("Arqueo de Caja", 14, currentY);
    const varianceColor = data.summary.variance !== null ? data.summary.variance >= 0 ? COLORS.success : COLORS.danger : COLORS.secondary;
    autoTable(doc, {
        startY: currentY + 5,
        body: [
            [
                "Caja Esperada",
                formatMoney(data.summary.expectedAmount)
            ],
            [
                "Caja Real",
                data.summary.actualAmount !== null ? formatMoney(data.summary.actualAmount) : "Pendiente"
            ],
            [
                "Diferencia",
                data.summary.variance !== null ? formatMoney(data.summary.variance) : "N/A"
            ]
        ],
        theme: "plain",
        columnStyles: {
            0: {
                fontStyle: "bold",
                cellWidth: 50
            }
        },
        didParseCell: (hookData)=>{
            if (hookData.row.index === 2 && hookData.column.index === 1) {
                hookData.cell.styles.textColor = varianceColor;
                hookData.cell.styles.fontStyle = "bold";
            }
        },
        margin: {
            left: 14,
            right: 14
        }
    });
    addFooter(doc);
    doc.save(`caja_${formatDate(data.register.date)}.pdf`);
}
async function generateStockReportPDF(data, branchName) {
    const { jsPDF } = await __turbopack_context__.A("[project]/node_modules/jspdf/dist/jspdf.node.min.js [app-ssr] (ecmascript, async loader)");
    const { default: autoTable } = await __turbopack_context__.A("[project]/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs [app-ssr] (ecmascript, async loader)");
    const doc = new jsPDF();
    addHeader(doc, "REPORTE DE STOCK", `${branchName} | ${formatDate(new Date().toISOString())}`);
    // Resumen
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text("Resumen de Inventario", 14, 48);
    autoTable(doc, {
        startY: 52,
        body: [
            [
                "Total de Productos",
                data.summary.totalProducts.toString()
            ],
            [
                "Unidades en Stock",
                data.summary.totalUnits.toString()
            ],
            [
                "Valor del Inventario (Costo)",
                formatMoney(data.summary.totalStockValue)
            ],
            [
                "Valor Potencial (Venta)",
                formatMoney(data.summary.totalPotentialRevenue)
            ]
        ],
        theme: "striped",
        columnStyles: {
            0: {
                fontStyle: "bold",
                cellWidth: 60
            }
        },
        margin: {
            left: 14,
            right: 14
        }
    });
    const finalY = doc.lastAutoTable.finalY;
    // Detalle de productos
    doc.setFontSize(12);
    doc.text("Detalle de Productos", 14, finalY + 15);
    autoTable(doc, {
        startY: finalY + 20,
        head: [
            [
                "Producto",
                "Categoría",
                "Stock",
                "Costo",
                "Precio",
                "Valor"
            ]
        ],
        body: data.products.map((p)=>[
                p.name,
                p.category || "-",
                p.stock.toString(),
                formatMoney(p.cost),
                formatMoney(p.salePrice),
                formatMoney(p.stockValue)
            ]),
        theme: "striped",
        headStyles: {
            fillColor: COLORS.primary
        },
        margin: {
            left: 14,
            right: 14
        },
        styles: {
            fontSize: 8
        },
        columnStyles: {
            0: {
                cellWidth: 50
            }
        }
    });
    addFooter(doc);
    doc.save(`stock_${formatDate(new Date().toISOString())}.pdf`);
}
async function generateExpiringProductsReportPDF(data, branchName) {
    const { jsPDF } = await __turbopack_context__.A("[project]/node_modules/jspdf/dist/jspdf.node.min.js [app-ssr] (ecmascript, async loader)");
    const { default: autoTable } = await __turbopack_context__.A("[project]/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs [app-ssr] (ecmascript, async loader)");
    const doc = new jsPDF();
    addHeader(doc, "PRODUCTOS POR VENCER", `${branchName} | ${formatDate(new Date().toISOString())}`);
    // Resumen
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text("Resumen de Riesgo", 14, 48);
    autoTable(doc, {
        startY: 52,
        body: [
            [
                "Total de Lotes",
                data.summary.totalBatches.toString()
            ],
            [
                "Unidades en Riesgo",
                data.summary.totalUnits.toString()
            ],
            [
                "Capital en Riesgo",
                formatMoney(data.summary.totalValueAtRisk)
            ]
        ],
        theme: "striped",
        columnStyles: {
            0: {
                fontStyle: "bold",
                cellWidth: 50
            }
        },
        headStyles: {
            fillColor: COLORS.warning
        },
        margin: {
            left: 14,
            right: 14
        }
    });
    const finalY = doc.lastAutoTable.finalY;
    // Detalle
    doc.setFontSize(12);
    doc.text("Detalle de Productos", 14, finalY + 15);
    autoTable(doc, {
        startY: finalY + 20,
        head: [
            [
                "Producto",
                "Cantidad",
                "Vencimiento",
                "Días",
                "Valor en Riesgo"
            ]
        ],
        body: data.products.map((p)=>[
                p.productName,
                p.quantity.toString(),
                formatDate(p.expirationDate),
                p.daysUntilExpiry <= 0 ? "VENCIDO" : `${p.daysUntilExpiry} días`,
                formatMoney(p.valueAtRisk)
            ]),
        theme: "striped",
        headStyles: {
            fillColor: COLORS.warning
        },
        margin: {
            left: 14,
            right: 14
        },
        styles: {
            fontSize: 9
        },
        didParseCell: (hookData)=>{
            if (hookData.column.index === 3 && hookData.section === "body") {
                const days = data.products[hookData.row.index]?.daysUntilExpiry;
                if (days !== undefined && days <= 0) {
                    hookData.cell.styles.textColor = COLORS.danger;
                    hookData.cell.styles.fontStyle = "bold";
                } else if (days !== undefined && days <= 3) {
                    hookData.cell.styles.textColor = COLORS.warning;
                }
            }
        }
    });
    addFooter(doc);
    doc.save(`productos_por_vencer_${formatDate(new Date().toISOString())}.pdf`);
}
}),
"[project]/lib/services/excel-generator.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Generador de reportes Excel para App-Kiosco
 * Usa xlsx para crear archivos Excel
 */ // xlsx is loaded dynamically inside each function to avoid adding ~400KB to the initial bundle
__turbopack_context__.s([
    "generateCashRegisterReportExcel",
    ()=>generateCashRegisterReportExcel,
    "generateExpiringProductsReportExcel",
    ()=>generateExpiringProductsReportExcel,
    "generateSalesReportExcel",
    ()=>generateSalesReportExcel,
    "generateStockReportExcel",
    ()=>generateStockReportExcel
]);
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}
function formatDateTime(dateStr) {
    return new Date(dateStr).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}
function downloadExcel(XLSX, workbook, filename) {
    const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array"
    });
    const blob = new Blob([
        excelBuffer
    ], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
async function generateSalesReportExcel(data, branchName) {
    const XLSX = await __turbopack_context__.A("[project]/node_modules/xlsx/xlsx.mjs [app-ssr] (ecmascript, async loader)");
    const workbook = XLSX.utils.book_new();
    // Hoja de resumen
    const summaryData = [
        [
            "REPORTE DE VENTAS"
        ],
        [
            "Sucursal:",
            branchName
        ],
        [
            "Período:",
            `${formatDate(data.period.from)} - ${formatDate(data.period.to)}`
        ],
        [
            "Generado:",
            new Date().toLocaleString("es-AR")
        ],
        [],
        [
            "RESUMEN"
        ],
        [
            "Total de Ventas",
            data.summary.totalSales
        ],
        [
            "Monto Total",
            data.summary.totalAmount
        ],
        [],
        [
            "DESGLOSE POR MÉTODO DE PAGO"
        ],
        [
            "Método",
            "Cantidad",
            "Monto"
        ],
        ...Object.entries(data.summary.byPaymentMethod).map(([method, info])=>[
                method,
                info.count,
                info.amount
            ])
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
    // Hoja de detalle
    const detailHeaders = [
        "ID",
        "Fecha",
        "Hora",
        "Items",
        "Método de Pago",
        "Empleado",
        "Total"
    ];
    const detailData = data.sales.map((s)=>[
            s.id,
            formatDate(s.date),
            new Date(s.date).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit"
            }),
            s.itemCount,
            s.paymentMethod,
            s.employeeName || "N/A",
            s.total
        ]);
    const detailSheet = XLSX.utils.aoa_to_sheet([
        detailHeaders,
        ...detailData
    ]);
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalle Ventas");
    downloadExcel(XLSX, workbook, `ventas_${formatDate(data.period.from)}_${formatDate(data.period.to)}.xlsx`);
}
async function generateCashRegisterReportExcel(data, branchName) {
    const XLSX = await __turbopack_context__.A("[project]/node_modules/xlsx/xlsx.mjs [app-ssr] (ecmascript, async loader)");
    const workbook = XLSX.utils.book_new();
    // Hoja principal
    const mainData = [
        [
            "REPORTE DE CAJA"
        ],
        [
            "Sucursal:",
            branchName
        ],
        [
            "Fecha:",
            formatDate(data.register.date)
        ],
        [
            "Generado:",
            new Date().toLocaleString("es-AR")
        ],
        [],
        [
            "INFORMACIÓN DEL TURNO"
        ],
        [
            "Empleado:",
            data.register.employeeName || "N/A"
        ],
        [
            "Apertura:",
            formatDateTime(data.register.openedAt)
        ],
        [
            "Cierre:",
            data.register.closedAt ? formatDateTime(data.register.closedAt) : "En curso"
        ],
        [
            "Monto Inicial:",
            data.register.openingAmount
        ],
        [],
        [
            "VENTAS DEL TURNO"
        ],
        [
            "Total Ventas:",
            data.sales.total
        ],
        [
            "Efectivo:",
            data.sales.cash
        ],
        [
            "Tarjeta:",
            data.sales.card
        ],
        [
            "Otros:",
            data.sales.other
        ],
        [],
        [
            "ARQUEO DE CAJA"
        ],
        [
            "Caja Esperada:",
            data.summary.expectedAmount
        ],
        [
            "Caja Real:",
            data.summary.actualAmount !== null ? data.summary.actualAmount : "Pendiente"
        ],
        [
            "Diferencia:",
            data.summary.variance !== null ? data.summary.variance : "N/A"
        ]
    ];
    const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
    XLSX.utils.book_append_sheet(workbook, mainSheet, "Resumen");
    // Hoja de movimientos
    if (data.movements.length > 0) {
        const movHeaders = [
            "Hora",
            "Tipo",
            "Categoría",
            "Descripción",
            "Monto"
        ];
        const movData = data.movements.map((m)=>[
                new Date(m.createdAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit"
                }),
                m.type,
                m.category,
                m.description || "-",
                m.type === "egreso" ? -m.amount : m.amount
            ]);
        const movSheet = XLSX.utils.aoa_to_sheet([
            movHeaders,
            ...movData
        ]);
        XLSX.utils.book_append_sheet(workbook, movSheet, "Movimientos");
    }
    downloadExcel(XLSX, workbook, `caja_${formatDate(data.register.date)}.xlsx`);
}
async function generateStockReportExcel(data, branchName) {
    const XLSX = await __turbopack_context__.A("[project]/node_modules/xlsx/xlsx.mjs [app-ssr] (ecmascript, async loader)");
    const workbook = XLSX.utils.book_new();
    // Hoja de resumen
    const summaryData = [
        [
            "REPORTE DE STOCK"
        ],
        [
            "Sucursal:",
            branchName
        ],
        [
            "Fecha:",
            formatDate(new Date().toISOString())
        ],
        [
            "Generado:",
            new Date().toLocaleString("es-AR")
        ],
        [],
        [
            "RESUMEN DE INVENTARIO"
        ],
        [
            "Total de Productos:",
            data.summary.totalProducts
        ],
        [
            "Unidades en Stock:",
            data.summary.totalUnits
        ],
        [
            "Valor del Inventario (Costo):",
            data.summary.totalStockValue
        ],
        [
            "Valor Potencial (Venta):",
            data.summary.totalPotentialRevenue
        ]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
    // Hoja de detalle
    const detailHeaders = [
        "ID",
        "Producto",
        "Categoría",
        "Código de Barras",
        "Stock",
        "Costo Unitario",
        "Precio Venta",
        "Valor Stock",
        "Valor Potencial"
    ];
    const detailData = data.products.map((p)=>[
            p.id,
            p.name,
            p.category || "-",
            p.barcode || "-",
            p.stock,
            p.cost,
            p.salePrice,
            p.stockValue,
            p.potentialRevenue
        ]);
    const detailSheet = XLSX.utils.aoa_to_sheet([
        detailHeaders,
        ...detailData
    ]);
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Productos");
    downloadExcel(XLSX, workbook, `stock_${formatDate(new Date().toISOString())}.xlsx`);
}
async function generateExpiringProductsReportExcel(data, branchName) {
    const XLSX = await __turbopack_context__.A("[project]/node_modules/xlsx/xlsx.mjs [app-ssr] (ecmascript, async loader)");
    const workbook = XLSX.utils.book_new();
    // Hoja de resumen
    const summaryData = [
        [
            "PRODUCTOS POR VENCER"
        ],
        [
            "Sucursal:",
            branchName
        ],
        [
            "Fecha:",
            formatDate(new Date().toISOString())
        ],
        [
            "Generado:",
            new Date().toLocaleString("es-AR")
        ],
        [],
        [
            "RESUMEN DE RIESGO"
        ],
        [
            "Total de Lotes:",
            data.summary.totalBatches
        ],
        [
            "Unidades en Riesgo:",
            data.summary.totalUnits
        ],
        [
            "Capital en Riesgo:",
            data.summary.totalValueAtRisk
        ]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
    // Hoja de detalle
    const detailHeaders = [
        "Producto",
        "ID Lote",
        "Cantidad",
        "Fecha Vencimiento",
        "Días Restantes",
        "Costo Unitario",
        "Valor en Riesgo"
    ];
    const detailData = data.products.map((p)=>[
            p.productName,
            p.batchId,
            p.quantity,
            formatDate(p.expirationDate),
            p.daysUntilExpiry <= 0 ? "VENCIDO" : p.daysUntilExpiry,
            p.cost,
            p.valueAtRisk
        ]);
    const detailSheet = XLSX.utils.aoa_to_sheet([
        detailHeaders,
        ...detailData
    ]);
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Productos");
    downloadExcel(XLSX, workbook, `productos_por_vencer_${formatDate(new Date().toISOString())}.xlsx`);
}
}),
"[project]/lib/offline/indexed-db.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 INDEXED DB SERVICE - Sistema de almacenamiento offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Servicio base para IndexedDB que maneja:
 * - Cache de productos por sucursal
 * - Cola de ventas pendientes de sincronización
 * - Metadata de sincronización
 *
 * IMPORTANTE: Este servicio solo corre en el cliente (browser)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ // ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────
__turbopack_context__.s([
    "STORES",
    ()=>STORES,
    "generateLocalId",
    ()=>generateLocalId,
    "offlineDB",
    ()=>offlineDB
]);
const DB_NAME = 'kiosco-offline';
const DB_VERSION = 2;
const STORES = {
    PRODUCTOS_CACHE: 'productos-cache',
    VENTAS_PENDIENTES: 'ventas-pendientes',
    SYNC_METADATA: 'sync-metadata'
};
// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────
class OfflineDB {
    db = null;
    dbPromise = null;
    /**
   * Verifica si IndexedDB está disponible
   */ isAvailable() {
        return ("TURBOPACK compile-time value", "undefined") !== 'undefined' && 'indexedDB' in window;
    }
    /**
   * Abre o crea la base de datos
   */ async open() {
        // Si ya está abierta, retornar
        if (this.db) {
            return this.db;
        }
        // Si hay una promesa en curso, esperar
        if (this.dbPromise) {
            return this.dbPromise;
        }
        // Verificar disponibilidad
        if (!this.isAvailable()) {
            throw new Error('IndexedDB no está disponible en este navegador');
        }
        // Crear promesa de apertura
        this.dbPromise = new Promise((resolve, reject)=>{
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = ()=>{
                this.dbPromise = null;
                reject(new Error(`Error abriendo IndexedDB: ${request.error?.message}`));
            };
            request.onsuccess = ()=>{
                this.db = request.result;
                this.dbPromise = null;
                // Manejar cierre inesperado
                this.db.onclose = ()=>{
                    this.db = null;
                };
                resolve(this.db);
            };
            request.onupgradeneeded = (event)=>{
                const db = event.target.result;
                // ─────────────────────────────────────────────────────────────────────
                // CREAR OBJECT STORES
                // ─────────────────────────────────────────────────────────────────────
                // Store: productos-cache
                if (!db.objectStoreNames.contains(STORES.PRODUCTOS_CACHE)) {
                    const productosStore = db.createObjectStore(STORES.PRODUCTOS_CACHE, {
                        keyPath: [
                            'id',
                            'sucursal_id'
                        ]
                    });
                    // Índices para búsqueda
                    productosStore.createIndex('sucursal_id', 'sucursal_id', {
                        unique: false
                    });
                    productosStore.createIndex('nombre', 'nombre', {
                        unique: false
                    });
                    productosStore.createIndex('codigo_barras', 'codigo_barras', {
                        unique: false
                    });
                    productosStore.createIndex('cached_at', 'cached_at', {
                        unique: false
                    });
                }
                // Store: ventas-pendientes
                if (!db.objectStoreNames.contains(STORES.VENTAS_PENDIENTES)) {
                    const ventasStore = db.createObjectStore(STORES.VENTAS_PENDIENTES, {
                        keyPath: 'id'
                    });
                    // Índices para consulta
                    ventasStore.createIndex('estado', 'estado', {
                        unique: false
                    });
                    ventasStore.createIndex('sucursal_id', 'sucursal_id', {
                        unique: false
                    });
                    ventasStore.createIndex('created_at', 'created_at', {
                        unique: false
                    });
                }
                // Store: sync-metadata
                if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
                    db.createObjectStore(STORES.SYNC_METADATA, {
                        keyPath: 'key'
                    });
                }
            };
        });
        return this.dbPromise;
    }
    /**
   * Cierra la conexión a la base de datos
   */ close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES GENÉRICAS
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Ejecuta una transacción con un store
   */ async transaction(storeName, mode, operation) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const request = operation(store);
            request.onsuccess = ()=>resolve(request.result);
            request.onerror = ()=>reject(request.error);
        });
    }
    /**
   * Obtiene todos los registros de un store
   */ async getAll(storeName) {
        return this.transaction(storeName, 'readonly', (store)=>store.getAll());
    }
    /**
   * Obtiene un registro por clave
   */ async get(storeName, key) {
        return this.transaction(storeName, 'readonly', (store)=>store.get(key));
    }
    /**
   * Guarda un registro (insert o update)
   */ async put(storeName, value) {
        return this.transaction(storeName, 'readwrite', (store)=>store.put(value));
    }
    /**
   * Elimina un registro por clave
   */ async delete(storeName, key) {
        return this.transaction(storeName, 'readwrite', (store)=>store.delete(key));
    }
    /**
   * Elimina todos los registros de un store
   */ async clear(storeName) {
        return this.transaction(storeName, 'readwrite', (store)=>store.clear());
    }
    /**
   * Cuenta registros en un store
   */ async count(storeName) {
        return this.transaction(storeName, 'readonly', (store)=>store.count());
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES DE PRODUCTOS CACHE
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Guarda productos en cache para una sucursal
   */ async cacheProductos(productos) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readwrite');
            const store = transaction.objectStore(STORES.PRODUCTOS_CACHE);
            transaction.oncomplete = ()=>resolve();
            transaction.onerror = ()=>reject(transaction.error);
            // Guardar cada producto
            for (const producto of productos){
                store.put(producto);
            }
        });
    }
    /**
   * Obtiene productos cacheados de una sucursal
   */ async getProductosBySucursal(sucursalId) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readonly');
            const store = transaction.objectStore(STORES.PRODUCTOS_CACHE);
            const index = store.index('sucursal_id');
            const request = index.getAll(sucursalId);
            request.onsuccess = ()=>resolve(request.result);
            request.onerror = ()=>reject(request.error);
        });
    }
    /**
   * Busca productos en cache (offline search)
   */ async searchProductosOffline(sucursalId, query) {
        const productos = await this.getProductosBySucursal(sucursalId);
        const queryLower = query.toLowerCase();
        return productos.filter((p)=>{
            // Excluir servicios virtuales
            if (p.nombre === 'Carga SUBE' || p.nombre === 'Carga Virtual') {
                return false;
            }
            // Buscar por nombre o código de barras
            const matchNombre = p.nombre.toLowerCase().includes(queryLower);
            const matchCodigo = p.codigo_barras === query;
            return matchNombre || matchCodigo;
        }).slice(0, 5) // Límite de 5 como en la búsqueda online
        ;
    }
    /**
   * Elimina productos cacheados de una sucursal
   */ async clearProductosBySucursal(sucursalId) {
        const productos = await this.getProductosBySucursal(sucursalId);
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.PRODUCTOS_CACHE, 'readwrite');
            const store = transaction.objectStore(STORES.PRODUCTOS_CACHE);
            transaction.oncomplete = ()=>resolve();
            transaction.onerror = ()=>reject(transaction.error);
            // Eliminar cada producto de esta sucursal
            for (const producto of productos){
                store.delete([
                    producto.id,
                    producto.sucursal_id
                ]);
            }
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES DE VENTAS PENDIENTES
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Guarda una venta pendiente
   */ async saveVentaPendiente(venta) {
        await this.put(STORES.VENTAS_PENDIENTES, venta);
    }
    /**
   * Obtiene todas las ventas pendientes
   */ async getVentasPendientes() {
        return this.getAll(STORES.VENTAS_PENDIENTES);
    }
    /**
   * Obtiene ventas pendientes por estado
   */ async getVentasByEstado(estado) {
        const db = await this.open();
        return new Promise((resolve, reject)=>{
            const transaction = db.transaction(STORES.VENTAS_PENDIENTES, 'readonly');
            const store = transaction.objectStore(STORES.VENTAS_PENDIENTES);
            const index = store.index('estado');
            const request = index.getAll(estado);
            request.onsuccess = ()=>resolve(request.result);
            request.onerror = ()=>reject(request.error);
        });
    }
    /**
   * Obtiene ventas que necesitan sincronización (pending o failed)
   */ async getVentasParaSincronizar() {
        const todas = await this.getVentasPendientes();
        return todas.filter((v)=>v.estado === 'pending' || v.estado === 'failed');
    }
    /**
   * Obtiene todas las ventas pendientes (alias para compatibilidad)
   */ async getAllVentasPendientes() {
        return this.getVentasPendientes();
    }
    /**
   * Cuenta ventas pendientes de sync
   */ async countVentasPendientesSync() {
        const ventas = await this.getVentasParaSincronizar();
        return ventas.length;
    }
    /**
   * Actualiza el estado de una venta pendiente
   */ async updateVentaEstado(id, estado, extra) {
        const venta = await this.get(STORES.VENTAS_PENDIENTES, id);
        if (!venta) {
            throw new Error(`Venta ${id} no encontrada`);
        }
        const updated = {
            ...venta,
            estado,
            intentos: estado === 'syncing' ? venta.intentos + 1 : venta.intentos,
            ultimo_intento: estado === 'syncing' ? Date.now() : venta.ultimo_intento,
            ...extra
        };
        await this.put(STORES.VENTAS_PENDIENTES, updated);
    }
    /**
   * Elimina una venta pendiente
   */ async deleteVentaPendiente(id) {
        await this.delete(STORES.VENTAS_PENDIENTES, id);
    }
    /**
   * Elimina ventas sincronizadas exitosamente (limpieza)
   */ async clearVentasSincronizadas() {
        const sincronizadas = await this.getVentasByEstado('synced');
        for (const venta of sincronizadas){
            await this.deleteVentaPendiente(venta.id);
        }
        return sincronizadas.length;
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // OPERACIONES DE METADATA
    // ─────────────────────────────────────────────────────────────────────────────
    /**
   * Guarda metadata de sincronización
   */ async setMetadata(key, value) {
        const metadata = {
            key,
            value,
            updated_at: Date.now()
        };
        await this.put(STORES.SYNC_METADATA, metadata);
    }
    /**
   * Obtiene metadata de sincronización
   */ async getMetadata(key) {
        return this.get(STORES.SYNC_METADATA, key);
    }
    /**
   * Obtiene el timestamp de última sincronización de productos
   */ async getLastProductosSyncTime(sucursalId) {
        const metadata = await this.getMetadata(`productos-sync-${sucursalId}`);
        return metadata ? metadata.value : null;
    }
    /**
   * Guarda el timestamp de sincronización de productos
   */ async setLastProductosSyncTime(sucursalId) {
        await this.setMetadata(`productos-sync-${sucursalId}`, Date.now());
    }
}
const offlineDB = new OfflineDB();
function generateLocalId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback para navegadores antiguos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c)=>{
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
}
}),
"[project]/lib/offline/product-cache.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📦 PRODUCT CACHE SERVICE - Cache de productos para modo offline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Servicio para mantener productos cacheados localmente y permitir:
 * - Búsqueda de productos sin conexión
 * - Sincronización automática cuando hay conexión
 * - Invalidación de cache por tiempo o manualmente
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ __turbopack_context__.s([
    "productCache",
    ()=>productCache
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/offline/indexed-db.ts [app-ssr] (ecmascript)");
;
// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────
/**
 * Tiempo de vida del cache en milisegundos (15 minutos)
 */ const CACHE_TTL_MS = 15 * 60 * 1000;
/**
 * Intervalo mínimo entre sincronizaciones (5 minutos)
 */ const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────
class ProductCacheService {
    syncingFor = new Set();
    syncPromises = new Map();
    /**
   * Verifica si el cache está disponible (cliente con IndexedDB)
   */ isAvailable() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].isAvailable();
    }
    /**
   * Verifica si el cache de una sucursal está obsoleto
   */ async isCacheStale(sucursalId) {
        const lastSync = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getLastProductosSyncTime(sucursalId);
        if (!lastSync) return true;
        const age = Date.now() - lastSync;
        return age > CACHE_TTL_MS;
    }
    /**
   * Verifica si podemos sincronizar (respeta el intervalo mínimo)
   */ async canSync(sucursalId) {
        if (this.syncingFor.has(sucursalId)) {
            return false;
        }
        const lastSync = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getLastProductosSyncTime(sucursalId);
        if (!lastSync) return true;
        const timeSinceLastSync = Date.now() - lastSync;
        return timeSinceLastSync >= MIN_SYNC_INTERVAL_MS;
    }
    /**
   * Sincroniza productos desde el servidor al cache local
   *
   * @param sucursalId - ID de la sucursal
   * @param fetchFn - Función para obtener productos del servidor
   * @param force - Forzar sincronización ignorando intervalo mínimo
   */ async syncFromServer(sucursalId, fetchFn, force = false) {
        // Verificar si ya estamos sincronizando
        if (this.syncingFor.has(sucursalId)) {
            // Esperar la sincronización en curso
            const existingPromise = this.syncPromises.get(sucursalId);
            if (existingPromise) {
                await existingPromise;
            }
            const count = (await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId)).length;
            return {
                success: true,
                count
            };
        }
        // Verificar intervalo mínimo
        if (!force && !await this.canSync(sucursalId)) {
            const count = (await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId)).length;
            return {
                success: true,
                count
            };
        }
        // Marcar como sincronizando
        this.syncingFor.add(sucursalId);
        const syncPromise = (async ()=>{
            try {
                // Obtener productos del servidor
                const productos = await fetchFn();
                // Convertir a formato cache
                const productosCache = productos.map((p)=>({
                        ...p,
                        cached_at: Date.now()
                    }));
                // Limpiar cache anterior de esta sucursal
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].clearProductosBySucursal(sucursalId);
                // Guardar nuevos productos
                if (productosCache.length > 0) {
                    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].cacheProductos(productosCache);
                }
                // Actualizar timestamp de sync
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].setLastProductosSyncTime(sucursalId);
                return {
                    success: true,
                    count: productosCache.length
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                return {
                    success: false,
                    count: 0,
                    error: errorMessage
                };
            } finally{
                this.syncingFor.delete(sucursalId);
                this.syncPromises.delete(sucursalId);
            }
        })();
        this.syncPromises.set(sucursalId, syncPromise.then(()=>{}));
        return syncPromise;
    }
    /**
   * Busca productos en el cache local
   */ async searchOffline(sucursalId, query) {
        if (!query || query.trim().length === 0) {
            return [];
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].searchProductosOffline(sucursalId, query.trim());
    }
    /**
   * Obtiene todos los productos cacheados de una sucursal
   */ async getAll(sucursalId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
    }
    /**
   * Obtiene el estado del cache para una sucursal
   */ async getStatus(sucursalId) {
        const productos = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
        const lastSyncAt = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getLastProductosSyncTime(sucursalId);
        const isStale = await this.isCacheStale(sucursalId);
        const isSyncing = this.syncingFor.has(sucursalId);
        return {
            sucursalId,
            productCount: productos.length,
            lastSyncAt,
            isStale,
            isSyncing
        };
    }
    /**
   * Invalida el cache de una sucursal (fuerza re-sync en próxima búsqueda)
   */ async invalidate(sucursalId) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].clearProductosBySucursal(sucursalId);
        // También limpiamos el timestamp para forzar re-sync
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].setMetadata(`productos-sync-${sucursalId}`, 0);
    }
    /**
   * Limpia todo el cache de productos
   */ async clearAll() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].clear('productos-cache');
    }
    /**
   * Actualiza el stock de un producto en cache
   * (útil después de una venta offline para mantener consistencia visual)
   */ async updateStock(productoId, sucursalId, nuevoStock) {
        const productos = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
        const producto = productos.find((p)=>p.id === productoId);
        if (producto) {
            const updated = {
                ...producto,
                stock_disponible: Math.max(0, nuevoStock)
            };
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].put('productos-cache', updated);
        }
    }
    /**
   * Reduce el stock de un producto en cache
   * (útil después de agregar al carrito offline)
   */ async reduceStock(productoId, sucursalId, cantidad) {
        const productos = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getProductosBySucursal(sucursalId);
        const producto = productos.find((p)=>p.id === productoId);
        if (producto) {
            await this.updateStock(productoId, sucursalId, producto.stock_disponible - cantidad);
        }
    }
}
const productCache = new ProductCacheService();
}),
"[project]/lib/offline/sync-manager.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 SYNC MANAGER - Gestor de sincronización offline/online
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Gestiona la sincronización de ventas pendientes cuando el dispositivo
 * recupera la conexión a internet.
 *
 * CARACTERÍSTICAS:
 * - Sincronización automática al detectar reconexión
 * - Backoff exponencial para reintentos
 * - Eventos para notificar progreso
 * - Prevención de sincronizaciones duplicadas
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */ __turbopack_context__.s([
    "SyncManager",
    ()=>SyncManager,
    "createSyncManager",
    ()=>createSyncManager,
    "getSyncManager",
    ()=>getSyncManager
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/offline/indexed-db.ts [app-ssr] (ecmascript)");
;
// ───────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ───────────────────────────────────────────────────────────────────────────────
/**
 * Configuración de backoff exponencial
 */ const BACKOFF_CONFIG = {
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 32000,
    MAX_RETRIES: 5,
    MULTIPLIER: 2
};
/**
 * Delay después de reconectar antes de iniciar sync
 */ const RECONNECT_DELAY_MS = 2000;
// ───────────────────────────────────────────────────────────────────────────────
// CLASE PRINCIPAL
// ───────────────────────────────────────────────────────────────────────────────
class SyncManager {
    config;
    isSyncing = false;
    status = 'idle';
    abortController = null;
    constructor(config = {}){
        this.config = {
            syncEndpoint: config.syncEndpoint || '/api/ventas/sync',
            autoSync: config.autoSync ?? true,
            handlers: config.handlers
        };
    }
    /**
   * Obtiene el estado actual de sincronización
   */ getStatus() {
        return this.status;
    }
    /**
   * Verifica si hay sincronización en curso
   */ isSyncInProgress() {
        return this.isSyncing;
    }
    /**
   * Calcula el delay con backoff exponencial
   */ calculateBackoffDelay(attempt) {
        const delay = Math.min(BACKOFF_CONFIG.BASE_DELAY_MS * Math.pow(BACKOFF_CONFIG.MULTIPLIER, attempt), BACKOFF_CONFIG.MAX_DELAY_MS);
        // Añadir jitter para evitar thundering herd
        const jitter = Math.random() * 0.3 * delay;
        return Math.floor(delay + jitter);
    }
    /**
   * Espera un tiempo determinado
   */ delay(ms) {
        return new Promise((resolve)=>setTimeout(resolve, ms));
    }
    /**
   * Sincroniza una venta individual al servidor
   */ async syncVenta(venta) {
        try {
            const response = await fetch(this.config.syncEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    localId: venta.id,
                    sucursalId: venta.sucursal_id,
                    turnoId: venta.turno_id,
                    organizationId: venta.organization_id,
                    items: venta.items,
                    metodoPago: venta.metodo_pago,
                    montoTotal: venta.monto_total,
                    vendedorId: venta.vendedor_id,
                    createdAt: venta.created_at
                }),
                signal: this.abortController?.signal
            });
            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${errorText}`
                };
            }
            const result = await response.json();
            return result;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Sincronización cancelada'
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error de red'
            };
        }
    }
    /**
   * Sincroniza todas las ventas pendientes
   */ async syncAll() {
        // Prevenir sincronizaciones duplicadas
        if (this.isSyncing) {
            return {
                success: false,
                syncedCount: 0,
                failedCount: 0,
                errors: [
                    {
                        ventaId: '',
                        error: 'Sincronización ya en curso'
                    }
                ]
            };
        }
        this.isSyncing = true;
        this.status = 'syncing';
        this.abortController = new AbortController();
        const result = {
            success: true,
            syncedCount: 0,
            failedCount: 0,
            errors: []
        };
        try {
            // Obtener ventas pendientes
            const ventasPendientes = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getVentasParaSincronizar();
            if (ventasPendientes.length === 0) {
                this.status = 'success';
                return result;
            }
            // Notificar inicio
            this.config.handlers?.onStart?.();
            const progress = {
                total: ventasPendientes.length,
                completed: 0,
                failed: 0,
                current: null
            };
            // Procesar cada venta secuencialmente
            for (const venta of ventasPendientes){
                // Verificar si se canceló
                if (this.abortController.signal.aborted) {
                    break;
                }
                // Verificar límite de reintentos
                if (venta.intentos >= BACKOFF_CONFIG.MAX_RETRIES) {
                    progress.failed++;
                    result.failedCount++;
                    result.errors.push({
                        ventaId: venta.id,
                        error: `Máximo de reintentos (${BACKOFF_CONFIG.MAX_RETRIES}) alcanzado`
                    });
                    continue;
                }
                progress.current = venta.id;
                this.config.handlers?.onProgress?.(progress);
                // Marcar como sincronizando
                await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].updateVentaEstado(venta.id, 'syncing');
                // Calcular delay si es reintento
                if (venta.intentos > 0) {
                    const backoffDelay = this.calculateBackoffDelay(venta.intentos);
                    await this.delay(backoffDelay);
                }
                // Intentar sincronizar
                const syncResult = await this.syncVenta(venta);
                if (syncResult.success && syncResult.ventaId) {
                    // Éxito
                    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].updateVentaEstado(venta.id, 'synced', {
                        venta_id_servidor: syncResult.ventaId,
                        synced_at: Date.now()
                    });
                    progress.completed++;
                    result.syncedCount++;
                    this.config.handlers?.onVentaSynced?.(venta, syncResult.ventaId);
                } else {
                    // Error
                    const errorMessage = syncResult.error || 'Error desconocido';
                    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].updateVentaEstado(venta.id, 'failed', {
                        ultimo_error: errorMessage
                    });
                    progress.failed++;
                    result.failedCount++;
                    result.errors.push({
                        ventaId: venta.id,
                        error: errorMessage
                    });
                    this.config.handlers?.onVentaFailed?.(venta, errorMessage);
                }
                this.config.handlers?.onProgress?.(progress);
            }
            // Limpiar ventas sincronizadas
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].clearVentasSincronizadas();
            // Determinar estado final
            result.success = result.failedCount === 0;
            this.status = result.success ? 'success' : 'error';
            // Notificar completado
            this.config.handlers?.onComplete?.(result);
            return result;
        } catch (error) {
            this.status = 'error';
            const errorInstance = error instanceof Error ? error : new Error('Error desconocido');
            this.config.handlers?.onError?.(errorInstance);
            return {
                success: false,
                syncedCount: result.syncedCount,
                failedCount: result.failedCount,
                errors: [
                    ...result.errors,
                    {
                        ventaId: '',
                        error: errorInstance.message
                    }
                ]
            };
        } finally{
            this.isSyncing = false;
            this.abortController = null;
        }
    }
    /**
   * Cancela la sincronización en curso
   */ cancel() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }
    /**
   * Reintenta las ventas fallidas (resetea el contador de intentos)
   */ async retryFailed() {
        const ventasConError = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getVentasByEstado('failed');
        for (const venta of ventasConError){
            // Resetear a pendiente para nuevo intento
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].put('ventas-pendientes', {
                ...venta,
                estado: 'pending',
                intentos: 0,
                ultimo_error: null
            });
        }
    }
    /**
   * Obtiene estadísticas de ventas pendientes
   */ async getStats() {
        const todas = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$offline$2f$indexed$2d$db$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["offlineDB"].getVentasPendientes();
        return {
            pendientes: todas.filter((v)=>v.estado === 'pending').length,
            sincronizando: todas.filter((v)=>v.estado === 'syncing').length,
            errores: todas.filter((v)=>v.estado === 'failed').length,
            sincronizadas: todas.filter((v)=>v.estado === 'synced').length
        };
    }
}
function createSyncManager(config) {
    return new SyncManager({
        syncEndpoint: '/api/ventas/sync',
        autoSync: true,
        ...config
    });
}
/**
 * Instancia singleton por defecto
 */ let defaultSyncManager = null;
function getSyncManager() {
    if (!defaultSyncManager) {
        defaultSyncManager = createSyncManager();
    }
    return defaultSyncManager;
}
;
}),
];

//# sourceMappingURL=lib_12657522._.js.map