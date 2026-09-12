const $ = s => document.querySelector(s);
const sourcesEl = $('#sources');
const resultsEl = $('#results');
const emptyEl = $('#empty');
const scanBtn = $('#scanBtn');
let sourceSeed = [];

function sourceRow(source = { name: '', url: '' }) {
  const row = document.createElement('div');
  row.className = 'source';
  row.innerHTML = `<input class="s-name" placeholder="Source name" value="${esc(source.name)}"><input class="s-url" placeholder="https://…" value="${esc(source.url)}"><button class="remove" title="Remove">×</button>`;
  row.querySelector('.remove').onclick = () => row.remove();
  return row;
}

function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getSources() { return [...sourcesEl.querySelectorAll('.source')].map(r => ({ name: r.querySelector('.s-name').value.trim(), url: r.querySelector('.s-url').value.trim() })).filter(x => x.url); }

async function load() {
  const config = await fetch('/api/config').then(r => r.json()).catch(() => ({ sources: [] }));
  sourceSeed = config.sources || [];
  for (const s of sourceSeed.filter(x => x.enabled !== false)) sourcesEl.append(sourceRow(s));
  if (!sourcesEl.children.length) sourcesEl.append(sourceRow());
  checkHealth();
  const last = await fetch('/api/last-run').then(r => r.json()).catch(() => null);
  if (last?.items?.length) renderRun(last, false);
}

async function checkHealth() {
  const h = $('#health');
  const res = await fetch('/api/health').then(async r => ({ ok: r.ok, data: await r.json() })).catch(() => ({ ok:false,data:{} }));
  if (res.ok) { h.className='pill ok'; h.textContent=`webcmd ${res.data.version || ''} · ready`; }
  else { h.className='pill bad'; h.textContent='webcmd setup needed'; }
}

$('#addSource').onclick = () => sourcesEl.append(sourceRow());
document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => $('#query').value = b.dataset.q);

function startExecution() {
  $('#runArea').classList.remove('hidden');
  $('#runTitle').textContent = 'Agent is browsing real websites…';
  $('#steps').innerHTML = getSources().map(s => `<div class="step"><b>${esc(s.name || new URL(s.url).hostname)}</b><span>Queued · read-only</span></div>`).join('');
  const started = performance.now();
  const t = setInterval(() => $('#timer').textContent = `${((performance.now()-started)/1000).toFixed(1)}s`, 100);
  return { stop: () => clearInterval(t), started };
}

scanBtn.onclick = async () => {
  scanBtn.disabled = true; scanBtn.innerHTML = 'Browsing…';
  const exec = startExecution();
  try {
    const res = await fetch('/api/scan', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ query: $('#query').value, sources: getSources() }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan failed');
    renderRun(data, true);
  } catch (err) {
    $('#runTitle').textContent = 'Run stopped';
    $('#steps').innerHTML = `<div class="step bad"><b>Could not complete scan</b><span>${esc(err.message)}</span></div>`;
  } finally {
    exec.stop(); scanBtn.disabled = false; scanBtn.innerHTML = 'Run live agent <span>↗</span>';
  }
};

function renderRun(run, live) {
  $('#runArea').classList.remove('hidden');
  $('#runTitle').textContent = live ? 'Live run complete' : 'Previous live run';
  $('#timer').textContent = `${((run.durationMs || 0)/1000).toFixed(1)}s`;
  $('#steps').innerHTML = (run.sources || []).map(s => `<div class="step ${s.ok?'ok':'bad'}"><b>${esc(s.name)}</b><span>${s.ok ? `${s.count} candidates · attempt ${s.attempt}` : esc(s.error || 'Unavailable')}</span></div>`).join('');

  const items = run.items || [];
  const newCount = items.filter(x=>x.change==='new').length;
  const changed = items.filter(x=>x.change==='changed').length;
  const okSources = (run.sources||[]).filter(x=>x.ok).length;
  const stats = $('#stats'); stats.classList.remove('hidden');
  stats.innerHTML = `<div class="stat"><strong>${items.length}</strong><span>shortlisted results</span></div><div class="stat"><strong>${newCount}</strong><span>new since last run</span></div><div class="stat"><strong>${changed}</strong><span>changed entries</span></div><div class="stat"><strong>${okSources}/${(run.sources||[]).length}</strong><span>sources recovered</span></div>`;

  emptyEl.style.display = items.length ? 'none' : 'block';
  resultsEl.innerHTML = items.map(card).join('');
}

function card(x) {
  const meta = [x.deadline && `Deadline: ${x.deadline}`, x.prize && x.prize, x.mode && x.mode, `score ${x.score ?? 0}`].filter(Boolean);
  return `<article class="card"><div><div class="card-top"><span class="source-tag">${esc(x.source)}</span>${x.change && x.change!=='same'?`<span class="change-tag ${esc(x.change)}">${esc(x.change)}</span>`:''}</div><h3>${esc(x.title)}</h3><p>${esc((x.snippet||'').slice(0,330))}</p><div class="meta">${meta.map(m=>`<span class="mini">${esc(m)}</span>`).join('')}</div></div><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Review manually ↗</a></article>`;
}

load();
