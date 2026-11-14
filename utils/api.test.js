const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');

// api.js memakai global browser hanya di dalam fungsi; di sini cukup menyuntikkan authToken.
function load(authToken) {
  return new Function('authToken', code + '\n;return { withAuthToken: withAuthToken, isAuthError: isAuthError, isRateLimitError: isRateLimitError, rateLimitDelay: rateLimitDelay };')(authToken);
}

test('withAuthToken: menambah token, tidak mengubah params asli', () => {
  const { withAuthToken } = load(() => 'tok.sig');
  const p = { action: 'larkSearch', tableId: 't1' };
  const out = withAuthToken(p);
  assert.deepStrictEqual(out, { action: 'larkSearch', tableId: 't1', token: 'tok.sig' });
  assert.deepStrictEqual(p, { action: 'larkSearch', tableId: 't1' });
});

test('withAuthToken: tanpa token atau tanpa fungsi authToken, params apa adanya', () => {
  assert.deepStrictEqual(load(() => '').withAuthToken({ a: 1 }), { a: 1 });
  assert.deepStrictEqual(load(undefined).withAuthToken({ a: 1 }), { a: 1 });
});

test('isAuthError: hanya pesan berawalan AUTH:', () => {
  const { isAuthError } = load(undefined);
  assert.strictEqual(isAuthError('AUTH: sesi tidak valid'), true);
  assert.strictEqual(isAuthError('Lark search error 99'), false);
  assert.strictEqual(isAuthError(undefined), false);
});

test('isRateLimitError: kode 1254290 atau TooManyRequest saja', () => {
  const { isRateLimitError } = load(undefined);
  assert.strictEqual(isRateLimitError('Lark search error 1254290: TooManyRequest'), true);
  assert.strictEqual(isRateLimitError('toomanyrequest'), true);
  assert.strictEqual(isRateLimitError('Lark search error 1254291: write conflict'), false);
  assert.strictEqual(isRateLimitError('AUTH: sesi tidak valid'), false);
  assert.strictEqual(isRateLimitError(undefined), false);
});

test('rateLimitDelay: naik per percobaan dengan jitter < 700 ms', () => {
  const { rateLimitDelay } = load(undefined);
  for (let i = 0; i < 50; i++) {
    const d0 = rateLimitDelay(0), d1 = rateLimitDelay(1);
    assert.ok(d0 >= 700 && d0 < 1400, 'attempt 0: ' + d0);
    assert.ok(d1 >= 1400 && d1 < 2100, 'attempt 1: ' + d1);
  }
});
