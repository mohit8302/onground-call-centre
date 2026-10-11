import { useEffect, useRef, useState } from 'react'
import { Bot, Mic, MicOff, PhoneOff, Send, SkipForward, Sparkles } from 'lucide-react'
import { LEADS } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { canListen, listenOnce, speak } from '../calling/aiVoice'
import type { VoiceLanguage } from '../calling/aiVoice'
import { formatClock, makeId } from '../lib/format'
import { Modal } from './ui'

/** Who the AI plays: the calling agent (you are the customer), or the customer (you practise as the agent). */
export type AiRole = 'agent' | 'customer'

interface Turn {
  speaker: 'ai' | 'human'
  text: string
}

type Phase = 'setup' | 'thinking' | 'speaking' | 'listening' | 'failed' | 'ending' | 'ended'

const PHASE_LABEL: Record<Phase, string> = {
  setup: '',
  thinking: 'AI is thinking…',
  speaking: 'AI is speaking',
  listening: 'Listening — speak now',
  failed: 'Something went wrong',
  ending: 'Ending call…',
  ended: 'Call ended',
}

const LANGUAGES: { id: VoiceLanguage; label: string }[] = [
  { id: 'en-IN', label: 'English' },
  { id: 'hi-IN', label: 'हिन्दी' },
]

// Errors after which the browser's speech recognition won't work this call.
const FATAL_SPEECH_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in the address bar, or type your replies below.',
  'service-not-allowed': 'This browser’s speech service isn’t available. Type your replies below.',
  'audio-capture': 'No microphone was found. Type your replies below.',
  network: 'Speech recognition needs an internet connection. Type your replies below.',
  unsupported: 'This browser can’t transcribe speech (use Chrome or Edge). Type your replies below.',
}

