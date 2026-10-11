import { useState } from 'react'
import { Phone, PhoneForwarded, Shield, ShieldCheck } from 'lucide-react'
import { useCall } from './callContext'
import { useAppState } from '../state/appContext'
import { formatClock } from '../lib/format'
import ConsentModal from '../components/ConsentModal'
import PhoneCallModal from '../components/PhoneCallModal'

/**
 * Compact bottom-centre pill that is always on screen. It only opens things:
 * the existing CallDock (via openDialer), the phone-call notice and the
 * recording-consent dialog. All call logic stays in CallProvider.
 */
export default function CallLauncher() {
  const call = useCall()
  const { consents } = useAppState()
  const [dialog, setDialog] = useState<'none' | 'consent' | 'phone'>('none')

  // Green shield only when a "yes" is on record for the person in the current call.
  const target = call.target
  const consent = target
    ? consents.find((c) => (target.leadId ? c.leadId === target.leadId : c.name === target.label))
    : undefined
  const consented = consent?.result === 'yes'
  const shieldLabel = !target
    ? 'Recording consent: no call selected'
    : consent
      ? `Recording consent for ${target.label}: ${consent.result === 'yes' ? 'yes' : 'no'} (${consent.id})`
      : `Recording consent for ${target.label}: not asked yet`

  const inAppLabel =
    call.status === 'in-call'
      ? formatClock(call.elapsedSec)
      : call.status === 'ringing'
        ? 'Incoming…'
        : call.status === 'calling'
          ? 'Calling…'
          : 'In-app call'
  const inAppTitle =
    call.status === 'offline'
      ? 'Call server offline. Open to reconnect.'
      : call.status === 'connecting'
        ? 'Connecting to the call server…'
        : 'Browser-to-browser audio call'

  return (
    <>
      <nav className="call-launcher" aria-label="Calling">
        <span className="demo-badge" title="Running on local demo data. Nothing is sent to a server.">
          DEMO
        </span>
        <button
          className={`launcher-btn status-${call.status}`}
          onClick={() => call.openDialer()}
          aria-expanded={call.dockOpen}
          title={inAppTitle}
        >
          <Phone size={15} />
          <span className="launcher-label">{inAppLabel}</span>
          {(call.status === 'offline' || call.status === 'connecting') && <span className="phone-dot" aria-hidden />}
        </button>
        <button className="launcher-btn" onClick={() => setDialog('phone')} title="Call a phone number">
          <PhoneForwarded size={15} />
          <span className="launcher-label">Phone call</span>
        </button>
        <button
          className={`launcher-shield ${consented ? 'ok' : ''}`}
          onClick={() => setDialog('consent')}
          aria-label={shieldLabel}
          title={shieldLabel}
        >
          {consented ? <ShieldCheck size={16} /> : <Shield size={16} />}
        </button>
      </nav>

      {dialog === 'consent' && <ConsentModal channel="Call centre" onClose={() => setDialog('none')} />}
      {dialog === 'phone' && <PhoneCallModal onClose={() => setDialog('none')} />}
    </>
  )
}
