import { PhoneCall, PhoneMissed } from 'lucide-react'
import { LEADS } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { useCall } from '../calling/callContext'
import { formatRupees, formatWhen } from '../lib/format'
import { Avatar, ScorePill, SectionHeader } from '../components/ui'
import type { CallRecord } from '../types'

/** A missed call counts as handled once a later connected call exists for the same lead. */
function isCalledBack(missed: CallRecord, all: CallRecord[]) {
  return all.some(
    (c) =>
      c.direction !== 'missed' &&
      c.durationSec > 0 &&
      new Date(c.startedAt) > new Date(missed.startedAt) &&
      (missed.leadId ? c.leadId === missed.leadId : c.peerId === missed.peerId),
  )
}

export default function Incoming() {
  const { recentCalls, openLeadsModal } = useAppState()
  const call = useCall()
  const busy = call.status === 'calling' || call.status === 'in-call' || call.status === 'ringing'

  const missed = recentCalls
    .filter((c) => c.direction === 'missed' && !isCalledBack(c, recentCalls))
    .map((c) => {
      const lead = LEADS.find((l) => l.id === c.leadId)
      // Expected value = deal size weighted by how likely they are to buy.
      const expectedValue = lead ? Math.round((lead.price * lead.intent) / 100) : 0
      return { call: c, lead, expectedValue }
    })
    .sort((a, b) => b.expectedValue - a.expectedValue)

  const atStake = missed.reduce((sum, m) => sum + m.expectedValue, 0)

  return (
    <div className="page">
      <SectionHeader title="Incoming" subtitle="Missed calls, ranked by expected value. Call the highest-value leads back first." />

      <div className="summary-strip card">
        <div>
          <div className="stat-big">{missed.length}</div>
          <div className="stat-label">Missed, not called back</div>
        </div>
        <div className="divider" />
        <div>
          <div className="stat-big green">{formatRupees(atStake)}</div>
          <div className="stat-label">Expected value at stake</div>
        </div>
      </div>

      {missed.length === 0 ? (
        <div className="empty card">
          <PhoneCall size={28} />
          <div>Every missed call has been returned.</div>
        </div>
      ) : (
        <div className="list-card card">
          {missed.map(({ call: c, lead, expectedValue }) => (
            <div key={c.id} className="missed-row">
              <span className="missed-icon"><PhoneMissed size={16} /></span>
              {lead ? <Avatar initials={lead.initials} /> : <Avatar initials="?" tone="grey" />}
              <div className="lead-row-main">
                {lead ? (
                  <button className="lead-name link-btn plain" onClick={() => openLeadsModal(lead.id)}>
                    {c.name}
                  </button>
                ) : (
                  <span className="lead-name">{c.name}</span>
                )}
                <span className="muted small">
                  {formatWhen(c.startedAt)} · {lead ? lead.product : c.outcome}
                </span>
              </div>
              <div className="missed-value">
                <div className="value">{lead ? formatRupees(expectedValue) : 'New contact'}</div>
                <div className="muted small">{lead ? 'expected' : 'no record'}</div>
              </div>
              {lead && <ScorePill score={lead.intent} label="Intent" />}
              <button
                className="btn btn-green"
                disabled={busy}
                onClick={() =>
                  call.openDialer({ label: c.name, leadId: c.leadId, peerId: c.peerId, purpose: 'callback' })
                }
              >
                <PhoneCall size={15} /> Call back
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
