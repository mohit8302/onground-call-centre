# On-Ground.ai · Call Centre (staff web app)

This is a rebuild of the On-Ground.ai call-centre staff app in React, TypeScript and Vite. It has eight screens that follow the provided mock and run on local demo data. It also has **real browser-to-browser audio calling** over WebRTC, using PeerJS for signalling.

There is no backend. Everything you change in the demo is kept in `localStorage`: messages you send, tasks you tick, calls you make and outcomes you log.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks (`tsc -b`) and builds to `dist/` |
| `npm run preview` | Serves the production build |
| `npm run lint` | ESLint (TypeScript + React hooks rules) |
| `npm run typecheck` | TypeScript only |
| `npm run test:ui` | Browser E2E: every screen and interaction (needs a build first) |
| `npm run test:calling` | Browser E2E: real PeerJS calls between 3 browser contexts (needs internet) |
| `npm run test:e2e` | Build, then both E2E suites |

The E2E scripts use `puppeteer-core` with the Chrome or Edge already installed on the machine. Set `CHROME_PATH` if it is in a non-standard location.

## Try a real call in 30 seconds

1. Run `npm run dev` and open http://localhost:5173 in **two** browser windows (or two devices on the same network, using HTTPS).
2. In window B, click **Phone** in the top bar and copy **Your ID**.
3. In window A, go to **Plan → Calls to make**, expand a lead and click **Place call**. Paste B's ID and click **Call**.
4. Allow the microphone in both windows, then **Accept** in B. You now have a two-way audio call. The timer, Mute and Hang up all work.
5. When you hang up, pick an outcome. The call appears in **Recent**, tagged to the lead, with its real duration.

See [docs/CALLING_GUIDE.md](docs/CALLING_GUIDE.md) for details, troubleshooting and limitations.

## Screens

| Screen | Where | Highlights |
| --- | --- | --- |
| Dashboard | Sidebar → Dashboard | KPI cards, progress, My Tasks (opens the Leads modal), earnings, who's waiting, 7-day calls and CSAT charts (Recharts) |
| Calls to make | Plan → Calls to make | Leads ranked by attractiveness score; expandable rows (story, product, cross-sell, EMI); **Place call**; two per page |
| Incoming | Plan → Incoming | Missed calls not yet returned, ranked by expected value (price × intent); **Call back** |
| Recent | Plan → Recent | Type, time, duration, outcome and SOP score; filter chips; click a row for the **SOP review** modal |
| Practise a call | Plan → Practise a call | Objection scenarios with a checklist, a real mic-level check, and a practice call to a teammate |
| Calendar | Sidebar → Calendar | Month grid with event dots, previous/next month, **Today**, day selection, upcoming list |
| Pulse | Sidebar → Pulse | AvaniBot hero with daily brief, agents (custom/role/task), channels, kudos, DMs |
| Pulse channel | Pulse → a channel | Back button, header, pinned **Needs your input** card (options or typed reply), chat bubbles, working composer |
| Leads modal | Dashboard → a task / "All leads" | Lead card, ICP and intent scores, collapsible ICP breakdown / journey / buying signals, prev/next, cumulative missed |

Shell: dark-green sidebar with Plan sub-items. The top bar has the OG logo, live phone status, a notification bell with dropdown, an OG Score ring (76) with rank #3, and a profile menu with **Reset demo data**. Under 860px the sidebar becomes a slide-in drawer.

**Call launcher.** A floating pill at the bottom centre of every screen. It has four parts:
- **DEMO:** a status badge, not a button.
- **In-app call:** opens the browser phone. During a call it shows the live state or timer.
- **Phone call:** explains that phone-number calling isn't set up and offers an in-app call instead. It never dials anything.
- **Shield:** the "Ask before you record" consent dialog. It has the script in ಕನ್ನಡ / हिन्दी / English. A "said out loud" answer is logged with a Consent ID. The shield turns green only when the current call's customer has said yes.

## Tech

- React 19, TypeScript, Vite 8
- PeerJS 1.5 on top of WebRTC, for calls
- Recharts, for the dashboard charts
- Lucide React, for icons
- Plain CSS with custom properties (`src/index.css` tokens, `src/App.css` components)
- No router or state library: screen state lives in a small context ([why](docs/ARCHITECTURE.md#decisions))

## Project layout

```
src/
  App.tsx                 shell + lazy-loaded screens
  types.ts                domain types (Lead, CallRecord, Channel, ...)
  data/mockData.ts        all demo data (written for this project)
  state/                  app state context + localStorage persistence
  calling/                PeerJS provider, call API types, floating call dock
  components/             sidebar, top bar, modals, small UI primitives
  screens/                one file per screen
  lib/                    formatting helpers, usePersistentState
e2e/                      puppeteer-core browser tests
docs/                     architecture, walkthrough, calling guide, status
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit together and why
- [docs/CODE_WALKTHROUGH.md](docs/CODE_WALKTHROUGH.md): a guided read through the code
- [docs/CALLING_GUIDE.md](docs/CALLING_GUIDE.md): how calling works, how to test it, its limits
- [docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md): what is done, what is partial, and how each part was verified
- [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md): how the project was built, commit by commit
- [docs/INTERVIEW_PREP.md](docs/INTERVIEW_PREP.md): likely questions and honest answers

## Known limitations

- Calls use PeerJS's defaults: the free public signalling server (`0.peerjs.com`), Google STUN, and PeerJS's free public TURN relays. These are best-effort shared services with no uptime guarantee, and some strict networks may still block calls. See [CALLING_GUIDE](docs/CALLING_GUIDE.md#limitations).
- The "customer" in a call is another browser running this app. There is no phone-network (PSTN) dialling: the **Phone call** button says so instead of pretending.
- Recording consent is logged in the browser only. The WhatsApp consent request is shown but disabled, because WhatsApp Business isn't connected. Calls are not recorded either way. The Kannada and Hindi consent scripts should be checked by native speakers.
- SOP scores, AvaniBot and agents are demo content. No AI model is called anywhere. The daily brief is computed from local data and says so.
- Live calls are not recorded or transcribed, so they have no SOP checklist.
