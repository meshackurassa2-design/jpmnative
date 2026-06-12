// lib/cart.tsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface CartItem {
  id: string
  name: string
  price: string
  image_url?: string
  shopId: string
  shopName: string
  shopCity?: string
  sellerId: string
  settings?: any
}

interface CartContextType {
  items: CartItem[]
  addToCart: (item: CartItem, customPrice?: string) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  cartTotal: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  // Load cart on mount
  useEffect(() => {
    AsyncStorage.getItem('@cart').then(stored => {
      if (stored) setItems(JSON.parse(stored))
    })
  }, [])

  // Save cart on change
  useEffect(() => {
    AsyncStorage.setItem('@cart', JSON.stringify(items))
  }, [items])

  const addToCart = (item: CartItem, customPrice?: string) => {
    setItems(prev => {
      // Don't add duplicates
      if (prev.some(i => i.id === item.id)) return prev
      if (customPrice) {
        item.price = customPrice
      }
      return [...prev, item]
    })
  }

  const removeFromCart = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const clearCart = () => setItems([])

  const cartTotal = items.reduce((sum, item) => {
    const priceNum = parseFloat(item.price.replace(/[^\d.]/g, '')) || 0
    return sum + priceNum
  }, 0)

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, cartTotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within a CartProvider')
  return context
}
