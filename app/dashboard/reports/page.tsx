'use client'
// app/dashboard/reports/page.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, calculatePercentageChange } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

type Period = 'today' | 'week' | 'month' | 'year'

interface SaleRecord {
  id: string
  receipt_number: string
  total_amount: number
  payment_method: string
  cashier_name: string
  created_at: string
  customer_id: string | null
}

interface ChartData { date: string; sales: number; transactions: number }
interface TopProduct { product_name: string; total_quantity: number; total_revenue: number }
interface PaymentData { method: string; count: number; total: number }

const PIE_COLORS = ['#00D4FF', '#6366f1', '#3fb950', '#f59e0b', '#ef4444']

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [salesChart, setSalesChart] = useState<ChartData[]>([])
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentData[]>([])
  const [stats, setStats] = useState({ totalRevenue: 0, totalTransactions: 0, avgOrderValue: 0, prevRevenue: 0, prevTransactions: 0 })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadReports() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  function getDateRanges(p: Period) {
    const now = new Date()
    let startDate: Date

    if (p === 'today') {
      startDate = new Date(now); startDate.setHours(0, 0, 0, 0)
    } else if (p === 'week') {
      startDate = new Date(now); startDate.setDate(startDate.getDate() - 7)
    } else if (p === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else {
      startDate = new Date(now.getFullYear(), 0, 1)
    }

    const diffMs = now.getTime() - startDate.getTime()
    const prevEnd = new Date(startDate)
    const prevStart = new Date(startDate.getTime() - diffMs)

    return { startDate, prevStart, prevEnd }
  }

  async function loadReports() {
    setLoading(true)
    const { startDate, prevStart, prevEnd } = getDateRanges(period)

    // ── Current period sales ──────────────────────────────────────────────
    const { data: sales } = await supabase
      .from('sales')
      .select('id, receipt_number, total_amount, payment_method, cashier_name, created_at, customer_id')
      .gte('created_at', startDate.toISOString())
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })

    // ── Previous period (for comparison) ─────────────────────────────────
    const { data: prevSales } = await supabase
      .from('sales')
      .select('total_amount')
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', prevEnd.toISOString())
      .eq('payment_status', 'completed')

    const current = sales || []
    const prev = prevSales || []

    setRecentSales(current.slice(0, 20))

    const totalRevenue = current.reduce((s, r) => s + r.total_amount, 0)
    const prevRevenue = prev.reduce((s, r) => s + r.total_amount, 0)

    setStats({
      totalRevenue,
      totalTransactions: current.length,
      avgOrderValue: current.length > 0 ? totalRevenue / current.length : 0,
      prevRevenue,
      prevTransactions: prev.length,
    })

    // ── Chart data ────────────────────────────────────────────────────────
    const grouped: Record<string, { sales: number; transactions: number }> = {}
    current.forEach(s => {
      const key = s.created_at.split('T')[0]
      if (!grouped[key]) grouped[key] = { sales: 0, transactions: 0 }
      grouped[key].sales += s.total_amount
      grouped[key].transactions += 1
    })
    setSalesChart(
      Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({ date: date.slice(5), ...d }))
    )

    // ── Payment breakdown ─────────────────────────────────────────────────
    const payMap: Record<string, { count: number; total: number }> = {}
    current.forEach(s => {
      if (!payMap[s.payment_method]) payMap[s.payment_method] = { count: 0, total: 0 }
      payMap[s.payment_method].count++
      payMap[s.payment_method].total += s.total_amount
    })
    setPaymentBreakdown(
      Object.entries(payMap).map(([method, d]) => ({ method, ...d }))
    )

    // ── Top products via sale_items ───────────────────────────────────────
    // Get sale IDs for the period, then fetch their items
    const saleIds = current.map(s => s.id)
    if (saleIds.length > 0) {
      const { data: items } = await supabase
        .from('sale_items')
        .select('product_name, quantity, subtotal')
        .in('sale_id', saleIds.slice(0, 200)) // limit to prevent URL overflow

      const prodMap: Record<string, { total_quantity: number; total_revenue: number }> = {}
        ;(items || []).forEach(i => {
          if (!prodMap[i.product_name]) prodMap[i.product_name] = { total_quantity: 0, total_revenue: 0 }
          prodMap[i.product_name].total_quantity += i.quantity
          prodMap[i.product_name].total_revenue += i.subtotal
        })
      setTopProducts(
        Object.entries(prodMap)
          .map(([product_name, d]) => ({ product_name, ...d }))
          .sort((a, b) => b.total_revenue - a.total_revenue)
          .slice(0, 8)
      )
    } else {
      setTopProducts([])
    }

    setLoading(false)
  }

  const revChange = calculatePercentageChange(stats.totalRevenue, stats.prevRevenue)
  const txChange = calculatePercentageChange(stats.totalTransactions, stats.prevTransactions)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</div>
        {payload.map((p: { name: string; value: number; color: string }) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.name === 'sales' ? formatCurrency(p.value) : p.value}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 overflow-y-auto" style={{ background: 'var(--bg-primary)', height: '100%' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Reports &amp; Analytics</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Business intelligence for TechMold</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['today', 'week', 'month', 'year'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: period === p ? 'rgba(0,212,255,0.15)' : 'var(--bg-card)',
                border: `1px solid ${period === p ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
                color: period === p ? 'var(--neon)' : 'var(--text-secondary)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Revenue', value: formatCurrency(stats.totalRevenue), change: revChange, color: 'var(--neon)' },
          { label: 'Transactions', value: stats.totalTransactions.toString(), change: txChange, color: 'var(--info)' },
          { label: 'Avg Order', value: formatCurrency(stats.avgOrderValue), change: 0, color: 'var(--success)' },
          { label: 'Products Sold', value: topProducts.reduce((s, p) => s + p.total_quantity, 0).toString(), change: 0, color: 'var(--warning)' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</span>
              {stat.change !== 0 && (
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: stat.change >= 0 ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
                    color: stat.change >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {stat.change >= 0 ? '+' : ''}{stat.change.toFixed(1)}%
                </span>
              )}
            </div>
            {loading ? (
              <div className="h-7 w-24 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
            ) : (
              <div className="font-display font-bold text-2xl" style={{ color: stat.color }}>{stat.value}</div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Revenue Trend</h3>
          {loading ? (
            <div className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
          ) : salesChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No sales data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={salesChart}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="sales" stroke="#00D4FF" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment breakdown */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Payment Methods</h3>
          {loading || paymentBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {loading ? 'Loading...' : 'No data'}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                    {paymentBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {paymentBreakdown.map((p, i) => (
                  <div key={p.method} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>
                        {p.method.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Top Products by Revenue</h3>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No sales data for this period</div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const maxRevenue = topProducts[0].total_revenue
                return (
                  <div key={p.product_name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono w-4 text-center" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                        <span className="font-medium truncate max-w-36" style={{ color: 'var(--text-primary)' }}>
                          {p.product_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span style={{ color: 'var(--text-muted)' }}>{p.total_quantity} units</span>
                        <span className="font-mono font-bold" style={{ color: 'var(--neon)' }}>
                          {formatCurrency(p.total_revenue)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(p.total_revenue / maxRevenue) * 100}%`,
                          background: `hsl(${200 + i * 25}, 80%, 55%)`
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Transactions chart */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Daily Transactions</h3>
          {loading ? (
            <div className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
          ) : salesChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesChart} barSize={salesChart.length > 14 ? 8 : 18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="transactions" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent sales table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-5 py-4" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Recent Transactions
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {['Receipt', 'Cashier', 'Payment', 'Amount', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-card)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : recentSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                    No transactions for this period
                  </td>
                </tr>
              ) : recentSales.map(sale => (
                <tr
                  key={sale.id}
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
                >
                  <td className="px-4 py-3">
                    <code className="text-xs" style={{ color: 'var(--neon)' }}>{sale.receipt_number}</code>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{sale.cashier_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded capitalize"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#8b5cf6' }}
                    >
                      {sale.payment_method.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: 'var(--success)' }}>
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(sale.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
