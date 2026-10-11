// Shared domain types. Everything the UI renders is described here so the
// mock data, the state layer and the screens agree on one shape.

export type ScreenId =
  | 'dashboard'
  | 'calls-to-make'
  | 'incoming'
  | 'recent'
  | 'practise'
  | 'calendar'
  | 'pulse'
  | 'pulse-channel'

export type Tone = 'green' | 'amber' | 'red' | 'purple' | 'blue'

export interface SubScore {
  label: string
  pct: number
}

export interface JourneyStep {
  date: string
  channel: string
  text: string
}

export interface BuyingSignal {
  category: string
  text: string
}

export interface Lead {
  id: string
  name: string
  initials: string
  phone: string
  product: string
  price: number
  crossSell: string
  emi: string
  /** 0–100: how attractive the lead is to call now. Used to rank "Calls to make". */
  attractiveness: number
  /** 0–100: how strongly the lead signals intent to buy. */
  intent: number
  /** 0–100: ideal-customer-profile fit. */
  icp: number
  subScores: SubScore[]
  story: string[]
  signals: BuyingSignal[]
  journey: JourneyStep[]
  status: 'Open' | 'Ageing' | 'At risk'
  slaBadge: string
}

export type CallDirection = 'incoming' | 'outgoing' | 'missed'

export interface SopCheck {
  label: string
  done: boolean
  note?: string
}

export interface CallRecord {
  id: string
  name: string
  leadId?: string
  direction: CallDirection
  /** ISO timestamp of when the call started (or was missed). */
  startedAt: string
  durationSec: number
  outcome: string
  /** 'demo' rows come from mock data; 'live' rows were real PeerJS calls. */
  source: 'demo' | 'live'
  peerId?: string
  sopScore?: number
  sopChecks?: SopCheck[]
  summary?: string
}

export interface QueueEntry {
  name: string
  waitSec: number
  reason: string
}

export interface CalendarEvent {
  id: string
  /** Local date as YYYY-MM-DD. */
  date: string
  time: string
  title: string
  meta: string
}

export interface ChatMessage {
  id: string
  author: string
  initials: string
  text: string
  sentAt: string
  mine?: boolean
}

export interface NeedsInputCard {
  question: string
  context: string
  options: string[]
}

export interface Channel {
  id: string
  name: string
  topic: string
  memberCount: number
  needsInput?: NeedsInputCard
  seed: ChatMessage[]
}

export interface DirectMessage {
  id: string
  name: string
  initials: string
  role?: string
  preview: string
  time: string
}

export interface Agent {
  id: string
  name: string
  kind: 'custom' | 'role' | 'task'
  description: string
}

export interface Kudos {
  id: string
  from: string
  text: string
  when: string
}

export interface TaskItem {
  id: string
  title: string
  detail: string
  leadId?: string
}
