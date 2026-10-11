import { lazy, Suspense, useState } from 'react'
import AppStateProvider from './state/AppStateProvider'
import { useAppState } from './state/appContext'
import CallProvider from './calling/CallProvider'
import CallDock from './calling/CallDock'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import LeadsModal from './components/LeadsModal'
import SopReviewModal from './components/SopReviewModal'
import type { ScreenId } from './types'
import './App.css'

// Each screen is its own chunk, so e.g. the charts library only loads with the dashboard.
const SCREENS: Record<ScreenId, React.LazyExoticComponent<() => React.JSX.Element>> = {
  dashboard: lazy(() => import('./screens/Dashboard')),
  'calls-to-make': lazy(() => import('./screens/CallsToMake')),
  incoming: lazy(() => import('./screens/Incoming')),
  recent: lazy(() => import('./screens/Recent')),
  practise: lazy(() => import('./screens/Practise')),
  calendar: lazy(() => import('./screens/CalendarScreen')),
  pulse: lazy(() => import('./screens/PulseHome')),
  'pulse-channel': lazy(() => import('./screens/PulseChannel')),
}

function Shell() {
  const { screen, addCall, showToast, toast } = useAppState()
  const [navOpen, setNavOpen] = useState(false)
  const Screen = SCREENS[screen] ?? SCREENS.dashboard

  return (
    <CallProvider
      onCallLogged={(record) => {
        addCall(record)
        showToast(`Call with ${record.name} saved to Recent`)
      }}
    >
      <div className="shell">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />}
        <div className="main-col">
          <TopBar onMenu={() => setNavOpen(true)} />
          <main className="content">
            <Suspense fallback={<div className="muted">Loading…</div>}>
              <Screen />
            </Suspense>
          </main>
        </div>
      </div>
      <CallDock />
      <LeadsModal />
      <SopReviewModal />
      {toast && <div className="toast" role="status">{toast}</div>}
    </CallProvider>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  )
}
