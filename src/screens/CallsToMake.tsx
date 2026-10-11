import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Phone, Sparkles } from 'lucide-react'
import { LEADS } from '../data/mockData'
import { useCall } from '../calling/callContext'
import { useAppState } from '../state/appContext'
import { formatRupees } from '../lib/format'
import { Avatar, PlanBand, ScorePill, SectionHeader } from '../components/ui'

const PAGE_SIZE = 2

// Highest attractiveness first: these are the calls most worth making now.
const RANKED = [...LEADS].sort((a, b) => b.attractiveness - a.attractiveness)

export default function CallsToMake() {
  const call = useCall()
  const { openLeadsModal } = useAppState()
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(RANKED[0].id)

  const pageCount = Math.ceil(RANKED.length / PAGE_SIZE)
  const visible = RANKED.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const busy = call.status === 'calling' || call.status === 'in-call' || call.status === 'ringing'

  return (
    <div className="page">
      <PlanBand />
      <SectionHeader title="Calls to make" subtitle="Ranked by lead attractiveness score. Tap a lead for the full picture." />

      <div className="list-card card">
        {visible.map((lead, i) => {
          const rank = page * PAGE_SIZE + i + 1
          const open = expandedId === lead.id
          return (
            <article key={lead.id} className={`lead-row ${open ? 'open' : ''}`}>
              <button
                className="lead-row-head"
                onClick={() => setExpandedId(open ? null : lead.id)}
                aria-expanded={open}
                aria-controls={`lead-${lead.id}`}
              >
                <span className="rank">#{rank}</span>
                <Avatar initials={lead.initials} />
                <span className="lead-row-main">
                  <span className="lead-name">{lead.name}</span>
                  <span className="muted small">
                    {lead.product} · {formatRupees(lead.price)}
                  </span>
                </span>
                <span className={`sla-badge status-${lead.status.replace(' ', '-').toLowerCase()}`}>{lead.slaBadge}</span>
                <ScorePill score={lead.attractiveness} />
                <ChevronDown size={18} className="chevron" />
              </button>

              {open && (
                <div className="lead-row-body" id={`lead-${lead.id}`}>
                  <div className="detail-block">
                    <div className="detail-label">Story so far</div>
                    <ul className="story">
                      {lead.story.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="detail-grid">
                    <div className="detail-tile">
                      <div className="detail-label">Preferred product</div>
                      <div>{lead.product}</div>
                      <div className="muted small">{formatRupees(lead.price)}</div>
                    </div>
                    <div className="detail-tile">
                      <div className="detail-label">Cross-sell</div>
                      <div>{lead.crossSell}</div>
                    </div>
                    <div className="detail-tile">
                      <div className="detail-label">EMI</div>
                      <div>{lead.emi}</div>
                    </div>
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn btn-green"
                      disabled={busy}
                      onClick={() => call.openDialer({ label: lead.name, leadId: lead.id, purpose: 'lead' })}
                    >
                      <Phone size={15} /> Place call
                    </button>
                    <button className="btn" onClick={() => openLeadsModal(lead.id)}>
                      <Sparkles size={15} /> Lead details
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <nav className="pager" aria-label="Pages">
        <button className="icon-btn" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {page + 1} of {pageCount} · {RANKED.length} leads
        </span>
        <button
          className="icon-btn"
          disabled={page === pageCount - 1}
          onClick={() => setPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  )
}
