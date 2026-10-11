import { useEffect, useRef, useState } from 'react'
import { Bell, Menu, Phone, RotateCcw } from 'lucide-react'
import { AGENT_PROFILE } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { useCall } from '../calling/callContext'
import { formatClock } from '../lib/format'
import { ScoreRing } from './ui'

const NOTIFICATIONS = [
  { id: 'n1', text: 'Ritu S. called and you missed it. Call back before her SLA runs out.' },
  { id: 'n2', text: 'Sunita Rao sent you kudos.' },
  { id: 'n3', text: '#callcentre-team needs your input on tomorrow’s shift.' },
]

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

export default function TopBar({ onMenu }: { onMenu: () => void }) {
  const { navigate, openChannel, resetDemo } = useAppState()
  const call = useCall()
  const [menu, setMenu] = useState<'none' | 'bell' | 'profile'>('none')
  const [seen, setSeen] = useState(false)
  const ref = useClickOutside(() => setMenu('none'))

  const phoneLabel =
    call.status === 'in-call'
      ? formatClock(call.elapsedSec)
      : call.status === 'ringing'
        ? 'Incoming…'
        : call.status === 'calling'
          ? 'Calling…'
          : 'Phone'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn topbar-menu" onClick={onMenu} aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <span className="brand-logo">OG</span>
        <span className="topbar-title">On-Ground.ai</span>
      </div>

      <div className="topbar-right" ref={ref}>
        <button
          className={`phone-chip status-${call.status}`}
          onClick={() => call.openDialer()}
          title={call.myId ? `Your call ID: ${call.myId}` : 'Connecting to the call server'}
        >
          <Phone size={15} />
          <span>{phoneLabel}</span>
          <span className="phone-dot" aria-hidden />
        </button>

        <div className="menu-anchor">
          <button
            className="bell"
            aria-label={`Notifications${seen ? '' : `, ${NOTIFICATIONS.length} unread`}`}
            onClick={() => {
              setMenu(menu === 'bell' ? 'none' : 'bell')
              setSeen(true)
            }}
          >
            <Bell size={17} />
            {!seen && <span className="bell-badge">{NOTIFICATIONS.length}</span>}
          </button>
          {menu === 'bell' && (
            <div className="dropdown" role="menu">
              <div className="dropdown-title">Notifications</div>
              {NOTIFICATIONS.map((n, i) => (
                <button
                  key={n.id}
                  className="dropdown-item"
                  onClick={() => {
                    setMenu('none')
                    if (i === 0) navigate('incoming')
                    else if (i === 1) navigate('pulse')
                    else openChannel('callcentre-team')
                  }}
                >
                  {n.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="og-score" title={`OG Score ${AGENT_PROFILE.ogScore} · rank #${AGENT_PROFILE.rank} of ${AGENT_PROFILE.rankOutOf}`}>
          <ScoreRing score={AGENT_PROFILE.ogScore} size={38} />
          <span className="rank-pill">#{AGENT_PROFILE.rank}</span>
        </div>

        <div className="menu-anchor">
          <button className="avatar-btn" onClick={() => setMenu(menu === 'profile' ? 'none' : 'profile')} aria-label="Profile menu">
            {AGENT_PROFILE.initials}
          </button>
          {menu === 'profile' && (
            <div className="dropdown" role="menu">
              <div className="dropdown-title">{AGENT_PROFILE.name}</div>
              <div className="dropdown-meta">{AGENT_PROFILE.team}</div>
              <button
                className="dropdown-item"
                onClick={() => {
                  setMenu('none')
                  resetDemo()
                }}
              >
                <RotateCcw size={14} /> Reset demo data
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
