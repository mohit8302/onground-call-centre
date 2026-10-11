import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, Mic, MicOff, Users } from 'lucide-react'
import { PRACTICE_SCENARIOS } from '../data/mockData'
import { useCall } from '../calling/callContext'
import { ProgressBar, SectionHeader } from '../components/ui'

/**
 * Real microphone check: opens the mic and shows the input level using the
 * Web Audio API. Nothing is recorded or uploaded.
 */
function useMicLevel() {
  const [active, setActive] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const cleanupRef = useRef<(() => void) | null>(null)

  async function start() {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone API unavailable. Use localhost or HTTPS.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      let frame = 0
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        // Root-mean-square of the waveform, scaled to roughly 0–100.
        let sum = 0
        for (const v of data) sum += ((v - 128) / 128) ** 2
        setLevel(Math.min(100, Math.round(Math.sqrt(sum / data.length) * 300)))
        frame = requestAnimationFrame(tick)
      }
      tick()
      cleanupRef.current = () => {
        cancelAnimationFrame(frame)
        stream.getTracks().forEach((t) => t.stop())
        ctx.close()
      }
      setActive(true)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      setError(name === 'NotAllowedError' ? 'Microphone permission was denied.' : (err as Error).message)
    }
  }

  function stop() {
    cleanupRef.current?.()
    cleanupRef.current = null
    setActive(false)
    setLevel(0)
  }

  useEffect(() => () => cleanupRef.current?.(), [])

  return { active, level, error, start, stop }
}

export default function Practise() {
  const call = useCall()
  const mic = useMicLevel()
  const [scenarioId, setScenarioId] = useState(PRACTICE_SCENARIOS[0].id)
  const [checked, setChecked] = useState<string[]>([])
  const scenario = PRACTICE_SCENARIOS.find((s) => s.id === scenarioId) ?? PRACTICE_SCENARIOS[0]

  function pickScenario(id: string) {
    setScenarioId(id)
    setChecked([])
  }

  const toggle = (tip: string) =>
    setChecked((c) => (c.includes(tip) ? c.filter((t) => t !== tip) : [...c, tip]))

  const busy = call.status !== 'ready'

  return (
    <div className="page">
      <SectionHeader
        title="Practise a call"
        subtitle="Pick a scenario, have a teammate play the customer on a real browser call, then tick off what you covered."
      />

      <div className="chip-row" role="group" aria-label="Scenario">
        {PRACTICE_SCENARIOS.map((s) => (
          <button key={s.id} className={`chip ${s.id === scenarioId ? 'active' : ''}`} onClick={() => pickScenario(s.id)}>
            {s.title}
          </button>
        ))}
      </div>

      <div className="practise-grid">
        <section className="card">
          <div className="detail-label">The customer says</div>
          <p className="customer-line">{scenario.customer}</p>

          <div className="detail-label">Your checklist</div>
          <ul className="task-list">
            {scenario.tips.map((tip) => {
              const done = checked.includes(tip)
              return (
                <li key={tip} className={`task ${done ? 'done' : ''}`}>
                  <button className="task-check" onClick={() => toggle(tip)} aria-pressed={done} aria-label={tip}>
                    {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <span className="task-title">{tip}</span>
                </li>
              )
            })}
          </ul>
          <ProgressBar value={checked.length} max={scenario.tips.length} />
          <p className="muted small">
            Self-score: {Math.round((checked.length / scenario.tips.length) * 100)}%
          </p>
        </section>

        <section className="card">
          <div className="card-head"><h2>1 · Check your mic</h2></div>
          <p className="muted small">Opens your microphone locally to show the input level. Nothing is recorded.</p>
          <div className="mic-meter" aria-label={`Mic level ${mic.level}`}>
            <div className="mic-meter-fill" style={{ width: `${mic.level}%` }} />
          </div>
          <button className="btn" onClick={mic.active ? mic.stop : mic.start}>
            {mic.active ? <MicOff size={15} /> : <Mic size={15} />} {mic.active ? 'Stop mic check' : 'Start mic check'}
          </button>
          {mic.error && <p className="error small" role="alert">{mic.error}</p>}

          <div className="card-head spaced"><h2>2 · Practise with a teammate</h2></div>
          <p className="muted small">
            Opens the browser phone tagged as a practice call. Your teammate opens this app in another tab or device and
            shares their ID.
          </p>
          <button
            className="btn btn-green"
            disabled={busy}
            onClick={() => {
              mic.stop() // free the mic for the call
              call.openDialer({ label: `Practice: ${scenario.title}`, purpose: 'practice' })
            }}
          >
            <Users size={15} /> Start practice call
          </button>
        </section>
      </div>
    </div>
  )
}
