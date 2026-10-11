# Architecture

## Overview

```
main.tsx
└── App
    └── AppStateProvider          state/AppStateProvider.tsx: screen, calls, messages, tasks, modals (persisted)
        └── Shell
            └── CallProvider      calling/CallProvider.tsx: owns the PeerJS Peer, mic stream, call session
                ├── Sidebar / TopBar
                ├── <Screen />    one of 8 lazy-loaded screens, chosen by `screen` state
                ├── CallDock      floating phone UI (reads the call API only)
                ├── LeadsModal / SopReviewModal
                └── <audio>       remote voice, always mounted
```

There are two React contexts. Each has a small typed API:

| Context | File | Owns | Persists? |
| --- | --- | --- | --- |
| `AppStateContext` | `state/appContext.ts` (API), `state/AppStateProvider.tsx` (impl) | current screen, active channel, recent calls, sent messages, needs-input answers, completed tasks, which modal is open, toast | Yes, via `usePersistentState` (except modals and toast) |
| `CallContext` | `calling/callContext.ts` (API), `calling/CallProvider.tsx` (impl) | PeerJS connection, call status, timer, mute, dialer target, pending wrap-up | No. Live connections can't be restored after a reload. |

Screens never talk to PeerJS directly. They call `useCall().openDialer({ label, leadId, purpose })`, and `CallProvider` reports finished calls back through its `onCallLogged` prop. `Shell` wires that prop to `addCall` in the app state. So the calling module doesn't know about the app state, and the app state doesn't know about PeerJS.

## Data flow

```
mockData.ts ─────────────► screens (read-only demo data: leads, KPIs, channels, events)
                              │
usePersistentState ◄──► AppStateProvider ◄── user actions (send message, tick task, log call)
   (localStorage)             │
                              ▼
                       derived values in screens
                       e.g. Incoming = missed calls − ones later returned, sorted by price × intent
```

- **Seed data vs user data.** Demo data stays in `mockData.ts` and is never written to storage. Only what the user creates is stored: sent messages, answers, completed tasks, and the call log, which starts as a copy of the demo calls. So editing the mock data never conflicts with stored state.
- **Versioned keys.** Keys look like `og-callcentre:v1:calls`. Changing `STATE_VERSION` drops old shapes without migration code.
- **Derived, not duplicated.** Nothing stores "missed calls not returned", "leads called today" or "cumulative missed". Screens compute them from `recentCalls`, so a real call immediately updates Incoming, the Dashboard counter and the Leads modal.

## Calling module

`CallProvider` is a state machine:

```
connecting ──open──► ready ──startCall──► calling ──remote stream──► in-call
                       ▲  ◄──peer 'call'── ringing ──accept──────────┘   │
                       │                                                  │
                       └──────── finishSession(reason) ◄──────────────────┘
offline ◄── signalling lost / network error ── reconnect() ──► connecting
```

- **Refs for long-lived objects.** The `Peer`, the current `Session` (call, direction, target, timestamps), the local `MediaStream` and timers are kept in refs. PeerJS event listeners are registered once, so they must read current values without re-subscribing.
- **One exit path.** Every ending goes through `finishSession(reason)`: hang-up, remote close, reject, timeout, ICE failure, tab close, errors. It runs once per session because it clears `sessionRef` first. It stops the mic tracks, detaches audio, signals the other side if needed, and builds a `CallRecord`.
- **Control messages.** PeerJS doesn't tell the caller when an unanswered call is rejected, or tell the callee when the caller gives up. We send `{type: 'reject' | 'cancel' | 'busy'}` over a short-lived PeerJS `DataConnection`. The ring timeouts (30s caller, 35s callee) are the fallback.
- **Wrap-up.** A connected call doesn't go straight to the log. It becomes a `PendingWrapUp` so the agent can tag an outcome. If anything else happens first (a new call, closing the dock), the pending record is logged as-is, so a call is never lost.

[CALLING_GUIDE.md](CALLING_GUIDE.md) describes the protocol in more detail.

## Styling

- `index.css` holds design tokens (`--green`, `--forest`, `--red`, …), the reset and focus styles. `App.css` holds component classes grouped by screen.
- The palette and component shapes follow the mock: dark-green sidebar, rounded cards, coloured nav chips, blue calendar selection, the red notification bell and the gold score ring.
- Responsive breakpoints: 1024px (4 KPI columns become 2, calendar and practise stack), 860px (sidebar becomes a drawer, single column), 600px (compact rows, hidden labels). E2E tests check 1280, 390 and 360px for horizontal overflow.

## Decisions

| Decision | Why | Trade-off |
| --- | --- | --- |
| No router: `screen` is state | 8 screens, no deep links required; the current screen survives reload through localStorage | No URL per screen, and the back button doesn't navigate |
| Context + hooks, no Redux/Zustand | State is small and has one owner per concern | Every consumer re-renders on any app-state change. Fine at this size. |
| PeerJS instead of raw WebRTC | Signalling server and ICE config come free, so the work goes into call UX | Depends on a public, best-effort server |
| `React.lazy` per screen | Recharts (~380 kB) loads only with the Dashboard; build has no chunk warnings | ~100–300 ms first visit to each screen |
| Plain CSS | The mock is plain CSS; no extra build tooling | Class names are global, so they are kept specific |
| E2E with `puppeteer-core` + system Chrome | Exercises real WebRTC with fake mic devices; no browser download | Needs Chrome/Edge installed; calling test needs internet |
