'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Zap, Copy, Save, RefreshCw, ChevronDown, Sparkles,
  BookOpen, Eye, CreditCard, AlertCircle, CheckCircle2,
  ImageIcon, Download, Menu, BookMarked,
  Volume2, Layers, Highlighter, HelpCircle, ThumbsUp, ThumbsDown, Meh,
  Maximize2, Share2, X,
} from 'lucide-react'
import { SUBJECTS, getSubject } from '../lib/subjects'
import { SubjectId, MnemonicOutput, GenerationStatus, MnemonicType, VisualStyle } from '../types'
import { cn } from '../lib/utils'
import PremiumFlashcard from './PremiumFlashcard'

interface WorkspaceProps {
  activeSubject: SubjectId
  onSubjectChange: (id: SubjectId) => void
  onCardSaved: (topic: string, subject: SubjectId, mnemonic: MnemonicOutput, imageUrl?: string) => void
  onOpenSidebar: () => void
  onOpenVault: () => void
  vaultCollapsed?: boolean
  onToggleVaultCollapsed?: () => void
  /** Topic handed off from the dashboard's "Quick Generate" search bar. */
  initialTopic?: string
  onMnemonicGenerated?: (topic: string, subjectLabel: string, result: MnemonicOutput) => void
}

type ResultTab = 'explain' | 'story' | 'anki' | 'visual'

const LOADING_STAGES = [
  'Analysing concept...',
  'Finding memory hooks...',
  'Generating visual story...',
  'Creating flashcards...',
  'Preparing quiz...',
  'Rendering illustration...',
]

