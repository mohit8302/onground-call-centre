# Calling guide

The app places **real two-way audio calls between browsers**. Nothing is simulated: the timer only starts when the other side's audio stream arrives, and the logged duration is measured, not invented.

## How it works

| Layer | What we use | Notes |
| --- | --- | --- |
| Identity | A random PeerJS ID like `onground-k3x9qa`, generated on each page load | Shown and copyable in the phone dock |
| Signalling | PeerJS cloud server `0.peerjs.com` (library default) | Exchanges SDP offers/answers and ICE candidates over a WebSocket |
| NAT traversal | PeerJS defaults: Google STUN plus PeerJS's public TURN relays | No credentials of ours are involved |
| Media | WebRTC `RTCPeerConnection`, audio only (`getUserMedia({ audio: true, video: false })`) | Encrypted (DTLS-SRTP), peer-to-peer when possible |
| Call control | PeerJS `MediaConnection` plus a short-lived `DataConnection` for reject/cancel/busy | See below |

### Lifecycle

1. **Register.** On mount, `CallProvider` creates `new Peer(id)`. On `open`, the status becomes **Ready**.
2. **Dial.** `startCall(peerId)` asks for the microphone, then `peer.call(peerId, stream)`. Status: **Calling…**, with a 30-second ring timeout.
3. **Ring.** The other browser gets `peer.on('call')`. If it is idle, it shows **Incoming call** with Accept/Reject. If it is busy, it rejects automatically and sends `busy`.
4. **Answer.** `acceptCall()` asks for the mic and calls `call.answer(stream)`. Both sides get a `stream` event. We attach it to an `<audio>` element and record `connectedAt`. Status: **In call**, and the timer runs.
5. **During the call.** Mute flips `track.enabled` on the local audio tracks. Nothing is renegotiated, and the remote side hears silence.
6. **End.** Every ending goes through `finishSession(reason)`. It stops all local tracks (the browser's mic indicator turns off), clears the audio element, closes the connection, and produces a `CallRecord`.
7. **Log.** Unconnected calls are logged straight away (`missed`, `No answer`, `Declined`, …). Connected calls show the outcome picker first (Interested / Quote sent / Call back later / Not interested / Skip), then go to **Recent**.

### Control messages (why there is a DataConnection)

PeerJS has no event for "the callee rejected before answering" or "the caller hung up while ringing". Without help, the other side would keep ringing until its timeout. So `CallProvider` opens a one-off `DataConnection` to the other peer and sends one of:

| Message | Sent when | Receiver shows |
| --- | --- | --- |
| `reject` | Callee presses Reject (or its ring timer expires) | "The other person declined the call." |
| `cancel` | Caller presses Cancel or its 30s timeout fires | Ringing stops; logged as missed, "Caller hung up" |
| `busy` | A call arrives while already on one | "The other person is on another call." |

These are best-effort. If the data connection fails, the ring timeouts still end the call.

### Ending detection

- **Hang-up by the other side**: PeerJS `close` event.
- **Other tab closed**: a `pagehide` handler closes the call and destroys the peer, so the other side finds out in under a second (measured ~20–800 ms in tests).
- **Network drop**: we watch `RTCPeerConnection.connectionState`. `failed`/`closed` end the call at once. `disconnected` gets a 5-second grace period to recover.

## Testing it yourself

### Two windows, one machine

1. `npm run dev`, then open http://localhost:5173 in two windows. Two profiles or an incognito window are clearest.
2. Window B: click **Phone** in the top bar and copy the ID.
3. Window A: **Plan → Calls to make → Place call** (or just **Phone**). Paste the ID and click **Call**.
4. Allow the microphone in both windows, then **Accept** in B.
5. Speak and hear yourself through the other window (use headphones to avoid feedback). Try **Mute**, then **Hang up**, then pick an outcome. Check **Recent**.

### Two devices

Browsers only allow microphone access on **HTTPS or `localhost`**. To test from a phone on your network you need HTTPS. Two options:
- deploy the `dist/` build to any static HTTPS host, or
- run `npm run dev -- --host` behind an HTTPS tunnel.

Plain `http://192.168.x.x:5173` shows "Microphone API unavailable. Open the app on localhost or over HTTPS."

### Automated

```bash
npm run build
npm run test:calling
```

This runs three isolated headless Chrome contexts with Chrome's fake microphone. It checks:
- registration
- unknown-ID error
- placing a call from a lead row
- ring and accept
- the timer
- **inbound RTP audio bytes on both sides** (read from `RTCPeerConnection.getStats()`)
- mute
- busy
- hang-up on both sides with mic tracks stopped
- the logged record (lead, duration, outcome)
- reject and cancel signalling
- prefilled call back from Incoming
- tab-close handling

It needs internet access for the signalling server.

## Error handling

| Situation | What the user sees |
| --- | --- |
| Mic permission denied | "Microphone permission was denied. Allow mic access in the browser address bar and try again." |
| No mic / mic in use | "No microphone was found…" / "Your microphone is being used by another app…" |
| Insecure origin (no `mediaDevices`) | "Microphone API unavailable. Open the app on localhost or over HTTPS." |
| ID not online | "That ID is not online. Check the ID and that the other tab is still open." |
| Calling your own ID | "That is your own ID. Open the app in a second tab or device and call that ID." |
| Signalling server unreachable | Status **Offline** with a **Reconnect** button |
| Connection dropped mid-call | "The connection dropped." / "The connection was lost.", then the call is logged |
| Autoplay blocked for remote audio | "Could not play remote audio: …" |

## Limitations

- **Public infrastructure.** `0.peerjs.com` and the PeerJS TURN relays are free shared services with no uptime guarantee. For production, run your own [PeerServer](https://github.com/peers/peerjs-server) and TURN server (e.g. coturn), and pass them via `new Peer(id, { host, port, path, config: { iceServers } })`.
- **IDs are not accounts.** Anyone who knows an ID can call it. There is no authentication or directory. In production the IDs would come from the backend, tied to staff and lead records.
- **New ID on every reload.** This is deliberate: PeerJS keeps an ID reserved for a while after disconnect, so reusing it right after a refresh fails with `unavailable-id`.
- **No PSTN.** You can't dial a real phone number. That would need a telephony provider (Twilio, Exotel, …). The launcher's **Phone call** button says this and offers an in-app call instead.
- **No recording or transcription,** so live calls show "no SOP checklist" in the SOP review.
- **One call at a time.** A second incoming call is auto-rejected with `busy`, and logged as missed.
- The live call state is not persisted. Reloading mid-call ends the call. The other side is told via `pagehide`.

## AI voice calling (AI ↔ human)

A real voice conversation between a person and an AI model (Google's Gemini, via its API). Two modes, chosen when the call starts:

| Mode | Where | The AI plays | You play |
| --- | --- | --- | --- |
| **AI calls the customer** | Launcher → **AI call** (after the consent step) | Avani, an AI calling assistant who says it's an AI, then follows the call SOP using the lead's details | The customer |
| **AI plays the customer** | **Practise a call → Practise with an AI customer** | The lead, with realistic objections from their history | The agent |

### How it works

```
mic ──► SpeechRecognition (browser) ──► text ──► POST /api/ai-call ──► Gemini (gemini-3.8-flash)
                                                                              │
speakers ◄── speechSynthesis (browser) ◄── reply text ◄───────────────────────┘
```

1. **Start.** The AI speaks first: `/api/ai-call` gets the lead's details and an empty transcript and returns the opening line.
2. **Speak.** `speechSynthesis` reads the reply sentence by sentence. The mic is off while the AI talks, so it never hears itself.
3. **Listen.** `SpeechRecognition` (Chrome/Edge) transcribes one utterance. Interim words show live; the final text becomes your turn. You can also type a reply, or press **Skip** to cut the AI off.
4. **Reply.** The whole transcript goes back to `/api/ai-call`, which asks Gemini for the next one to three spoken sentences.
5. **End.** Press **End call**, or the AI ends it after saying goodbye (it appends an `[END]` marker that the server strips). A second request turns the transcript into a call-log summary and an outcome (structured JSON output), and the call is logged to **Recent** with an **AI call** tag and its real duration.

### Server and key

- `api/ai-call.ts` is a Vercel Function. It holds the only copy of the Gemini API key (`GEMINI_API_KEY`), validates and size-limits the request (60 turns, 600 characters each), builds the prompt and calls Gemini with Google's `@google/genai` SDK. `GEMINI_MODEL` can override the model. The browser never sees the key.
- In `npm run dev` and `npm run preview`, a small Vite plugin in `vite.config.ts` serves the same handler at the same path, reading the key from `.env.local` (git-ignored; copy `.env.example`).
- Requests use a low thinking level for fast replies; the summary uses JSON-schema output. If a safety filter blocks a reply, the AI ends the call politely instead of going silent. Errors come back as plain messages: no key (503), key rejected (502), free-tier rate limit hit (429).

### Set it up

1. Create a free API key in Google AI Studio (aistudio.google.com/apikey). Leave billing off on that project, so the key stays on the free tier and the public endpoint can't run up charges.
2. Local: copy `.env.example` to `.env.local`, put the key in it, restart `npm run dev`.
3. Vercel: Project → Settings → Environment Variables → add `GEMINI_API_KEY`, then redeploy.

### Limits

- Speech recognition needs Chrome or Edge, and those browsers send the audio to their own speech service (Google's, in Chrome). Other browsers can still type.
- Turn-taking is half-duplex. You can't talk over the AI; press **Skip** instead.
- Reply time is mostly the model's response time, typically a second or two. The free tier has per-minute and per-day request limits; a long call or many test calls can hit them (the app shows a "quota busy" message).
- Voices depend on what's installed on the device. Hindi works best on devices with a Hindi voice.
- Not on the phone network: the AI talks to a person in the browser, not to a phone number.
