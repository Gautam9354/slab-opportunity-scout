import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BIN = process.env.WEBCMD_BIN || 'webcmd';
const PROFILE = process.env.WEBCMD_PROFILE || 'slab-opportunity';

export class WebcmdError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'WebcmdError';
    this.details = details;
  }
}

function clean(s) {
  return String(s ?? '').trim();
}

export async function runWebcmd(args, options = {}) {
  const timeout = options.timeout ?? 60_000;
  try {
    const { stdout, stderr } = await execFileAsync(BIN, args, {
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: false,
      input: options.input,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { stdout: clean(stdout), stderr: clean(stderr) };
  } catch (err) {
    throw new WebcmdError(`webcmd failed: ${clean(err.message)}`, {
      args,
      code: err.code,
      stdout: clean(err.stdout),
      stderr: clean(err.stderr),
    });
  }
}

export async function runWebcmdWithStdin(args, input, options = {}) {
  const timeout = options.timeout ?? 90_000;
  return new Promise((resolve, reject) => {
    const child = spawn(BIN, args, {
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill('SIGKILL');
      settled = true;
      reject(new WebcmdError(`webcmd timed out after ${timeout}ms`, { args, stdout, stderr }));
    }, timeout);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(new WebcmdError(err.message, { args, stdout, stderr }));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) return resolve({ stdout: clean(stdout), stderr: clean(stderr) });
      reject(new WebcmdError(`webcmd exited with code ${code}`, { args, code, stdout: clean(stdout), stderr: clean(stderr) }));
    });
    child.stdin.end(input);
  });
}

export function parseJsonish(text) {
  const raw = clean(text);
  if (!raw) return null;

  const attempts = [raw];
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) attempts.push(lines[i]);

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) attempts.push(raw.slice(firstBrace, lastBrace + 1));

  const firstBracket = raw.indexOf('[');
  const lastBracket = raw.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) attempts.push(raw.slice(firstBracket, lastBracket + 1));

  for (const candidate of attempts) {
    try { return JSON.parse(candidate); } catch {}
  }
  return null;
}

function deepFind(obj, predicate, depth = 0) {
  if (depth > 7 || obj == null) return undefined;
  if (predicate(obj)) return obj;
  if (typeof obj !== 'object') return undefined;
  for (const value of Object.values(obj)) {
    const found = deepFind(value, predicate, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function extractSessionId(output) {
  const parsed = parseJsonish(output);
  const candidate = deepFind(parsed, v => typeof v === 'object' && v && typeof v.id === 'string' && v.id.length > 2);
  if (candidate?.id) return candidate.id;

  const m = clean(output).match(/(?:^|\s)id\s*[:=]\s*["']?([a-zA-Z0-9._-]+)/i);
  if (m) return m[1];
  return null;
}

export function extractRunResult(output) {
  const parsed = parseJsonish(output);
  if (parsed == null) throw new WebcmdError('Could not parse browser run output as JSON', { output: clean(output).slice(0, 1800) });

  const unwrap = value => {
    if (typeof value === 'string') {
      const inner = parseJsonish(value);
      return inner ?? value;
    }
    return value;
  };

  const direct = unwrap(parsed);
  if (Array.isArray(direct)) return direct;
  if (direct && Array.isArray(direct.result)) return direct.result;
  if (direct && direct.result && typeof direct.result === 'object') return direct.result;

  const found = deepFind(direct, v => Array.isArray(v) && v.every(x => x == null || typeof x === 'object'));
  if (found) return found;

  const resultObj = deepFind(direct, v => typeof v === 'object' && v && ('items' in v || 'results' in v));
  if (resultObj?.items) return unwrap(resultObj.items);
  if (resultObj?.results) return unwrap(resultObj.results);

  return direct;
}

export async function ensureProfile() {
  try {
    await runWebcmd(['profile', 'create', PROFILE], { timeout: 20_000 });
  } catch (err) {
    const blob = `${err.details?.stderr || ''} ${err.details?.stdout || ''} ${err.message}`.toLowerCase();
    if (!blob.includes('already') && !blob.includes('exists')) throw err;
  }
  return PROFILE;
}

export async function createSession(name = 'SLAB Opportunity Scout') {
  await ensureProfile();
  const { stdout } = await runWebcmd(['--profile', PROFILE, 'session', 'create', name, '-f', 'json'], { timeout: 35_000 });
  const id = extractSessionId(stdout);
  if (!id) throw new WebcmdError('Session was created but its ID could not be parsed.', { stdout });
  return id;
}

export async function closeSession(sessionId) {
  if (!sessionId) return;
  try {
    await runWebcmd(['--profile', PROFILE, 'session', 'close', sessionId], { timeout: 20_000 });
  } catch {}
}

export async function memoryContext(url, taskId) {
  try {
    await runWebcmd(['site', 'memory', 'context', url, '--task-id', taskId, '-f', 'json'], { timeout: 25_000 });
  } catch {
    // Memory is secondary to the live browser task. A memory failure must not block the scan.
  }
}

export async function browserRun(sessionId, program, timeout = 90_000) {
  const { stdout } = await runWebcmdWithStdin([
    '--profile', PROFILE,
    '--session', sessionId,
    'browser', 'run', '--stdin', '--no-snapshot-diff'
  ], program, { timeout });
  return extractRunResult(stdout);
}

export async function webcmdVersion() {
  const { stdout } = await runWebcmd(['--version'], { timeout: 10_000 });
  return stdout;
}

export async function doctor() {
  const { stdout, stderr } = await runWebcmd(['doctor'], { timeout: 40_000 });
  return [stdout, stderr].filter(Boolean).join('\n');
}

export { PROFILE };
