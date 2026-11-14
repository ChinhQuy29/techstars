# 06 · Privacy and safety

Prototype; not legal advice. Institutional IRB rules come first for any KU or lab testing.

## Data map
| Data | Where | Kept |
|---|---|---|
| Worksheet photo | taken only on Check my work (or adult-enabled Auto-snap); to Gemini only with a key and mock off | never stored |
| Spoken / typed explanation | speech → text by the browser (web) or the phone's own speech recognizer (Android app, which may use the phone maker's speech service under the phone's settings); only the text goes to the backend (and Gemini when enabled) | the app never records, stores or uploads audio; text not logged; best quote per concept kept |
| "Talk to Lumi" text | backend, Gemini when enabled | in-memory session only |
| Marks, answers, outcomes, timings, stars | backend memory | session only |
| **Saved progress** (adult opt-in) | `backend/data/lumi.db`, keyed by a random 128-bit id on the device | only stars, best quotes, ready concepts, town visits, and story choices (which version per act, scenes seen); deleted after 180 days unused or on request |
| Names, ages, emails, accounts | not collected | — |

## Access to a child's session
- A session is identified only by a **128-bit random id** (32 hex characters) made on the device with the secure random generator; the server refuses any other id (422), so sessions can't be guessed or listed. Saved-progress ids are also 128-bit.
- The **"phone as camera" relay** (`/api/frame`, Socket.IO) is off unless `LUMI_PHONE_CAMERA=1`, which is for laptop demos only and must never be set on a deployed server.
- Known gaps, not yet fixed: no sign-in or app key, no rate limits, the cloud server accepts requests from any website, and the Android build is a debug build. Fix before families use the cloud server; see [08](08-status-and-roadmap.md).

## Consent and deletion
- **💾 Save Lumi's progress on this device?** explains what's kept (en/es/vi), needs a 1.5 s hold, and records time and wording version (`CONSENT_VERSION`, identical in `store.py` and `api.ts`; a stale screen gets 409).
- **🗑 Delete this session's data** wipes the session. **🗑 Delete saved progress** (hold) deletes the profile immediately, clears the device id and stops all saving.
- One profile per browser (siblings share it, a known limit). `MOCK_MODE=1` sends nothing to any AI provider. Check Gemini's data terms before any pilot; never use a provider that trains on children's data.

- **Admin portal** (`/?admin=1`, backend `LUMI_ADMIN=1`): a local testing tool that edits in-memory test sessions. It is off by default and must never be enabled on a deployed server or used with real children's sessions.

## Child-safety rules
AI never decides math, reveals, stars or flow; no praise of wrong ideas; no early answers; sanitized LLM text with template fallback; Lumi is a peer, never sad or guilt-tripping; adult actions are hold-to-confirm; no streaks, timers, leaderboards, purchases or random rewards; the report is honest (deliberate mistakes; stars aren't mastery).

## Before testing with a child
- [ ] Written parental consent and child assent ("you can stop any time"); IRB decision if research.
- [ ] `MOCK_MODE=1` unless the provider was reviewed and disclosed.
- [ ] Explain the deliberate mistakes and that stars are a game signal.
- [ ] No photos or video of the child without separate consent; record the screen only.
- [ ] Delete session data afterwards unless the parent wants the report.

## Pilot plan
- **Question:** for ready 6–10-year-olds, does Teach beat Help on understanding and transfer?
- **Design:** within-subjects, counterbalanced Help vs. Teach on matched concepts, 2–3 sessions each; pre-test, post-test, near transfer, delayed check; mixed prior achievement. Town study: town vs. stars-only on return and explanation quality over 2–3 weeks.
- **Outcomes:** concept gain, accuracy on new problems, retention; secondary: explanation quality, caught/missed/false alarms, `teach_done.elapsed_s`, voluntary More homework, returns, attitude (separately), adult interventions.
- **Stop a session** if the child is upset, stuck > 2 min after help, or wrong math appears. **Pause the pilot** on any affirmed wrong math or early reveal until fixed.
- Report every session. Parent feedback is recorded against the random session id only.
