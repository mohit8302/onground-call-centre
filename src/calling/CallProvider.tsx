import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'
import type { CallRecord } from '../types'
import { makeId } from '../lib/format'
import { CallContext } from './callContext'
import type { CallApi, CallStatus, CallTarget, PendingWrapUp } from './callContext'

// How long an outgoing call may ring before we give up.
const RING_TIMEOUT_MS = 30_000
// How long a dropped connection may try to recover before the call ends.
const DISCONNECT_GRACE_MS = 5_000

// Short, readable ID so it can be read out loud during a demo.
function makePeerId() {
  return 'onground-' + Math.random().toString(36).slice(2, 8)
}

/** Turns getUserMedia failures into something an agent can act on. */
function micErrorMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Microphone permission was denied. Allow mic access in the browser address bar and try again.'
  if (name === 'NotFoundError') return 'No microphone was found. Plug one in and try again.'
  if (name === 'NotReadableError') return 'Your microphone is being used by another app. Close it and try again.'
  return err instanceof Error ? err.message : 'Could not start the microphone.'
}

type EndReason = 'hangup' | 'remote-ended' | 'rejected' | 'no-answer' | 'failed' | 'remote-declined' | 'remote-cancelled'

/** Messages sent over a PeerJS data connection to signal call control. */
interface ControlMessage {
  type: 'reject' | 'cancel' | 'busy'
}

// Outcome text for calls that never connected, by reason and direction.
const OUTCOME_BY_REASON: Record<EndReason, Record<'incoming' | 'outgoing', string>> = {
  hangup: { incoming: 'Not connected', outgoing: 'Not connected' },
  'remote-ended': { incoming: 'Caller hung up', outgoing: 'Not connected' },
  rejected: { incoming: 'Declined', outgoing: 'Cancelled' },
  'no-answer': { incoming: 'Not answered', outgoing: 'No answer' },
  failed: { incoming: 'Not connected', outgoing: 'Not connected' },
  'remote-declined': { incoming: 'Declined', outgoing: 'Declined by recipient' },
  'remote-cancelled': { incoming: 'Caller hung up', outgoing: 'Cancelled' },
}

// Everything about the call in progress that listeners need to read without
// going stale. Kept in a ref: changing it must not re-render.
interface Session {
  call: MediaConnection
  direction: 'incoming' | 'outgoing'
  peerId: string
  target: CallTarget | null
  startedAt: number
  connectedAt: number | null
}

interface Props {
  children: ReactNode
  /** Called once per finished call with a record ready for "Recent". */
  onCallLogged: (record: CallRecord) => void
}