// ── Image generation via Pollinations (client-side, no key needed) ──────────
function buildImageUrl(compiledPrompt: string): string {
  const seed = Math.floor(Math.random() * 999999)
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(compiledPrompt.slice(0, 900))}?width=800&height=500&seed=${seed}&nologo=true&model=flux`
}

export default function Workspace({
  activeSubject, onSubjectChange, onCardSaved, onOpenSidebar, onOpenVault,
  vaultCollapsed, onToggleVaultCollapsed, initialTopic, onMnemonicGenerated,
}: WorkspaceProps) {
  const [topic, setTopic] = useState(initialTopic?.trim() || '')
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [result, setResult] = useState<MnemonicOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ResultTab>('explain')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imgLoading, setImgLoading] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Focus the topic input when arriving with a topic handed off from the dashboard ──
  useEffect(() => {
    if (initialTopic?.trim()) inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cycle through the "alive" loading stages while a generation is in flight ──
  useEffect(() => {
    if (status !== 'generating') return
    setLoadingStage(0)
    const id = setInterval(() => {
      setLoadingStage(s => Math.min(s + 1, LOADING_STAGES.length - 1))
    }, 850)
    return () => clearInterval(id)
  }, [status])

  // ── Multi-sensory dashboard toggles ──────────────────────────────────────
  const [audioOn, setAudioOn] = useState(false)
  const [highlightOn, setHighlightOn] = useState(false)
  const [visualLayerOn, setVisualLayerOn] = useState(false)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)

  // ── Confidence rating + quiz ──────────────────────────────────────────────
  const [confidence, setConfidence] = useState<'hard' | 'good' | 'easy' | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizRevealed, setQuizRevealed] = useState(false)

  // ── Anki export button feedback ──────────────────────────────────────────
  const [savingImg, setSavingImg] = useState(false)

  // ── User-controlled mnemonic style ───────────────────────────────────────
  const [mnemonicType, setMnemonicType] = useState<MnemonicType>('hybrid')
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('sketchy')

  const subject = getSubject(activeSubject)

  const generateImg = useCallback((visualScene: string) => {
    setImgLoading(true)
    setImgError(false)
    setImageUrl(buildImageUrl(visualScene))
  }, [])

  const generate = useCallback(async () => {
    if (!topic.trim() || status === 'generating') return
    setStatus('generating')
    setResult(null)
    setError(null)
    setSaved(false)
    setImageUrl(null)
    setImgError(false)
    setConfidence(null)
    setQuizOpen(false)
    setQuizRevealed(false)
    setHighlightOn(false)
    setVisualLayerOn(false)
    if (audioOn) window.speechSynthesis?.cancel()

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), subject: subject.id, mnemonicType, visualStyle }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Generation failed.')

      const data: MnemonicOutput = json.data
      setResult(data)
      setStatus('success')
      setTab('explain')
      generateImg(data.visualScene)

      if (onMnemonicGenerated) {
        onMnemonicGenerated(topic.trim(), subject.label, data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStatus('error')
    }
  }, [topic, subject.id, status, generateImg, audioOn, mnemonicType, visualStyle, onMnemonicGenerated])

  // ── Multi-sensory toggle handlers ────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (!result) return
    if (audioOn) {
      window.speechSynthesis?.cancel()
      setAudioOn(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(
      `${result.explanation} ${result.mnemonic}`,
    )
    utter.rate = 0.95
    utter.onend = () => setAudioOn(false)
    speechRef.current = utter
    window.speechSynthesis?.speak(utter)
    setAudioOn(true)
  }, [result, audioOn])

  const toggleHighlight = useCallback(() => setHighlightOn(h => !h), [])
  const toggleVisualLayer = useCallback(() => setVisualLayerOn(v => !v), [])

  const handleConfidence = useCallback((level: 'hard' | 'good' | 'easy') => {
    setConfidence(level)
    // Hook point: feed into SM-2 spaced repetition once card is reviewed from the vault.
    // quality mapping: hard=2, good=4, easy=5 (see app/lib/vault.ts sm2())
  }, [])

  const handleCopy = () => {
    if (!result) return
    const text =
      tab === 'story' ? result.story
      : tab === 'visual' ? result.visualScene
      : tab === 'anki' ? `Q: ${result.ankiFront}\n\nA: ${result.ankiBack}`
      : `${result.explanation}\n\n${result.mnemonic}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    if (!result || saved) return
    onCardSaved(topic.trim(), subject.id, result, imageUrl ?? undefined)
    setSaved(true)
  }

  const handleDownloadImage = useCallback(async () => {
    if (!imageUrl || savingImg) return
    setSavingImg(true)
    try {
      // Draw image + title overlay onto a canvas so the saved file includes the title baked in
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not load image'))
        img.src = imageUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')

      ctx.drawImage(img, 0, 0)

      // Semi-transparent gradient backdrop for readable title text
      const gradientHeight = canvas.height * 0.22
      const gradient = ctx.createLinearGradient(0, canvas.height - gradientHeight, 0, canvas.height)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.78)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, canvas.height - gradientHeight, canvas.width, gradientHeight)

      // Title text
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.round(canvas.width * 0.045)}px sans-serif`
      ctx.textBaseline = 'bottom'
      ctx.fillText(topic, canvas.width * 0.04, canvas.height - canvas.height * 0.04, canvas.width * 0.92)

      ctx.fillStyle = 'rgba(13,242,125,0.95)'
      ctx.font = `600 ${Math.round(canvas.width * 0.022)}px monospace`
      ctx.fillText('MnemonicFlow Pro', canvas.width * 0.04, canvas.height - canvas.height * 0.115)

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.92))
      if (!blob) throw new Error('Could not export image')

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${topic.replace(/\s+/g, '_')}_mnemonic.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: download the raw image directly if canvas overlay fails (e.g. CORS)
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = `${topic.replace(/\s+/g, '_')}_mnemonic.jpg`
      a.target = '_blank'
      a.click()
    } finally {
      setSavingImg(false)
    }
  }, [imageUrl, topic, savingImg])

  const fillTopic = (t: string) => {
    setTopic(t)
    setResult(null)
    setStatus('idle')
    setSaved(false)
    setImageUrl(null)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-border">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-elevated transition-colors shrink-0"
          aria-label="Open subjects menu"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base sm:text-lg font-bold font-display text-ink-primary tracking-tight truncate">Focus Mode</h1>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-ink-tertiary font-mono shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-glow" />
              AI ENGINE READY
            </div>
          </div>
          <p className="text-[11px] sm:text-xs text-ink-tertiary mt-0.5 truncate">Type a topic → get story, image, and Anki card.</p>
        </div>

        <button
          onClick={onOpenVault}
          className="lg:hidden p-2 -mr-1 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-elevated transition-colors shrink-0 relative"
          aria-label="Open vault"
        >
          <BookMarked className="w-4.5 h-4.5" />
        </button>

        {onToggleVaultCollapsed && (
          <button
            onClick={onToggleVaultCollapsed}
            className="hidden lg:flex items-center gap-1.5 text-[11px] text-ink-tertiary hover:text-ink-primary px-2.5 py-1.5 rounded-lg border border-border hover:border-subtle transition-all duration-200 active:scale-95 shrink-0"
            aria-label={vaultCollapsed ? 'Show vault' : 'Hide vault'}
          >
            <BookMarked className="w-3.5 h-3.5" />
            {vaultCollapsed ? 'Show Vault' : 'Hide Vault'}
          </button>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 2xl:px-0 py-4 sm:py-6 border-b border-border">
      <div className="w-full 2xl:max-w-4xl 2xl:mx-auto space-y-3 sm:space-y-4">
        {/* Subject selector */}
        <div className="relative">
          <button
            onClick={() => setShowDrop(d => !d)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left bg-elevated border border-border hover:border-subtle transition-all duration-200 active:scale-[0.99]"
          >
            <span className="text-base shrink-0">{subject.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-ink-primary">{subject.label}</span>
              <span className="hidden sm:inline text-xs text-ink-tertiary ml-2">{subject.description}</span>
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-ink-tertiary transition-transform shrink-0', showDrop && 'rotate-180')} />
          </button>

          {showDrop && (
            <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-card-lg overflow-hidden animate-scale-in max-h-72 overflow-y-auto">
              {SUBJECTS.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSubjectChange(s.id); setShowDrop(false) }}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs hover:bg-elevated transition-colors', s.id === subject.id && 'bg-elevated')}
                >
                  <span>{s.icon}</span>
                  <span className="text-ink-secondary flex-1 min-w-0 truncate">{s.label}</span>
                  <span className="text-[9px] text-ink-muted font-mono shrink-0">Y{s.year}</span>
                  {s.id === subject.id && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.accent }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Topic input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={topic}
            onChange={e => { setTopic(e.target.value); setResult(null); setStatus('idle') }}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder={`e.g. "${subject.topics[0]}"`}
            maxLength={120}
            className="w-full bg-elevated border rounded-xl px-4 py-3 pr-14 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none focus:ring-1 transition-all duration-150 border-border focus:border-neon-green-border focus:ring-neon-green-glow"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-ink-tertiary font-mono hidden sm:inline">{topic.length}/120</span>
        </div>

        {/* Quick chips */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
          {subject.topics.slice(0, 4).map(t => (
            <button key={t} onClick={() => fillTopic(t)} className="text-[10px] px-2.5 py-1 rounded-full bg-elevated border border-border text-ink-tertiary hover:text-ink-secondary hover:border-subtle transition-all shrink-0 whitespace-nowrap">
              {t}
            </button>
          ))}
        </div>

        {/* Mnemonic type selector */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-ink-tertiary mb-1.5">Mnemonic Type</p>
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: 'acronym' as const, label: 'First-Letter Acronym' },
              { key: 'storyline' as const, label: 'Character Storyline' },
              { key: 'spatial' as const, label: 'Visual Spatial Layout' },
              { key: 'hybrid' as const, label: 'Hybrid Blend' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setMnemonicType(opt.key)}
                aria-pressed={mnemonicType === opt.key}
                className={cn(
                  'text-[10px] px-2.5 py-1.5 rounded-full border font-medium',
                  'transition-all duration-200 active:scale-95',
                  mnemonicType === opt.key
                    ? 'bg-neon-green-dim border-neon-green-border text-neon-green'
                    : 'bg-elevated border-border text-ink-tertiary hover:text-ink-secondary hover:border-subtle',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual style selector */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-ink-tertiary mb-1.5">Image Style</p>
          <div className="flex gap-1.5">
            {([
              { key: 'sketchy' as const, label: 'Clinical Ink™', desc: 'Hand-drawn, ink line art' },
              { key: 'osmosis' as const, label: 'NeuroCanvas™', desc: 'Flat-vector whiteboard' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setVisualStyle(opt.key)}
                aria-pressed={visualStyle === opt.key}
                className={cn(
                  'flex-1 flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border text-left',
                  'transition-all duration-200 active:scale-[0.97]',
                  visualStyle === opt.key
                    ? 'bg-neon-biochem-dim border-neon-biochem-border'
                    : 'bg-elevated border-border hover:border-subtle',
                )}
              >
                <span className={cn('text-xs font-semibold', visualStyle === opt.key ? 'text-neon-biochem' : 'text-ink-secondary')}>{opt.label}</span>
                <span className="text-[9px] text-ink-tertiary">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={!topic.trim() || status === 'generating'}
          style={topic.trim() ? { boxShadow: '0 0 24px rgba(13, 242, 125, 0.25)' } : {}}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold tracking-wide',
            'transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none',
            topic.trim() && status !== 'generating'
              ? 'bg-neon-green text-void hover:brightness-110'
              : 'bg-elevated text-ink-tertiary opacity-50 border border-border',
          )}
        >
          {status === 'generating'
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
            : <><Zap className="w-4 h-4" /> Generate Mnemonic and Image</>}
        </button>
        </div>
      </div>

      {/* Result Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 2xl:px-0 py-5 sm:py-6">
      <div className="w-full 2xl:max-w-4xl 2xl:mx-auto space-y-4 sm:space-y-5">
        {status === 'error' && error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-neon-danger-dim border border-neon-danger/30 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-neon-danger shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-neon-danger">Generation Failed</div>
              <div className="text-xs text-ink-secondary mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {status === 'generating' && <GeneratingSkeleton accent={subject.accent} stage={loadingStage} />}

        {status === 'success' && result && (
          <div className="space-y-4 animate-fade-up">
            {/* Image */}
            <div className="rounded-xl overflow-hidden border border-border bg-elevated">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="w-3.5 h-3.5 text-neon-biochem shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-neon-biochem truncate">AI Generated Image</span>
                </div>
                {imageUrl && !imgLoading && !imgError && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => setLightboxOpen(true)}
                      title="Expand"
                      className="icon-btn w-6 h-6"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => generateImg(result?.visualScene ?? '')}
                      title="Regenerate"
                      className="icon-btn w-6 h-6"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={async () => {
                        if (navigator.share) {
                          try { await navigator.share({ title: topic, text: `${topic} — MnemonicFlow Pro`, url: imageUrl }) } catch { /* user cancelled */ }
                        } else {
                          navigator.clipboard.writeText(imageUrl)
                        }
                      }}
                      title="Share"
                      className="icon-btn w-6 h-6"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleDownloadImage}
                      disabled={savingImg}
                      title="Save"
                      className={cn(
                        'flex items-center gap-1 text-[9px] font-medium shrink-0 rounded-md px-1.5 py-0.5 ml-0.5',
                        'transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
                        'text-ink-tertiary hover:text-neon-green hover:bg-neon-green-dim',
                      )}
                    >
                      {savingImg ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      {savingImg ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              <div className="relative w-full group" style={{ aspectRatio: '16/10' }}>
                {imgLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-elevated gap-3 skeleton-shimmer">
                    <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${subject.accent}44`, borderTopColor: subject.accent }} />
                    <p className="text-[10px] text-ink-tertiary font-mono">Generating image...</p>
                    <p className="text-[9px] text-ink-muted">Takes ~10-15 seconds</p>
                  </div>
                )}
                {imgError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-elevated gap-2">
                    <span className="text-3xl">🖼️</span>
                    <p className="text-xs text-ink-tertiary">Image generation failed</p>
                    <button
                      onClick={() => generateImg(result.visualScene)}
                      className="text-[10px] text-neon-green hover:underline mt-1 transition-all duration-200 active:scale-95"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`AI illustration for ${topic}`}
                      loading="lazy"
                      onLoad={() => setImgLoading(false)}
                      onError={() => { setImgLoading(false); setImgError(true) }}
                      onClick={() => setLightboxOpen(true)}
                      className={cn(
                        'w-full h-full object-cover cursor-zoom-in transition-all duration-500 group-hover:scale-[1.02]',
                        imgLoading ? 'opacity-0' : 'opacity-100',
                      )}
                    />
                    {/* Title overlay — readable semi-transparent backdrop */}
                    {!imgLoading && (
                      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 pt-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                        <p className="text-[9px] font-mono font-semibold text-neon-green tracking-wide">MNEMONICFLOW PRO</p>
                        <p className="text-sm font-bold text-white truncate">{topic}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Multi-sensory dashboard toggles */}
            <div className="flex gap-2">
              <button
                onClick={toggleAudio}
                aria-pressed={audioOn}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium',
                  'transition-all duration-200 active:scale-95 border',
                  audioOn
                    ? 'bg-neon-green-dim border-neon-green-border text-neon-green'
                    : 'bg-elevated border-border text-ink-tertiary hover:text-ink-secondary hover:border-subtle',
                )}
              >
                <Volume2 className="w-3.5 h-3.5" /> {audioOn ? 'Stop Audio' : 'Audio'}
              </button>
              <button
                onClick={toggleVisualLayer}
                aria-pressed={visualLayerOn}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium',
                  'transition-all duration-200 active:scale-95 border',
                  visualLayerOn
                    ? 'bg-neon-biochem-dim border-neon-biochem-border text-neon-biochem'
                    : 'bg-elevated border-border text-ink-tertiary hover:text-ink-secondary hover:border-subtle',
                )}
              >
                <Layers className="w-3.5 h-3.5" /> Visual Layer
              </button>
              <button
                onClick={toggleHighlight}
                aria-pressed={highlightOn}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium',
                  'transition-all duration-200 active:scale-95 border',
                  highlightOn
                    ? 'bg-neon-physio-dim border-neon-physio-border text-neon-physio'
                    : 'bg-elevated border-border text-ink-tertiary hover:text-ink-secondary hover:border-subtle',
                )}
              >
                <Highlighter className="w-3.5 h-3.5" /> Highlight
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-elevated rounded-xl border border-border overflow-x-auto scrollbar-none">
              {([
                { key: 'explain', label: 'Explain', icon: <Sparkles className="w-3.5 h-3.5" /> },
                { key: 'story', label: 'Story', icon: <BookOpen className="w-3.5 h-3.5" /> },
                { key: 'anki', label: 'Anki', icon: <CreditCard className="w-3.5 h-3.5" /> },
                { key: 'visual', label: 'Prompt', icon: <Eye className="w-3.5 h-3.5" /> },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap min-w-[70px]',
                    tab === t.key ? 'bg-card text-ink-primary shadow-card-sm border border-border' : 'text-ink-tertiary hover:text-ink-secondary',
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="min-h-[140px]">
              {tab === 'explain' && (
                <div className="animate-fade-in space-y-3">
                  <div className="p-4 rounded-xl border border-border bg-elevated">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-3.5 h-3.5 text-ink-tertiary" />
                      <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-ink-tertiary">Simple Explanation</span>
                    </div>
                    <p className={cn(
                      'text-sm leading-relaxed whitespace-pre-line transition-all duration-300',
                      highlightOn
                        ? 'text-ink-primary [&::selection]:bg-neon-physio'
                        : 'text-ink-primary',
                    )}>
                      {highlightOn ? <HighYieldHighlight text={result.explanation} /> : result.explanation}
                    </p>
                  </div>

                  {result.mnemonic && (
                    <div className={cn(
                      'p-4 rounded-xl border-2 transition-all duration-300',
                      visualLayerOn
                        ? 'border-neon-green shadow-glow-md bg-neon-green-dim'
                        : 'border-neon-green-border bg-neon-green-dim',
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3.5 h-3.5 text-neon-green" />
                        <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-neon-green">The Mnemonic</span>
                      </div>
                      <p className="text-sm font-bold text-ink-primary leading-relaxed">{result.mnemonic}</p>
                    </div>
                  )}

                  {result.mnemonicKey && (
                    <div className="p-4 rounded-xl border border-neon-biochem-border bg-neon-biochem-dim">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-neon-biochem" />
                        <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-neon-biochem">What Each Part Means</span>
                      </div>
                      <p className="text-xs text-ink-primary leading-relaxed whitespace-pre-line">{result.mnemonicKey}</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'story' && (
                <div className="animate-fade-in space-y-3">
                  <div className="p-5 rounded-xl border" style={{ background: `${subject.accent}0a`, borderColor: `${subject.accent}33` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-3.5 h-3.5" style={{ color: subject.accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: subject.accent }}>The Storyline</span>
                    </div>
                    <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-line">{result.story}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.tags?.map(tagItem => (
                      <span key={tagItem} className="text-[9px] px-2 py-0.5 rounded-full bg-subtle text-ink-tertiary font-mono">#{tagItem}</span>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'visual' && (
                <div className="animate-fade-in p-5 rounded-xl bg-elevated border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-3.5 h-3.5 text-neon-biochem" />
                    <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-neon-biochem">Image Prompt Used</span>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed font-mono break-words">{result.visualScene}</p>
                </div>
              )}

              {tab === 'anki' && (
                <div className="animate-fade-in">
                  <PremiumFlashcard
                    card={{
                      id: 'preview',
                      topic: topic,
                      subject: subject.id,
                      mnemonic: {
                        mnemonic: result.mnemonic,
                        ankiFront: result.ankiFront,
                        ankiBack: result.ankiBack,
                        explanation: result.explanation
                      }
                    }}
                    isFavorite={saved}
                    onToggleFav={handleSave}
                    onReview={(q) => handleConfidence(q === 2 ? 'hard' : q === 4 ? 'good' : 'easy')}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                  'bg-elevated border border-border text-ink-secondary',
                  'transition-all duration-200 hover:text-ink-primary hover:border-subtle active:scale-95',
                )}
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleSave}
                disabled={saved}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold min-w-[120px]',
                  'transition-all duration-200 active:scale-95 disabled:active:scale-100',
                  saved ? 'bg-neon-success-dim border border-neon-green-border text-neon-green cursor-default' : 'bg-neon-green text-void hover:brightness-110',
                )}
              >
                {saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved to Vault</> : <><Save className="w-3.5 h-3.5" /> Save to Vault</>}
              </button>
              <button
                onClick={generate}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                  'bg-elevated border border-border text-ink-secondary',
                  'transition-all duration-200 hover:text-ink-primary hover:border-subtle active:scale-95',
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>

            {/* Confidence rating widget */}
            <div className="p-3 rounded-xl border border-border bg-elevated">
              <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-ink-tertiary mb-2.5">How well did you remember this?</p>
              <div className="flex gap-2">
                {([
                  { key: 'hard' as const, label: 'Hard', icon: <ThumbsDown className="w-3.5 h-3.5" />, active: 'bg-neon-danger-dim border-neon-danger/40 text-neon-danger' },
                  { key: 'good' as const, label: 'Good', icon: <Meh className="w-3.5 h-3.5" />, active: 'bg-neon-physio-dim border-neon-physio-border text-neon-physio' },
                  { key: 'easy' as const, label: 'Easy', icon: <ThumbsUp className="w-3.5 h-3.5" />, active: 'bg-neon-green-dim border-neon-green-border text-neon-green' },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => handleConfidence(opt.key)}
                    aria-pressed={confidence === opt.key}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border',
                      'transition-all duration-200 active:scale-95',
                      confidence === opt.key ? opt.active : 'bg-card border-border text-ink-tertiary hover:text-ink-secondary hover:border-subtle',
                    )}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              {confidence && (
                <p className="text-[10px] text-ink-tertiary mt-2 animate-fade-in">
                  Got it — saved cards will use this to schedule your next review.
                </p>
              )}
            </div>

            {/* Quick quiz toggle */}
            {(result.quizQuestion || result.quizAnswer) && (
              <div className="rounded-xl border border-border bg-elevated overflow-hidden">
                <button
                  onClick={() => { setQuizOpen(o => !o); setQuizRevealed(false) }}
                  aria-expanded={quizOpen}
                  className="w-full flex items-center justify-between px-4 py-3 transition-all duration-200 active:scale-[0.99]"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-primary">
                    <HelpCircle className="w-3.5 h-3.5 text-neon-micro" /> Quick Quiz
                  </span>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-ink-tertiary transition-transform duration-200', quizOpen && 'rotate-180')} />
                </button>
                {quizOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-3 animate-fade-in border-t border-border">
                    <p className="text-sm text-ink-primary leading-relaxed">{result.quizQuestion}</p>
                    {!quizRevealed ? (
                      <button
                        onClick={() => setQuizRevealed(true)}
                        className="text-xs font-medium text-neon-micro hover:underline transition-all duration-200 active:scale-95"
                      >
                        Reveal answer →
                      </button>
                    ) : (
                      <div className="p-3 rounded-lg bg-neon-micro-dim border border-neon-micro-border animate-fade-in">
                        <p className="text-xs text-ink-primary font-medium">{result.quizAnswer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {status === 'idle' && !result && (
          <IdleState accent={subject.accent} topics={subject.topics} onFill={fillTopic} />
        )}
        </div>
      </div>

      {/* Fullscreen image lightbox */}
      {lightboxOpen && imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 icon-btn w-9 h-9 bg-elevated border border-border"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`AI illustration for ${topic}`}
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-full rounded-xl shadow-card-lg animate-scale-in object-contain"
          />
        </div>
      )}
    </div>
  )
}

// ── Simple high-yield text highlighter (bolds long/technical words) ─────────
function HighYieldHighlight({ text }: { text: string }) {
  const parts = text.split(/(\s+)/)
  return (
    <>
      {parts.map((part, i) => {
        const isHighYield = part.length >= 8 && /^[A-Za-z-]+$/.test(part)
        return isHighYield ? (
          <mark key={i} className="bg-neon-physio-dim text-neon-physio rounded px-0.5 font-semibold">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

function IdleState({ accent, topics, onFill }: { accent: string; topics: string[]; onFill: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-8 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border" style={{ background: `${accent}10`, borderColor: `${accent}30`, boxShadow: `0 0 32px ${accent}20` }}>
        <Zap className="w-7 h-7 animate-float" style={{ color: accent }} />
      </div>
      <h3 className="text-sm font-semibold text-ink-secondary mb-1">Ready to generate</h3>
      <p className="text-xs text-ink-tertiary mb-2 max-w-xs leading-relaxed px-4">You'll get a real mnemonic, an AI image, and an Anki card — all free.</p>
      <div className="flex items-center gap-3 mb-6 text-[10px] text-ink-tertiary font-mono">
        <span>📖 Mnemonic</span><span>+</span><span>🖼️ Image</span><span>+</span><span>🎴 Anki</span>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs px-4">
        {topics.slice(0, 5).map(t => (
          <button key={t} onClick={() => onFill(t)} className="text-xs px-4 py-2.5 rounded-xl bg-elevated border border-border text-ink-secondary hover:text-ink-primary hover:border-subtle transition-all text-left flex items-center gap-2">
            <span className="text-ink-tertiary">→</span> {t}
          </button>
        ))}
      </div>
    </div>
  )
}

function GeneratingSkeleton({ accent, stage }: { accent: string; stage: number }) {
  const isDone = stage >= LOADING_STAGES.length - 1
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="p-4 rounded-xl bg-elevated border border-border overflow-hidden relative">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin shrink-0" style={{ borderColor: `${accent}44`, borderTopColor: accent }} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink-primary transition-all duration-300">{LOADING_STAGES[stage]}</div>
            <div className="text-[10px] text-ink-tertiary mt-0.5">Step {stage + 1} of {LOADING_STAGES.length}</div>
          </div>
        </div>
        {/* Indeterminate progress rail */}
        <div className="h-1 rounded-full bg-subtle overflow-hidden mt-3">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((stage + 1) / LOADING_STAGES.length) * 100}%`, background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
        </div>
        {/* Stage checklist */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
          {LOADING_STAGES.map((s, i) => (
            <span key={s} className={cn(
              'text-[9px] font-mono transition-colors duration-300',
              i < stage ? 'text-ink-tertiary line-through' : i === stage ? 'text-ink-primary' : 'text-ink-muted',
            )}>
              {i < stage ? '✓' : '·'} {s.replace('...', '')}
            </span>
          ))}
        </div>
      </div>
      <div className="w-full rounded-xl bg-elevated skeleton-shimmer" style={{ aspectRatio: '16/10' }} />
      {[100, 80, 90].map((w, i) => (
        <div key={i} className="h-3 rounded-full bg-elevated skeleton-shimmer" style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }} />
      ))}
      {isDone && <p className="text-[10px] text-ink-tertiary text-center font-mono">Almost there — polishing the details...</p>}
    </div>
  )
}