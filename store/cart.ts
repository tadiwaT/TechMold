// store/cart.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CartItem, Product, Customer, PaymentMethod } from '@/types'

interface CartState {
  items: CartItem[]
  customer: Customer | null
  discount: number
  paymentMethod: PaymentMethod
  notes: string
  
  // Actions
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemDiscount: (productId: string, discount: number) => void
  setCustomer: (customer: Customer | null) => void
  setDiscount: (discount: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setNotes: (notes: string) => void
  clearCart: () => void
  
  // Computed
  subtotal: () => number
  taxAmount: () => number
  discountAmount: () => number
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      discount: 0,
      paymentMethod: 'cash',
      notes: '',

      addItem: (product: Product) => {
        set((state) => {
          const existing = state.items.find(i => i.product.id === product.id)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.product.price * (1 - i.discount / 100) }
                  : i
              )
            }
          }
          return {
            items: [...state.items, {
              product,
              quantity: 1,
              discount: 0,
              subtotal: product.price
            }]
          }
        })
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter(i => i.product.id !== productId)
        }))
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity < 1) {
          get().removeItem(productId)
          return
        }
        set((state) => ({
          items: state.items.map(i =>
            i.product.id === productId
              ? { ...i, quantity, subtotal: quantity * i.product.price * (1 - i.discount / 100) }
              : i
          )
        }))
      },

      updateItemDiscount: (productId: string, discount: number) => {
        set((state) => ({
          items: state.items.map(i =>
            i.product.id === productId
              ? { ...i, discount, subtotal: i.quantity * i.product.price * (1 - discount / 100) }
              : i
          )
        }))
      },

      setCustomer: (customer) => set({ customer }),
      setDiscount: (discount) => set({ discount }),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setNotes: (notes) => set({ notes }),

      clearCart: () => set({
        items: [],
        customer: null,
        discount: 0,
        paymentMethod: 'cash',
        notes: ''
      }),

      subtotal: () => {
        return get().items.reduce((sum, item) => sum + item.subtotal, 0)
      },

      taxAmount: () => {
        const subtotal = get().subtotal()
        const discountAmt = get().discountAmount()
        const taxableAmount = subtotal - discountAmt
        const avgTaxRate = get().items.length > 0
          ? get().items.reduce((sum, item) => sum + item.product.tax_rate, 0) / get().items.length
          : 15
        return (taxableAmount * avgTaxRate) / 100
      },

      discountAmount: () => {
        const subtotal = get().subtotal()
        return (subtotal * get().discount) / 100
      },

      total: () => {
        return get().subtotal() - get().discountAmount() + get().taxAmount()
      },

      itemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      }
    }),
    {
      name: 'techmold-cart',
      partialize: (state) => ({
        items: state.items,
        customer: state.customer,
        discount: state.discount,
        paymentMethod: state.paymentMethod,
        notes: state.notes
      })
    }
  )
)
