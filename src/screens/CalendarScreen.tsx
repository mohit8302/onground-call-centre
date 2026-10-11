import { useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { CALENDAR_EVENTS } from '../data/mockData'
import { toDateKey } from '../lib/format'
import { SectionHeader } from '../components/ui'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarScreen() {
  const today = new Date()
  const todayKey = toDateKey(today)
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selected, setSelected] = useState<string>(todayKey)

  const first = new Date(view.year, view.month, 1)
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const leadingBlanks = first.getDay()
  const monthLabel = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const eventDates = new Set(CALENDAR_EVENTS.map((e) => e.date))

  function shiftMonth(delta: number) {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function goToday() {
    setView({ year: today.getFullYear(), month: today.getMonth() })
    setSelected(todayKey)
  }

  // Selected day's events first; otherwise everything from today onwards.
  const dayEvents = CALENDAR_EVENTS.filter((e) => e.date === selected)
  const upcoming = CALENDAR_EVENTS.filter((e) => e.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date))
  const selectedLabel = new Date(selected + 'T00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="page">
      <SectionHeader title="Calendar" subtitle="Callbacks, coaching sessions and meeting invites in one place." />

      <div className="calendar-layout">
        <section className="card cal-card">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <h2 className="cal-month" aria-live="polite">{monthLabel}</h2>
            <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
            <button className="btn btn-small" onClick={goToday}>Today</button>
          </div>

          <div className="cal-grid" role="grid" aria-label={monthLabel}>
            {WEEKDAYS.map((d) => (
              <div key={d} className="cal-weekday" role="columnheader">{d}</div>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`blank-${i}`} className="cal-day empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const key = toDateKey(new Date(view.year, view.month, day))
              const classes = ['cal-day']
              if (key === todayKey) classes.push('today')
              if (key === selected) classes.push('selected')
              return (
                <button
                  key={key}
                  className={classes.join(' ')}
                  onClick={() => setSelected(key)}
                  aria-pressed={key === selected}
                  aria-label={`${day}${eventDates.has(key) ? ', has events' : ''}`}
                >
                  {day}
                  {eventDates.has(key) && <span className="cal-dot" />}
                </button>
              )
            })}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{selected === todayKey ? 'Today' : selectedLabel}</h2>
          </div>
          {dayEvents.length === 0 ? (
            <p className="muted small">Nothing scheduled for this day.</p>
          ) : (
            dayEvents.map((e) => (
              <div key={e.id} className="event">
                <div className="event-time">{e.time}</div>
                <div>
                  <div className="event-title">{e.title}</div>
                  <div className="muted small">{e.meta}</div>
                </div>
              </div>
            ))
          )}

          <div className="card-head spaced">
            <h2><CalendarClock size={16} /> Upcoming</h2>
          </div>
          {upcoming.map((e) => (
            <button key={e.id} className="event event-btn" onClick={() => {
              const d = new Date(e.date + 'T00:00')
              setView({ year: d.getFullYear(), month: d.getMonth() })
              setSelected(e.date)
            }}>
              <div className="event-time">
                {new Date(e.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                <span>{e.time}</span>
              </div>
              <div>
                <div className="event-title">{e.title}</div>
                <div className="muted small">{e.meta}</div>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}
