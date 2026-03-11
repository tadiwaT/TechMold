'use client'
// app/dashboard/pos/page.tsx — Offline-capable POS Terminal

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cart'
import { Product, Customer } from '@/types'
import { formatCurrency, debounce } from '@/lib/utils'
import {
  cacheProducts,
  cacheCustomers,
  getCachedProducts,
  getCachedCustomers,
  queueOfflineSale,
  updateCachedProductStock,
  getCacheAge,
} from '@/lib/offline-db'
import { useOffline } from '@/hooks/useOffline'
import toast from 'react-hot-toast'

const CACHE_MAX_AGE_MS = 15 * 60 * 1000 // 15 min

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'live' | 'cache' | 'none'>('none')
  const [showPayment, setShowPayment] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const authTokenRef = useRef<string | null>(null)

  const supabase = createClient()
  const cart = useCartStore()
  const { isOnline, isOffline, pendingCount, isSyncing, setAuthToken, updatePendingCount } = useOffline()

  // Store auth token for SW use
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? null
      authTokenRef.current = token
      setAuthToken(token)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null
      authTokenRef.current = token
      setAuthToken(token)
    })

    // Listen for SW requesting auth token
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'GET_AUTH_TOKEN') {
          e.ports?.[0]?.postMessage({ token: authTokenRef.current })
        }
      })
    }

    return () => subscription.unsubscribe()
  }, [setAuthToken, supabase.auth])

  // Load products — online from Supabase + cache, offline from IDB
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      if (isOnline) {
        // Try Supabase first
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (!error && data) {
          setProducts(data)
          setFilteredProducts(data)
          setDataSource('live')
          // Cache for offline use
          await cacheProducts(data.map(p => ({
            id: p.id, name: p.name, sku: p.sku, barcode: p.barcode,
            category: p.category, brand: p.brand, price: p.price,
            cost_price: p.cost_price, stock_quantity: p.stock_quantity,
            min_stock_level: p.min_stock_level, tax_rate: p.tax_rate,
            is_active: p.is_active, cached_at: new Date().toISOString(),
          })))
          const cats = ['All', ...new Set(data.map(p => p.category))]
          setCategories(cats)
          setLoading(false)
          return
        }
      }

      // Offline or Supabase failed — use IDB cache
      const age = await getCacheAge('products_cached_at')
      const cached = await getCachedProducts()

      if (cached.length > 0) {
        const mapped = cached.map(p => ({ ...p } as unknown as Product))
        setProducts(mapped)
        setFilteredProducts(mapped)
        setDataSource('cache')
        const cats = ['All', ...new Set(mapped.map(p => p.category))]
        setCategories(cats)
        if (age > CACHE_MAX_AGE_MS) {
          toast('Using cached products — data may be slightly outdated', { icon: '📦' })
        }
      } else {
        setDataSource('none')
        toast.error('No cached products available. Please connect to internet first.')
      }
    } catch (err) {
      console.error('Load products error:', err)
      // Try cache as last resort
      const cached = await getCachedProducts()
      if (cached.length > 0) {
        setProducts(cached as unknown as Product[])
        setFilteredProducts(cached as unknown as Product[])
        setDataSource('cache')
      }
    } finally {
      setLoading(false)
    }
  }, [isOnline, supabase])

  // Load customers
  const loadCustomers = useCallback(async () => {
    try {
      if (isOnline) {
        const { data } = await supabase.from('customers').select('*').order('name').limit(200)
        if (data) {
          setCustomers(data)
          await cacheCustomers(data.map(c => ({
            id: c.id, name: c.name, email: c.email, phone: c.phone,
            loyalty_points: c.loyalty_points, total_spent: c.total_spent,
            cached_at: new Date().toISOString(),
          })))
          return
        }
      }
      const cached = await getCachedCustomers()
      setCustomers(cached as unknown as Customer[])
    } catch {
      const cached = await getCachedCustomers()
      setCustomers(cached as unknown as Customer[])
    }
  }, [isOnline, supabase])

  useEffect(() => {
    loadProducts()
    loadCustomers()
  }, [loadProducts, loadCustomers])

  // Re-fetch when coming back online
  useEffect(() => {
    if (isOnline && dataSource === 'cache') {
      loadProducts()
      loadCustomers()
    }
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter products
  const filterProducts = useCallback(
    debounce((term: string, cat: string, prods: Product[]) => {
      let filtered = prods
      if (term) filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term.toLowerCase()) ||
        p.sku.toLowerCase().includes(term.toLowerCase()) ||
        (p.barcode || '').includes(term)
      )
      if (cat !== 'All') filtered = filtered.filter(p => p.category === cat)
      setFilteredProducts(filtered)
    }, 200),
    []
  )

  useEffect(() => { filterProducts(search, category, products) }, [search, category, products, filterProducts])

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  ).slice(0, 10)

  // Generate local receipt number for offline sales
  function generateLocalReceiptNumber(): string {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(Math.random() * 9000 + 1000)
    return `TM-${dateStr}-${rand}-OFF`
  }

  // Process payment — online goes to Supabase, offline queues to IDB
  async function processPayment() {
    if (cart.items.length === 0) { toast.error('Cart is empty'); return }
    setProcessingPayment(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const total = cart.total()
      const cashAmt = parseFloat(cashReceived) || 0

      if (cart.paymentMethod === 'cash' && cashAmt < total) {
        toast.error('Insufficient cash received')
        setProcessingPayment(false)
        return
      }

      const { data: profile } = isOnline
        ? await supabase.from('profiles').select('full_name').eq('id', user!.id).single()
        : { data: { full_name: 'Offline Cashier' } }

      const salePayload = {
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
        cashier_id: user?.id,
        cashier_name: profile?.full_name || user?.email || 'Staff',
      }

      const saleItems = cart.items.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        product_sku: item.product.sku,
        quantity: item.quantity,
        unit_price: item.product.price,
        discount: item.discount,
        tax_rate: item.product.tax_rate,
        subtotal: item.subtotal,
      }))

      if (isOnline) {
        // ── Online: write directly to Supabase ─────────────────────────────
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert(salePayload)
          .select()
          .single()

        if (saleError) throw saleError

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems.map(i => ({ ...i, sale_id: sale.id })))

        if (itemsError) throw itemsError

        toast.success(`✓ Sale complete! Receipt: ${sale.receipt_number}`)
        await loadProducts() // refresh stock counts

      } else {
        // ── Offline: queue in IndexedDB for later sync ──────────────────────
        const localReceiptNumber = generateLocalReceiptNumber()
        const localId = await queueOfflineSale({
          sale: { ...salePayload, receipt_number: localReceiptNumber },
          items: saleItems,
          status: 'pending',
          created_at: new Date().toISOString(),
          sync_attempts: 0,
          receipt_number: localReceiptNumber,
        })

        // Optimistically update local stock counts in IDB
        for (const item of cart.items) {
          await updateCachedProductStock(item.product.id, -item.quantity)
        }

        // Update products displayed (optimistic)
        setProducts(prev => prev.map(p => {
          const cartItem = cart.items.find(i => i.product.id === p.id)
          return cartItem ? { ...p, stock_quantity: Math.max(0, p.stock_quantity - cartItem.quantity) } : p
        }))

        await updatePendingCount()

        toast.success(
          `✓ Sale saved offline! Receipt: ${localReceiptNumber}\n↗ Will sync when connected (ID: ${localId})`,
          { duration: 5000 }
        )
      }

      cart.clearCart()
      setShowPayment(false)
      setCashReceived('')

    } catch (err) {
      toast.error('Payment failed. Please try again.')
      console.error(err)
    } finally {
      setProcessingPayment(false)
    }
  }

  const change = parseFloat(cashReceived || '0') - cart.total()

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Offline / Pending Sync Banner ─────────────────────────────────── */}
      {(isOffline || pendingCount > 0) && (
        <div
          className="flex items-center justify-between px-4 py-2 text-xs font-medium"
          style={{
            background: isOffline ? 'rgba(248,81,73,0.12)' : 'rgba(210,153,34,0.12)',
            borderBottom: `1px solid ${isOffline ? 'rgba(248,81,73,0.25)' : 'rgba(210,153,34,0.25)'}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: isOffline ? 'var(--danger)' : 'var(--warning)' }}
            />
            {isOffline ? (
              <span style={{ color: 'var(--danger)' }}>
                Offline mode — sales are saved locally and will sync when reconnected
              </span>
            ) : isSyncing ? (
              <span style={{ color: 'var(--warning)' }}>
                Syncing {pendingCount} offline sale{pendingCount !== 1 ? 's' : ''} to server...
              </span>
            ) : (
              <span style={{ color: 'var(--warning)' }}>
                {pendingCount} offline sale{pendingCount !== 1 ? 's' : ''} queued — will sync shortly
              </span>
            )}
          </div>
          {dataSource === 'cache' && (
            <span style={{ color: 'var(--text-muted)' }}>📦 Using cached data</span>
          )}
        </div>
      )}

      {/* ── Main POS Layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">

        {/* LEFT: Product grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & filters */}
          <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, SKU, barcode..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--neon)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              {/* Connection badge */}
              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
                style={{
                  background: isOnline ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                  border: `1px solid ${isOnline ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)'}`,
                  color: isOnline ? 'var(--success)' : 'var(--danger)',
                }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} ${!isOnline ? 'animate-pulse' : ''}`} />
                {isOnline ? 'Live' : 'Offline'}
              </div>
            </div>
            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    background: category === cat ? 'var(--neon)' : 'var(--bg-tertiary)',
                    color: category === cat ? '#080c10' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: category === cat ? 'var(--neon)' : 'var(--border)',
                  }}
                >
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
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {dataSource === 'none' ? 'Connect to internet to load products' : 'No products match your search'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map(product => {
                  const inCart = cart.items.find(i => i.product.id === product.id)
                  const isLowStock = product.stock_quantity <= product.min_stock_level && product.stock_quantity > 0
                  const isOutOfStock = product.stock_quantity === 0
                  return (
                    <button
                      key={product.id}
                      disabled={isOutOfStock}
                      onClick={() => { cart.addItem(product); toast.success(`${product.name} added`, { duration: 800 }) }}
                      className="relative text-left rounded-xl p-3 transition-all duration-150"
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
                      <div className="w-10 h-10 rounded-lg mb-2 flex items-center justify-center text-xl"
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
                        <div
                          className="text-xs px-1.5 py-0.5 rounded font-mono"
                          style={{
                            background: isOutOfStock ? 'rgba(248,81,73,0.15)' : isLowStock ? 'rgba(210,153,34,0.15)' : 'rgba(63,185,80,0.15)',
                            color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)',
                          }}
                        >
                          {isOutOfStock ? 'Out' : product.stock_quantity}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart panel */}
        <div className="w-full lg:w-96 flex flex-col" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
          {/* Cart header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Current Sale</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cart.itemCount()} items</p>
            </div>
            {cart.items.length > 0 && (
              <button
                onClick={() => { cart.clearCart(); toast.success('Cart cleared') }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(248,81,73,0.1)', color: 'var(--danger)', border: '1px solid rgba(248,81,73,0.2)' }}
              >
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
              <button
                onClick={() => setShowCustomerSearch(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors"
                style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
              >
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
              <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-60">
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
                      <div className="text-xs font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{item.product.name}</div>
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
                        className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-sm"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>−</button>
                      <span className="w-7 text-center text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                        {item.quantity}
                      </span>
                      <button onClick={() => cart.updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-sm"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>+</button>
                    </div>
                    <div className="font-bold font-mono text-sm" style={{ color: 'var(--neon)' }}>
                      {formatCurrency(item.subtotal)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Discount input */}
          {cart.items.length > 0 && (
            <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <label className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>Discount:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number" min="0" max="100" step="1"
                    value={cart.discount}
                    onChange={e => cart.setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-14 text-center px-2 py-1 rounded-lg text-xs font-mono outline-none"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                </div>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="px-4 py-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
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
              <span className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>TOTAL</span>
              <span className="font-display font-bold text-lg" style={{ color: 'var(--neon)' }}>{formatCurrency(cart.total())}</span>
            </div>
          </div>

          {/* Charge button */}
          <div className="p-4">
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.items.length === 0}
              className="w-full py-3.5 rounded-xl font-display font-bold text-sm transition-all duration-200"
              style={{
                background: cart.items.length === 0 ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #00D4FF, #0ea5e9)',
                color: cart.items.length === 0 ? 'var(--text-muted)' : '#080c10',
                cursor: cart.items.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isOffline && cart.items.length > 0 ? (
                <span className="flex items-center justify-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save Offline {cart.items.length > 0 ? formatCurrency(cart.total()) : ''}
                </span>
              ) : (
                `Charge ${cart.items.length > 0 ? formatCurrency(cart.total()) : '—'}`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Customer Search Modal ─────────────────────────────────────────── */}
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.phone || c.email || 'No contact'}</div>
                  </div>
                  <div className="text-xs font-mono" style={{ color: 'var(--neon)' }}>{c.loyalty_points} pts</div>
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No customers found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ─────────────────────────────────────────────────── */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 glass-bright">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {isOffline ? '💾 Save Offline' : '💳 Complete Payment'}
              </h3>
              <button onClick={() => setShowPayment(false)} style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Amount */}
            <div className="text-center mb-5 p-4 rounded-xl"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Amount Due</div>
              <div className="font-display font-bold text-3xl" style={{ color: 'var(--neon)' }}>
                {formatCurrency(cart.total())}
              </div>
            </div>

            {/* Offline warning */}
            {isOffline && (
              <div className="mb-4 p-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.25)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-xs" style={{ color: 'var(--warning)' }}>
                  You&apos;re offline. This sale will be saved locally and synced to Supabase automatically when you reconnect.
                </p>
              </div>
            )}

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

            {/* Cash calculation */}
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
                  <div className="mt-2 flex justify-between items-center text-xs px-1">
                    <span style={{ color: 'var(--text-secondary)' }}>Change</span>
                    <span className="font-mono font-bold text-base" style={{ color: 'var(--success)' }}>
                      {formatCurrency(change)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={processPayment}
              disabled={processingPayment || (cart.paymentMethod === 'cash' && parseFloat(cashReceived || '0') < cart.total())}
              className="w-full py-3.5 rounded-xl font-display font-bold text-sm transition-all duration-200"
              style={{
                background: isOffline
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'linear-gradient(135deg, #3fb950, #2ea043)',
                color: '#fff',
                opacity: (processingPayment || (cart.paymentMethod === 'cash' && parseFloat(cashReceived || '0') < cart.total())) ? 0.5 : 1,
                cursor: processingPayment ? 'not-allowed' : 'pointer',
              }}
            >
              {processingPayment ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
                  </svg>
                  {isOffline ? 'Saving...' : 'Processing...'}
                </span>
              ) : isOffline ? '💾 Save & Queue for Sync' : '✓ Confirm Payment'}
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
