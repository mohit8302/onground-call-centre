# Interview prep

Likely questions about this project, with answers grounded in the actual code. File references point to where each answer can be shown live.

## Architecture

**Walk me through the app's structure.**
There are two providers. `AppStateProvider` owns the UI and demo state, persisted to localStorage. `CallProvider` owns everything WebRTC. Screens are lazy-loaded and picked by a `screen` value in state. Screens never touch PeerJS. They call `useCall().openDialer({ label, leadId, purpose })`. `CallProvider` reports finished calls through an `onCallLogged` callback that `Shell` connects to `addCall`. See `src/App.tsx` and [ARCHITECTURE.md](ARCHITECTURE.md).

**Why no React Router / Redux?**
Eight screens, no deep-link requirement, and small state with one clear owner per concern. A router would add a dependency for a URL nobody shares. I'd add one first if screens needed shareable links or the back button. The trade-off is listed in ARCHITECTURE → Decisions.

**How does persistence work, and what happens if the stored data shape changes?**
`usePersistentState` (`src/lib/usePersistentState.ts`) mirrors state to `localStorage` under keys like `og-callcentre:v1:calls`. Only user-created data is stored: seed data stays in `mockData.ts`. If the shape changes, I bump `STATE_VERSION`, old keys are ignored, and no migration code is needed. Storage failures are caught, and the app keeps working in memory.

**Why are "missed calls not returned" and "leads called" not stored?**
They are derived from `recentCalls`. Storing them would let them drift out of sync. Because they are derived, a real call immediately updates Incoming, the Dashboard and the Leads modal. See `isCalledBack()` in `src/screens/Incoming.tsx`.

## Calling / WebRTC

**Explain what happens when I click "Place call".**
1. `openDialer` stores the lead as the call target and opens the dock.
2. `startCall` gets the mic with `getUserMedia`, calls `peer.call(id, stream)`, saves a `Session` in a ref and starts a 30 s ring timer.
3. PeerJS exchanges the SDP offer/answer and ICE candidates through its signalling server.
4. When the callee answers, both sides get a `stream` event. We play it, set `connectedAt`, and the timer starts.
5. On hang-up, `finishSession` stops the tracks, closes the call and builds a `CallRecord` with the lead ID and the measured duration.

**What does PeerJS do for you, and what does it not do?**
It handles the signalling server, the SDP/ICE exchange and default STUN/TURN config. It does *not* tell the caller when the callee rejects an unanswered call, or tell the callee when the caller cancels. My E2E test caught this: the caller kept ringing for 30 s. I added a one-off `DataConnection` carrying `reject` / `cancel` / `busy` (`sendControl` in `CallProvider.tsx`). Notice time went from about 30 s to about 0.7 s.

**Why refs instead of state for the Peer and the call?**
PeerJS listeners are registered once. If they read React state, they would see the value from when they were created (stale closure). Refs always hold the current value, and changing them doesn't trigger a render. State is used only for what the UI shows: status, error, timer, mute.

**How do you make sure a call is cleaned up exactly once?**
`finishSession` reads `sessionRef.current`, returns if it is null, then sets it to null before doing anything else. `close`, `error`, the ICE `failed` state and the user's button can all fire for the same call. Only the first one does anything. Every listener also checks `sessionRef.current?.call === call`, to ignore events from an older call.

**How do you know audio really flows, not just that the UI says "In call"?**
The calling E2E test wraps `RTCPeerConnection` and reads `getStats()`. It asserts `inbound-rtp` audio `bytesReceived > 0` on both sides. It also checks that no sender track is still `live` after hang-up, which shows the mic was released. To be honest: I verified packets flow with Chrome's fake microphone. Listening with real microphones is a manual step (CALLING_GUIDE).

**How does mute work?**
It sets `track.enabled = false` on the local audio tracks. The connection stays up and the other side gets silence. There is no renegotiation. Stopping the track instead would end the stream.

