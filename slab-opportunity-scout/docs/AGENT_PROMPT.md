# Optional coding-agent prompt

Use the `webcmd-browser` skill and the `slab-opportunity` Profile to research current student opportunities relevant to: **AI browser agents / developer tools / India**.

Start with these public, read-only sources:
- https://unstop.com/hackathons/amp
- https://devpost.com/c/artificial-intelligence
- https://devpost.com/hackathons?status=open

Return stable structured rows with: source, title, url, snippet, deadline, prize, mode.

Safety boundaries:
- Read-only research.
- Do not register, apply, submit, message, buy, delete or pay.
- If login, OTP or CAPTCHA is required, stop for human handoff; never request or type credentials.
- If one source fails, report that source as unavailable and continue the others.

After the task succeeds, retain only useful general site navigation knowledge according to the Webcmd memory workflow. Do not store private data or user-specific information in sitemap memory.
