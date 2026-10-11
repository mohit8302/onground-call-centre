import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Hash, Pin, Send, Users } from 'lucide-react'
import { CHANNELS } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { Avatar } from '../components/ui'

export default function PulseChannel() {
  const { activeChannelId, navigate, messagesFor, sendMessage, needsInputAnswers, answerNeedsInput } = useAppState()
  const channel = CHANNELS.find((c) => c.id === activeChannelId) ?? CHANNELS[0]
  const messages = messagesFor(channel.id)
  const answer = needsInputAnswers[channel.id]

  const [draft, setDraft] = useState('')
  const [customReply, setCustomReply] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages.length])

  return (
    <div className="page channel-page">
      <header className="channel-header card">
        <button className="icon-btn" onClick={() => navigate('pulse')} aria-label="Back to Pulse">
          <ArrowLeft size={18} />
        </button>
        <div className="channel-header-main">
          <h1 className="channel-title"><Hash size={18} /> {channel.name}</h1>
          <div className="muted small">{channel.topic}</div>
        </div>
        <span className="muted small members"><Users size={14} /> {channel.memberCount}</span>
      </header>

      {channel.needsInput && (
        <section className={`needs-input card ${answer ? 'answered' : ''}`} aria-label="Needs your input">
          <div className="needs-input-tag"><Pin size={13} /> Needs your input</div>
          <div className="needs-input-q">{channel.needsInput.question}</div>
          <div className="muted small">{channel.needsInput.context}</div>
          {answer ? (
            <div className="needs-input-done">You answered: <strong>{answer}</strong></div>
          ) : (
            <>
              <div className="chip-row">
                {channel.needsInput.options.map((o) => (
                  <button key={o} className="chip" onClick={() => answerNeedsInput(channel.id, o)}>
                    {o}
                  </button>
                ))}
              </div>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!customReply.trim()) return
                  answerNeedsInput(channel.id, customReply.trim())
                  setCustomReply('')
                }}
              >
                <input
                  value={customReply}
                  onChange={(e) => setCustomReply(e.target.value)}
                  placeholder="Or type a reply…"
                  aria-label="Reply to the pinned question"
                />
                <button className="btn btn-green" type="submit" disabled={!customReply.trim()}>Reply</button>
              </form>
            </>
          )}
        </section>
      )}

      <section className="chat card" aria-label="Messages" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.mine ? 'mine' : ''}`}>
            {!m.mine && <Avatar initials={m.initials} size={30} tone="purple" />}
            <div className="bubble">
              {!m.mine && <div className="bubble-author">{m.author}</div>}
              <div>{m.text}</div>
              <div className="bubble-time">{m.sentAt}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </section>

      <form
        className="composer card"
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage(channel.id, draft)
          setDraft('')
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message #${channel.name}`}
          aria-label={`Message #${channel.name}`}
        />
        <button className="btn btn-green" type="submit" disabled={!draft.trim()} aria-label="Send message">
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}
