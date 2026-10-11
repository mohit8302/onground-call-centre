import { useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'
import { Copy, Mic, MicOff, Phone, PhoneIncoming, PhoneOff } from 'lucide-react'

type CallStatus = 'connecting' | 'ready' | 'calling' | 'ringing' | 'in-call'

// Short, readable ID so it can be read out loud during a demo.
function makePeerId() {
  return 'onground-' + Math.random().toString(36).slice(2, 8)
}

export default function CallPanel() {
  // --- UI state (changing these re-renders the component) ---
  const [myId, setMyId] = useState('')
  const [remoteId, setRemoteId] = useState('')
  const [status, setStatus] = useState<CallStatus>('connecting')
  const [incomingFrom, setIncomingFrom] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState('')

  // --- Long-lived objects (refs: mutable, no re-render, never stale in listeners) ---
  const peerRef = useRef<Peer | null>(null)
  const callRef = useRef<MediaConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  // Reset everything related to the current call (does not touch the Peer).
  function cleanupCall() {
    callRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    setIncomingFrom('')
    setIsMuted(false)
    setStatus('ready')
  }

  // Listen to a call's lifecycle. Used for both outgoing and incoming calls.
  function attachCallEvents(call: MediaConnection) {
    call.on('stream', (remoteStream) => {
      const audio = remoteAudioRef.current
      if (!audio) return
      audio.srcObject = remoteStream
      audio.play().catch((err) => setError('Could not play remote audio: ' + err.message))
      setStatus('in-call')
    })
    call.on('close', () => {
      // Ignore close events from an older call.
      if (callRef.current === call) cleanupCall()
    })
    call.on('error', (err) => {
      setError('Call error: ' + err.message)
      if (callRef.current === call) cleanupCall()
    })
  }

  async function getMicrophone() {
    if (!navigator.mediaDevices) {
      throw new Error('Microphone API unavailable. Open the app on localhost or HTTPS.')
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    localStreamRef.current = stream
    return stream
  }

  // Create the Peer once when the component mounts; destroy it on unmount.
  useEffect(() => {
    const peer = new Peer(makePeerId())
    peerRef.current = peer

    peer.on('open', (id) => {
      setMyId(id)
      setStatus('ready')
    })

    peer.on('call', (call) => {
      // Already busy? Reject the new caller.
      if (callRef.current) {
        call.close()
        return
      }
      callRef.current = call
      attachCallEvents(call)
      setIncomingFrom(call.peer)
      setStatus('ringing')
    })

    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        setError('That ID is not online. Check the ID and try again.')
        cleanupCall()
      } else {
        setError(`${err.type}: ${err.message}`)
      }
    })

    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      peer.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startCall() {
    const peer = peerRef.current
    const target = remoteId.trim()
    if (!peer || !target) return
    setError('')
    setStatus('calling')
    try {
      const stream = await getMicrophone()
      const call = peer.call(target, stream)
      callRef.current = call
      attachCallEvents(call)
    } catch (err) {
      setError((err as Error).message)
      cleanupCall()
    }
  }

  async function acceptCall() {
    const call = callRef.current
    if (!call) return
    setError('')
    try {
      const stream = await getMicrophone()
      call.answer(stream) // 'stream' event will fire and set status to in-call
    } catch (err) {
      setError((err as Error).message)
      call.close()
      cleanupCall()
    }
  }

  // Used for Hang up, Cancel and Reject.
  function endCall() {
    callRef.current?.close()
    cleanupCall()
  }

  function toggleMute() {
    const stream = localStreamRef.current
    if (!stream) return
    const nextMuted = !isMuted
    stream.getAudioTracks().forEach((track) => (track.enabled = !nextMuted))
    setIsMuted(nextMuted)
  }

  return (
    <div className="call-panel">
      <h2>Browser Call (WebRTC)</h2>

      <div className="call-row">
        <span className="label">Your ID</span>
        <code>{myId || 'connecting…'}</code>
        <button
          className="icon-btn"
          disabled={!myId}
          onClick={() => navigator.clipboard.writeText(myId)}
          title="Copy ID"
        >
          <Copy size={16} />
        </button>
      </div>

      <p className={`status status-${status}`}>Status: {status}</p>

      {status === 'ready' && (
        <div className="call-row">
          <input
            value={remoteId}
            onChange={(e) => setRemoteId(e.target.value)}
            placeholder="Paste the other person's ID"
          />
          <button className="btn btn-green" onClick={startCall} disabled={!remoteId.trim()}>
            <Phone size={16} /> Call
          </button>
        </div>
      )}

      {status === 'calling' && (
        <div className="call-row">
          <span>Calling {remoteId}…</span>
          <button className="btn btn-red" onClick={endCall}>
            <PhoneOff size={16} /> Cancel
          </button>
        </div>
      )}

      {status === 'ringing' && (
        <div className="call-row">
          <PhoneIncoming size={18} />
          <span>Incoming call from {incomingFrom}</span>
          <button className="btn btn-green" onClick={acceptCall}>
            <Phone size={16} /> Accept
          </button>
          <button className="btn btn-red" onClick={endCall}>
            <PhoneOff size={16} /> Reject
          </button>
        </div>
      )}

      {status === 'in-call' && (
        <div className="call-row">
          <span>In call</span>
          <button className="btn" onClick={toggleMute}>
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />} {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button className="btn btn-red" onClick={endCall}>
            <PhoneOff size={16} /> Hang up
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* Plays the other person's voice. Hidden; no controls needed. */}
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  )
}