export default function CallProvider({ children, onCallLogged }: Props) {
  // --- UI state ---
  const [myId, setMyId] = useState('')
  const [status, setStatus] = useState<CallStatus>('connecting')
  const [error, setError] = useState('')
  const [remotePeerId, setRemotePeerId] = useState('')
  const [target, setTarget] = useState<CallTarget | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [dockOpen, setDockOpen] = useState(false)
  const [wrapUp, setWrapUp] = useState<PendingWrapUp | null>(null)

  // --- Long-lived objects (refs: mutable, no re-render, never stale in listeners) ---
  const peerRef = useRef<Peer | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const ringTimerRef = useRef<number | null>(null)
  const targetRef = useRef<CallTarget | null>(null)
  const onLoggedRef = useRef(onCallLogged)

  useEffect(() => {
    onLoggedRef.current = onCallLogged
  }, [onCallLogged])

  // Keep the ref in sync so PeerJS listeners see the latest dialer target.
  const setDialTarget = useCallback((t: CallTarget | null) => {
    targetRef.current = t
    setTarget(t)
  }, [])

  // Live timer: ticks only while audio is flowing.
  useEffect(() => {
    if (status !== 'in-call') return
    const id = window.setInterval(() => {
      const connectedAt = sessionRef.current?.connectedAt
      if (connectedAt) setElapsedSec(Math.floor((Date.now() - connectedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [status])

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current !== null) {
      window.clearTimeout(ringTimerRef.current)
      ringTimerRef.current = null
    }
  }, [])

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
  }, [])

  /**
   * PeerJS gives no signal when an unanswered call is rejected or cancelled,
   * so we send a one-off message over a short-lived data connection.
   */
  const sendControl = useCallback((peerId: string, type: ControlMessage['type']) => {
    const peer = peerRef.current
    if (!peer || peer.disconnected) return
    const conn = peer.connect(peerId, { reliable: true })
    conn.on('open', () => {
      conn.send({ type } satisfies ControlMessage)
      window.setTimeout(() => conn.close(), 1000)
    })
    conn.on('error', () => conn.close()) // best effort; ring timeouts are the fallback
  }, [])

  /**
   * Ends the current session exactly once: stops the mic, detaches remote
   * audio, logs the call and resets the UI. Safe to call from any listener.
   */
  const finishSession = useCallback(
    (reason: EndReason) => {
      const session = sessionRef.current
      if (!session) return
      sessionRef.current = null
      clearRingTimer()
      stopLocalTracks()
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
      session.call.close()

      const durationSec = session.connectedAt ? Math.round((Date.now() - session.connectedAt) / 1000) : 0
      const connected = session.connectedAt !== null
      // Tell the other side we gave up before the call connected.
      if (!connected && (reason === 'rejected' || reason === 'no-answer')) {
        sendControl(session.peerId, session.direction === 'incoming' ? 'reject' : 'cancel')
      }
      const record: CallRecord = {
        id: makeId('live'),
        name: session.target?.label || session.peerId,
        leadId: session.target?.leadId,
        direction: connected ? session.direction : session.direction === 'incoming' ? 'missed' : 'outgoing',
        startedAt: new Date(session.startedAt).toISOString(),
        durationSec,
        outcome: connected ? 'Connected' : OUTCOME_BY_REASON[reason][session.direction],
        source: 'live',
        peerId: session.peerId,
        summary: session.target?.purpose === 'practice' ? 'Practice call with a teammate.' : undefined,
      }

      if (connected) {
        // Let the agent tag the outcome before it lands in Recent.
        setWrapUp({ record })
        setDockOpen(true)
      } else {
        onLoggedRef.current(record)
      }

      setIsMuted(false)
      setElapsedSec(0)
      setRemotePeerId('')
      setStatus(peerRef.current && !peerRef.current.disconnected ? 'ready' : 'offline')
    },
    [clearRingTimer, stopLocalTracks, sendControl],
  )

  // Listen to a call's lifecycle. Used for both outgoing and incoming calls.
  const attachCallEvents = useCallback(
    (call: MediaConnection) => {
      call.on('stream', (remoteStream) => {
        const session = sessionRef.current
        if (!session || session.call !== call) return
        clearRingTimer()
        if (session.connectedAt === null) session.connectedAt = Date.now()
        const audio = remoteAudioRef.current
        if (audio) {
          audio.srcObject = remoteStream
          audio.play().catch((err: Error) => setError('Could not play remote audio: ' + err.message))
        }
        setElapsedSec(0)
        setStatus('in-call')

        // 'close' is not always delivered when the other tab disappears, so
        // also watch the underlying RTCPeerConnection.
        // 'disconnected' can recover, so give it a short grace period.
        const pc = call.peerConnection
        let graceTimer: number | undefined
        pc?.addEventListener('connectionstatechange', () => {
          if (sessionRef.current?.call !== call) return
          window.clearTimeout(graceTimer)
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            setError(pc.connectionState === 'failed' ? 'The connection dropped.' : '')
            finishSession('remote-ended')
          } else if (pc.connectionState === 'disconnected') {
            graceTimer = window.setTimeout(() => {
              if (sessionRef.current?.call !== call || pc.connectionState === 'connected') return
              setError('The connection was lost.')
              finishSession('remote-ended')
            }, DISCONNECT_GRACE_MS)
          }
        })
      })
      call.on('close', () => {
        // Ignore close events from an older call.
        if (sessionRef.current?.call === call) finishSession('remote-ended')
      })
      call.on('error', (err) => {
        if (sessionRef.current?.call !== call) return
        setError('Call error: ' + err.message)
        finishSession('failed')
      })
    },
    [clearRingTimer, finishSession],
  )

  async function getMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone API unavailable. Open the app on localhost or over HTTPS.')
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      return stream
    } catch (err) {
      throw new Error(micErrorMessage(err), { cause: err })
    }
  }

  // Create the Peer once when the provider mounts; destroy it on unmount.
  const createPeer = useCallback(() => {
    const peer = new Peer(makePeerId())
    peerRef.current = peer

    peer.on('open', (id) => {
      setMyId(id)
      setError('')
      if (!sessionRef.current) setStatus('ready')
    })

    peer.on('call', (call) => {
      // Already busy? Reject the new caller; it shows up as missed.
      if (sessionRef.current) {
        call.close()
        sendControl(call.peer, 'busy')
        onLoggedRef.current({
          id: makeId('live'),
          name: call.peer,
          direction: 'missed',
          startedAt: new Date().toISOString(),
          durationSec: 0,
          outcome: 'Busy on another call',
          source: 'live',
          peerId: call.peer,
        })
        return
      }
      sessionRef.current = {
        call,
        direction: 'incoming',
        peerId: call.peer,
        target: { label: call.peer, purpose: 'manual' },
        startedAt: Date.now(),
        connectedAt: null,
      }
      attachCallEvents(call)
      // PeerJS does not tell us if the caller gives up before we answer, so
      // stop ringing ourselves and log it as missed.
      ringTimerRef.current = window.setTimeout(() => finishSession('no-answer'), RING_TIMEOUT_MS + 5_000)
      setRemotePeerId(call.peer)
      setTarget(sessionRef.current.target)
      setDockOpen(true)
      setStatus('ringing')
    })

    // Control messages from the other side about a call that has not connected.
    peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        const session = sessionRef.current
        const msg = data as Partial<ControlMessage>
        if (!session || session.peerId !== conn.peer || session.connectedAt !== null) return
        if ((msg.type === 'reject' || msg.type === 'busy') && session.direction === 'outgoing') {
          setError(msg.type === 'busy' ? 'The other person is on another call.' : 'The other person declined the call.')
          finishSession('remote-declined')
        } else if (msg.type === 'cancel' && session.direction === 'incoming') {
          finishSession('remote-cancelled')
        }
      })
    })

    peer.on('disconnected', () => {
      // Lost the signalling server. An active call can keep going (audio is
      // peer-to-peer) but no new calls can be placed until we reconnect.
      if (!sessionRef.current) setStatus('offline')
    })

    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        setError('That ID is not online. Check the ID and that the other tab is still open.')
        finishSession('failed')
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        setError('Cannot reach the PeerJS signalling server. Check your internet connection and retry.')
        if (!sessionRef.current) setStatus('offline')
      } else if (err.type === 'browser-incompatible') {
        setError('This browser does not support WebRTC calling.')
        setStatus('offline')
      } else {
        setError(`${err.type}: ${err.message}`)
      }
    })

    return peer
  }, [attachCallEvents, finishSession, sendControl])

  useEffect(() => {
    const peer = createPeer()
    // Closing the tab mid-call: hang up properly so the other side finds out now.
    const onPageHide = () => {
      sessionRef.current?.call.close()
      peerRef.current?.destroy()
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      sessionRef.current?.call.close()
      sessionRef.current = null
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      peer.destroy()
    }
  }, [createPeer])

  const startCall = useCallback(
    async (rawPeerId: string) => {
      const peer = peerRef.current
      const peerId = rawPeerId.trim()
      if (!peer || !peerId || sessionRef.current) return
      if (peerId === peer.id) {
        setError('That is your own ID. Open the app in a second tab or device and call that ID.')
        return
      }
      setError('')
      setStatus('calling')
      setRemotePeerId(peerId)
      try {
        const stream = await getMicrophone()
        const call = peer.call(peerId, stream)
        if (!call) throw new Error('Could not place the call. Is the signalling connection open?')
        sessionRef.current = {
          call,
          direction: 'outgoing',
          peerId,
          target: targetRef.current,
          startedAt: Date.now(),
          connectedAt: null,
        }
        attachCallEvents(call)
        ringTimerRef.current = window.setTimeout(() => {
          setError('No answer after 30 seconds.')
          finishSession('no-answer')
        }, RING_TIMEOUT_MS)
      } catch (err) {
        stopLocalTracks()
        setError((err as Error).message)
        setRemotePeerId('')
        setStatus('ready')
      }
    },
    [attachCallEvents, finishSession, stopLocalTracks],
  )

  const acceptCall = useCallback(async () => {
    const session = sessionRef.current
    if (!session || session.direction !== 'incoming') return
    clearRingTimer() // the mic permission prompt may take a while
    setError('')
    try {
      const stream = await getMicrophone()
      session.call.answer(stream) // 'stream' will fire and move us to in-call
    } catch (err) {
      setError((err as Error).message)
      finishSession('failed')
    }
  }, [clearRingTimer, finishSession])

  const rejectCall = useCallback(() => finishSession('rejected'), [finishSession])

  const hangUp = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    finishSession(session.connectedAt ? 'hangup' : 'rejected')
  }, [finishSession])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const nextMuted = !isMuted
    stream.getAudioTracks().forEach((track) => (track.enabled = !nextMuted))
    setIsMuted(nextMuted)
  }, [isMuted])

  const reconnect = useCallback(() => {
    const peer = peerRef.current
    setError('')
    if (peer && !peer.destroyed && peer.disconnected) {
      setStatus('connecting')
      peer.reconnect()
    } else {
      setStatus('connecting')
      peer?.destroy()
      createPeer()
    }
  }, [createPeer])

  const finishWrapUp = useCallback(
    (outcome: string | null) => {
      if (wrapUp) onLoggedRef.current({ ...wrapUp.record, outcome: outcome ?? wrapUp.record.outcome })
      setWrapUp(null)
      setDialTarget(null)
    },
    [wrapUp, setDialTarget],
  )

  const openDialer = useCallback(
    (t?: CallTarget) => {
      if (!sessionRef.current) setDialTarget(t ?? null)
      setDockOpen(true)
    },
    [setDialTarget],
  )

  const closeDock = useCallback(() => {
    // The dock can't be dismissed mid-call; the call UI must stay reachable.
    if (sessionRef.current) return
    setDockOpen(false)
    setError('')
  }, [])

  const api = useMemo<CallApi>(
    () => ({
      myId,
      status,
      error,
      remotePeerId,
      target,
      isMuted,
      elapsedSec,
      dockOpen,
      wrapUp,
      openDialer,
      closeDock,
      startCall,
      acceptCall,
      rejectCall,
      hangUp,
      toggleMute,
      reconnect,
      clearError: () => setError(''),
      finishWrapUp,
    }),
    [myId, status, error, remotePeerId, target, isMuted, elapsedSec, dockOpen, wrapUp, openDialer, closeDock,
      startCall, acceptCall, rejectCall, hangUp, toggleMute, reconnect, finishWrapUp],
  )

  return (
    <CallContext.Provider value={api}>
      {children}
      {/* Plays the other person's voice. Always mounted so it survives navigation. */}
      <audio ref={remoteAudioRef} autoPlay />
    </CallContext.Provider>
  )
}
