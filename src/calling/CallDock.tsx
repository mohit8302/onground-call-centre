import { useState } from 'react'
import { Check, Copy, Mic, MicOff, Phone, PhoneIncoming, PhoneOff, RefreshCw, X } from 'lucide-react'
import { useCall } from './callContext'
import { formatClock, formatDuration } from '../lib/format'

const OUTCOMES = ['Interested', 'Quote sent', 'Call back later', 'Not interested']

const STATUS_TEXT: Record<string, string> = {
  connecting: 'Connecting to call server…',
  ready: 'Ready',
  offline: 'Offline',
  calling: 'Calling…',
  ringing: 'Incoming call',
  'in-call': 'In call',
}

/**
 * Floating browser-phone panel. All call logic lives in CallProvider; this
 * component only renders the current state and forwards button clicks.
 */
export default function CallDock() {
  const call = useCall()
  const [copied, setCopied] = useState(false)

  if (!call.dockOpen) return null

  async function copyId() {
    try {
      await navigator.clipboard.writeText(call.myId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (e.g. insecure context); the ID is still selectable.
    }
  }

  const busy = call.status === 'calling' || call.status === 'ringing' || call.status === 'in-call'
  const purposeLabel =
    call.target?.purpose === 'practice' ? 'Practice call' : call.target?.purpose === 'callback' ? 'Call back' : 'Call'

  return (
    <aside className="call-dock" aria-label="Browser phone" aria-live="polite">
      <header className="call-dock-head">
        <div>
          <div className="call-dock-title">Browser phone</div>
          <div className={`call-dock-status status-${call.status}`}>
            <span className="phone-dot" aria-hidden /> {STATUS_TEXT[call.status]}
          </div>
        </div>
        {!busy && (
          <button className="icon-btn ghost" onClick={call.closeDock} aria-label="Close phone">
            <X size={18} />
          </button>
        )}
      </header>

      <div className="call-dock-id">
        <span className="muted">Your ID</span>
        <code className="peer-id">{call.myId || '…'}</code>
        <button className="icon-btn" disabled={!call.myId} onClick={copyId} aria-label="Copy your call ID">
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      {call.wrapUp && !busy ? (
        <div className="call-dock-body">
          <div className="wrap-title">Call ended · {formatDuration(call.wrapUp.record.durationSec)}</div>
          <p className="muted small">How did the call with {call.wrapUp.record.name} go? This is saved to Recent.</p>
          <div className="chip-row">
            {OUTCOMES.map((o) => (
              <button key={o} className="chip" onClick={() => call.finishWrapUp(o)}>
                {o}
              </button>
            ))}
          </div>
          <button className="btn btn-text" onClick={() => call.finishWrapUp(null)}>
            Skip
          </button>
        </div>
      ) : (
        <div className="call-dock-body">
          {call.target && call.status !== 'ringing' && (
            <div className="call-target">
              {purposeLabel}: <strong>{call.target.label}</strong>
            </div>
          )}

          {call.status === 'offline' && (
            <button className="btn" onClick={call.reconnect}>
              <RefreshCw size={15} /> Reconnect
            </button>
          )}

          {call.status === 'ready' && (
            // Keyed by target so the input resets (and prefills) per call.
            <DialForm key={`${call.target?.label}-${call.target?.peerId}`} initialPeerId={call.target?.peerId ?? ''} />
          )}

          {call.status === 'ready' && (
            <p className="muted small">
              The customer side is another browser tab or device running this app. Share your ID with them, or paste
              theirs here.
            </p>
          )}

          {call.status === 'calling' && (
            <div className="call-live">
              <div className="pulse-ring"><Phone size={20} /></div>
              <div>Ringing <code>{call.remotePeerId}</code>…</div>
              <button className="btn btn-red" onClick={call.hangUp}>
                <PhoneOff size={15} /> Cancel
              </button>
            </div>
          )}

          {call.status === 'ringing' && (
            <div className="call-live">
              <div className="pulse-ring ringing"><PhoneIncoming size={20} /></div>
              <div>
                Incoming call from <code>{call.remotePeerId}</code>
              </div>
              <div className="btn-row">
                <button className="btn btn-green" onClick={call.acceptCall}>
                  <Phone size={15} /> Accept
                </button>
                <button className="btn btn-red" onClick={call.rejectCall}>
                  <PhoneOff size={15} /> Reject
                </button>
              </div>
            </div>
          )}

          {call.status === 'in-call' && (
            <div className="call-live">
              <div className="call-timer" aria-label="Call duration">{formatClock(call.elapsedSec)}</div>
              <div className="muted small">
                Connected to <code>{call.remotePeerId}</code>
                {call.isMuted && ' · you are muted'}
              </div>
              <div className="btn-row">
                <button className={`btn ${call.isMuted ? 'btn-amber' : ''}`} onClick={call.toggleMute} aria-pressed={call.isMuted}>
                  {call.isMuted ? <MicOff size={15} /> : <Mic size={15} />} {call.isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className="btn btn-red" onClick={call.hangUp}>
                  <PhoneOff size={15} /> Hang up
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {call.error && (
        <div className="call-error" role="alert">
          <span>{call.error}</span>
          <button className="icon-btn ghost" onClick={call.clearError} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}
    </aside>
  )
}

function DialForm({ initialPeerId }: { initialPeerId: string }) {
  const { startCall } = useCall()
  const [peerInput, setPeerInput] = useState(initialPeerId)

  return (
    <form
      className="dial-form"
      onSubmit={(e) => {
        e.preventDefault()
        startCall(peerInput)
      }}
    >
      <label className="sr-only" htmlFor="peer-input">
        Other person’s call ID
      </label>
      <input
        id="peer-input"
        value={peerInput}
        onChange={(e) => setPeerInput(e.target.value)}
        placeholder="Paste the other person’s ID"
        autoComplete="off"
        spellCheck={false}
      />
      <button className="btn btn-green" type="submit" disabled={!peerInput.trim()}>
        <Phone size={15} /> Call
      </button>
    </form>
  )
}
