"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"

export interface CartItem {
  id: string
  name: string
  price: number
  stock: number
  cantidad: number
  barcode?: string | null
  emoji?: string | null
}

export interface UseCartOptions {
  onItemAdded?: (item: CartItem) => void
  onItemRemoved?: (itemId: string) => void
}

export function useCart(options: UseCartOptions = {}) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = useCallback(
    (product: Omit<CartItem, "cantidad">) => {
      setItems((prev) => {
        const existing = prev.find((p) => p.id === product.id)
        if (existing) {
          return prev.map((p) =>
            p.id === product.id ? { ...p, cantidad: p.cantidad + 1 } : p
          )
        }
        const newItem = { ...product, cantidad: 1 }
        options.onItemAdded?.(newItem)
        return [...prev, newItem]
      })
      toast.success(`+1 ${product.name}`, {
        position: "bottom-center",
        duration: 800,
      })
    },
    [options]
  )

  const removeItem = useCallback(
    (itemId: string) => {
      setItems((prev) => prev.filter((item) => item.id !== itemId))
      options.onItemRemoved?.(itemId)
    },
    [options]
  )

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === itemId ? { ...p, cantidad: Math.max(1, p.cantidad + delta) } : p
      )
    )
  }, [])

  const incrementItem = useCallback(
    (itemId: string) => updateQuantity(itemId, 1),
    [updateQuantity]
  )

  const decrementItem = useCallback(
    (itemId: string) => updateQuantity(itemId, -1),
    [updateQuantity]
  )

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const getTotal = useCallback(() => {
    return items.reduce((total, item) => total + item.price * item.cantidad, 0)
  }, [items])

  const getItemCount = useCallback(() => {
    return items.reduce((count, item) => count + item.cantidad, 0)
  }, [items])

  const isEmpty = items.length === 0

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    incrementItem,
    decrementItem,
    clearCart,
    getTotal,
    getItemCount,
    isEmpty,
  }
}
