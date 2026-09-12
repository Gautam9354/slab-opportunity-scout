import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createSession, closeSession, browserRun, memoryContext, WebcmdError } from './webcmd.mjs';

const DATA_DIR = path.resolve('data');
const LAST_RUN = path.join(DATA_DIR, 'last-run.json');
const HISTORY = path.join(DATA_DIR, 'history.json');
const MAX_SOURCES = 6;

function safeUrl(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http/https URLs are allowed.');
  if (['localhost', '127.0.0.1', '::1'].includes(u.hostname)) throw new Error('Localhost URLs are not allowed.');
  return u.toString();
}

function normalizeQuery(q) {
  return String(q || '').trim().replace(/\s+/g, ' ').slice(0, 160);
}

function makeTaskId() {
  return `slab-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function makeProgram(url, query, sourceName) {
  return `
const targetUrl = ${JSON.stringify(url)};
const query = ${JSON.stringify(query)};
const sourceName = ${JSON.stringify(sourceName)};
await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1600);

const extracted = await page.locator('a').evaluateAll((anchors, args) => {
  const { query, sourceName } = args;
  const clean = s => String(s || '').replace(/\\s+/g, ' ').trim();
  const tokens = query.toLowerCase().split(/[^a-z0-9+#.-]+/).filter(t => t.length > 1);
  const opportunityWords = ['hackathon','internship','scholarship','fellowship','challenge','competition','ideathon','hiring','job','prize','deadline','apply','register'];
  const seen = new Set();
  const rows = [];

  for (const a of anchors) {
    const href = a.href || '';
    const title = clean(a.innerText || a.textContent || '');
    if (!href || !/^https?:/i.test(href) || title.length < 4) continue;
    if (seen.has(href)) continue;

    const box = a.closest('article, li, section, [class*=card], [class*=item], [class*=hack], [class*=event], [class*=job], [class*=opportun]') || a.parentElement;
    const snippet = clean(box?.innerText || title).slice(0, 700);
    const hay = (title + ' ' + snippet + ' ' + href).toLowerCase();

    let score = 0;
    for (const token of tokens) if (hay.includes(token)) score += 5;
    for (const word of opportunityWords) if (hay.includes(word)) score += 1;
    if (/register|apply|deadline|prize|hackathon|internship/i.test(snippet)) score += 3;
    if (title.length > 120) score -= 2;
    if (/privacy|terms|login|sign in|about|contact|help|facebook|twitter|instagram|linkedin/i.test(title)) score -= 8;
    if (score < 2 && tokens.length > 0) continue;

    const deadline = (snippet.match(/(?:deadline|closes?|ends?)\\s*[:—-]?\\s*([^|•\\n]{3,70})/i) || [])[1] || '';
    const prize = (snippet.match(/(?:₹|\\$|€|£)\\s?[\\d,.]+(?:\\s?[kKmM])?(?:\\s*(?:in prizes?|prize pool))?/i) || [])[0] || '';
    const mode = /\\bonline\\b/i.test(snippet) ? 'Online' : /\\boffline\\b|in-person|in person/i.test(snippet) ? 'Offline' : /hybrid/i.test(snippet) ? 'Hybrid' : '';

    seen.add(href);
    rows.push({ source: sourceName, title: title.slice(0, 180), url: href, snippet, deadline: clean(deadline), prize: clean(prize), mode, score });
  }

  rows.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return rows.slice(0, 28);
}, { query, sourceName });

return {
  page: { title: await page.title(), url: page.url() },
  items: extracted
};
`;
}

function unwrapItems(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.result)) return result.result;
  if (Array.isArray(result?.result?.items)) return result.result.items;
  return [];
}

function keyOf(item) {
  try {
    const u = new URL(item.url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/utm_|ref|source|campaign/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return item.url;
  }
}

function compareWithPrevious(items, previous) {
  const old = new Map((previous?.items || []).map(x => [keyOf(x), x]));
  return items.map(item => {
    const before = old.get(keyOf(item));
    if (!before) return { ...item, change: 'new' };
    const fingerprint = x => JSON.stringify([x.title, x.deadline, x.prize, x.mode, x.snippet?.slice(0, 260)]);
    return { ...item, change: fingerprint(before) === fingerprint(item) ? 'same' : 'changed' };
  });
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function persist(run) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const history = await readJson(HISTORY, []);
  history.unshift({ at: run.at, query: run.query, itemCount: run.items.length, sourceStatus: run.sources.map(s => ({ name: s.name, ok: s.ok })) });
  await fs.writeFile(LAST_RUN, JSON.stringify(run, null, 2));
  await fs.writeFile(HISTORY, JSON.stringify(history.slice(0, 25), null, 2));
}

function classifyError(err) {
  const blob = `${err.message || ''} ${err.details?.stderr || ''} ${err.details?.stdout || ''}`.toLowerCase();
  if (blob.includes('captcha')) return 'Human verification required';
  if (blob.includes('auth_required') || blob.includes('login')) return 'Authentication required';
  if (blob.includes('rate limit') || blob.includes('too many requests')) return 'Rate limited';
  if (blob.includes('browser_connect') || blob.includes('doctor')) return 'Browser runtime unavailable; run webcmd doctor';
  if (blob.includes('timeout')) return 'Timed out while loading this source';
  return 'Source could not be scanned';
}

export async function scanOpportunities({ query, sources }) {
  const q = normalizeQuery(query) || 'AI browser agent hackathon internship scholarship';
  const sanitized = (sources || []).slice(0, MAX_SOURCES).map((s, i) => ({
    name: String(s.name || `Source ${i + 1}`).trim().slice(0, 80),
    url: safeUrl(s.url),
  }));
  if (!sanitized.length) throw new Error('Add at least one source URL.');

  const previous = await readJson(LAST_RUN, null);
  const taskId = makeTaskId();
  const started = Date.now();
  let sessionId;
  const statuses = [];
  const all = [];

  try {
    sessionId = await createSession('SLAB Opportunity Scout');

    for (const source of sanitized) {
      await memoryContext(source.url, `${taskId}-${statuses.length + 1}`);
      let lastError;
      let success = false;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await browserRun(sessionId, makeProgram(source.url, q, source.name), 90_000);
          const items = unwrapItems(result).filter(x => x && x.url && x.title);
          all.push(...items);
          statuses.push({ name: source.name, url: source.url, ok: true, count: items.length, attempt });
          success = true;
          break;
        } catch (err) {
          lastError = err;
          const category = classifyError(err);
          if (/Human verification|Authentication required|Rate limited|Browser runtime/.test(category)) break;
        }
      }

      if (!success) statuses.push({
        name: source.name,
        url: source.url,
        ok: false,
        count: 0,
        error: classifyError(lastError || new Error('Unknown error')),
      });
    }
  } finally {
    await closeSession(sessionId);
  }

  const dedup = new Map();
  for (const item of all) {
    const key = keyOf(item);
    const existing = dedup.get(key);
    if (!existing || Number(item.score || 0) > Number(existing.score || 0)) dedup.set(key, item);
  }

  let items = [...dedup.values()].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 60);
  items = compareWithPrevious(items, previous);

  const run = {
    at: new Date().toISOString(),
    query: q,
    durationMs: Date.now() - started,
    taskId,
    safety: {
      mode: 'read-only',
      writesAutomated: false,
      message: 'The agent researches only. Applications, messages, submissions, purchases, and payments require a human.'
    },
    sources: statuses,
    items,
  };

  await persist(run);
  return run;
}

export { safeUrl, normalizeQuery, classifyError, compareWithPrevious };
