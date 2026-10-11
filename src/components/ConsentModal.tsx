import { useState } from 'react'
import { Check, Mic, Phone, PhoneForwarded, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { LEADS } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { useCall } from '../calling/callContext'
import type { CallTarget } from '../calling/callContext'
import { formatWhen } from '../lib/format'
import { Modal } from './ui'

// The script the agent reads right after hello. Translations were written for
// this demo and should be reviewed by native speakers before real use.
const SCRIPTS = [
  {
    id: 'kn',
    label: 'ಕನ್ನಡ',
    text: 'ನಾವು ಈ ಕರೆಯನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಬಹುದೇ? ಇದು ನಿಮ್ಮ ಸೇವೆ ಮತ್ತು ಫಾಲೋ-ಅಪ್‌ಗಾಗಿ ಮಾತ್ರ. ನೀವು ಬೇಡ ಎನ್ನಬಹುದು, ಅಥವಾ ಯಾವಾಗ ಬೇಕಾದರೂ ಅದನ್ನು ಅಳಿಸಲು ಕೇಳಬಹುದು.',
  },
  {
    id: 'hi',
    label: 'हिन्दी',
    text: 'क्या हम यह कॉल रिकॉर्ड कर सकते हैं? यह सिर्फ़ आपकी सेवा और फ़ॉलो-अप के लिए है। आप मना कर सकते हैं, या कभी भी इसे डिलीट करने के लिए कह सकते हैं।',
  },
  {
    id: 'en',
    label: 'English',
    text: 'Can we record this? Only for your service and follow-up. You can say no, or ask us to delete it any time.',
  },
]

function makeConsentId() {
  return 'CNS-' + Date.now().toString(36).slice(-6).toUpperCase()
}

interface Props {
  /** Which kind of call the consent is for, shown under the title. */
  channel: 'Call centre' | 'Phone call' | 'AI call'
  onClose: () => void
  /** Moves on to the call itself (the consent step comes first), with whoever was picked here. */
  onContinue: (target?: CallTarget) => void
  continueLabel: string
}

/**
 * Recording consent. The app does not record calls yet; this captures and
 * logs the customer's answer (with a Consent ID) so recording can be switched
 * on later without changing the agent's workflow.
 */
export default function ConsentModal({ channel, onClose, onContinue, continueLabel }: Props) {
  const { consents, addConsent } = useAppState()
  const call = useCall()

  // Who we're asking: the current call's lead if there is one, else a pick.
  const liveTarget = call.target && !call.target.leadId ? call.target : null
  const [leadId, setLeadId] = useState(call.target?.leadId ?? (liveTarget ? '' : LEADS[0].id))
  const lead = LEADS.find((l) => l.id === leadId)
  const subjectName = lead?.name ?? liveTarget?.label ?? 'Unknown caller'

  const [language, setLanguage] = useState('en')
  const [method, setMethod] = useState<'whatsapp' | 'verbal'>('whatsapp')
  const [guardian, setGuardian] = useState(false)
  const [number, setNumber] = useState('')
  const [saved, setSaved] = useState<{ id: string; result: 'yes' | 'no' } | null>(null)

  const script = SCRIPTS.find((s) => s.id === language) ?? SCRIPTS[2]
  const previous = consents.find((c) => (lead ? c.leadId === lead.id : c.name === subjectName))

  function record(result: 'yes' | 'no') {
    const id = makeConsentId()
    addConsent({
      id,
      name: subjectName,
      leadId: lead?.id,
      peerId: liveTarget ? call.remotePeerId || undefined : undefined,
      method: 'verbal',
      result,
      language: script.label,
      guardian,
      at: new Date().toISOString(),
    })
    setSaved({ id, result })
  }

  return (
    <Modal
      title={
        <span className="consent-title">
          <span className="consent-icon"><ShieldCheck size={18} /></span>
          Ask before you record
        </span>
      }
      subtitle={`${channel} · ${subjectName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-green"
            onClick={() =>
              onContinue(lead ? { label: lead.name, leadId: lead.id, purpose: call.target?.purpose ?? 'lead' } : call.target ?? undefined)
            }
          >
            {channel === 'Phone call' ? <PhoneForwarded size={15} /> : channel === 'AI call' ? <Sparkles size={15} /> : <Phone size={15} />} {continueLabel}
          </button>
        </>
      }
    >
      {!call.target?.leadId && (
        <label className="consent-subject">
          <span className="detail-label">Asking</span>
          <select value={leadId} onChange={(e) => { setLeadId(e.target.value); setSaved(null) }}>
            {liveTarget && <option value="">{liveTarget.label}</option>}
            {LEADS.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
      )}

      {previous && !saved && (
        <p className="notice small">
          Last answer from {subjectName}: <strong>{previous.result === 'yes' ? 'Yes' : 'No'}</strong> ({previous.id},{' '}
          {formatWhen(previous.at)})
        </p>
      )}

      <section className="consent-step">
        <h3><span className="step-num">1</span> Say this · right after hello</h3>
        <div className="consent-script">
          <div className="chip-row" role="group" aria-label="Script language">
            {SCRIPTS.map((s) => (
              <button
                key={s.id}
                className={`chip ${s.id === language ? 'active dark' : ''}`}
                onClick={() => setLanguage(s.id)}
                aria-pressed={s.id === language}
                lang={s.id}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p lang={script.id}>{script.text}</p>
        </div>
      </section>

      <section className="consent-step">
        <h3><span className="step-num">2</span> Get their yes</h3>
        <div className="segmented" role="tablist" aria-label="How they answer">
          <button role="tab" aria-selected={method === 'whatsapp'} className={method === 'whatsapp' ? 'active' : ''} onClick={() => setMethod('whatsapp')}>
            <Send size={14} /> On WhatsApp
          </button>
          <button role="tab" aria-selected={method === 'verbal'} className={method === 'verbal' ? 'active' : ''} onClick={() => setMethod('verbal')}>
            <Mic size={14} /> Said out loud
          </button>
        </div>

        {saved ? (
          <div className={`consent-saved ${saved.result}`} role="status">
            <Check size={16} />
            {saved.result === 'yes' ? 'Consent logged' : 'No logged, carry on without recording'} · <strong>{saved.id}</strong>
          </div>
        ) : method === 'whatsapp' ? (
          <>
            <form className="consent-wa" onSubmit={(e) => e.preventDefault()}>
              <span className="cc">+91</span>
              <input
                inputMode="numeric"
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/[^\d ]/g, ''))}
                placeholder={guardian ? "Parent's number" : lead ? lead.phone.replace('+91 ', '') : 'Mobile number'}
                aria-label={guardian ? "Parent's WhatsApp number" : 'Customer WhatsApp number'}
              />
              <button
                className="btn btn-green"
                type="submit"
                disabled
                title="WhatsApp Business isn't connected in this demo"
              >
                <Send size={15} /> Send
              </button>
            </form>
            <p className="muted small">
              WhatsApp Business isn’t connected in this demo, so nothing is sent. Use <strong>Said out loud</strong> to log
              their answer.
            </p>
          </>
        ) : (
          <div className="btn-row">
            <button className="btn btn-green" onClick={() => record('yes')}>
              <Check size={15} /> They said yes
            </button>
            <button className="btn" onClick={() => record('no')}>
              <X size={15} /> They said no
            </button>
          </div>
        )}

        <label className="toggle-row">
          <span>
            <strong>Under 18?</strong>
            <span className="muted small">
              {method === 'whatsapp' ? "Send it to a parent's number instead." : 'A parent or guardian must answer.'}
            </span>
          </span>
          <input type="checkbox" role="switch" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} />
        </label>
      </section>

      <p className="muted small consent-foot">
        A yes gives a Consent ID tied to this call. A no is logged too, and you carry on without recording. This demo
        doesn’t record calls; it only keeps the answer, in this browser.
      </p>
    </Modal>
  )
}
