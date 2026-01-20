"use client"

import { useState, useEffect } from "react"
import { Package, Wallet } from "lucide-react"
import { getCapitalSummaryAction } from "@/lib/actions/inventory.actions"

interface CapitalBadgesProps {
    organizationId: string
    formatMoney: (val: number) => string
}

export function CapitalBadges({ organizationId, formatMoney }: CapitalBadgesProps) {
    const [capitalFisico, setCapitalFisico] = useState(0)
    const [saldoVirtual, setSaldoVirtual] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchCapitalSummary = async () => {
            if (!organizationId) return

            setLoading(true)
            const result = await getCapitalSummaryAction(organizationId)

            if (result.success) {
                setCapitalFisico(result.capitalFisico)
                setSaldoVirtual(result.saldoVirtual)
            }
            setLoading(false)
        }

        fetchCapitalSummary()
    }, [organizationId])

    return (
        <div className="flex gap-3">
            {/* Capital Físico */}
            <div className="text-right bg-white/5 rounded-2xl px-4 py-2 border border-white/10 backdrop-blur-sm">
                <p className="text-[9px] text-emerald-300 font-black uppercase tracking-widest flex items-center justify-end gap-1">
                    <Package className="h-3 w-3" /> Capital Físico
                </p>
                <p className="text-lg font-black text-emerald-400 tabular-nums">
                    {formatMoney(capitalFisico)}
                </p>
            </div>

            {/* Saldo Virtual */}
            <div className="text-right bg-white/5 rounded-2xl px-4 py-2 border border-white/10 backdrop-blur-sm">
                <p className="text-[9px] text-blue-300 font-black uppercase tracking-widest flex items-center justify-end gap-1">
                    <Wallet className="h-3 w-3" /> Saldo Virtual
                </p>
                <p className="text-lg font-black text-blue-400 tabular-nums">
                    {formatMoney(saldoVirtual)}
                </p>
            </div>

            {/* Total (opcional, comentado por ahora) */}
            {/* 
            <div className="text-right bg-white/10 rounded-2xl px-4 py-2 border-2 border-white/20">
                <p className="text-[9px] text-white/70 font-black uppercase">Total</p>
                <p className="text-xl font-black text-white">
                    {formatMoney(capitalTotal)}
                </p>
            </div>
            */}
        </div>
    )
}