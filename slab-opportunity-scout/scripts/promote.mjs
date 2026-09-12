console.log(`
PROMOTION PROMPT — paste this into Codex / Claude Code / your coding agent after one successful live scan:

Use webcmd and the existing SLAB Opportunity Scout project to turn the proven read-only opportunity workflow into a private reusable Webcmd CLI.

Goal:
- Create a command such as: webcmd opportunities scan "AI browser agents" -f json
- Reuse the existing successful Devpost/Unstop browser evidence and Webcmd sitemap memory rather than rediscovering everything.
- Output stable JSON-friendly rows with: source, title, url, snippet, deadline, prize, mode, score.
- Keep the command strictly read-only. Never register, apply, submit, message, purchase, or pay.
- If a page needs login/CAPTCHA, use human handoff; never request or type credentials/OTP.
- Verify the command end to end before finishing.
- Preserve recovery: one source failing must not fabricate data from that source.

After it works, show: webcmd opportunities scan "AI browser agents" -f json
`);
