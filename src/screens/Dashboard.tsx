import { ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Headset, IndianRupee } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AGENT_PROFILE, KPIS, QUEUE_NOW, TASKS, WEEK_STATS } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { formatDuration, formatRupees } from '../lib/format'
import { ProgressBar } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

interface KpiProps {
  label: string
  value: string
  delta: string
  good: boolean
  hint?: string
}

function Kpi({ label, value, delta, good, hint }: KpiProps) {
  const Arrow = delta.startsWith('-') ? ArrowDownRight : ArrowUpRight
  return (
    <div className="card kpi">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-delta ${good ? 'good' : 'bad'}`}>
        <Arrow size={13} /> {delta.replace('-', '')}
        {hint && <span className="kpi-hint">{hint}</span>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { navigate, completedTasks, toggleTask, openLeadsModal, recentCalls } = useAppState()

  // "Leads called" includes real calls placed from this browser today.
  const today = new Date().toDateString()
  const liveCallsToday = recentCalls.filter(
    (c) => c.source === 'live' && c.direction !== 'missed' && new Date(c.startedAt).toDateString() === today,
  ).length
  const leadsCalled = KPIS.leadsCalled + liveCallsToday
  const openTasks = TASKS.length - completedTasks.filter((id) => TASKS.some((t) => t.id === id)).length

  return (
    <div className="page">
      <section className="hero card">
        <div>
          <div className="hero-greeting">{greeting()} 👋</div>
          <h1 className="hero-name">{AGENT_PROFILE.name}</h1>
          <div className="hero-meta">{AGENT_PROFILE.team}</div>
        </div>
        <span className="status-badge"><span className="live-dot" /> On queue</span>
      </section>

      <section className="kpi-grid" aria-label="Key metrics this week">
        <Kpi label="OG Score™" value={String(AGENT_PROFILE.ogScore)} delta={`+${AGENT_PROFILE.ogScoreDelta}`} good />
        <Kpi label="Avg handle time" value={KPIS.avgHandleTime} delta={KPIS.avgHandleDelta} good hint="faster" />
        <Kpi label="CSAT today" value={`${KPIS.csatToday}%`} delta={KPIS.csatDelta} good />
        <div className="card kpi">
          <div className="kpi-value">{QUEUE_NOW.length}</div>
          <div className="kpi-label">In queue</div>
          <div className="kpi-delta live"><span className="live-dot" /> live</div>
        </div>
      </section>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>My progress · today</h2>
          </div>
          <div className="progress-stats">
            <div>
              <div className="stat-big">{KPIS.leadsCreated}</div>
              <div className="stat-label">Leads created</div>
            </div>
            <div>
              <div className="stat-big">{leadsCalled}</div>
              <div className="stat-label">Leads called</div>
            </div>
            <div>
              <div className="stat-big">{KPIS.progressTarget}</div>
              <div className="stat-label">Daily target</div>
            </div>
          </div>
          <ProgressBar value={KPIS.leadsCreated + leadsCalled} max={KPIS.progressTarget} />
          <p className="muted small">
            {KPIS.leadsCreated + leadsCalled} of {KPIS.progressTarget} touches done today
          </p>
        </section>

        <section className="card earnings">
          <div className="card-head">
            <h2><IndianRupee size={16} /> My earnings this month</h2>
          </div>
          <div className="earnings-value">{formatRupees(KPIS.earnings)}</div>
          <ProgressBar value={KPIS.earnings} max={KPIS.earningsTarget} tone="gold" />
          <p className="muted small">
            {formatRupees(KPIS.earningsTarget - KPIS.earnings)} to reach the {formatRupees(KPIS.earningsTarget)} slab ·{' '}
            {formatRupees(KPIS.coachedEarnings)} from coached moves
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>My tasks <span className="count-badge">{openTasks}</span></h2>
            <button className="link-btn" onClick={() => openLeadsModal()}>All leads →</button>
          </div>
          <ul className="task-list">
            {TASKS.map((task) => {
              const done = completedTasks.includes(task.id)
              return (
                <li key={task.id} className={`task ${done ? 'done' : ''}`}>
                  <button
                    className="task-check"
                    onClick={() => toggleTask(task.id)}
                    aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                  >
                    {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <button className="task-body" onClick={() => openLeadsModal(task.leadId)}>
                    <span className="task-title">{task.title}</span>
                    <span className="task-detail">{task.detail}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Who’s waiting</h2>
            <button className="link-btn" onClick={() => navigate('calls-to-make')}>Open planner →</button>
          </div>
          {QUEUE_NOW.map((q) => (
            <div key={q.name} className="queue-row">
              <span className="queue-icon"><Headset size={16} /></span>
              <div className="queue-body">
                <div className="queue-name">{q.name}</div>
                <div className="muted small">{q.reason}</div>
              </div>
              <span className={`wait-badge ${q.waitSec > 180 ? 'hi' : 'mid'}`}>{formatDuration(q.waitSec)}</span>
            </div>
          ))}
        </section>

        <section className="card chart-card">
          <div className="card-head">
            <h2>Calls handled · last 7 days</h2>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEK_STATS} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef0f3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(29,158,117,.08)' }} formatter={(v) => [v, 'Calls']} />
                <Bar dataKey="calls" fill="#1d9e75" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card chart-card">
          <div className="card-head">
            <h2>CSAT trend · last 7 days</h2>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={WEEK_STATS} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef0f3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[80, 100]} tickLine={false} axisLine={false} fontSize={12} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'CSAT']} />
                <Line type="monotone" dataKey="csat" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}
