'use client'
// app/auth/login/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Welcome back!')
      router.push('/dashboard/pos')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>
      
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(#00D4FF 1px, transparent 1px), linear-gradient(90deg, #00D4FF 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      
      {/* Glowing orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #00D4FF 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #6366f1)', boxShadow: '0 0 40px rgba(0,212,255,0.3)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 8h20M6 16h12M6 24h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="24" r="6" fill="white" fillOpacity="0.3"/>
              <path d="M21 24l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="font-display text-3xl font-800 text-gradient">TechMold</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Point of Sale System</p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl p-8 glass-bright">
          <h2 className="font-display text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--neon)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                placeholder="cashier@techmold.co.zw"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--neon)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 relative overflow-hidden"
              style={{
                background: loading ? 'var(--bg-hover)' : 'linear-gradient(135deg, #00D4FF, #0ea5e9)',
                color: loading ? 'var(--text-muted)' : '#080c10',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Secured by Supabase Auth • TechMold POS v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
