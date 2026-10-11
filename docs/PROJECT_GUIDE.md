# Project guide

A one-page overview of the On-Ground.ai Call Centre rebuild. The other files in `docs/` go deeper on each topic.

## 1. What the project is

A staff web app for call-centre agents, rebuilt from the provided HTML mock in **React 19 + TypeScript + Vite**. An agent can:

- see their day: KPIs, progress, earnings, tasks and charts;
- work their calls: ranked leads to call, missed calls to return, and recent calls with SOP scores;
- check the calendar, chat with the team in Pulse, and review leads;
- make **real browser-to-browser audio calls** (WebRTC through PeerJS), with a recording-consent step before each call.

There is no backend. Demo data comes from `src/data/mockData.ts`. Anything the user creates (messages, answers, ticked tasks, the call log, consent answers) is saved in `localStorage`.

**Stack:** React, TypeScript, Vite, Recharts (charts), Lucide (icons), PeerJS (calling), plain CSS. Tests use `puppeteer-core` driving the Chrome already installed on the machine.

## 2. Architecture

```
App
└── AppStateProvider     screen, call log, messages, tasks, consents, modals (saved to localStorage)
    └── Shell
        └── CallProvider  PeerJS peer, microphone, call state machine (not saved)
            ├── Sidebar / TopBar
            ├── <Screen />          one of 8 lazy-loaded screens
            ├── CallDock            the phone panel
            ├── CallLauncher        bottom bar: DEMO · In-app call · Phone call · shield
            └── modals              Leads, SOP review, Consent, DPDP, Phone call
```

Key decisions:

| Decision | Why |
| --- | --- |
| Two contexts (app state, calling) | Each concern has one owner. Screens never touch PeerJS. They call `useCall().openDialer(...)`. |
| No router | Only 8 screens and no shareable links needed. The current screen is state, so it survives a reload. |
| Seed data kept apart from user data | Only user changes are saved. Storage keys are versioned (`og-callcentre:v1:*`). |
| Derived values instead of stored ones | Values like "missed and not returned" are computed from the call log, so they can't go stale. |
| `React.lazy` per screen | Recharts only loads with the Dashboard. |

## 3. Code walkthrough

| Path | What's in it |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Entry point. Sets up providers, the shell and lazy screens, and wires `onCallLogged` to `addCall`. |
| `src/state/` | `appContext.ts` (typed API and hook), `AppStateProvider.tsx` (implementation) |
| `src/lib/usePersistentState.ts` | `useState` that mirrors to localStorage. Survives storage errors. |
| `src/lib/format.ts` | Formatting for times, durations and money |
| `src/data/mockData.ts` | Leads, KPIs, channels, calendar events, notifications |
| `src/types.ts` | Shared types (`Lead`, `CallRecord`, `Consent`, …) |
| `src/screens/` | Dashboard, CallsToMake, Incoming, Recent, CalendarScreen, PulseHome, PulseChannel, Practise |
| `src/components/` | Sidebar, TopBar, LeadsModal, SopReviewModal, ConsentModal, DpdpModal, PhoneCallModal, `ui.tsx` (Modal, pills, progress bars) |
| `src/calling/` | `callContext.ts` (API), `CallProvider.tsx` (all WebRTC logic), `CallDock.tsx` (phone UI), `CallLauncher.tsx` (bottom bar) |
| `e2e/` | `ui.e2e.cjs` (screens), `calling.e2e.cjs` (real calls), `helpers.cjs` |

## 4. Calling guide

**How a call works:**
1. Each tab registers with the PeerJS cloud server under a random ID like `onground-k3x9qa`.
2. **Dial:** ask for the mic, then `peer.call(id, stream)`. The caller rings for up to 30 s.
3. **Ring:** the other tab shows Accept or Reject. If it is already on a call, it answers "busy" automatically.
4. **Answer:** both sides receive the remote audio stream, and the timer starts.
5. **End:** every way a call can end goes through one `finishSession()`. It runs once per call, stops the mic and builds a `CallRecord`.
6. **Log:** the agent picks an outcome, and the call appears in Recent with its measured duration.

**Extras:**
- **Reject, cancel and busy reach the other side in about 1 s.** PeerJS has no event for these, so a short `DataConnection` sends the message.
- **Closing the tab ends the call.** The other side hears about it through a `pagehide` handler.
- **Network drops:** a `failed` connection ends the call. A `disconnected` one gets 5 s to recover.
- **Mute** flips `track.enabled`, so nothing is renegotiated.

