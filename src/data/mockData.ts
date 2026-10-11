// Local demo data. There is no backend: every screen reads from here, and
// anything the user changes is layered on top via localStorage (see state/).
// Dates are generated relative to "now" so the demo always looks current.

import type {
  Agent,
  CalendarEvent,
  CallRecord,
  Channel,
  DirectMessage,
  Kudos,
  Lead,
  QueueEntry,
  TaskItem,
} from '../types'

export const AGENT_PROFILE = {
  name: 'Arvind Rajan',
  initials: 'AR',
  team: 'The Sleep Company · Call Centre',
  store: 'Koramangala',
  ogScore: 76,
  ogScoreDelta: 13,
  rank: 3,
  rankOutOf: 6,
}

export const LEADS: Lead[] = [
  {
    id: 'lead-mukunda',
    name: 'Mukunda R.',
    initials: 'MR',
    phone: '+91 98765 4xxxx',
    product: 'Ortho GRID Mattress',
    price: 8490,
    crossSell: 'Mattress protector (₹1,999)',
    emi: 'Raised EMI himself, so open with the 12-month no-cost plan',
    attractiveness: 90,
    intent: 91,
    icp: 87,
    subScores: [
      { label: 'Budget fit', pct: 87 },
      { label: 'Need match', pct: 72 },
      { label: 'Decision stage', pct: 60 },
    ],
    story: [
      'Came in through an EMI retargeting ad and opted in on WhatsApp two days later.',
      'Had a short qualifying call and asked whether pillows are bundled.',
      'Is comparing us with a competitor on price. The 100-night trial lowers his risk.',
      'Prefers calls after 6 pm.',
    ],
    signals: [
      { category: 'Financing', text: 'Asked directly about monthly instalments. Budget is a factor, not a blocker.' },
      { category: 'Quote requested', text: 'Wants a quote with pillows included so he can compare it like-for-like.' },
      { category: 'Warranty', text: 'Has not asked yet. Bring up the trial before he does.' },
    ],
    journey: [
      { date: '18 Sep', channel: 'Meta ad', text: 'Clicked the no-cost EMI ad (first touch)' },
      { date: '20 Sep', channel: 'WhatsApp', text: 'Opted in and shared his bed size (queen)' },
      { date: '22 Sep', channel: 'Voice AI', text: '4 min qualifying call, asked about bundled pillows' },
      { date: '24 Sep', channel: 'WhatsApp', text: 'Asked for a written quote' },
    ],
    status: 'Open',
    slaBadge: '2h left',
  },
  {
    id: 'lead-ritu',
    name: 'Ritu S.',
    initials: 'RS',
    phone: '+91 99001 2xxxx',
    product: 'Luxe Recliner Sofa',
    price: 42990,
    crossSell: 'Fabric protection plan (₹2,990)',
    emi: 'Paying upfront, so mention the prepaid discount',
    attractiveness: 82,
    intent: 96,
    icp: 84,
    subScores: [
      { label: 'Budget fit', pct: 90 },
      { label: 'Need match', pct: 80 },
      { label: 'Decision stage', pct: 78 },
    ],
    story: [
      'Visited the Koramangala store last weekend and sat in the recliner for 20 minutes.',
      'Missed our callback this morning, then called back herself.',
      'Moving into a new flat next month, so delivery date matters most.',
    ],
    signals: [
      { category: 'Delivery timing', text: 'Needs delivery before the 1st. Confirm the slot on the call.' },
      { category: 'Store visit', text: 'Has already seen the product. No demo needed, go straight to closing.' },
    ],
    journey: [
      { date: '27 Sep', channel: 'Store visit', text: 'Tried the Luxe recliner with a store associate' },
      { date: '28 Sep', channel: 'WhatsApp', text: 'Asked for fabric swatches' },
      { date: 'Today', channel: 'Phone', text: 'Inbound call went unanswered' },
    ],
    status: 'Open',
    slaBadge: '5h left',
  },
  {
    id: 'lead-faizan',
    name: 'Faizan A.',
    initials: 'FA',
    phone: '+91 97400 8xxxx',
    product: 'Ergonomic Office Chair',
    price: 13490,
    crossSell: 'Lumbar cushion (₹1,299)',
    emi: 'Corporate purchase, so offer a GST invoice',
    attractiveness: 71,
    intent: 74,
    icp: 70,
    subScores: [
      { label: 'Budget fit', pct: 76 },
      { label: 'Need match', pct: 68 },
      { label: 'Decision stage', pct: 58 },
    ],
    story: [
      'Buying for a 6-person startup office and may order in bulk.',
      'Asked whether we offer a volume discount over 5 units.',
    ],
    signals: [
      { category: 'Bulk order', text: 'Possible 6-unit order. Check volume pricing before calling.' },
      { category: 'Invoice', text: 'Needs a GST invoice for reimbursement.' },
    ],
    journey: [
      { date: '25 Sep', channel: 'Website', text: 'Filled the bulk enquiry form' },
      { date: '29 Sep', channel: 'Email', text: 'Opened the product brochure twice' },
    ],
    status: 'Open',
    slaBadge: '1d left',
  },
  {
    id: 'lead-kavitha',
    name: 'Kavitha R.',
    initials: 'KR',
    phone: '+91 98450 3xxxx',
    product: 'SmartGRID Hybrid Mattress',
    price: 24990,
    crossSell: 'Cooling pillow pair (₹2,499)',
    emi: 'Budget is tight, so a payment plan could decide it',
    attractiveness: 55,
    intent: 63,
    icp: 61,
    subScores: [
      { label: 'Budget fit', pct: 61 },
      { label: 'Need match', pct: 42 },
      { label: 'Decision stage', pct: 35 },
    ],
    story: [
      'Wants to try the hybrid in a store before deciding.',
      'Has not replied to the last two WhatsApp messages.',
    ],
    signals: [
      { category: 'Store demo', text: 'Book a store slot instead of pushing for a phone close.' },
      { category: 'Price', text: 'Said the hybrid is "a bit much". The EMI plan may help.' },
    ],
    journey: [
      { date: '15 Sep', channel: 'Instagram', text: 'Saved a reel about hybrid mattresses' },
      { date: '19 Sep', channel: 'WhatsApp', text: 'Asked when she could see it in person' },
    ],
    status: 'Ageing',
    slaBadge: '+3d ageing',
  },
  {
    id: 'lead-divya',
    name: 'Divya P.',
    initials: 'DP',
    phone: '+91 90080 6xxxx',
    product: 'Memory Foam Pillow (pair)',
    price: 3998,
    crossSell: 'Bamboo pillow covers (₹899)',
    emi: 'Low ticket, so EMI is not relevant',
    attractiveness: 38,
    intent: 41,
    icp: 45,
    subScores: [
      { label: 'Budget fit', pct: 70 },
      { label: 'Need match', pct: 35 },
      { label: 'Decision stage', pct: 22 },
    ],
    story: ['Browsed pillows once and abandoned the cart.', 'No answer on the last call attempt.'],
    signals: [{ category: 'Cart abandoned', text: 'A small nudge, like free delivery, may be enough.' }],
    journey: [{ date: '30 Sep', channel: 'Website', text: 'Abandoned the cart at checkout' }],
    status: 'At risk',
    slaBadge: 'SLA missed',
  },
]

