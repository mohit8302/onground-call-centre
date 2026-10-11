# Development log

A factual record of how this repository got to its current state. It is based on the git history and the work sessions behind it. Times are IST on Sunday 11 Oct 2026. `git log` is the source of truth.

## Tools used

- Editor: VS Code
- AI assistance: Claude Code (Anthropic) was used for implementation, browser testing and documentation from commit `7cd0fd3` onward. Those commits carry a `Co-Authored-By: Claude` trailer.
- Reference material: the assignment PDF and the mock `NOvideo_staff_web_callcentre_v9.html`. The mock was used **only as a visual and content reference**. Colours, layout and the kinds of data were studied. Its source code was not copied: all components, styles and mock data here were written for this project.

## Timeline

### `f24f6cd`: Milestone 1, PeerJS browser audio call prototype (11:14)

- Vite + React + TypeScript scaffold. Added `peerjs`, `lucide-react` and `recharts`.
- A single `CallPanel` component with a random PeerJS ID, call by ID, accept/reject, mute, hang-up and mic error handling. Long-lived objects (`Peer`, `MediaConnection`, `MediaStream`) were in refs.

### `7cd0fd3`: App shell, eight screens, integrated calling (11:34)

- Studied the mock's CSS palette (forest-green sidebar `#123c30`, brand green `#1d9e75`, blue calendar selection, red bell, gold score ring) and its screen contents.
- Wrote `types.ts` and an original `mockData.ts` with relative dates.
- Added the `usePersistentState` hook and `AppStateProvider` (screen, calls, messages, tasks, modals).
- **Refactored `CallPanel` into `CallProvider` + `CallDock`.** The calling logic moved into a context, so any screen can start a call tagged with a lead. Added a duration timer, a ring timeout, a `finishSession` single exit path, and call logging to Recent.
- Built all eight screens, the Leads and SOP review modals, the sidebar and the top bar.
- Fixed a `react-hooks/set-state-in-effect` lint error by moving the `connecting` status out of `createPeer`.
- Added `React.lazy` per screen to clear Vite's >500 kB chunk warning. Recharts now loads only with the Dashboard.

### `b3094d8`: Reject/cancel/busy signalling and browser E2E tests (11:48)

- Drove two headless Chrome contexts with fake microphones through a real call. Connect, timer, audio, mute, hang-up and logging all worked.
- **Found:** when the callee rejected, the caller kept ringing for the full 30s (PeerJS sends no event for this). The same happened in reverse when the caller cancelled.
- **Fixed** with a short-lived PeerJS `DataConnection` that sends `reject` / `cancel` / `busy`. Measured notice time went from about 30 s to about 0.7 s.
- **Found:** closing the other tab mid-call took about 18 s to notice (ICE failure).
- **Fixed** with a `pagehide` handler that closes the call, plus a 5 s grace period on `disconnected`. Measured notice time is now under 1 s.
- Turned the ad-hoc scripts into `e2e/ui.e2e.cjs` and `e2e/calling.e2e.cjs` (`puppeteer-core` with the installed Chrome).
- Layout fixes found in screenshots:
  - the menu button showed on desktop (CSS order)
  - calendar cells were too tall
  - the CSAT axis label was clipped
  - the channel auto-scroll moved the whole page

### `9a06e19`: Phone layout polish (11:49)

- Kept the rank pill visible on phones, put the nav drawer above the call dock, and moved the toast to the top so it no longer covers the dock.

### `62b0919`: Never lose an untagged call (11:51)

- **Found in code review:** if a new call arrived while the outcome picker was still showing, the dock hid Accept/Reject, and the previous call's record could be overwritten.
- **Fixed:** `flushWrapUp()` logs any pending record before a new call starts or when the dock is closed. The dock shows the picker only when idle.

### Documentation commit

- Wrote README, ARCHITECTURE, CODE_WALKTHROUGH, CALLING_GUIDE, FEATURE_STATUS, INTERVIEW_PREP and this log.
- Checked the PeerJS 1.5.5 default ICE config in `node_modules`: Google STUN plus PeerJS public TURN. The docs were corrected to match.

### Floating call launcher

