# Judging rubric mapping (100 points)

## Live reliability — 30
- Explicit Webcmd Profile and Session lifecycle.
- One bounded Playwright-style browser program per source.
- Two-attempt recovery for transient failures.
- Hard stop classification for CAPTCHA/auth/rate limiting/browser-runtime errors.
- A failed source does not fail the entire run.
- No synthetic fallback data.

## Real-world usefulness — 25
- Students repeatedly search fragmented hackathon/internship/scholarship listings.
- The agent turns browsing into a shortlist with direct evidence URLs.
- Change detection turns it into a practical monitoring workflow.

## Technical depth and recovery — 20
- Webcmd CLI orchestration from a constrained middleware seam.
- URL safety rules and capped source count.
- DOM extraction through Webcmd's Playwright-style runtime.
- Query scoring, deduplication, run persistence and diffs.
- Error categorization prevents unsafe retries.

## Creativity — 15
- “Opportunity inbox” rather than a generic scraper.
- Live source health and change intelligence make the agent feel operational.
- User can add an unfamiliar public listing page on stage.

## Demo and storytelling — 10
- Dark single-screen UI with clear source execution state.
- 90-second script in `DEMO.md`.
- Strong safety line: research is automated; consequential actions are manual.
