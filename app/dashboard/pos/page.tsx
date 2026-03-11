'use client'
// app/dashboard/pos/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import { Product, Customer } from '@/types'
import { formatCurrency, debounce } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(['All'])
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const supabase = createClient()
  
  const cart = useCartStore()

  useEffect(() => {
    loadProducts()
    loadCustomers()
  }, [])

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (error) { toast.error('Failed to load products'); return }
    setProducts(data || [])
    setFilteredProducts(data || [])
    const cats = ['All', ...new Set((data || []).map(p => p.category))]
    setCategories(cats)
    setLoading(false)
  }

  async function loadCustomers() {
    const { data } = await supabase.from('customers').select('*').order('name').limit(100)
    setCustomers(data || [])
  }

  const filterProducts = useCallback(
    debounce((term: string, cat: string) => {
      let filtered = products
      if (term) filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term.toLowerCase()) ||
        p.sku.toLowerCase().includes(term.toLowerCase()) ||
        (p.barcode || '').includes(term)
      )
      if (cat !== 'All') filtered = filtered.filter(p => p.category === cat)
      setFilteredProducts(filtered)
    }, 200),
    [products]
  )

  useEffect(() => { filterProducts(search, category) }, [search, category, filterProducts])

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  ).slice(0, 10)

  async function processPayment() {
    if (cart.items.length === 0) { toast.error('Cart is empty'); return }
    setProcessingPayment(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single()
      
      const total = cart.total()
      const cashAmt = parseFloat(cashReceived) || 0
      
      if (cart.paymentMethod === 'cash' && cashAmt < total) {
        toast.error('Insufficient cash received')
        setProcessingPayment(false)
        return
      }

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_id: cart.customer?.id || null,
          subtotal: cart.subtotal(),
          tax_amount: cart.taxAmount(),
          discount_amount: cart.discountAmount(),
          total_amount: total,
          payment_method: cart.paymentMethod,
          payment_status: 'completed',
          cash_received: cart.paymentMethod === 'cash' ? cashAmt : null,
          change_amount: cart.paymentMethod === 'cash' ? cashAmt - total : null,
          notes: cart.notes,
          cashier_id: user!.id,
          cashier_name: profile?.full_name || user!.email || 'Staff',
        })
        .select()
        .single()

      if (saleError) throw saleError

      const saleItems = cart.items.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name,
        product_sku: item.product.sku,
        quantity: item.quantity,
        unit_price: item.product.price,
        discount: item.discount,
        tax_rate: item.product.tax_rate,
        subtotal: item.subtotal,
      }))

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
      if (itemsError) throw itemsError

      toast.success(`Sale completed! Receipt: ${sale.receipt_number}`)
      cart.clearCart()
      setShowPayment(false)
      setCashReceived('')
      await loadProducts() // refresh stock
    } catch (err) {
      toast.error('Payment failed. Please try again.')
      console.error(err)
    } finally {
      setProcessingPayment(false)
    }
  }

  const change = parseFloat(cashReceived || '0') - cart.total()

  return (
    <div className="flex h-full flex-col lg:flex-row" style={{ background: 'var(--bg-primary)' }}>
      {/* LEFT: Product grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search & filter bar */}
        <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products, SKU, barcode..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={e => e.target.style.borderColor = 'var(--neon)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  background: category === cat ? 'var(--neon)' : 'var(--bg-tertiary)',
                  color: category === cat ? '#080c10' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: category === cat ? 'var(--neon)' : 'var(--border)',
                }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-xl h-36 animate-pulse" style={{ background: 'var(--bg-card)' }} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
              </svg>
              <p style={{ color: 'var(--text-muted)' }}>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(product => {
                const inCart = cart.items.find(i => i.product.id === product.id)
                const isLowStock = product.stock_quantity <= product.min_stock_level
                const isOutOfStock = product.stock_quantity === 0
                return (
                  <button
                    key={product.id}
                    disabled={isOutOfStock}
                    onClick={() => { cart.addItem(product); toast.success(`${product.name} added`, { duration: 1000 }) }}
                    className="relative text-left rounded-xl p-3 transition-all duration-150 group"
                    style={{
                      background: inCart ? 'rgba(0,212,255,0.08)' : 'var(--bg-card)',
                      border: `1px solid ${inCart ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
                      opacity: isOutOfStock ? 0.5 : 1,
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={e => { if (!isOutOfStock) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.3)' }}
                    onMouseLeave={e => { if (!inCart) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    {inCart && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'var(--neon)', color: '#080c10' }}>
                        {inCart.quantity}
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-lg mb-2 flex items-center justify-center text-lg"
                      style={{ background: 'var(--bg-tertiary)' }}>
                      {getCategoryEmoji(product.category)}
                    </div>
                    <div className="text-xs font-medium leading-tight mb-1 line-clamp-2"
                      style={{ color: 'var(--text-primary)' }}>{product.name}</div>
                    <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{product.sku}</div>
                    <div className="flex items-end justify-between">
                      <div className="font-display font-bold text-sm" style={{ color: 'var(--neon)' }}>
                        {formatCurrency(product.price)}
                      </div>
                      <div className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: isOutOfStock ? 'rgba(248,81,73,0.15)' : isLowStock ? 'rgba(210,153,34,0.15)' : 'rgba(63,185,80,0.15)',
                          color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)',
                        }}>
                        {isOutOfStock ? 'Out' : `${product.stock_quantity}`}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className="w-full lg:w-96 flex flex-col" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
        {/* Cart header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Current Sale
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {cart.itemCount()} items
            </p>
          </div>
          {cart.items.length > 0 && (
            <button onClick={() => { cart.clearCart(); toast.success('Cart cleared') }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--danger)', border: '1px solid rgba(248,81,73,0.2)' }}>
              Clear
            </button>
          )}
        </div>

        {/* Customer selector */}
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          {cart.customer ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--neon)', color: '#080c10' }}>
                {cart.customer.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{cart.customer.name}</div>
                <div className="text-xs" style={{ color: 'var(--neon)' }}>{cart.customer.loyalty_points} pts</div>
              </div>
              <button onClick={() => cart.setCustomer(null)} style={{ color: 'var(--text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowCustomerSearch(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors"
              style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              Add Customer (optional)
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
                <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
              </svg>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tap products to add to cart</p>
            </div>
          ) : (
            cart.items.map(item => (
              <div key={item.product.id} className="rounded-xl p-3"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {item.product.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.product.sku}</div>
                  </div>
                  <button onClick={() => cart.removeItem(item.product.id)} style={{ color: 'var(--danger)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button onClick={() => cart.updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>−</button>
                    <span className="w-7 text-center text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                      {item.quantity}
                    </span>
                    <button onClick={() => cart.updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>+</button>
                  </div>
                  <div className="text-sm font-bold font-mono" style={{ color: 'var(--neon)' }}>
                    {formatCurrency(item.subtotal)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount */}
        {cart.items.length > 0 && (
          <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Cart Discount:</label>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  min="0" max="100" step="1"
                  value={cart.discount}
                  onChange={e => cart.setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-16 text-center px-2 py-1 rounded-lg text-xs font-mono outline-none"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{formatCurrency(cart.subtotal())}</span>
          </div>
          {cart.discountAmount() > 0 && (
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--warning)' }}>Discount ({cart.discount}%)</span>
              <span className="font-mono" style={{ color: 'var(--warning)' }}>-{formatCurrency(cart.discountAmount())}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--text-secondary)' }}>Tax (15%)</span>
            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{formatCurrency(cart.taxAmount())}</span>
          </div>
          <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Total</span>
            <span className="font-display font-bold text-lg" style={{ color: 'var(--neon)' }}>
              {formatCurrency(cart.total())}
            </span>
          </div>
        </div>

        {/* Payment button */}
        <div className="p-4">
          <button
            onClick={() => setShowPayment(true)}
            disabled={cart.items.length === 0}
            className="w-full py-3.5 rounded-xl font-display font-bold text-sm transition-all duration-200"
            style={{
              background: cart.items.length === 0 ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #00D4FF, #0ea5e9)',
              color: cart.items.length === 0 ? 'var(--text-muted)' : '#080c10',
              cursor: cart.items.length === 0 ? 'not-allowed' : 'pointer',
            }}>
            Charge {cart.items.length > 0 ? formatCurrency(cart.total()) : '—'}
          </button>
        </div>
      </div>

      {/* Customer search modal */}
      {showCustomerSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 glass-bright">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Select Customer</h3>
              <button onClick={() => { setShowCustomerSearch(false); setCustomerSearch('') }} style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <input
              autoFocus
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Search name, email, phone..."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-3"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredCustomers.map(c => (
                <button key={c.id}
                  onClick={() => { cart.setCustomer(c); setShowCustomerSearch(false); setCustomerSearch('') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--neon)', color: '#080c10' }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.phone || c.email}</div>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--neon)' }}>{c.loyalty_points} pts</div>
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No customers found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 glass-bright">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>Complete Payment</h3>
              <button onClick={() => setShowPayment(false)} style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="text-center mb-5 p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Amount Due</div>
              <div className="font-display font-bold text-3xl" style={{ color: 'var(--neon)' }}>
                {formatCurrency(cart.total())}
              </div>
            </div>

            {/* Payment method */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'cash', label: 'Cash', emoji: '💵' },
                  { value: 'card', label: 'Card', emoji: '💳' },
                  { value: 'mobile_money', label: 'EcoCash', emoji: '📱' },
                  { value: 'bank_transfer', label: 'Bank', emoji: '🏦' },
                ].map(method => (
                  <button key={method.value}
                    onClick={() => cart.setPaymentMethod(method.value as 'cash' | 'card' | 'mobile_money' | 'bank_transfer')}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: cart.paymentMethod === method.value ? 'rgba(0,212,255,0.15)' : 'var(--bg-tertiary)',
                      border: `1px solid ${cart.paymentMethod === method.value ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
                      color: cart.paymentMethod === method.value ? 'var(--neon)' : 'var(--text-secondary)',
                    }}>
                    <span>{method.emoji}</span> {method.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash received */}
            {cart.paymentMethod === 'cash' && (
              <div className="mb-4">
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Cash Received</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder={`Min. ${formatCurrency(cart.total())}`}
                  className="w-full px-3 py-3 rounded-xl text-sm font-mono outline-none"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
                {cashReceived && change >= 0 && (
                  <div className="mt-2 flex justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>Change</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(change)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={processPayment}
              disabled={processingPayment || (cart.paymentMethod === 'cash' && parseFloat(cashReceived || '0') < cart.total())}
              className="w-full py-3.5 rounded-xl font-display font-bold text-sm transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #3fb950, #2ea043)',
                color: '#fff',
                opacity: (processingPayment || (cart.paymentMethod === 'cash' && parseFloat(cashReceived || '0') < cart.total())) ? 0.5 : 1,
                cursor: processingPayment ? 'not-allowed' : 'pointer',
              }}>
              {processingPayment ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
                  </svg>
                  Processing...
                </span>
              ) : `✓ Confirm Payment`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    'Laptops': '💻', 'Smartphones': '📱', 'Tablets': '📱', 'Accessories': '🎧',
    'Storage': '💾', 'Networking': '🌐', 'Gaming': '🎮', 'Displays': '🖥️', 'General': '📦'
  }
  return map[category] || '📦'
}
