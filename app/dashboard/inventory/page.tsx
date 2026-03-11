'use client'
// app/dashboard/inventory/page.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/types'
import { formatCurrency, PRODUCT_CATEGORIES } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [showStockModal, setShowStockModal] = useState<Product | null>(null)
  const [stockAdjustment, setStockAdjustment] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add')
  const [formData, setFormData] = useState({
    name: '', sku: '', barcode: '', category: 'General', brand: '',
    description: '', price: '', cost_price: '', stock_quantity: '',
    min_stock_level: '5', tax_rate: '15', is_active: true
  })
  const supabase = createClient()

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'All' || p.category === filterCategory
    return matchSearch && matchCat
  })

  function openEdit(product: Product) {
    setEditProduct(product)
    setFormData({
      name: product.name, sku: product.sku, barcode: product.barcode || '',
      category: product.category, brand: product.brand, description: product.description || '',
      price: product.price.toString(), cost_price: product.cost_price.toString(),
      stock_quantity: product.stock_quantity.toString(), min_stock_level: product.min_stock_level.toString(),
      tax_rate: product.tax_rate.toString(), is_active: product.is_active
    })
    setShowForm(true)
  }

  function openNew() {
    setEditProduct(null)
    setFormData({
      name: '', sku: '', barcode: '', category: 'General', brand: '',
      description: '', price: '', cost_price: '', stock_quantity: '0',
      min_stock_level: '5', tax_rate: '15', is_active: true
    })
    setShowForm(true)
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...formData,
      price: parseFloat(formData.price),
      cost_price: parseFloat(formData.cost_price),
      stock_quantity: parseInt(formData.stock_quantity),
      min_stock_level: parseInt(formData.min_stock_level),
      tax_rate: parseFloat(formData.tax_rate),
    }

    if (editProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id)
      if (error) { toast.error('Failed to update product'); return }
      toast.success('Product updated!')
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) { toast.error('Failed to create product: ' + error.message); return }
      toast.success('Product created!')
    }
    setShowForm(false)
    loadProducts()
  }

  async function adjustStock() {
    if (!showStockModal) return
    const amount = parseInt(stockAdjustment)
    if (isNaN(amount)) { toast.error('Invalid quantity'); return }
    
    let newQty = showStockModal.stock_quantity
    if (adjustmentType === 'add') newQty += amount
    else if (adjustmentType === 'remove') newQty -= amount
    else newQty = amount
    
    if (newQty < 0) { toast.error('Stock cannot be negative'); return }
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase.from('products').update({ stock_quantity: newQty }).eq('id', showStockModal.id)
    if (error) { toast.error('Failed to adjust stock'); return }
    
    await supabase.from('stock_movements').insert({
      product_id: showStockModal.id,
      type: 'adjustment',
      quantity: adjustmentType === 'remove' ? -amount : amount,
      notes: `Manual ${adjustmentType} by staff`,
      created_by: user?.id
    })
    
    toast.success('Stock updated!')
    setShowStockModal(null)
    setStockAdjustment('')
    loadProducts()
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(product.is_active ? 'Product deactivated' : 'Product activated')
    loadProducts()
  }

  const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0)
  const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock_level && p.stock_quantity > 0).length
  const outOfStockCount = products.filter(p => p.stock_quantity === 0).length

  return (
    <div className="p-4 lg:p-6 space-y-5" style={{ background: 'var(--bg-primary)', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Inventory</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{products.length} products</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Products', value: products.length, color: 'var(--info)' },
          { label: 'Inventory Value', value: formatCurrency(totalValue), color: 'var(--neon)' },
          { label: 'Low Stock', value: lowStockCount, color: 'var(--warning)' },
          { label: 'Out of Stock', value: outOfStockCount, color: 'var(--danger)' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            <div className="font-display font-bold text-xl" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="All">All Categories</option>
          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {['Product', 'SKU', 'Category', 'Price', 'Cost', 'Stock', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-card)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.map(product => {
                const isLow = product.stock_quantity <= product.min_stock_level && product.stock_quantity > 0
                const isOut = product.stock_quantity === 0
                return (
                  <tr key={product.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                          style={{ background: 'var(--bg-tertiary)' }}>
                          {getCategoryEmoji(product.category)}
                        </div>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{product.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{product.brand}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs px-2 py-0.5 rounded"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--neon)' }}>{product.sku}</code>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{product.category}</td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold" style={{ color: 'var(--neon)' }}>
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {formatCurrency(product.cost_price)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold"
                          style={{ color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)' }}>
                          {product.stock_quantity}
                        </span>
                        <button onClick={() => setShowStockModal(product)}
                          className="text-xs px-2 py-0.5 rounded transition-colors"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          Adjust
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full"
                        style={{
                          background: product.is_active ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
                          color: product.is_active ? 'var(--success)' : 'var(--danger)',
                        }}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(product)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--info)', background: 'rgba(88,166,255,0.1)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => toggleActive(product)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: product.is_active ? 'var(--warning)' : 'var(--success)', background: product.is_active ? 'rgba(210,153,34,0.1)' : 'rgba(63,185,80,0.1)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {product.is_active ? <path d="M18.36 6.64A9 9 0 0 1 20.77 15M6.16 6.16a9 9 0 1 0 12.68 12.68M12 2v4M2 12h4M20 12h2"/> : <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>}
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No products found</div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 glass-bright">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Adjust Stock</h3>
              <button onClick={() => setShowStockModal(null)} style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{showStockModal.name}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Current stock: <span style={{ color: 'var(--neon)' }}>{showStockModal.stock_quantity} units</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['add', 'remove', 'set'].map(type => (
                <button key={type} onClick={() => setAdjustmentType(type as 'add' | 'remove' | 'set')}
                  className="py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                  style={{
                    background: adjustmentType === type ? 'rgba(0,212,255,0.15)' : 'var(--bg-tertiary)',
                    border: `1px solid ${adjustmentType === type ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
                    color: adjustmentType === type ? 'var(--neon)' : 'var(--text-secondary)',
                  }}>
                  {type}
                </button>
              ))}
            </div>
            <input type="number" min="0" value={stockAdjustment}
              onChange={e => setStockAdjustment(e.target.value)}
              placeholder="Quantity"
              className="w-full px-3 py-3 rounded-xl text-sm font-mono outline-none mb-4"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <button onClick={adjustStock}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10' }}>
              Update Stock
            </button>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-2xl rounded-2xl p-6 glass-bright my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {editProduct ? 'Edit Product' : 'New Product'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={saveProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Product Name *', key: 'name', type: 'text', placeholder: 'e.g. MacBook Pro 14"', required: true, full: true },
                { label: 'SKU *', key: 'sku', type: 'text', placeholder: 'e.g. MBP-14-M3', required: true },
                { label: 'Barcode', key: 'barcode', type: 'text', placeholder: 'EAN/UPC barcode' },
                { label: 'Brand', key: 'brand', type: 'text', placeholder: 'e.g. Apple', required: true },
                { label: 'Selling Price *', key: 'price', type: 'number', placeholder: '0.00', required: true },
                { label: 'Cost Price *', key: 'cost_price', type: 'number', placeholder: '0.00', required: true },
                { label: 'Stock Qty', key: 'stock_quantity', type: 'number', placeholder: '0' },
                { label: 'Min Stock Level', key: 'min_stock_level', type: 'number', placeholder: '5' },
                { label: 'Tax Rate (%)', key: 'tax_rate', type: 'number', placeholder: '15' },
              ].map(field => (
                <div key={field.key} className={field.full ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {field.label}
                  </label>
                  <input type={field.type} required={field.required} placeholder={field.placeholder}
                    value={(formData as Record<string, string | boolean>)[field.key] as string}
                    onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
                <select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Status</label>
                <select value={formData.is_active ? 'active' : 'inactive'} onChange={e => setFormData(p => ({ ...p, is_active: e.target.value === 'active' }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10' }}>
                  {editProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
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