export const QUEUE_NOW: QueueEntry[] = [
  { name: 'Priya Iyer', waitSec: 260, reason: 'Probably a billing question (raised one before)' },
  { name: 'Suresh Nair', waitSec: 110, reason: 'Asking about an upgrade' },
]

export const TASKS: TaskItem[] = [
  { id: 'task-1', title: 'Call back Mukunda R.', detail: 'Quote follow-up · due 4:30 pm', leadId: 'lead-mukunda' },
  { id: 'task-2', title: 'Call back Ritu S.', detail: 'Missed inbound · high intent', leadId: 'lead-ritu' },
  { id: 'task-3', title: 'Review hot lead Faizan A.', detail: 'Untouched for 24h', leadId: 'lead-faizan' },
  { id: 'task-4', title: 'Log outcome for Kavitha R.', detail: 'Last call has no outcome', leadId: 'lead-kavitha' },
]

export const KPIS = {
  avgHandleTime: '4m 12s',
  avgHandleDelta: '-8%',
  csatToday: 94,
  csatDelta: '+2pt',
  leadsCreated: 3,
  leadsCalled: 2,
  progressTarget: 8,
  earnings: 5200,
  earningsTarget: 6000,
  coachedEarnings: 1700,
}

export const WEEK_STATS = [
  { day: 'Mon', calls: 18, csat: 88 },
  { day: 'Tue', calls: 22, csat: 90 },
  { day: 'Wed', calls: 15, csat: 85 },
  { day: 'Thu', calls: 26, csat: 92 },
  { day: 'Fri', calls: 20, csat: 89 },
  { day: 'Sat', calls: 12, csat: 91 },
  { day: 'Today', calls: 14, csat: 94 },
]

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

