const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');

// api.js memakai global browser hanya di dalam fungsi; di sini cukup menyuntikkan authToken.
function load(authToken) {
  return new Function('authToken', code + '\n;return { withAuthToken: withAuthToken, isAuthError: isAuthError };')(authToken);
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
