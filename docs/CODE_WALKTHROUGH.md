# Code walkthrough

A suggested reading order for someone new to the codebase. Paths are relative to the repo root.

## 1. Entry and shell: `src/main.tsx`, `src/App.tsx`

- `main.tsx` renders `<App />` inside `StrictMode`. StrictMode mounts effects twice in development. That is a useful test that the PeerJS setup cleans up after itself (`peer.destroy()` in the effect cleanup).
- `App.tsx` wraps everything in `AppStateProvider`, then `Shell`. `Shell` puts `CallProvider` around the layout and passes it `onCallLogged`, which adds the record to Recent and shows a toast.
- `SCREENS` maps each `ScreenId` to a `React.lazy` import. `<Suspense>` covers the short chunk load. That is how Recharts ends up only in the Dashboard chunk.

## 2. Types and data: `src/types.ts`, `src/data/mockData.ts`

- `types.ts` is the contract. `Lead` has three different scores, each with its own job:
  - `attractiveness` ranks Calls to make
  - `intent` feeds the Incoming expected value
  - `icp` shows customer fit
- `CallRecord.source` separates `'demo'` rows from `'live'` (real) calls, so the UI can label them honestly.
- `mockData.ts` holds all demo content, written for this project. Dates are relative to today (`hoursAgo`, `dateFromToday`), so the calendar and Recent never look stale.

## 3. State: `src/lib/usePersistentState.ts`, `src/state/*`

- `usePersistentState(key, initial)` works like `useState`, but reads from localStorage on first render and writes back in an effect. Every storage access is in `try/catch` (private mode, quota), so the app still works in memory.
- `state/appContext.ts` holds only the context and the `useAppState()` hook. The provider is in its own file so React Fast Refresh keeps working.
- `AppStateProvider.tsx`:
  - `messagesFor(channelId)` returns the seed messages plus the user's sent messages. Only the user's messages are stored.
  - `answerNeedsInput` records the answer **and** posts it into the chat, so the pinned card and the thread stay in sync.
  - `resetDemo` clears every `og-callcentre:*` key and resets each piece of state.
  - Everything is wrapped in `useCallback`/`useMemo`, so the context value only changes when its data does.

## 4. Calling: `src/calling/*` (the most important part)

Read `callContext.ts` first. It is the public API: `CallStatus`, `CallTarget` (label, leadId, peerId, purpose), and the `CallApi` that screens use.

Then read `CallProvider.tsx` from top to bottom:

1. **Constants and helpers** (top of file): ring timeout, disconnect grace period, `makePeerId`, and `micErrorMessage`, which maps `DOMException` names to plain-language messages.
2. **`EndReason` and `OUTCOME_BY_REASON`**: one table decides the outcome text for every way a call can end without connecting, by direction. This replaced a nested ternary.
3. **`Session`**: everything about the call in progress, held in `sessionRef`. Listeners read it directly instead of from stale state.
4. **`flushWrapUp`**: if a previous connected call is still waiting for an outcome when a new call starts, it is logged as-is, so no call is lost.
5. **`sendControl`**: the one-off DataConnection for `reject`/`cancel`/`busy`.
6. **`finishSession(reason)`**: the only way a call ends. Note the first lines:
   ```ts
   const session = sessionRef.current
   if (!session) return
   sessionRef.current = null
   ```
   That makes it idempotent. `close`, `error`, the ICE state change and the user's button can all fire for the same call, and only the first one counts.
7. **`attachCallEvents(call)`**: `stream` sets `connectedAt`, plays the audio and watches `connectionState`. `close`/`error` call `finishSession`. Every handler first checks `sessionRef.current?.call === call`, so events from an older call are ignored.
8. **`createPeer`**: registers the PeerJS handlers:
   - `open`: becomes Ready
   - `call`: incoming, or `busy` if already on a call
   - `connection`: control messages
   - `disconnected` / `error`: shows the error and goes Offline where needed
9. **The mount effect**: creates the peer, adds the `pagehide` handler, and cleans up (closes the call, stops tracks, destroys the peer).
10. **Actions**: `startCall`, `acceptCall`, `rejectCall`, `hangUp`, `toggleMute`, `reconnect`, `finishWrapUp`, `openDialer`, `closeDock`. They are memoised and exposed through `useMemo`.
11. The hidden `<audio>` element is rendered by the provider, not by the dock. So remote audio keeps playing when the dock re-renders or the user changes screens.

`CallDock.tsx` only displays state. It renders one block per status, plus the wrap-up picker and the error banner. `DialForm` is keyed by the call target, so "Call back" on a live missed call prefills the peer ID, and a new target resets the input.

## 5. Shell components: `src/components/*`

- `Sidebar.tsx`: nav items plus Plan sub-items. `Plan` is highlighted when any sub-screen is active.
- `TopBar.tsx`: the phone chip shows the live state (`Calling…`, `Incoming…`, or the `mm:ss` timer). Also the bell dropdown (each item navigates), the SVG `ScoreRing`, the rank pill, and the profile menu with Reset.
- `ui.tsx`: `Avatar`, `ScorePill` (colour comes from `scoreTone`), `ProgressBar`, `ScoreRing`, `SectionHeader`, and `Modal`. `Modal` focuses itself, closes on Escape or backdrop click, locks body scroll, and gives focus back on close. It keeps `onClose` in a ref, so its setup effect runs once per open, not on every render.
- `LeadsModal.tsx`: wraps paging around `LEADS`. The `key={lead.id}` wrapper resets the collapsibles when you move to the next lead.
- `SopReviewModal.tsx`: shows the checklist for demo calls. For live calls it says plainly that nothing was recorded.

## 6. Screens: `src/screens/*`

| File | Thing to notice |
| --- | --- |
| `Dashboard.tsx` | "Leads called" adds today's live calls to the demo baseline. Charts use `ResponsiveContainer`. |
| `CallsToMake.tsx` | `RANKED` is sorted once at module level. Pagination is plain slicing. The row header is a `<button aria-expanded>`. |
| `Incoming.tsx` | `isCalledBack()`: a missed call disappears once a later **connected** call exists for the same lead (or peer). Expected value = `price × intent / 100`. |
| `Recent.tsx` | Filter chips, a `live` tag for real calls, and the SOP pill or "No SOP". |
| `CalendarScreen.tsx` | Dates are `YYYY-MM-DD` strings, so comparing and sorting is plain string comparison. Clicking an upcoming item jumps to its month and day. |
| `PulseHome.tsx` | The daily brief is computed from local state and labelled "No AI model was called". |
| `PulseChannel.tsx` | The chat auto-scrolls its own container (`scrollTop`), not the page. |
| `Practise.tsx` | `useMicLevel()`: real `getUserMedia` → `AnalyserNode` → RMS level, drawn on each `requestAnimationFrame`. The cleanup stops the tracks and closes the `AudioContext`. |

## 7. Tests: `e2e/*`

- `helpers.cjs`:
  - starts `vite preview` on a free port
  - launches the local Chrome with `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`
  - wraps `RTCPeerConnection` so tests can read real WebRTC stats
  - includes a small step runner
- `ui.e2e.cjs`: every screen at three widths, plus interactions and persistence.
- `calling.e2e.cjs`: real calls between three isolated browser contexts.

## Conventions

- Business logic lives in providers. Screens derive what they need and call actions.
- `aria-*` on interactive elements (expanded, pressed, labels for icon buttons). `:focus-visible` outlines. `prefers-reduced-motion` turns animations off.
- Comments explain *why* (PeerJS quirks, StrictMode, persistence choices), not *what*.
