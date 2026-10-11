import { useState } from 'react'
import { Phone, PhoneForwarded, Shield } from 'lucide-react'
import { useCall } from './callContext'
import { formatClock } from '../lib/format'
import ConsentModal from '../components/ConsentModal'
import DpdpModal from '../components/DpdpModal'
import PhoneCallModal from '../components/PhoneCallModal'

type Dialog = 'none' | 'consent-in-app' | 'consent-phone' | 'phone' | 'dpdp'

/**
 * Compact bottom-centre pill that is always on screen. It only opens things:
 * the consent step, then the existing CallDock (via openDialer) or the
 * phone-call notice; and the DPDP explainer. All call logic stays in CallProvider.
 */
export default function CallLauncher() {
  const call = useCall()
  const [dialog, setDialog] = useState<Dialog>('none')
  const close = () => setDialog('none')

  // Mid-call (or with an outcome still to pick) go straight to the call controls.
  const callActive = call.status === 'calling' || call.status === 'ringing' || call.status === 'in-call' || !!call.wrapUp

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
          onClick={() => (callActive ? call.openDialer() : setDialog('consent-in-app'))}
          title={inAppTitle}
        >
          <Phone size={15} />
          <span className="launcher-label">{inAppLabel}</span>
          {(call.status === 'offline' || call.status === 'connecting') && <span className="phone-dot" aria-hidden />}
        </button>
        <button className="launcher-btn" onClick={() => setDialog('consent-phone')} title="Call a phone number">
          <PhoneForwarded size={15} />
          <span className="launcher-label">Phone call</span>
        </button>
        <button
          className="launcher-shield"
          onClick={() => setDialog('dpdp')}
          aria-label="How this app keeps you DPDP-safe"
          title="How this app keeps you DPDP-safe"
        >
          <Shield size={16} />
        </button>
      </nav>

      {dialog === 'consent-in-app' && (
        <ConsentModal
          channel="Call centre"
          continueLabel="Open in-app call"
          onClose={close}
          onContinue={(target) => {
            close()
            call.openDialer(target)
          }}
        />
      )}
      {dialog === 'consent-phone' && (
        <ConsentModal
          channel="Phone call"
          continueLabel="Dial phone number"
          onClose={close}
          onContinue={() => setDialog('phone')}
        />
      )}
      {dialog === 'phone' && <PhoneCallModal onClose={close} />}
      {dialog === 'dpdp' && <DpdpModal onClose={close} />}
    </>
  )
}
