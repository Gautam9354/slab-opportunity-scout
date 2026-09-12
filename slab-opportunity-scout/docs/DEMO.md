# 90-second demo script

**0–15 sec — problem**  
“Students miss good hackathons and internships because opportunities are scattered across websites and deadlines change. Opportunity Scout turns that repeated browser work into one live agent run.”

**15–35 sec — live run**  
Enter `AI browser agents hackathon student India` and click **Run live agent**.  
“Under the hood this creates an explicit Webcmd Session inside the `slab-opportunity` Profile, then browses real websites. No fake dataset.”

**35–55 sec — structured outcome**  
Show cards with source, URL, snippet, deadline/prize/mode when found.  
“The agent returns bounded structured evidence instead of dumping a page. It deduplicates overlaps and ranks against my goal.”

**55–70 sec — recovery**  
Add one bad/nonexistent public URL if you want to demonstrate failure isolation.  
“If one source breaks, times out, rate-limits or asks for human verification, it is marked unavailable; the agent does not invent results and the other sources still finish.”

**70–82 sec — monitoring**  
Mention the `new` and `changed` markers.  
“Each run is diffed against the previous real run, so this becomes a monitoring agent, not a one-shot scraper.”

**82–90 sec — Webcmd learning story**  
“The first browser run proves the workflow. Webcmd’s model is explore once, remember the site, then promote stable flows into reusable commands. Our project includes a promotion prompt for `webcmd opportunities scan`.”

Close with: **“Browse once. Know what changed. Never auto-submit.”**
