'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User, LogOut, ChevronDown } from 'lucide-react'

export default function UserMenu() {
  const [user, setUser] = useState<any>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!user) return null

  const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Student'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-elevated hover:border-subtle transition-all">
        <div className="w-6 h-6 rounded-lg bg-neon-green-dim border border-neon-green-border flex items-center justify-center">
          <span className="text-[9px] font-bold text-neon-green font-mono">{initials}</span>
        </div>
        <span className="text-xs text-ink-secondary max-w-[80px] truncate">{name}</span>
        <ChevronDown className={`w-3 h-3 text-ink-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-card-lg overflow-hidden z-50 animate-scale-in">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-ink-primary truncate">{name}</p>
            <p className="text-[10px] text-ink-tertiary truncate">{user.email}</p>
          </div>
          <button onClick={() => window.location.href = '/profile'}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-ink-secondary hover:bg-elevated hover:text-ink-primary transition-colors">
            <User className="w-3.5 h-3.5" /> My Profile
          </button>
          <button onClick={signOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-neon-danger hover:bg-neon-danger-dim transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
