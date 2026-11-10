const test = require('node:test');
const assert = require('node:assert');

// scope.js memakai global browser; di node kita pasang stub-nya dulu.
global.FLOW = require('./flow.js');
global.CONFIG = { MASTER_SM_USER_FIELD: 'STORE', MASTER_SITE_FIELD: 'SITE' };
global.fieldText = (v) => (typeof v === 'string' ? v : '');
let icoFlag = false;
global.isICO = () => icoFlag;
const listScope = require('./scope.js');

const SITES = [
  { fields: { SITE: 'J1', STORE: [{ id: 'u1' }] } },
  { fields: { SITE: 'J2', STORE: [{ id: 'u1' }, { id: 'u2' }] } },
  { fields: { SITE: 'J3', STORE: [{ id: 'u2' }] } },
  { fields: { SITE: 'J4' } }
];

test('manager: hanya site miliknya', () => {
  icoFlag = false;
  assert.deepStrictEqual(listScope({ openId: 'u1' }, SITES, {}), ['J1', 'J2']);
  assert.deepStrictEqual(listScope({ openId: 'u2' }, SITES, {}), ['J2', 'J3']);
});

test('manager tanpa site dan anonim: tidak ada akses', () => {
  icoFlag = false;
  assert.deepStrictEqual(listScope({ openId: 'u9' }, SITES, {}), []);
  assert.deepStrictEqual(listScope({ openId: '' }, SITES, {}), []);
});

test('ICO: site dari peta ICO, override ico = semua', () => {
  icoFlag = true;
  global.sessionStorage = { getItem: () => '' };
  assert.deepStrictEqual(listScope({ openId: 'i1' }, SITES, { i1: ['J1', 'J9'] }), ['J1', 'J9']);
  global.sessionStorage = { getItem: () => 'ico' };
  assert.strictEqual(listScope({ openId: 'i1' }, SITES, { i1: ['J1'] }), null);
  delete global.sessionStorage;
});

test('loadDetailRows: menolak rentang > 6 bulan tanpa memanggil jaringan', async () => {
  let calls = 0;
  global.larkSearch = () => { calls++; return Promise.resolve([]); };
  const ms = (y, m, d) => new Date(y, m - 1, d).getTime();
  await assert.rejects(listScope.loadDetailRows('T', 'STR Number', null, ms(2025, 1, 1), ms(2026, 11, 1)), /6 bulan/);
  assert.strictEqual(calls, 0);
});

test('loadDetailRows: satu panggilan per bulan, hasil digabung', async () => {
  global.CONFIG.STR_BASE_APP_TOKEN = 'tok';
  const seen = [];
  global.larkSearch = (token, table, filter) => { seen.push(filter.conditions[0].value[0]); return Promise.resolve([{ m: filter.conditions[0].value[0] }]); };
  const ms = (y, m, d) => new Date(y, m - 1, d).getTime();
  const rows = await listScope.loadDetailRows('T', 'STR Number', ['J1'], ms(2026, 10, 5), ms(2026, 11, 9));
  assert.deepStrictEqual(seen, ['/10/2026', '/11/2026']);
  assert.strictEqual(rows.length, 2);
});