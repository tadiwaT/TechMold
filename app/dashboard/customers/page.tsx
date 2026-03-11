'use client'
// app/dashboard/customers/page.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [customerSales, setCustomerSales] = useState<{ id: string; receipt_number: string; total_amount: number; payment_method: string; created_at: string }[]>([])
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', notes: '' })
  const supabase = createClient()

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }

  async function loadCustomerSales(customerId: string) {
    const { data } = await supabase.from('sales')
      .select('id, receipt_number, total_amount, payment_method, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10)
    setCustomerSales(data || [])
  }

  const filtered = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  function openEdit(customer: Customer) {
    setEditCustomer(customer)
    setFormData({ name: customer.name, email: customer.email || '', phone: customer.phone || '', address: customer.address || '', notes: customer.notes || '' })
    setShowForm(true)
  }

  function openNew() {
    setEditCustomer(null)
    setFormData({ name: '', email: '', phone: '', address: '', notes: '' })
    setShowForm(true)
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (editCustomer) {
      const { error } = await supabase.from('customers').update(formData).eq('id', editCustomer.id)
      if (error) { toast.error('Failed to update'); return }
      toast.success('Customer updated!')
      if (selected?.id === editCustomer.id) setSelected({ ...selected, ...formData })
    } else {
      const { error } = await supabase.from('customers').insert(formData)
      if (error) { toast.error('Failed to create: ' + error.message); return }
      toast.success('Customer created!')
    }
    setShowForm(false)
    loadCustomers()
  }

  const selectCustomer = (c: Customer) => {
    setSelected(c)
    loadCustomerSales(c.id)
  }

  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0)
  const totalPoints = customers.reduce((sum, c) => sum + c.loyalty_points, 0)

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 lg:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Customers</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{customers.length} registered customers</p>
            </div>
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Customer
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Customers', value: customers.length, color: 'var(--info)' },
              { label: 'Total Revenue', value: formatCurrency(totalRevenue), color: 'var(--neon)' },
              { label: 'Loyalty Points', value: totalPoints.toLocaleString(), color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="font-display font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        {/* Customer list */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
            ))
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => selectCustomer(c)}
              className="w-full text-left rounded-xl p-4 transition-all"
              style={{
                background: selected?.id === c.id ? 'rgba(0,212,255,0.08)' : 'var(--bg-card)',
                border: `1px solid ${selected?.id === c.id ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
              }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                  {c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.phone || c.email || 'No contact info'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold font-mono" style={{ color: 'var(--neon)' }}>
                    {formatCurrency(c.total_spent)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--warning)' }}>{c.loyalty_points} pts</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 flex flex-col overflow-hidden hidden lg:flex"
          style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
          <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Customer Profile</h3>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selected)}
                  className="p-1.5 rounded-lg" style={{ color: 'var(--info)', background: 'rgba(88,166,255,0.1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={() => setSelected(null)} style={{ color: 'var(--text-muted)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                {selected.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Customer since {formatDate(selected.created_at)}</div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { icon: '📧', value: selected.email, label: 'Email' },
                { icon: '📱', value: selected.phone, label: 'Phone' },
                { icon: '📍', value: selected.address, label: 'Address' },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="flex items-center gap-2 text-xs">
                  <span>{f.icon}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
            {[
              { label: 'Total Spent', value: formatCurrency(selected.total_spent), color: 'var(--neon)' },
              { label: 'Visits', value: selected.visit_count, color: 'var(--info)' },
              { label: 'Points', value: selected.loyalty_points, color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-2.5 text-center"
                style={{ background: 'var(--bg-tertiary)' }}>
                <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Recent Purchases</h4>
            <div className="space-y-2">
              {customerSales.map(sale => (
                <div key={sale.id} className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <code className="text-xs" style={{ color: 'var(--neon)' }}>{sale.receipt_number}</code>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(sale.created_at)} • {sale.payment_method}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm" style={{ color: 'var(--success)' }}>
                      {formatCurrency(sale.total_amount)}
                    </div>
                  </div>
                </div>
              ))}
              {customerSales.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No purchases yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 glass-bright">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {editCustomer ? 'Edit Customer' : 'New Customer'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={saveCustomer} className="space-y-4">
              {[
                { label: 'Full Name *', key: 'name', type: 'text', required: true },
                { label: 'Email', key: 'email', type: 'email', required: false },
                { label: 'Phone', key: 'phone', type: 'tel', required: false },
                { label: 'Address', key: 'address', type: 'text', required: false },
                { label: 'Notes', key: 'notes', type: 'text', required: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input type={f.type} required={f.required}
                    value={(formData as Record<string, string>)[f.key]}
                    onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10' }}>
                  {editCustomer ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