- **Asked for:** the bottom-centre pill from the reference screenshots (DEMO · In-app call · Phone call · shield).
- **Checked first:** the existing `CallDock` is the expanded phone panel. No PSTN code exists. The shield in the reference opens an "Ask before you record" consent flow, and the app had no recording or consent state.
- **Added** `src/calling/CallLauncher.tsx`. It only calls the existing `openDialer`, so there is no second Peer or audio element. The E2E test asserts exactly one `<audio>`.
- **Added** `src/components/PhoneCallModal.tsx`. It says plainly that phone-number calling isn't set up and offers the in-app call.
- **Added** `src/components/ConsentModal.tsx` and a persisted `consents` list in app state:
  - consent script in Kannada, Hindi and English
  - "Said out loud" yes/no logged with a `CNS-…` Consent ID
  - under-18 guardian flag
  - the WhatsApp path is visible but disabled, with an explanation
- The shield turns green only when a "yes" is on record for the current call target.
- **Layout:**
  - added a `--launcher-space` token
  - the expanded dock, the channel composer and the page padding now sit above the pill
  - the pill centres on the content column when the sidebar is visible, and respects safe-area insets (`viewport-fit=cover`)
- **Layering:** content < launcher (140) < dock (150) < drawer (170) < modals (200) < toast (300).
- **E2E:**
  - the UI suite checks that the pill is on-screen for every screen at 1280/390/360px, and covers its three actions
  - the calling suite opens one agent's phone from the launcher, checks that the launcher shows Incoming and the timer, and checks the consent shield's green state

### Shield → DPDP explainer; consent moves in front of calls

- **Feedback:** the shield should open "How this app keeps you DPDP-safe", not the consent step. The consent step belongs to the In-app call and Phone call buttons.
- **Added** `src/components/DpdpModal.tsx`: the five rules with their DPDP Act 2023 sections.
  - The reference's wording claimed automatic recording stops, a DPO request flow and a tamper-proof log. None of these exist here.
  - So each rule carries an "In this app" line saying what is built, and rules 3 and 4 are marked "Not built yet".
  - The subtitle was changed to "Five rules for every call."
- **In-app call** now opens the consent step ("Call centre · name"), and **Open in-app call** then opens the dock with the chosen lead as the target.
- **Phone call** opens the consent step ("Phone call · name"), and **Dial phone number** then shows the not-configured notice.
- During an active call, ringing call or pending wrap-up, In-app call goes straight to the dock.
- The shield no longer changes colour.
- E2E updated: 15/15 UI steps and 14/14 calling steps pass.

### Dashboard and colour bands matched to the mock

- Navy KPI hero (full width, trend pills), the green My Progress card, the brown My Tasks card with three summary rows that expand to the individual tasks, full-width bar charts with values, and "Who's waiting" and chart labels outside the cards.
- Navy "Today's calling plan / Planner" band on the Plan screens; purple Pulse header, AvaniBot card, channel header and Leads modal header.
- E2E task steps updated for the new My Tasks card.

### AI voice calling

- **Request from the reviewer:** demo calling end to end with no mocks, ideally human to human and AI to human.
- Human to human was already real (PeerJS/WebRTC). Added **AI to human**:
  - `api/ai-call.ts` (Vercel Function, mounted in dev/preview by `vite.config.ts`) holds the key and returns the next spoken line or a JSON summary.
  - `aiVoice.ts` (browser speech in and out) and `AiCallModal.tsx` (turn-taking, transcript, summary, logging).
  - Two modes: the AI calls you as an agent (launcher → AI call, after consent), or the AI plays the customer (Practise a call).
- First built on Claude; switched to the **Gemini API free tier** so the demo costs nothing.
- New E2E step stubs the server reply and checks consent → conversation → summary → Recent. 16/16 UI steps and 14/14 calling steps pass.

## Test runs recorded during development

- `npm run lint`: 0 problems
- `npm run build`: passes, no chunk warnings
- `npm run test:e2e`: 12/12 UI steps and 13/13 calling steps passed on the last run before the documentation commit
- After the launcher: 15/15 UI steps and 14/14 calling steps passed
- After the AI call: 16/16 UI steps and 14/14 calling steps passed

## Things deliberately left out

- URL routing
- Unit tests
- A self-hosted signalling server

These are listed with reasons in [FEATURE_STATUS.md](FEATURE_STATUS.md).