async function postAiCall<T>(body: object, signal: AbortSignal): Promise<T> {
  const res = await fetch('/api/ai-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `The AI call failed (HTTP ${res.status}).`)
  return data as T
}

interface Props {
  leadId?: string
  initialRole: AiRole
  onClose: () => void
}

/**
 * A real voice conversation with an AI model (Gemini). Speech is transcribed in the browser,
 * /api/ai-call turns the transcript into the next line, and the browser speaks
 * it. Turn-taking is half-duplex: the mic is off while the AI talks, so it never
 * hears itself through the speakers.
 */
export default function AiCallModal({ leadId, initialRole, onClose }: Props) {
  const { addCall } = useAppState()
  const [selectedLeadId, setSelectedLeadId] = useState(leadId ?? LEADS[0].id)
  const lead = LEADS.find((l) => l.id === selectedLeadId) ?? LEADS[0]
  const [role, setRole] = useState<AiRole>(initialRole)
  const [language, setLanguage] = useState<VoiceLanguage>('en-IN')

  const [phase, setPhaseState] = useState<Phase>('setup')
  const [turns, setTurns] = useState<Turn[]>([])
  const [interim, setInterim] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [muted, setMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<{ summary: string; outcome: string } | null>(null)

  // Speech and network callbacks outlive renders, so they read these refs.
  const phaseRef = useRef<Phase>('setup')
  const turnsRef = useRef<Turn[]>([])
  const mutedRef = useRef(false)
  const voiceBrokenRef = useRef(false)
  const endedRef = useRef(false)
  const startedAtRef = useRef(0)
  const stopListenRef = useRef<() => void>(() => {})
  const cancelSpeakRef = useRef<() => void>(() => {})
  const abortRef = useRef<AbortController | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }
  const addTurn = (turn: Turn) => {
    turnsRef.current = [...turnsRef.current, turn]
    setTurns(turnsRef.current)
  }
  const request = (action: 'reply' | 'summary') => {
    abortRef.current = new AbortController()
    return {
      body: {
        action,
        role,
        language,
        lead: { name: lead.name, product: lead.product, price: lead.price, crossSell: lead.crossSell, emi: lead.emi, story: lead.story },
        turns: turnsRef.current,
      },
      signal: abortRef.current.signal,
    }
  }

  const live = phase === 'thinking' || phase === 'speaking' || phase === 'listening' || phase === 'failed'

  // Call timer.
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 500)
    return () => window.clearInterval(id)
  }, [live])

  // Keep the newest line in view.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns.length, interim])

  // Closing the dialog stops the mic, the voice and any reply in flight. A
  // summary already in flight is left to finish so the call still gets logged.
  useEffect(
    () => () => {
      const summarising = phaseRef.current === 'ending'
      endedRef.current = true
      stopListenRef.current()
      cancelSpeakRef.current()
      if (!summarising) abortRef.current?.abort()
    },
    [],
  )

  function listen() {
    if (endedRef.current) return
    setPhase('listening')
    setInterim('')
    if (mutedRef.current || voiceBrokenRef.current) return
    if (!canListen()) {
      voiceBrokenRef.current = true
      setNotice(FATAL_SPEECH_ERRORS.unsupported)
      return
    }
    stopListenRef.current = listenOnce(language, {
      onInterim: setInterim,
      onFinal: (text) => humanSays(text),
      onIdle: () => {
        if (phaseRef.current === 'listening' && !mutedRef.current && !endedRef.current) listen()
      },
      onError: (code) => {
        voiceBrokenRef.current = true
        setNotice(FATAL_SPEECH_ERRORS[code] ?? `Speech recognition stopped (${code}). Type your replies below.`)
      },
    })
  }

  async function aiTurn() {
    setPhase('thinking')
    setError('')
    let reply: { text: string; end: boolean }
    try {
      const { body, signal } = request('reply')
      reply = await postAiCall(body, signal)
    } catch (err) {
      if (endedRef.current) return
      setError((err as Error).message)
      setPhase('failed')
      return
    }
    if (endedRef.current) return
    addTurn({ speaker: 'ai', text: reply.text })
    setPhase('speaking')
    const speech = speak(reply.text, language)
    cancelSpeakRef.current = speech.cancel
    await speech.done
    if (endedRef.current || phaseRef.current !== 'speaking') return
    if (reply.end) void endCall()
    else listen()
  }

  function humanSays(text: string) {
    const said = text.trim()
    if (!said || endedRef.current || (phaseRef.current !== 'listening' && phaseRef.current !== 'speaking')) return
    stopListenRef.current()
    if (phaseRef.current === 'speaking') {
      phaseRef.current = 'thinking' // stops aiTurn from listening after the cut-off speech
      cancelSpeakRef.current()
    }
    setInterim('')
    addTurn({ speaker: 'human', text: said })
    void aiTurn()
  }

  function start() {
    endedRef.current = false
    voiceBrokenRef.current = false
    turnsRef.current = []
    setTurns([])
    setResult(null)
    setNotice('')
    setElapsed(0)
    startedAtRef.current = Date.now()
    void aiTurn()
  }

  async function endCall() {
    if (endedRef.current) return
    endedRef.current = true
    stopListenRef.current()
    cancelSpeakRef.current()
    abortRef.current?.abort()
    setInterim('')
    setPhase('ending')

    const startedAt = startedAtRef.current
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    let summary = { summary: '', outcome: 'No decision' }
    if (turnsRef.current.length > 0) {
      try {
        const { body, signal } = request('summary')
        summary = await postAiCall(body, signal)
      } catch (err) {
        setError(`Couldn’t summarise the call: ${(err as Error).message}`)
      }
    }
    addCall({
      id: makeId('ai'),
      name: role === 'agent' ? lead.name : `Practice: AI as ${lead.name}`,
      leadId: role === 'agent' ? lead.id : undefined,
      direction: 'outgoing',
      startedAt: new Date(startedAt).toISOString(),
      durationSec,
      outcome: summary.outcome,
      source: 'ai',
      summary: summary.summary || undefined,
    })
    setResult(summary)
    setPhase('ended')
  }

  function toggleMute() {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (phaseRef.current !== 'listening') return
    if (next) {
      stopListenRef.current()
      setInterim('')
    } else {
      listen()
    }
  }

  function close() {
    if (live) void endCall()
    onClose()
  }

  const aiName = role === 'agent' ? 'Avani (AI agent)' : `${lead.name} (AI customer)`
  const humanName = role === 'agent' ? `You, as ${lead.name}` : 'You (agent)'

  return (
    <Modal
      wide
      className="ai-call"
      title={
        <span className="consent-title">
          <span className="consent-icon ai"><Sparkles size={18} /></span>
          AI voice call
        </span>
      }
      subtitle={role === 'agent' ? `You play the customer; the AI agent calls ${lead.name}` : `You practise as the agent; the AI plays ${lead.name}`}
      onClose={close}
      footer={
        phase === 'setup' ? (
          <>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-green" onClick={start}><Bot size={15} /> Start AI call</button>
          </>
        ) : phase === 'ended' ? (
          <>
            <button className="btn" onClick={() => setPhase('setup')}>New AI call</button>
            <button className="btn btn-green" onClick={onClose}>Done</button>
          </>
        ) : (
          <button className="btn btn-red" onClick={() => void endCall()} disabled={phase === 'ending'}>
            <PhoneOff size={15} /> End call
          </button>
        )
      }
    >
      {phase === 'setup' ? (
        <>
          <div className="segmented" role="tablist" aria-label="Who the AI plays">
            <button role="tab" aria-selected={role === 'agent'} className={role === 'agent' ? 'active' : ''} onClick={() => setRole('agent')}>
              AI calls the customer
            </button>
            <button role="tab" aria-selected={role === 'customer'} className={role === 'customer' ? 'active' : ''} onClick={() => setRole('customer')}>
              AI plays the customer
            </button>
          </div>

          <label className="consent-subject">
            <span className="detail-label">Lead</span>
            <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)}>
              {LEADS.map((l) => (
                <option key={l.id} value={l.id}>{l.name} · {l.product}</option>
              ))}
            </select>
          </label>

          <div className="chip-row" role="group" aria-label="Call language">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                className={`chip ${l.id === language ? 'active dark' : ''}`}
                onClick={() => setLanguage(l.id)}
                aria-pressed={l.id === language}
              >
                {l.label}
              </button>
            ))}
          </div>

          <p className="muted small">
            {role === 'agent'
              ? `The AI introduces itself as an AI assistant, then follows the call SOP using ${lead.name}’s lead details. Answer as the customer would.`
              : `The AI answers as ${lead.name} and raises real objections from the lead’s history. Run the call as you would with a customer.`}
          </p>
          <p className="notice small">
            How it works: your speech is turned into text by the browser’s speech service (in Chrome, Google’s). The text
            goes to Google’s Gemini model through this app’s server, and the reply is spoken by your device. Audio isn’t recorded. Use
            Chrome or Edge, and headphones if you can.
          </p>
          {!canListen() && <p className="error small">{FATAL_SPEECH_ERRORS.unsupported}</p>}
        </>
      ) : (
        <>
          <div className={`ai-status phase-${phase}`} role="status">
            <span className="ai-status-dot" />
            <span>{muted && phase === 'listening' ? 'Muted' : PHASE_LABEL[phase]}</span>
            <span className="ai-status-time">{formatClock(elapsed)}</span>
          </div>

          <div className="ai-transcript" ref={transcriptRef} aria-live="polite">
            {turns.map((t, i) => (
              <div key={i} className={`bubble-row ${t.speaker === 'human' ? 'mine' : ''}`}>
                <div className="bubble">
                  <div className="bubble-author">{t.speaker === 'ai' ? aiName : humanName}</div>
                  {t.text}
                </div>
              </div>
            ))}
            {interim && (
              <div className="bubble-row mine">
                <div className="bubble interim">{interim}…</div>
              </div>
            )}
            {phase === 'thinking' && <div className="muted small ai-typing">{aiName} is replying…</div>}
          </div>

          {error && <p className="error small" role="alert">{error}</p>}
          {notice && phase !== 'ended' && <p className="notice small">{notice}</p>}

          {phase === 'failed' && (
            <div className="btn-row">
              <button className="btn" onClick={() => void aiTurn()}>Try again</button>
            </div>
          )}

          {(phase === 'listening' || phase === 'speaking' || phase === 'thinking') && (
            <>
              <div className="btn-row">
                <button className="btn" onClick={toggleMute} aria-pressed={muted}>
                  {muted ? <MicOff size={15} /> : <Mic size={15} />} {muted ? 'Unmute' : 'Mute'}
                </button>
                {phase === 'speaking' && (
                  <button className="btn" onClick={() => cancelSpeakRef.current()}>
                    <SkipForward size={15} /> Skip
                  </button>
                )}
              </div>
              <form
                className="consent-wa"
                onSubmit={(e) => {
                  e.preventDefault()
                  humanSays(typed)
                  setTyped('')
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Or type what you’d say…"
                  aria-label="Type a reply"
                  maxLength={500}
                />
                <button className="btn btn-green" type="submit" disabled={!typed.trim() || phase === 'thinking'}>
                  <Send size={15} /> Send
                </button>
              </form>
            </>
          )}

          {phase === 'ended' && result && (
            <section className="ai-result">
              <div className="detail-label">Logged to Recent · {formatClock(elapsed)}</div>
              <div className="ai-outcome">{result.outcome}</div>
              {result.summary && <p>{result.summary}</p>}
            </section>
          )}
        </>
      )}
    </Modal>
  )
}
