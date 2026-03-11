'use client'
// app/dashboard/settings/page.tsx

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface StaffMember {
  id: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'store' | 'profile' | 'staff'>('store')
  const [profile, setProfile] = useState({ full_name: '', role: '' })
  const [storeSettings, setStoreSettings] = useState({
    name: 'TechMold',
    address: '123 Technology Drive, Harare, Zimbabwe',
    phone: '+263 242 000000',
    email: 'info@techmold.co.zw',
    tax_rate: '15',
    currency: 'USD',
    receipt_footer: 'Thank you for shopping at TechMold!',
  })
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'staff') loadStaff()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  async function loadStaff() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setStaff(data || [])
  }

  async function saveProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { error } = await supabase.from('profiles').update({ full_name: profile.full_name }).eq('id', user.id)
    if (error) { toast.error('Failed to update profile'); setLoading(false); return }
    toast.success('Profile updated!')
    setLoading(false)
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { toast.error('Failed to update password: ' + error.message); setLoading(false); return }
    toast.success('Password updated successfully!')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
  }

  const tabs = [
    { id: 'store' as const, label: 'Store Settings' },
    { id: 'profile' as const, label: 'My Profile' },
    { id: 'staff' as const, label: 'Staff' },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-5 overflow-y-auto" style={{ background: 'var(--bg-primary)', height: '100%' }}>
      <div>
        <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage your TechMold POS system</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-medium transition-all relative"
            style={{ color: activeTab === tab.id ? 'var(--neon)' : 'var(--text-muted)' }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: 'var(--neon)' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Store Settings ───────────────────────────────────────────────── */}
      {activeTab === 'store' && (
        <div className="max-w-2xl space-y-5">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Business Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Store Name', key: 'name' },
                { label: 'Email', key: 'email' },
                { label: 'Phone', key: 'phone' },
                { label: 'Tax Rate (%)', key: 'tax_rate' },
                { label: 'Currency', key: 'currency' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {f.label}
                  </label>
                  <input
                    value={(storeSettings as Record<string, string>)[f.key]}
                    onChange={e => setStoreSettings(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Address</label>
                <input
                  value={storeSettings.address}
                  onChange={e => setStoreSettings(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Receipt Footer</label>
                <textarea
                  value={storeSettings.receipt_footer}
                  onChange={e => setStoreSettings(p => ({ ...p, receipt_footer: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <button
              onClick={() => toast.success('Settings saved! Add a settings table in Supabase to persist these.')}
              className="mt-4 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10' }}
            >
              Save Settings
            </button>
          </div>

          {/* Supabase info card */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>System Information</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Application', value: 'TechMold POS' },
                { label: 'Version', value: '1.0.0' },
                { label: 'Framework', value: 'Next.js 14' },
                { label: 'Database', value: 'Supabase PostgreSQL' },
                { label: 'Auth', value: 'Supabase Auth' },
                { label: 'Supabase Project', value: 'zdsmlialmxvkwdliagto' },
              ].map(s => (
                <div key={s.label} className="rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                  <div className="text-sm font-medium mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Settings ─────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="max-w-md space-y-5">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                <input
                  value={profile.full_name}
                  onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
                <input
                  value={profile.role}
                  disabled
                  className="w-full px-3 py-2.5 rounded-xl text-sm capitalize"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                />
              </div>
              <button
                onClick={saveProfile}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0ea5e9)', color: '#080c10', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Saving...' : 'Update Profile'}
              </button>
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <button
                onClick={changePassword}
                disabled={loading || !newPassword}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  opacity: loading || !newPassword ? 0.5 : 1,
                  cursor: !newPassword ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Staff ────────────────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {staff.length} staff member{staff.length !== 1 ? 's' : ''} registered
            </p>
            <a
              href="https://app.supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--neon)', border: '1px solid rgba(0,212,255,0.2)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Manage in Supabase
            </a>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  {['Staff Member', 'Role', 'Status', 'Joined'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                      No staff members found
                    </td>
                  </tr>
                ) : staff.map(s => (
                  <tr
                    key={s.id}
                    style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #00D4FF, #6366f1)', color: '#080c10' }}
                        >
                          {s.full_name[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded capitalize"
                        style={{
                          background: s.role === 'admin' ? 'rgba(239,68,68,0.12)' : s.role === 'manager' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                          color: s.role === 'admin' ? '#f87171' : s.role === 'manager' ? '#fbbf24' : '#8b5cf6',
                        }}
                      >
                        {s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: s.is_active ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
                          color: s.is_active ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <p>To add staff, create users in your Supabase Authentication dashboard. New users automatically receive a <strong>cashier</strong> role.</p>
              <p>To promote a user to admin, run: <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--neon)' }}>UPDATE profiles SET role = &apos;admin&apos; WHERE id = &apos;user-uuid&apos;;</code></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