**What if the other person closes their tab?**
A `pagehide` handler closes the call and destroys the peer, so the other side gets `close` within about a second. If the network drops instead, we watch `connectionState`. `failed` ends the call. `disconnected` gets a 5 s grace period, because it can recover.

**Why does the ID change on every reload?**
After a disconnect, the PeerJS server keeps an ID reserved for a while. Reusing it right after a refresh fails with `unavailable-id`. In production, IDs would come from the backend and map to staff and lead records.

**What would you change for production?**
- Self-host PeerServer and a TURN server (coturn), and pass them in `new Peer(id, { host, config: { iceServers } })`.
- Authenticate peers: today anyone with an ID can call it.
- Connect PSTN through a telephony provider for real customer numbers.
- Record and transcribe calls server-side for SOP scoring.
- Add monitoring: call setup time, ICE failure rate.

**Why not AI voice calling?**
It was optional. Doing it properly needs a speech-to-text, LLM and text-to-speech pipeline with API keys, and those must live on a server. A browser-only version would either leak keys or be fake. I put the core assignment and real calling first.

## React specifics

**StrictMode mounts effects twice. Did that cause problems?**
It is a useful check. The Peer effect's cleanup destroys the first peer, and a fresh one is created. If cleanup were missing, we would leak a registered peer. ESLint's `react-hooks/set-state-in-effect` also flagged a `setStatus` call made directly in the effect body. I moved it out.

**Why is the modal's `onClose` stored in a ref?**
Callers pass inline arrow functions. If `onClose` were an effect dependency, the effect would run on every render, steal focus back to the dialog and re-lock scrolling. With a ref, the effect runs once per open (`src/components/ui.tsx`).

**Why `key={lead.id}` in the Leads modal and `key` on `DialForm`?**
A changing key remounts the component, which resets local state. Collapsibles close when you move to the next lead, and the dial input is prefilled with the new target's peer ID.

**How did you handle bundle size?**
`React.lazy` per screen. Recharts (about 380 kB minified) is only in the Dashboard chunk, and Vite's >500 kB warning is gone.

## Product / UX

**What does the Phone call button do?**
It opens a dialog saying phone-number calling isn't set up, and offers the working in-app call. PSTN needs a telephony provider. A button that pretends to dial would be worse than one that says it can't. To add it later, replace the body of `PhoneCallModal`; the launcher doesn't change.

**What is the shield for?**
Recording consent. The agent reads a short script (Kannada / Hindi / English) and logs the customer's spoken yes or no. That gives a Consent ID. The shield turns green only when a yes exists for the person on the current call. The app doesn't record calls yet, and the WhatsApp request is disabled because nothing is connected. The consent workflow is ready for when recording is added.

**How is "Calls to make" ranked, and how is "Incoming" ranked?**
Calls to make uses the lead's `attractiveness` score. Incoming uses expected value = `price × intent / 100`. A missed call from a high-value, high-intent lead comes first. Unknown callers show "New contact" with no value.

**What happens to a call if the agent doesn't pick an outcome?**
It is still logged. Closing the dock, or starting or receiving another call, flushes the pending record with outcome "Connected" (`flushWrapUp`). A review caught that the original version could lose it.

**Accessibility?**
- Icon buttons have `aria-label`s.
- Expandable rows use `aria-expanded`, and toggles use `aria-pressed`.
- The modal has `role="dialog"`, `aria-modal`, Escape to close and focus return.
- Toasts and call status use `aria-live`.
- `:focus-visible` outlines, and `prefers-reduced-motion` turns animations off.

## Honest gaps (say these before they're asked)

- No unit tests. Coverage is browser E2E (29 steps).
- Tested in Chrome only. Phone layouts were checked by viewport emulation, not on real phones.
- The `offline` → Reconnect path and mic-permission-denied messages are in the code but not exercised by automated tests.
- SOP scores, AvaniBot and agents are demo content.
