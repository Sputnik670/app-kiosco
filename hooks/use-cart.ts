"use client"

import { useState, useCallback, useRef } from "react"
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

// Objeto vacío estable para evitar recrear funciones cada render
// cuando se llama useCart() sin argumentos
const EMPTY_OPTIONS: UseCartOptions = {}

export function useCart(options: UseCartOptions = EMPTY_OPTIONS) {
  const [items, setItems] = useState<CartItem[]>([])
  // Usar ref para callbacks opcionales — evita que addItem/removeItem
  // se recreen cuando el consumer pasa un objeto options nuevo cada render
  const optionsRef = useRef(options)
  optionsRef.current = options

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
        optionsRef.current.onItemAdded?.(newItem)
        return [...prev, newItem]
      })
      toast.success(`+1 ${product.name}`, {
        position: "bottom-center",
        duration: 800,
      })
    },
    [] // estable — usa optionsRef en vez de options
  )

  const removeItem = useCallback(
    (itemId: string) => {
      setItems((prev) => prev.filter((item) => item.id !== itemId))
      optionsRef.current.onItemRemoved?.(itemId)
    },
    [] // estable
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