const STANDARD_SOP = [
  'Greeted by name and introduced self',
  'Confirmed the need before pitching',
  'Pitched the preferred product',
  'Offered the cross-sell',
  'Handled the price / EMI question',
  'Agreed a clear next step',
]

function sop(doneFlags: boolean[], notes: Record<number, string> = {}) {
  return STANDARD_SOP.map((label, i) => ({ label, done: doneFlags[i], note: notes[i] }))
}

export const DEMO_RECENT_CALLS: CallRecord[] = [
  {
    id: 'demo-1',
    name: 'Mukunda R.',
    leadId: 'lead-mukunda',
    direction: 'incoming',
    startedAt: hoursAgo(1.5),
    durationSec: 252,
    outcome: 'Quote sent',
    source: 'demo',
    sopScore: 83,
    sopChecks: sop([true, true, true, false, true, true], { 3: 'Protector not mentioned. Add it next time.' }),
    summary: 'Walked through the Ortho GRID and the 12-month EMI. He will compare the quote tonight.',
  },
  {
    id: 'demo-2',
    name: 'Ritu S.',
    leadId: 'lead-ritu',
    direction: 'missed',
    startedAt: hoursAgo(3),
    durationSec: 0,
    outcome: 'No answer',
    source: 'demo',
  },
  {
    id: 'demo-3',
    name: 'Faizan A.',
    leadId: 'lead-faizan',
    direction: 'missed',
    startedAt: hoursAgo(4.5),
    durationSec: 0,
    outcome: 'No answer',
    source: 'demo',
  },
  {
    id: 'demo-4',
    name: 'Kavitha R.',
    leadId: 'lead-kavitha',
    direction: 'outgoing',
    startedAt: hoursAgo(22),
    durationSec: 125,
    outcome: 'Call back later',
    source: 'demo',
    sopScore: 50,
    sopChecks: sop([true, true, false, false, true, false], {
      2: 'Went to price before confirming which model she wanted.',
      5: 'Call ended without a follow-up time.',
    }),
    summary: 'She was busy, asked to be called back. Mentioned the store demo once.',
  },
  {
    id: 'demo-5',
    name: 'Divya P.',
    leadId: 'lead-divya',
    direction: 'missed',
    startedAt: hoursAgo(26),
    durationSec: 0,
    outcome: 'No answer',
    source: 'demo',
  },
  {
    id: 'demo-6',
    name: 'Faizan A.',
    leadId: 'lead-faizan',
    direction: 'outgoing',
    startedAt: hoursAgo(70),
    durationSec: 400,
    outcome: 'Interested',
    source: 'demo',
    sopScore: 100,
    sopChecks: sop([true, true, true, true, true, true]),
    summary: 'Discussed a 6-chair order and sent the brochure plus volume pricing.',
  },
]

function dateFromToday(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export const CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'ev-1', date: dateFromToday(0), time: '4:30 PM', title: 'Callback: Mukunda R.', meta: 'Quote follow-up · Ortho GRID' },
  { id: 'ev-2', date: dateFromToday(2), time: '11:00 AM', title: 'SOP coaching session', meta: 'With Sunita Rao (Manager)' },
  { id: 'ev-3', date: dateFromToday(5), time: '2:30 PM', title: 'Warranty pitch refresher', meta: 'L&D team · picked from your last 3 calls' },
  { id: 'ev-4', date: dateFromToday(7), time: '10:00 AM', title: 'Weekly team huddle', meta: 'Call centre team · #callcentre-team' },
  { id: 'ev-5', date: dateFromToday(7), time: '3:00 PM', title: 'Store demo: Kavitha R.', meta: 'Koramangala store · SmartGRID Hybrid' },
]

export const AGENTS: Agent[] = [
  { id: 'ag-1', name: 'Quote Builder', kind: 'custom', description: 'Drafts quotes with bundles and EMI applied' },
  { id: 'ag-2', name: 'Objection Coach', kind: 'role', description: 'Suggests replies to price and warranty pushback' },
  { id: 'ag-3', name: 'Follow-up Scheduler', kind: 'task', description: 'Books callbacks from the call outcome' },
]

