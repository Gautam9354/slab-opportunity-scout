import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, normalizeQuery, classifyError, compareWithPrevious } from './scout.mjs';
import { parseJsonish, extractSessionId, extractRunResult } from './webcmd.mjs';

test('safeUrl allows public http/https and blocks localhost', () => {
  assert.match(safeUrl('https://example.com/a'), /^https:\/\/example\.com/);
  assert.throws(() => safeUrl('file:///etc/passwd'));
  assert.throws(() => safeUrl('http://localhost:3000'));
});

test('query normalization is bounded', () => {
  assert.equal(normalizeQuery('  AI   hackathon  '), 'AI hackathon');
  assert.ok(normalizeQuery('x'.repeat(300)).length <= 160);
});

test('webcmd output parsers accept common shapes', () => {
  assert.deepEqual(parseJsonish('{"id":"abc"}'), { id: 'abc' });
  assert.equal(extractSessionId('{"id":"work-k7"}'), 'work-k7');
  assert.deepEqual(extractRunResult('{"result":[{"title":"A"}]}'), [{ title: 'A' }]);
});

test('change detection labels new / changed / same', () => {
  const previous = { items: [{ url: 'https://a.test/x', title: 'A', deadline: 'Tomorrow', prize: '', mode: '', snippet: 'One' }] };
  const out = compareWithPrevious([
    { url: 'https://a.test/x', title: 'A', deadline: 'Tomorrow', prize: '', mode: '', snippet: 'One' },
    { url: 'https://b.test/y', title: 'B', deadline: '', prize: '', mode: '', snippet: 'Two' },
  ], previous);
  assert.equal(out[0].change, 'same');
  assert.equal(out[1].change, 'new');
});

test('error classifier catches safety-relevant states', () => {
  assert.equal(classifyError(new Error('CAPTCHA challenge')), 'Human verification required');
  assert.equal(classifyError(new Error('rate limit exceeded')), 'Rate limited');
});
