import { useState } from 'react'
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Radio, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppState } from '../state/appContext'
import { formatDuration, formatWhen } from '../lib/format'
import { PlanBand, ScorePill, SectionHeader } from '../components/ui'
import type { CallDirection } from '../types'

const DIRECTION: Record<CallDirection, { icon: LucideIcon; label: string }> = {
  incoming: { icon: PhoneIncoming, label: 'Incoming' },
  outgoing: { icon: PhoneOutgoing, label: 'Outgoing' },
  missed: { icon: PhoneMissed, label: 'Missed' },
}

type Filter = 'all' | CallDirection

export default function Recent() {
  const { recentCalls, setSopReviewCallId } = useAppState()
  const [filter, setFilter] = useState<Filter>('all')
  const calls = filter === 'all' ? recentCalls : recentCalls.filter((c) => c.direction === filter)

  return (
    <div className="page">
      <PlanBand />
      <SectionHeader title="Recent calls" subtitle="Tap a call to review it against the SOP." />

      <div className="chip-row" role="group" aria-label="Filter calls">
        {(['all', 'incoming', 'outgoing', 'missed'] as Filter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {f === 'all' ? 'All' : DIRECTION[f].label}
          </button>
        ))}
      </div>

      <div className="list-card card">
        {calls.length === 0 && <div className="empty">No calls here yet.</div>}
        {calls.map((c) => {
          const { icon: Icon, label } = DIRECTION[c.direction]
          return (
            <button key={c.id} className="recent-row" onClick={() => setSopReviewCallId(c.id)}>
              <span className={`dir-icon dir-${c.direction}`} title={label}>
                <Icon size={16} />
              </span>
              <span className="lead-row-main">
                <span className="lead-name">
                  {c.name}
                  {c.source === 'live' && (
                    <span className="live-tag" title="A real browser call made in this session">
                      <Radio size={11} /> live
                    </span>
                  )}
                  {c.source === 'ai' && (
                    <span className="live-tag ai" title="A real voice call with the AI, made in this session">
                      <Sparkles size={11} /> AI call
                    </span>
                  )}
                </span>
                <span className="muted small">
                  {label} · {formatWhen(c.startedAt)}
                </span>
              </span>
              <span className="recent-duration">{formatDuration(c.durationSec)}</span>
              <span className={`outcome outcome-${c.direction}`}>{c.outcome}</span>
              {c.sopScore !== undefined ? <ScorePill score={c.sopScore} label="SOP" /> : <span className="pill pill-grey">No SOP</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