export const CHANNELS: Channel[] = [
  {
    id: 'callcentre-team',
    name: 'callcentre-team',
    topic: 'Daily coordination for the call centre floor',
    memberCount: 8,
    needsInput: {
      question: 'Can you take the 3–5 pm inbound shift tomorrow?',
      context: 'Priya is on leave and the queue usually peaks then.',
      options: ['Yes, I can', 'Only 3–4 pm', "Can't tomorrow"],
    },
    seed: [
      { id: 'm1', author: 'Sunita Rao', initials: 'SR', text: 'Morning team! QA scores for last week are up, please review yours before Friday.', sentAt: '09:02' },
      { id: 'm2', author: 'Raju Kumar', initials: 'RK', text: 'Done. My warranty-pitch score dipped, going to rewatch the training.', sentAt: '09:15' },
      { id: 'm3', author: 'Arvind Rajan', initials: 'AR', text: 'Will do. Closed Mukunda on a quote yesterday 🙌', sentAt: '09:21', mine: true },
      { id: 'm4', author: 'Sunita Rao', initials: 'SR', text: 'Nice work Arvind! Push the protector cross-sell on the follow-up.', sentAt: '09:24' },
    ],
  },
  {
    id: 'all-stores',
    name: 'all-stores',
    topic: 'Announcements across every store',
    memberCount: 64,
    seed: [
      { id: 'm1', author: 'Ops Bot', initials: 'OB', text: 'The Ortho GRID festive campaign starts on the 15th. Pricing sheet is pinned.', sentAt: '10:22' },
    ],
  },
  {
    id: 'avani-coaching',
    name: 'avani-coaching',
    topic: 'AI coaching nudges based on your calls',
    memberCount: 2,
    seed: [
      { id: 'm1', author: 'AvaniBot', initials: 'AV', text: 'Your warranty score dropped 12% this week. Want a 5-minute refresher?', sentAt: '09:01' },
    ],
  },
  {
    id: 'quotation-tickets',
    name: 'quotation-tickets',
    topic: 'Quote approvals',
    memberCount: 5,
    seed: [
      { id: 'm1', author: 'Finance', initials: 'FN', text: 'Quote #4471 (Mukunda R.) is waiting for approval.', sentAt: '09:12' },
    ],
  },
]

export const DIRECT_MESSAGES: DirectMessage[] = [
  { id: 'dm-1', name: 'Sunita Rao', initials: 'SR', role: 'Manager', preview: 'Great work with Mukunda, keep it up', time: '12:40' },
  { id: 'dm-2', name: 'Priya Krishnan', initials: 'PK', preview: 'Can you cover my 3 pm slot today?', time: '09:55' },
  { id: 'dm-3', name: 'Raju Kumar', initials: 'RK', preview: 'Nice cross-sell on the office chair 🔥', time: 'Yesterday' },
]

export const KUDOS: Kudos[] = [
  { id: 'k-1', from: 'Sunita Rao', text: 'Handled the warranty objection with Mukunda really well.', when: 'Today' },
  { id: 'k-2', from: 'Raju Kumar', text: 'Smart cross-sell on the office chair order.', when: 'Yesterday' },
  { id: 'k-3', from: 'Sunita Rao', text: 'Best SOP score on the floor this week.', when: '2 days ago' },
]

export const PRACTICE_SCENARIOS = [
  {
    id: 'price',
    title: 'Price objection',
    customer: '"Another brand is ₹2,000 cheaper. Why should I pay more?"',
    tips: ['Acknowledge the comparison', 'Anchor on the 100-night trial and warranty', 'Offer the no-cost EMI to soften the price'],
  },
  {
    id: 'warranty',
    title: 'Warranty doubt',
    customer: '"What if the mattress sags after a year?"',
    tips: ['Explain the 10-year warranty plainly', 'Describe the replacement process', 'Confirm they feel reassured before moving on'],
  },
  {
    id: 'delivery',
    title: 'Delivery deadline',
    customer: '"I need it before I move in on the 1st. Can you promise that?"',
    tips: ['Check the actual slot before promising', 'Offer two concrete dates', 'Get a yes on one of them'],
  },
]