**Before each call:** In-app call and Phone call both open **Ask before you record**:
- a script in Kannada, Hindi or English;
- the spoken yes or no is logged with a `CNS-…` ID;
- an Under 18 switch.

The shield opens the five DPDP rules, and each rule says honestly whether this app does it yet.

**Try it:** run `npm run dev` and open two windows.
1. In window B, click **Phone** and copy the ID.
2. In window A, go to **Plan → Calls to make → Place call**, paste the ID and click **Call**.
3. In window B, click **Accept**.

The mic only works on `localhost` or HTTPS. See [CALLING_GUIDE.md](CALLING_GUIDE.md) for errors and limits.

## 5. Features

| Area | Status |
| --- | --- |
| Shell: sidebar with Plan sub-items, top bar (bell, OG Score 76 #3, avatar menu) | Done |
| Dashboard: 4 KPIs, My progress, earnings, My Tasks, who's waiting, calls and CSAT charts | Done |
| Calls to make: ranked, 2 per page, expandable rows, Place call | Done |
| Incoming: ranked by expected value (price × intent), Call back | Done |
| Recent: opens the SOP review | Done |
| Calendar: month grid, day list, upcoming | Done |
| Pulse: AvaniBot, agents, channels, Kudos, DMs, working chat, Needs-your-input answers | Done (demo content) |
| Leads modal: ICP and intent scores, collapsible sections, pager, cumulative missed | Done |
| Practise a call: checklist, mic level meter, practice call | Done |
| Real audio calling with lead linking and outcomes | Done |
| Consent step and DPDP explainer | Done; sending the consent request on WhatsApp is not connected |
| Phone (PSTN) call | Not possible without a telephony provider. The app says so and offers an in-app call. |
| Recording, transcription, AI call assist, AI voice calls | Not built. These need a server and API keys. |
| Responsive down to 360 px | Done |

The full table is in [FEATURE_STATUS.md](FEATURE_STATUS.md).

## 6. How to test

```bash
npm install
npm run lint          # ESLint
npm run build         # type-check + production build
npm run test:ui       # every screen and interaction, in headless Chrome
npm run test:calling  # real calls between 3 browser contexts (needs internet)
npm run test:e2e      # build, then both suites
```

- **What the calling test proves:** that audio really flows. It reads `getStats()` and checks that inbound audio bytes are above 0 on both sides, and that no mic track is still live after hang-up.
- **What is not automated:** listening on real microphones, mic-permission-denied messages, and the offline → Reconnect path. All of these are manual checks.
- **Requirements:** Chrome or Edge must be installed. Set `CHROME_PATH` if it isn't found.

## 7. Interview questions (short answers)

**Why PeerJS rather than raw WebRTC?**
It provides signalling and ICE config, so the time went into call handling. The cost is relying on a public, best-effort server. In production I would self-host PeerServer and TURN.

**Why refs for the Peer and the call?**
PeerJS listeners are registered once. If they read React state they would see stale values. Refs always hold the current value and don't cause re-renders.

**How do you make sure a call is cleaned up only once?**
`finishSession` checks `sessionRef.current` and sets it to null before doing anything else. Later events for the same call do nothing.

**How do you know audio flows, and not just that the UI says "In call"?**
The E2E test reads `RTCPeerConnection.getStats()` and checks `bytesReceived > 0` on both sides.

**Why are values like "missed and not returned" not stored?**
They are derived from the call log, so a new call updates every screen immediately and nothing can drift out of sync.

**What happens if the stored data shape changes?**
I bump `STATE_VERSION`. Old keys are ignored, so no migration code is needed.

**Why does Phone call not dial?**
Dialling a real number needs a telephony provider such as Twilio or Exotel. A button that pretends to dial would be worse than one that says it can't.

**What would you change for production?**
- A backend with auth that issues the call IDs.
- Self-hosted PeerServer and TURN.
- PSTN through a provider.
- Server-side recording and transcription for SOP scoring.
- Call-quality monitoring.

**Honest gaps:**
- No unit tests; the coverage is browser E2E only.
- Tested in Chrome only.
- Phone layouts were checked by emulation, not on real phones.
- SOP scores and AvaniBot are demo content.

More answers are in [INTERVIEW_PREP.md](INTERVIEW_PREP.md).
