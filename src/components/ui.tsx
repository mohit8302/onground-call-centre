import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { scoreTone } from '../lib/format'

export function Avatar({ initials, size = 36, tone = 'green' }: { initials: string; size?: number; tone?: string }) {
  return (
    <span className={`avatar avatar-${tone}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials}
    </span>
  )
}

export function ScorePill({ score, label }: { score: number; label?: string }) {
  return (
    <span className={`pill pill-${scoreTone(score)}`}>
      {label && <span className="pill-label">{label}</span>}
      {score}
    </span>
  )
}

export function ProgressBar({ value, max = 100, tone = 'green' }: { value: number; max?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`progress-fill tone-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Circular score ring drawn with SVG so it scales cleanly. */
export function ScoreRing({ score, size = 40, stroke = 4 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#ffd34d"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="score-ring-text">
        {score}
      </text>
    </svg>
  )
}

interface ModalProps {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Extra class on the panel, e.g. a coloured header variant. */
  className?: string
}

/** Accessible modal: Escape closes, focus moves inside, backdrop click closes. */
export function Modal({ title, subtitle, onClose, children, footer, wide, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Callers pass inline functions; read the latest one without re-running the effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Runs once per open: focus the dialog, lock page scroll, restore focus on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true" tabIndex={-1} ref={panelRef}>
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Navy band on top of the three Plan screens, as in the mock's planner. */
export function PlanBand() {
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className="plan-band">
      <div>
        <div className="plan-band-kicker">Today’s calling plan</div>
        <div className="plan-band-title">Planner</div>
      </div>
      <span className="plan-band-date">{date}</span>
    </div>
  )
}
