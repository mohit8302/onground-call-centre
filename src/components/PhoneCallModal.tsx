import { PhoneOff, Phone } from 'lucide-react'
import { LEADS } from '../data/mockData'
import { useCall } from '../calling/callContext'
import { Modal } from './ui'

/**
 * Phone-network (PSTN) calling is not implemented: there is no telephony
 * provider behind this app. This dialog says so plainly and points the agent
 * at the working in-app call instead. A future integration (Twilio, Exotel…)
 * would replace the body of this component, not the launcher.
 */
export default function PhoneCallModal({ onClose }: { onClose: () => void }) {
  const call = useCall()
  const lead = LEADS.find((l) => l.id === call.target?.leadId)
  const busy = call.status === 'calling' || call.status === 'ringing' || call.status === 'in-call'

  return (
    <Modal
      title="Phone call"
      subtitle={lead ? `${lead.name} · ${lead.phone}` : 'Dial a phone number'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button
            className="btn btn-green"
            disabled={call.status === 'offline' || call.status === 'connecting'}
            onClick={() => {
              onClose()
              call.openDialer(busy ? undefined : call.target ?? undefined)
            }}
          >
            <Phone size={15} /> {busy ? 'Show current call' : 'Use in-app call'}
          </button>
        </>
      }
    >
      <div className="unavailable">
        <span className="unavailable-icon"><PhoneOff size={20} /></span>
        <div>
          <strong>Phone-number calling isn’t set up</strong>
          <p className="muted small">
            This app can’t dial phone numbers yet: no telephony provider is connected, so nothing has been dialled.
            In-app calls (browser to browser) work now.
          </p>
        </div>
      </div>
    </Modal>
  )
}
