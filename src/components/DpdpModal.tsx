import { Hand, MessageSquareWarning, MicOff, UserPlus, UserSearch } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from './ui'

interface Rule {
  icon: LucideIcon
  tone: string
  title: string
  section: string
  text: string
  /** What this build actually does, so the dialog never over-claims. */
  status: string
  built: boolean
}

// Section references are to India's Digital Personal Data Protection Act, 2023.
const RULES: Rule[] = [
  {
    icon: MessageSquareWarning,
    tone: 'green',
    title: 'Ask first',
    section: 'Sec 5–6',
    text: 'Read the line and get their yes before anything is recorded.',
    status: 'The consent step opens before every in-app or phone call and logs the answer with a Consent ID. Sending the line on WhatsApp isn’t connected yet.',
    built: true,
  },
  {
    icon: MicOff,
    tone: 'grey',
    title: 'No means no',
    section: 'Sec 6',
    text: 'Carry on without recording. Offers stay off unless they say yes.',
    status: 'A no is logged too. This app never records calls.',
    built: true,
  },
  {
    icon: Hand,
    tone: 'red',
    title: 'Stop means stop',
    section: 'Sec 6',
    text: 'If they take their consent back, recording stops straight away.',
    status: 'Not built yet: there is no call recording or speech detection to stop.',
    built: false,
  },
  {
    icon: UserSearch,
    tone: 'blue',
    title: 'Data questions go to the DPO',
    section: 'Sec 11–14',
    text: 'Pass the request to your Data Protection Officer. They get a reference number. Don’t promise anything.',
    status: 'Not built yet: there is no DPO request flow in this app.',
    built: false,
  },
  {
    icon: UserPlus,
    tone: 'amber',
    title: 'Under 18 needs a parent',
    section: 'Sec 9',
    text: 'Switch on “Under 18?” and the parent says yes.',
    status: 'The “Under 18?” switch in the consent step marks the answer as a parent’s.',
    built: true,
  },
]

export default function DpdpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How this app keeps you DPDP-safe" subtitle="Five rules for every call." onClose={onClose}>
      <ul className="dpdp-list">
        {RULES.map(({ icon: Icon, tone, title, section, text, status, built }) => (
          <li key={title}>
            <span className={`dpdp-icon tone-${tone}`}><Icon size={18} /></span>
            <div className="dpdp-body">
              <div className="dpdp-head">
                <strong>{title}</strong>
                <span className="dpdp-sec">{section}</span>
              </div>
              <p>{text}</p>
              <p className={`dpdp-status ${built ? 'built' : 'todo'}`}>In this app: {status}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small consent-foot">
        Consent answers are saved in this browser only. They aren’t yet an audit trail your DPO can rely on.
      </p>
    </Modal>
  )
}
