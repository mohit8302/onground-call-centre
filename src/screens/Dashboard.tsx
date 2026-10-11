import { useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronRight, Circle, ClipboardList, Headset, ListTodo, PhoneCall, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AGENT_PROFILE, KPIS, QUEUE_NOW, TASKS, WEEK_STATS } from '../data/mockData'
import { useAppState } from '../state/appContext'
import { formatDuration, formatRupees } from '../lib/format'
import { ProgressBar } from '../components/ui'
import type { TaskItem } from '../types'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** "+13" → "▲13", "-8%" → "▼8%". Both can be good news (a shorter handle time is). */
function trend(delta: string) {
  return delta.startsWith('-') ? `▼${delta.slice(1)}` : `▲${delta.replace('+', '')}`
}

function Kpi({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="kpi">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      <span className="kpi-delta">{trend(delta)}</span>
    </div>
  )
}

const TASK_GROUPS: { kind: TaskItem['kind']; icon: LucideIcon; one: string; many: string; note: string }[] = [
  { kind: 'callback', icon: PhoneCall, one: 'callback', many: 'callbacks', note: 'next 4:30pm' },
  { kind: 'hot-lead', icon: Users, one: 'hot lead', many: 'hot leads', note: 'untouched 24h' },
  { kind: 'outcome', icon: ClipboardList, one: 'outcome', many: 'outcomes', note: 'to log' },
]

function WeekBars({ dataKey, label, colors, unit = '' }: { dataKey: 'calls' | 'csat'; label: string; colors: [string, string]; unit?: string }) {
  return (
    <div className="card chart-card">
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={WEEK_STATS} margin={{ top: 20, right: 0, left: 0, bottom: 0 }} barCategoryGap="1.5%">
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis hide domain={dataKey === 'csat' ? [60, 100] : [0, 'auto']} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,.04)' }} formatter={(v) => [`${v}${unit}`, label]} />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
              <LabelList dataKey={dataKey} position="top" fontSize={12} fontWeight={700} fill="#6b6b74" formatter={(v) => `${v}${unit}`} />
              {WEEK_STATS.map((d, i) => (
                <Cell key={d.day} fill={i === WEEK_STATS.length - 1 ? colors[1] : colors[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { navigate, completedTasks, toggleTask, openLeadsModal, recentCalls } = useAppState()
  const [openGroup, setOpenGroup] = useState<TaskItem['kind'] | null>(null)

  // "Leads called" includes real calls placed from this browser today.
  const today = new Date().toDateString()
  const liveCallsToday = recentCalls.filter(
    (c) => c.source === 'live' && c.direction !== 'missed' && new Date(c.startedAt).toDateString() === today,
  ).length
  const leadsCalled = KPIS.leadsCalled + liveCallsToday
  const openTasks = TASKS.filter((t) => !completedTasks.includes(t.id)).length

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">{greeting()} 👋</div>
            <h1 className="hero-name">{AGENT_PROFILE.name}</h1>
            <div className="hero-meta">{AGENT_PROFILE.team}</div>
          </div>
          <div className="hero-side">
            <span className="status-badge"><span className="live-dot" /> On queue</span>
            <span className="period-chip"><CalendarDays size={14} /> This week</span>
          </div>
        </div>

        <div className="kpi-grid" role="group" aria-label="Key metrics this week">
          <Kpi label="OG Score™" value={String(AGENT_PROFILE.ogScore)} delta={`+${AGENT_PROFILE.ogScoreDelta}`} />
          <Kpi label="Avg handle time" value={KPIS.avgHandleTime} delta={KPIS.avgHandleDelta} />
          <Kpi label="CSAT today" value={`${KPIS.csatToday}%`} delta={KPIS.csatDelta} />
          <div className="kpi">
            <div className="kpi-value">{QUEUE_NOW.length}</div>
            <div className="kpi-label">In queue</div>
            <span className="kpi-delta"><span className="live-dot" /> live</span>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <div className="dash-col">
          <section className="progress-card">
            <h2><span className="live-dot" /> My progress · today</h2>
            <div className="progress-tiles">
              <div className="progress-tile">
                <div className="stat-big">{KPIS.leadsCreated}</div>
                <span className="tile-delta gold">▲ +{KPIS.leadsCreatedDelta}</span>
                <div className="tile-label">Leads created</div>
              </div>
              <div className="progress-tile">
                <div className="stat-big">{leadsCalled}</div>
                <span className="tile-delta">▲ +{KPIS.leadsCalledDelta + liveCallsToday}</span>
                <div className="tile-label">Leads called</div>
              </div>
            </div>
          </section>

          <section>
            <div className="section-label">
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
        </div>

        <div className="dash-col">
          <section className="card earnings">
            <div className="earnings-head">
              <h2>💰 My earnings this month</h2>
              <span className="muted small">
                {formatRupees(KPIS.earningsTarget - KPIS.earnings)} to {formatRupees(KPIS.earningsTarget)} slab
              </span>
            </div>
            <div className="earnings-line">
              <span className="earnings-value">{formatRupees(KPIS.earnings)}</span>
              <span className="muted">{formatRupees(KPIS.coachedEarnings)} from coached moves</span>
            </div>
            <ProgressBar value={KPIS.earnings} max={KPIS.earningsTarget} />
          </section>

          <section className="tasks-card">
            <div className="tasks-head">
              <h2><ListTodo size={17} /> My tasks <span className="count-badge">{openTasks}</span></h2>
              <button className="link-btn light" onClick={() => openLeadsModal()}>All leads →</button>
            </div>
            {TASK_GROUPS.map(({ kind, icon: Icon, one, many, note }) => {
              const tasks = TASKS.filter((t) => t.kind === kind)
              const open = tasks.filter((t) => !completedTasks.includes(t.id)).length
              const expanded = openGroup === kind
              return (
                <div key={kind} className={`task-group ${expanded ? 'open' : ''}`}>
                  <button
                    className="task-group-head"
                    onClick={() => setOpenGroup(expanded ? null : kind)}
                    aria-expanded={expanded}
                  >
                    <span className={`task-group-icon ${kind}`}><Icon size={16} /></span>
                    <span className="task-group-text">
                      <strong>{open} {open === 1 ? one : many}</strong> <span className="muted">{open ? note : 'all done'}</span>
                    </span>
                    <ChevronRight size={16} className="task-group-chevron" />
                  </button>
                  {expanded && (
                    <ul className="task-list">
                      {tasks.map((task) => {
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
                  )}
                </div>
              )
            })}
          </section>
        </div>
      </div>

      <section>
        <div className="section-label"><h2>Calls handled · last 7 days</h2></div>
        <WeekBars dataKey="calls" label="Calls" colors={['#5dcaa5', '#0f6e56']} />
      </section>

      <section>
        <div className="section-label"><h2>CSAT trend · last 7 days</h2></div>
        <WeekBars dataKey="csat" label="CSAT" colors={['#93b4f5', '#1e5bb8']} unit="%" />
      </section>
    </div>
  )
}
