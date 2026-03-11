// types/index.ts

export interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  category: string
  brand: string
  description?: string
  price: number
  cost_price: number
  stock_quantity: number
  min_stock_level: number
  image_url?: string
  is_active: boolean
  tax_rate: number
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  loyalty_points: number
  total_spent: number
  visit_count: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface CartItem {
  product: Product
  quantity: number
  discount: number
  subtotal: number
}

export interface Sale {
  id: string
  receipt_number: string
  customer_id?: string
  customer?: Customer
  items: SaleItem[]
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  payment_method: PaymentMethod
  payment_status: 'pending' | 'completed' | 'refunded' | 'partial'
  cash_received?: number
  change_amount?: number
  notes?: string
  cashier_id: string
  cashier_name: string
  created_at: string
  updated_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  discount: number
  tax_rate: number
  subtotal: number
}

export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'split'

export interface StockMovement {
  id: string
  product_id: string
  type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'transfer'
  quantity: number
  reference?: string
  notes?: string
  created_at: string
}

export interface DashboardStats {
  today_sales: number
  today_transactions: number
  today_items_sold: number
  monthly_sales: number
  top_products: TopProduct[]
  recent_sales: Sale[]
  low_stock_products: Product[]
  sales_chart: SalesChartData[]
}

export interface TopProduct {
  product_id: string
  product_name: string
  total_quantity: number
  total_revenue: number
}

export interface SalesChartData {
  date: string
  sales: number
  transactions: number
}

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'cashier'
  is_active: boolean
  created_at: string
}

export interface Notification {
  id: string
  type: 'low_stock' | 'new_sale' | 'system' | 'alert'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface ReceiptData {
  sale: Sale
  store_name: string
  store_address: string
  store_phone: string
  store_email: string
}
