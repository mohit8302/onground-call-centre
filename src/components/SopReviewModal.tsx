import { CheckCircle2, Phone, XCircle } from 'lucide-react'
import { useAppState } from '../state/appContext'
import { useCall } from '../calling/callContext'
import { formatDuration, formatWhen } from '../lib/format'
import { Modal, ScorePill } from './ui'

export default function SopReviewModal() {
  const { recentCalls, sopReviewCallId, setSopReviewCallId } = useAppState()
  const call = useCall()
  const record = recentCalls.find((c) => c.id === sopReviewCallId)
  if (!record) return null

  const close = () => setSopReviewCallId(null)
  const isIdle = call.status === 'ready'

  return (
    <Modal
      title="Call SOP review"
      subtitle={`${record.name} · ${formatWhen(record.startedAt)} · ${formatDuration(record.durationSec)}`}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>Close</button>
          {record.direction !== 'outgoing' || record.durationSec === 0 ? (
            <button
              className="btn btn-green"
              disabled={!isIdle}
              onClick={() => {
                close()
                call.openDialer({ label: record.name, leadId: record.leadId, peerId: record.peerId, purpose: 'callback' })
              }}
            >
              <Phone size={15} /> Call back
            </button>
          ) : null}
        </>
      }
    >
      <div className="sop-summary">
        <div>
          <div className="detail-label">Outcome</div>
          <div className="sop-outcome">{record.outcome}</div>
        </div>
        {record.sopScore !== undefined && (
          <div>
            <div className="detail-label">SOP score</div>
            <ScorePill score={record.sopScore} />
          </div>
        )}
      </div>

      {record.summary && (
        <div className="detail-block">
          <div className="detail-label">Summary</div>
          <p>{record.summary}</p>
        </div>
      )}

      {record.sopChecks ? (
        <ul className="sop-list">
          {record.sopChecks.map((check) => (
            <li key={check.label} className={check.done ? 'ok' : 'miss'}>
              {check.done ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
              <div>
                <div>{check.label}</div>
                {check.note && <div className="muted small">{check.note}</div>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notice">
          {record.direction === 'missed' || record.durationSec === 0
            ? 'This call did not connect, so there is nothing to review.'
            : 'This was a real browser call. Calls are not recorded or transcribed in this demo, so no SOP checklist was generated.'}
        </p>
      )}
    </Modal>
  )
}
