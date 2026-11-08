const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');

// Jalankan config.js dengan location dan sessionStorage palsu; kembalikan CONFIG dan isi storage.
function load(pathname, search, stored) {
  const store = Object.assign({}, stored || {});
  const sessionStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const location = { pathname, search };
  const CONFIG = new Function('location', 'sessionStorage', code + '\n;return CONFIG;')(location, sessionStorage);
  return { CONFIG, store };
}

const PROD = {
  STR_BASE_APP_TOKEN: 'Z0BrbJIloaJtSxsOTY4lOsQagEb',
  STR_HEADER_TABLE_ID: 'tblQ7qPdqgZ6QcOg',
  STR_DETAIL_TABLE_ID: 'tbluAki3HiMe1ppg',
  MASTER_ICO_TABLE_ID: 'tbl53FFpAodzb70G',
  ADJ_HEADER_TABLE_ID: 'tblFGno3ONx4BseJ',
  ADJ_DETAIL_TABLE_ID: 'tblUShPPgJW3fqBn'
};

test('default (tanpa env) = produksi persis, flag mati', () => {
  const { CONFIG } = load('/str-request/lark-mini-app/pages/home/index.html', '');
  assert.strictEqual(CONFIG.FLOW_V2, false);
  assert.strictEqual(CONFIG.STATUS_AFTER_APPROVE, 'Waiting Create by ICO');
  Object.keys(PROD).forEach((k) => assert.strictEqual(CONFIG[k], PROD[k], k));
});

test('?env=test di home menyalakan flag dan menimpa Base', () => {
  const { CONFIG, store } = load('/str-request/lark-mini-app/pages/home/index.html', '?env=test');
  assert.strictEqual(CONFIG.FLOW_V2, true);
  assert.strictEqual(CONFIG.STATUS_AFTER_APPROVE, 'Approved - Waiting RPA');
  assert.strictEqual(store._env, 'test');
  assert.notStrictEqual(CONFIG.STR_BASE_APP_TOKEN, PROD.STR_BASE_APP_TOKEN);
  assert.ok(!/FILL_FROM_TASK_0/.test(CONFIG.STR_BASE_APP_TOKEN), 'nilai Base uji belum diisi');
  ['STR_HEADER_TABLE_ID', 'STR_DETAIL_TABLE_ID', 'MASTER_ICO_TABLE_ID', 'ADJ_HEADER_TABLE_ID', 'ADJ_DETAIL_TABLE_ID']
    .forEach((k) => {
      assert.notStrictEqual(CONFIG[k], PROD[k], k + ' masih ID produksi');
      assert.ok(!/FILL_FROM_TASK_0/.test(CONFIG[k]), k + ' belum diisi');
    });
  assert.ok(CONFIG.IP_USER_IDS.length > 0);
  assert.ok(Object.keys(CONFIG.MD_MAP).length > 0);
});

test('halaman non-home mengikuti env yang tersimpan', () => {
  const { CONFIG } = load('/str-request/lark-mini-app/pages/md-list/index.html', '', { _env: 'test' });
  assert.strictEqual(CONFIG.FLOW_V2, true);
});

test('home tanpa parameter env menghapus env tersimpan (kembali ke produksi)', () => {
  const { CONFIG, store } = load('/str-request/lark-mini-app/pages/home/index.html', '', { _env: 'test' });
  assert.strictEqual(CONFIG.FLOW_V2, false);
  assert.ok(!('_env' in store));
  Object.keys(PROD).forEach((k) => assert.strictEqual(CONFIG[k], PROD[k], k));
});

test('nilai env selain test diabaikan', () => {
  const { CONFIG } = load('/str-request/lark-mini-app/pages/home/index.html', '?env=prod');
  assert.strictEqual(CONFIG.FLOW_V2, false);
});
