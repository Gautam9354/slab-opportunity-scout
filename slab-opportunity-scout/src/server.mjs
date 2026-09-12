import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanOpportunities } from './scout.mjs';
import { webcmdVersion, doctor, PROFILE } from './webcmd.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 4173);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

async function bodyJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('Request too large');
  }
  return raw ? JSON.parse(raw) : {};
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function api(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/config') {
    return json(res, 200, { sources: await readJson(path.join(DATA, 'sources.json'), []), profile: PROFILE });
  }
  if (req.method === 'GET' && pathname === '/api/last-run') {
    return json(res, 200, await readJson(path.join(DATA, 'last-run.json'), { items: [], sources: [] }));
  }
  if (req.method === 'GET' && pathname === '/api/health') {
    try {
      const version = await webcmdVersion();
      return json(res, 200, { ok: true, version, profile: PROFILE });
    } catch (err) {
      return json(res, 503, { ok: false, error: err.message, hint: 'Install @agentrhq/webcmd and run webcmd doctor.' });
    }
  }
  if (req.method === 'POST' && pathname === '/api/doctor') {
    try { return json(res, 200, { ok: true, output: await doctor() }); }
    catch (err) { return json(res, 503, { ok: false, error: err.message, details: err.details || null }); }
  }
  if (req.method === 'POST' && pathname === '/api/scan') {
    try {
      const payload = await bodyJson(req);
      const result = await scanOpportunities(payload);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message, details: err.details || null });
    }
  }
  return false;
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, 'index.html')) return false;
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await api(req, res, url.pathname);
      if (handled !== false) return;
      return json(res, 404, { error: 'Not found' });
    }
    if (await serveStatic(res, url.pathname)) return;
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nSLAB Opportunity Scout running at http://127.0.0.1:${PORT}`);
  console.log(`Webcmd profile: ${PROFILE}`);
  console.log('Press Ctrl+C to stop.\n');
});
