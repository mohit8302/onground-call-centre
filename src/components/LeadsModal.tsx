import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Phone } from 'lucide-react'
import { LEADS } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { useCall } from '../calling/callContext'
import { formatRupees, scoreTone } from '../lib/format'
import { Avatar, Modal, ProgressBar, ScorePill } from './ui'

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`collapsible ${open ? 'open' : ''}`}>
      <button className="collapsible-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {title}
        <ChevronDown size={16} className="chevron" />
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  )
}

export default function LeadsModal() {
  const { leadsModalIndex, setLeadsModalIndex, recentCalls } = useAppState()
  const call = useCall()
  if (leadsModalIndex === null) return null

  const lead = LEADS[leadsModalIndex]
  const close = () => setLeadsModalIndex(null)
  const go = (delta: number) => setLeadsModalIndex((leadsModalIndex + delta + LEADS.length) % LEADS.length)

  // Missed calls across all allocated leads, as the manager would see them.
  const cumulativeMissed = recentCalls.filter((c) => c.direction === 'missed' && c.leadId).length
  const leadMissed = recentCalls.filter((c) => c.direction === 'missed' && c.leadId === lead.id).length

  return (
    <Modal
      wide
      title="Leads"
      subtitle="Your allocated leads · SLA to close"
      onClose={close}
      footer={
        <div className="leads-foot">
          <span>
            <strong>Cumulative missed: {cumulativeMissed}</strong>
            <span className="muted"> · visible to your manager</span>
          </span>
          <div className="pager">
            <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous lead">
              <ChevronLeft size={16} />
            </button>
            <span>{leadsModalIndex + 1} / {LEADS.length}</span>
            <button className="icon-btn" onClick={() => go(1)} aria-label="Next lead">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      }
    >
      {/* Key forces collapsibles to reset when paging to another lead. */}
      <div key={lead.id}>
        <div className="lead-card">
          <Avatar initials={lead.initials} size={46} />
          <div className="lead-card-main">
            <div className="lead-card-name">{lead.name}</div>
            <div className="muted small">{lead.phone}</div>
            <div className="small">Interested in <strong>{lead.product}</strong> · {formatRupees(lead.price)}</div>
          </div>
          <div className="lead-card-side">
            <span className={`sla-badge status-${lead.status.replace(' ', '-').toLowerCase()}`}>{lead.slaBadge}</span>
            <button
              className="btn btn-green"
              disabled={call.status !== 'ready'}
              onClick={() => {
                close()
                call.openDialer({ label: lead.name, leadId: lead.id, purpose: 'lead' })
              }}
            >
              <Phone size={15} /> Call
            </button>
          </div>
        </div>

        <div className="score-tiles">
          <div className="score-tile">
            <div className="detail-label">ICP score</div>
            <div className={`score-big tone-${scoreTone(lead.icp)}`}>{lead.icp}</div>
            <div className="muted small">Fit with your ideal customer</div>
          </div>
          <div className="score-tile">
            <div className="detail-label">Lead intent score</div>
            <div className={`score-big tone-${scoreTone(lead.intent)}`}>{lead.intent}</div>
            <div className="muted small">How ready they are to buy</div>
          </div>
          <div className="score-tile">
            <div className="detail-label">Missed calls</div>
            <div className="score-big">{leadMissed}</div>
            <div className="muted small">For this lead</div>
          </div>
        </div>

        <Collapsible title="ICP breakdown" defaultOpen>
          {lead.subScores.map((s) => (
            <div key={s.label} className="subscore">
              <div className="subscore-head">
                <span>{s.label}</span>
                <ScorePill score={s.pct} />
              </div>
              <ProgressBar value={s.pct} tone={scoreTone(s.pct)} />
            </div>
          ))}
        </Collapsible>

        <Collapsible title="Customer journey">
          <ol className="journey">
            {lead.journey.map((j) => (
              <li key={j.date + j.text}>
                <span className="journey-date">{j.date}</span>
                <span className="journey-channel">{j.channel}</span>
                <span>{j.text}</span>
              </li>
            ))}
          </ol>
        </Collapsible>

        <Collapsible title="Buying signals">
          {lead.signals.map((s) => (
            <div key={s.category} className="signal">
              <span className="signal-cat">{s.category}</span>
              <span>{s.text}</span>
            </div>
          ))}
        </Collapsible>
      </div>
    </Modal>
  )
}
