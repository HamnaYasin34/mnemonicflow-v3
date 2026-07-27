'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/components/WelcomeDashboard.tsx
// Premium post-login landing view. Pure presentation — reads the vault data
// already loaded in page.tsx and hands control back via callback props.
// No Supabase, auth, or business-logic calls live here.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import {
  Search, Zap, Flame, BookMarked, Clock, TrendingUp,
  ArrowRight, Sparkles, Star, CheckCircle2,
} from 'lucide-react'
import { Flashcard, SubjectId } from '../types'
import { getSubject } from '../lib/subjects'
import { isDue } from '../lib/vault'
import { formatRelativeTime, truncate, cn } from '../lib/utils'

interface WelcomeDashboardProps {
  userName:        string
  cards:           Flashcard[]
  dueCount:        number
  onQuickGenerate: (topic?: string) => void
  onContinue:      () => void
  onOpenVault:     () => void
}

// Simple, presentation-only streak estimate from review/creation timestamps —
// does not touch the SM-2 scheduler or vault storage logic.
function computeStreak(cards: Flashcard[]): number {
  const days = new Set<string>()
  cards.forEach(c => {
    days.add(new Date(c.lastReview ?? c.createdAt).toDateString())
  })
  let streak = 0
  const cursor = new Date()
  while (days.has(cursor.toDateString())) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function WelcomeDashboard({
  userName, cards, dueCount, onQuickGenerate, onContinue, onOpenVault,
}: WelcomeDashboardProps) {
  const favCount = useMemo(() => cards.filter(c => c.isFavorite).length, [cards])
  const streak = useMemo(() => computeStreak(cards), [cards])
  const recent = useMemo(
    () => [...cards].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
    [cards],
  )
  const reviewsDone = useMemo(() => cards.reduce((n, c) => n + c.repetitions, 0), [cards])

  return (
    <div className="h-full overflow-y-auto scrollbar-none">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* ── Hero ── */}
        <section className="min-h-[70vh] sm:min-h-[75vh] flex flex-col justify-center animate-fade-up">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-neon-green mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-glow" />
            AI Engine Ready
          </div>

          <h1 className="font-display font-bold text-ink-primary leading-[1.05] tracking-tight text-[clamp(1.75rem,6vw,3.25rem)]">
            Welcome back, <span className="text-neon-green text-glow-green">{userName}</span>
          </h1>
          <p className="mt-3 text-ink-secondary text-sm sm:text-base max-w-lg">
            Ready to master medicine today? Pick up where you left off, or generate something new.
          </p>

          {/* Large AI search */}
          <form
            onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); onQuickGenerate(String(fd.get('topic') ?? '')) }}
            className="mt-8 sm:mt-10 w-full max-w-2xl"
          >
            <div className="relative">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-ink-tertiary" />
              <input
                name="topic"
                type="text"
                placeholder="Type any topic — e.g. Brachial plexus, Krebs cycle..."
                className="w-full bg-elevated border border-border rounded-2xl pl-11 sm:pl-14 pr-28 sm:pr-36 py-4 sm:py-5 text-sm sm:text-base text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-neon-green-border focus:ring-1 focus:ring-neon-green-glow transition-all shadow-card-md"
              />
              <button
                type="submit"
                className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold bg-neon-green text-void hover:brightness-110 transition-all active:scale-95"
                style={{ boxShadow: '0 0 20px rgba(13,242,125,0.3)' }}
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Generate</span>
              </button>
            </div>
          </form>

          {/* Quick actions */}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              onClick={() => onQuickGenerate()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-neon-green-dim border border-neon-green-border text-neon-green hover:brightness-110 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Quick Generate
            </button>
            {cards.length > 0 && (
              <button
                onClick={onContinue}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-elevated border border-border text-ink-secondary hover:text-ink-primary hover:border-subtle transition-all active:scale-95"
              >
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Continue Learning
              </button>
            )}
            <button
              onClick={onOpenVault}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-elevated border border-border text-ink-secondary hover:text-ink-primary hover:border-subtle transition-all active:scale-95"
            >
              <BookMarked className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Open Vault
            </button>
          </div>
        </section>

        {/* ── Stats grid ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-up">
          <StatCard icon={<Flame className="w-4 h-4 sm:w-5 sm:h-5" />} label="Daily Streak" value={`${streak}d`} accent="#ff9a00" />
          <StatCard icon={<BookMarked className="w-4 h-4 sm:w-5 sm:h-5" />} label="Saved Mnemonics" value={String(cards.length)} accent="#0df27d" />
          <StatCard icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />} label="Due for Review" value={String(dueCount)} accent="#ffd60a" />
          <StatCard icon={<Star className="w-4 h-4 sm:w-5 sm:h-5" />} label="Favorites" value={String(favCount)} accent="#c77dff" />
        </section>

        {/* ── Study statistics + recent activity ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8 pb-8">
          {/* Recent activity */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-ink-primary font-display">Recent Activity</h2>
              {cards.length > 0 && (
                <button onClick={onOpenVault} className="text-[11px] text-neon-green hover:underline">View all</button>
              )}
            </div>

            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="w-11 h-11 rounded-full bg-elevated border border-border flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-ink-tertiary" />
                </div>
                <p className="text-xs text-ink-secondary font-medium">No cards yet</p>
                <p className="text-[11px] text-ink-tertiary mt-1">Generate your first mnemonic to get started.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {recent.map(card => {
                  const subject = getSubject(card.subject)
                  const due = isDue(card)
                  return (
                    <li key={card.id}>
                      <button
                        onClick={onContinue}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-elevated border border-border hover:border-subtle transition-all text-left"
                      >
                        <span className="text-base shrink-0">{subject.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-ink-primary truncate">{truncate(card.topic, 40)}</p>
                          <p className="text-[10px] text-ink-tertiary">{subject.label} · {formatRelativeTime(card.nextReview)}</p>
                        </div>
                        {due ? (
                          <span className="text-[9px] px-2 py-1 rounded-full bg-neon-review-dim text-neon-review border border-neon-review-border shrink-0">Due</span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-ink-tertiary shrink-0" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Study statistics */}
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-bold text-ink-primary font-display mb-4">Study Statistics</h2>
            <div className="space-y-4">
              <MiniStat icon={<TrendingUp className="w-3.5 h-3.5" />} label="Total reviews" value={reviewsDone} />
              <MiniStat icon={<BookMarked className="w-3.5 h-3.5" />} label="Cards saved" value={cards.length} />
              <MiniStat icon={<Clock className="w-3.5 h-3.5" />} label="Due right now" value={dueCount} />
              <MiniStat icon={<Star className="w-3.5 h-3.5" />} label="Favorited" value={favCount} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5 sm:gap-3">
      <div
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center"
        style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}44` }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-ink-primary leading-none">{value}</div>
        <div className="text-[10px] sm:text-[11px] text-ink-tertiary uppercase tracking-wider mt-1">{label}</div>
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-ink-tertiary shrink-0">
        {icon}
      </span>
      <span className="flex-1 text-xs text-ink-secondary">{label}</span>
      <span className="text-sm font-bold font-mono text-ink-primary">{value}</span>
    </div>
  )
}