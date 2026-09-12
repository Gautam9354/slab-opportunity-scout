# SLAB Opportunity Scout — Webcmd Hackathon Project

A local, read-only browser agent for students. Give it a goal such as **“AI browser-agent hackathons in India”** and it uses **Webcmd** to browse real opportunity pages, extract a structured shortlist, compare it with the previous run, and continue even when one website fails.

## Why this is a strong SLAB demo

- **Live reliability:** every scan uses a real Webcmd browser Session. Sources are isolated at the workflow level, retried once, and failures do not fabricate data.
- **Real-world usefulness:** students repeatedly search hackathons, internships, scholarships and competitions across fragmented sites.
- **Technical depth:** browser orchestration, structured extraction, Webcmd Profile/Session lifecycle, source recovery, deduplication, change monitoring, local history, and a clear promotion path to a reusable Webcmd command.
- **Safety:** the app is hard-coded as research-only. It never applies, registers, submits, messages, buys, deletes or pays.
- **Demo story:** “First run explores. Next run highlights what changed. Then promote the proven workflow into `webcmd opportunities scan ...`.”

## 1) Requirements

- Node.js **20.6+**
- Webcmd installed globally
- A browser runtime accepted by `webcmd doctor`

Install Webcmd:

```bash
npm install -g @agentrhq/webcmd
```

Then follow Webcmd setup once:

```bash
webcmd --version
webcmd doctor
webcmd skills add
```

`webcmd doctor` should be green before the live scan.

## 2) Run this project

Open a terminal in this folder:

```bash
npm run check
npm test
npm start
```

Open:

```text
http://127.0.0.1:4173
```

No `npm install` is required for this project because it uses only built-in Node.js modules and the globally installed `webcmd` CLI.

## 3) Live hackathon demo

1. Keep the default sources: Unstop + Devpost.
2. Search: `AI browser agents hackathon student India`
3. Click **Run live agent**.
4. Explain that the browser is running through one named Webcmd Profile and one explicit Session; each website returns bounded structured evidence.
5. Show that each result has a real source URL and the **Review manually** action.
6. Run again later or change a query/source and show `new` / `changed` labels.
7. Optional “self-learning” finale: run `npm run promote`, copy the prompt into Codex/Claude Code, and let the Webcmd skill turn the proven workflow into a reusable private command.

## 4) Architecture

```text
Dashboard (browser)
      |
      v
Node HTTP server
      |
      v
Safety + orchestration wrapper
      |
      +--> webcmd profile: slab-opportunity
      |        |
      |        +--> explicit browser Session
      |                 |
      |                 +--> Unstop / Devpost / custom public URL
      |
      +--> structured extraction + scoring
      +--> retry/recovery per source
      +--> dedupe + previous-run diff
      +--> data/last-run.json + data/history.json
```

The server never exposes an arbitrary shell endpoint. It invokes a small allow-listed Webcmd command surface from code.

## 5) Files judges may ask about

- `src/webcmd.mjs` — safe Webcmd wrapper, Profile/Session lifecycle, output parsing.
- `src/scout.mjs` — browser program, ranking, recovery, dedupe and change detection.
- `public/` — demo dashboard.
- `scripts/preflight.mjs` — verifies Node/Webcmd and runs `webcmd doctor`.
- `scripts/promote.mjs` — prompt that promotes the successful browser workflow into a reusable Webcmd CLI through a coding agent.
- `docs/DEMO.md` — 90-second demo script.
- `docs/JUDGING.md` — how the project maps to the 100-point rubric.

## 6) Add another source

Use the dashboard **+ Add URL** button. Keep demo sources public/read-only for reliability. The backend blocks `file://` and localhost URLs and caps a run to six sources.

## 7) Important hackathon rule alignment

This project deliberately keeps sensitive writes out of automation. If you extend it to applications or bookings, add a human approval step before the final submission/purchase/message and handle login/OTP/CAPTCHA manually in the visible browser.

## 8) Troubleshooting

**webcmd setup needed** → run:

```bash
webcmd doctor
```

**A single source shows unavailable** → the run still completes. Open that source manually to check for CAPTCHA/login/rate limiting before retrying.

**No useful results** → use a more specific query or add a direct category/listing URL instead of a home page.
