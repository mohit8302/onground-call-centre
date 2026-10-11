# Feature status

Legend:
- ✅ done
- 🟡 partial or demo-only (explained in the row)
- ❌ not done

**How it was verified:**
- **E2E** = covered by `e2e/ui.e2e.cjs` or `e2e/calling.e2e.cjs` (headless Chrome, Chrome's fake microphone)
- **Visual** = screenshots reviewed at 1440/1280 and 390px
- **Build** = `npm run build` + `npm run lint` pass

## Screens (from the assignment brief)

| # | Feature | Status | Verified by |
| --- | --- | --- | --- |
| 1 | Dashboard: KPI cards, progress, My Tasks, earnings, who's waiting, 7-day calls and CSAT charts | ✅ | E2E, Visual |
| 2 | Calls to make: ranked by score, expandable rows (story, product, cross-sell, EMI, Place call), 2 per page | ✅ | E2E, Visual |
| 3 | Incoming: missed calls with expected value, summary, Call back | ✅ | E2E, Visual |
| 4 | Recent: type, time, duration, outcome; click opens SOP review | ✅ | E2E, Visual |
| 5 | Calendar: month grid, event dots, prev/next, Today, selected-day list, upcoming | ✅ | E2E, Visual |
| 6 | Pulse home: AvaniBot hero, custom/role/task agents, channels, Kudos, DMs | ✅ (content is demo) | E2E, Visual |
| 7 | Pulse channel: back, header, pinned Needs-your-input with options + reply box, bubbles with times, working composer | ✅ | E2E, Visual |
| 8 | Leads modal: lead card, ICP score, intent score, collapsible ICP breakdown / journey / buying signals, prev/next, cumulative missed | ✅ | E2E, Visual |
| — | Shell: dark-green sidebar with Plan sub-items, top bar with OG logo, bell, OG Score ring 76 + rank #3, avatar | ✅ | E2E, Visual |
| — | Floating call launcher (DEMO · In-app call · Phone call · consent shield), bottom centre on every screen | ✅ | E2E (on-screen on all 7 nav screens at 1280/390/360px, no overflow), Visual |

## Bonus items

| Feature | Status | Verified by |
| --- | --- | --- |
| Send a message (persists across reload) | ✅ | E2E |
| Answer the Needs-input card (option or typed reply, posts to chat) | ✅ | E2E |
| Practise a call: scenario checklist, real mic-level check, practice call to a teammate | ✅ | E2E (mic level); practice call uses the same tested call path |
| Call back from Incoming / SOP review (prefills peer ID for live missed calls) | ✅ | E2E |
| Responsive to phone width (drawer nav, stacked layouts) | ✅ | E2E (no horizontal overflow at 1280/390/360px), Visual |
| Charts library (Recharts) | ✅ | Visual |
| localStorage persistence + Reset demo data | ✅ | E2E |

## Real browser calling (PeerJS / WebRTC)

| Feature | Status | Verified by |
| --- | --- | --- |
| Generate participant ID, show it, copy to clipboard | ✅ | E2E (ID shown); the copy-to-clipboard click is not asserted by tests |
| Call by ID | ✅ | E2E |
| Incoming call with Accept / Reject | ✅ | E2E |
| Two-way audio | ✅ | E2E: inbound RTP audio bytes > 0 on **both** sides via `getStats()` |
| Mute / unmute (`track.enabled`) | ✅ | E2E |
| Hang up, other side ends too | ✅ | E2E |
| Connection states (connecting / ready / offline / calling / ringing / in-call) | ✅ | E2E covers all except `offline` |
| Real duration timer | ✅ | E2E (timer ≥ 3s after 3.2s; logged duration ≥ 3s) |
| Track cleanup (mic released after the call) | ✅ | E2E (no live sender tracks after hang-up) |
| Mic permission errors (denied / not found / busy / insecure origin) | ✅ code paths | 🟡 Not run automatically: the E2E browser auto-grants the mic. Messages reviewed in code. |
| Unknown ID error | ✅ | E2E |
| Reject / cancel / busy signalled to the other side in about 1s | ✅ | E2E |
| Other tab closed mid-call | ✅ | E2E |
| Signalling lost → Offline + Reconnect | ✅ code path | 🟡 Not exercised automatically (would need the network cut mid-test) |
| Calls linked to leads ("Place call", "Call back") and logged to Recent with outcome | ✅ | E2E |
| Launcher "In-app call" opens the same dock (one Peer, one audio element) and shows Calling/Incoming/timer | ✅ | E2E |
| Launcher "Phone call" | 🟡 By design | Explains PSTN isn't configured and offers an in-app call. Nothing is dialled. E2E checks this. |
| Recording consent (script in 3 languages, verbal yes/no → Consent ID, under-18 guardian flag) | ✅ local only | E2E. Stored in localStorage only; no recording exists. |
| Consent via WhatsApp | ❌ | Shown, but Send is disabled: WhatsApp Business isn't connected |
| Outcome picker after a connected call | ✅ | E2E |

## Not done / out of scope

| Item | Status | Note |
| --- | --- | --- |
| AI voice calling | ❌ | Optional. Skipped on purpose: it needs server-side API keys. Nothing in the UI pretends to have it. |
| Call recording / transcription / live SOP scoring | ❌ | SOP checklists exist only for demo calls |
| Real phone-network (PSTN) calls | ❌ | Needs a telephony provider |
| Self-hosted signalling / TURN | ❌ | Uses PeerJS public defaults (see CALLING_GUIDE) |
| URL routing / browser back button | ❌ | Screen is kept in state and localStorage |
| Unit tests | ❌ | Coverage is browser E2E only |

## What was *not* verified

So nobody over-reads the ✅ marks:

- **Human-audible audio** with real microphones and speakers was not checked by the person who built this. The automated tests prove audio packets flow both ways using Chrome's synthetic microphone. To hear it, follow the steps in CALLING_GUIDE.
- **Firefox and Safari** were not tested. Only Chrome (headless) was. PeerJS supports all three.
- **Real phones** were not tested. Phone layouts were checked with viewport emulation (390px, 360px).
- **Two different networks** (e.g. office Wi-Fi to mobile data) were not tested. All automated calls ran on one machine.
