import { CalendarDays, ClipboardList, LayoutDashboard, MessagesSquare, PhoneIncoming, PhoneOutgoing, History, Mic } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppState } from '../state/appContext'
import type { ScreenId } from '../types'

interface NavItem {
  id: ScreenId
  label: string
  icon: LucideIcon
  tone: string
}

const PLAN_ITEMS: NavItem[] = [
  { id: 'calls-to-make', label: 'Calls to make', icon: PhoneOutgoing, tone: 'blue' },
  { id: 'incoming', label: 'Incoming', icon: PhoneIncoming, tone: 'blue' },
  { id: 'recent', label: 'Recent', icon: History, tone: 'blue' },
  { id: 'practise', label: 'Practise a call', icon: Mic, tone: 'amber' },
]

const PLAN_IDS = PLAN_ITEMS.map((i) => i.id)

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { screen, navigate } = useAppState()

  function go(id: ScreenId) {
    navigate(id)
    onNavigate()
  }

  const isPulse = screen === 'pulse' || screen === 'pulse-channel'

  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Main">
      <div className="sidebar-brand">On-Ground.ai</div>

      <button className={`nav-item ${screen === 'dashboard' ? 'active' : ''}`} onClick={() => go('dashboard')}>
        <span className="nav-icon tone-green"><LayoutDashboard size={17} /></span>
        <span>Dashboard</span>
      </button>

      <button className={`nav-item ${PLAN_IDS.includes(screen) ? 'active' : ''}`} onClick={() => go('calls-to-make')}>
        <span className="nav-icon tone-blue"><ClipboardList size={17} /></span>
        <span>Plan</span>
      </button>
      <div className="nav-sub">
        {PLAN_ITEMS.map(({ id, label, icon: Icon, tone }) => (
          <button
            key={id}
            className={`nav-sub-item ${screen === id ? 'active' : ''} ${tone === 'amber' ? 'ghost' : ''}`}
            onClick={() => go(id)}
            aria-current={screen === id ? 'page' : undefined}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <button className={`nav-item ${screen === 'calendar' ? 'active' : ''}`} onClick={() => go('calendar')}>
        <span className="nav-icon tone-amber"><CalendarDays size={17} /></span>
        <span>Calendar</span>
      </button>

      <button className={`nav-item ${isPulse ? 'active' : ''}`} onClick={() => go('pulse')}>
        <span className="nav-icon tone-purple"><MessagesSquare size={17} /></span>
        <span>Pulse</span>
      </button>
    </nav>
  )
}
