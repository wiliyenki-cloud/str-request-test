const test = require('node:test');
const assert = require('node:assert');
const FLOW = require('./flow.js');

test('nama status V2', () => {
  assert.strictEqual(FLOW.S.WAITING_MGR, 'Waiting Approval by Mgr');
  assert.strictEqual(FLOW.S.APPROVED_RPA, 'Approved - Waiting RPA');
  assert.strictEqual(FLOW.S.WAITING_MD, 'Waiting MD Review');
  assert.strictEqual(FLOW.S.WAITING_IP, 'Waiting IP Release');
  assert.strictEqual(FLOW.S.CSV_READY, 'CSV Ready - Waiting PR');
  assert.strictEqual(FLOW.S.DONE, 'Done Create STR');
  assert.strictEqual(FLOW.S.REJECT, 'Reject');
});

test('parseMdReview toleran terhadap isi rusak', () => {
  assert.deepStrictEqual(FLOW.parseMdReview(''), {});
  assert.deepStrictEqual(FLOW.parseMdReview(null), {});
  assert.deepStrictEqual(FLOW.parseMdReview('bukan json'), {});
  assert.deepStrictEqual(FLOW.parseMdReview('[1,2]'), {});
  assert.deepStrictEqual(FLOW.parseMdReview('{"1":{"d":"ok"}}'), { 1: { d: 'ok' } });
});

test('serializeMdReview menyimpan qty hanya untuk d=qty', () => {
  const s = FLOW.serializeMdReview([
    { seq: 1, d: 'qty', q: '3' },
    { seq: 2, d: 'ok', q: '9' },
    { seq: 3, d: 'reject' }
  ]);
  assert.deepStrictEqual(JSON.parse(s), { 1: { d: 'qty', q: 3 }, 2: { d: 'ok' }, 3: { d: 'reject' } });
});

test('finalQty: approve, ubah, tolak', () => {
  const it = { seq: 1, requestQty: 12, approvalQty: 10 };
  assert.strictEqual(FLOW.finalQty(it, {}), 10);
  assert.strictEqual(FLOW.finalQty(it, { 1: { d: 'ok' } }), 10);
  assert.strictEqual(FLOW.finalQty(it, { 1: { d: 'qty', q: 3 } }), 3);
  assert.strictEqual(FLOW.finalQty(it, { 1: { d: 'reject' } }), 0);
  assert.strictEqual(FLOW.finalQty({ seq: 1, requestQty: 12, approvalQty: '' }, {}), 12);
});

test('validateMdDecisions', () => {
  const items = [{ seq: 1, requestQty: 5, approvalQty: 5 }, { seq: 2, requestQty: 4, approvalQty: 4 }];
  let v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'ok' }]);
  assert.strictEqual(v.ok, false);
  assert.match(v.error, /belum dipilih/);

  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'ok' }, { seq: 2, d: 'qty', q: '1000' }]);
  assert.strictEqual(v.ok, false);
  assert.match(v.error, /0 sampai 999/);

  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'ok' }, { seq: 2, d: 'qty', q: '1.5' }]);
  assert.strictEqual(v.ok, false);

  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'reject' }, { seq: 2, d: 'reject' }]);
  assert.deepStrictEqual([v.ok, v.kept], [true, 0]);

  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'ok' }, { seq: 2, d: 'reject' }]);
  assert.deepStrictEqual([v.ok, v.kept], [true, 1]);

  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'qty', q: '0' }, { seq: 2, d: 'ok' }]);
  assert.deepStrictEqual([v.ok, v.kept], [true, 1]);
});

test('statusAfterMd', () => {
  assert.strictEqual(FLOW.statusAfterMd(2), 'Waiting IP Release');
  assert.strictEqual(FLOW.statusAfterMd(0), 'Reject');
});

test('buildCsv: 15 kolom, nilai otomatis, item tolak tidak ikut', () => {
  const header = { strNumber: 'T001/J347/Sofa & Chair/11/2026', site: 'J347', kodeVendor: '6100000005', planReceiveMs: new Date(2026, 10, 20).getTime() };
  const items = [
    { seq: 1, article: '10045821', description: 'Sofa 3 Seater, Abu', requestQty: 12, approvalQty: 10 },
    { seq: 2, article: '10045822', description: 'Sofa 2', requestQty: 6, approvalQty: 6 }
  ];
  const csv = FLOW.buildCsv(header, items, { 2: { d: 'reject' } });
  const lines = csv.split('\r\n');
  assert.strictEqual(lines.length, 2);
  assert.strictEqual(lines[0], 'Doc Type,PR NUMBER,PR Item,Article,Description,Quantity,Delivery Date,Site,Storage Location,Purchasing Group,Purchasing Organization,Info Record,Vendor,Shipping Mode,Lark STR Number');
  assert.strictEqual(lines[1], 'ZNB1,,,10045821,"Sofa 3 Seater, Abu",10,20.11.2026,J347,1000,,RJ20,,6100000005,Y1,T001/J347/Sofa & Chair/11/2026');
});

test('dummyRpa deterministik dan berbentuk RPA Data', () => {
  const a = FLOW.dummyRpa('J347', '10045821');
  const b = FLOW.dummyRpa('J347', '10045821');
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.v, 1);
  assert.ok(a.stok.store >= 0 && a.stok.store <= 39);
  assert.ok(a.stok.dc.H001 >= 100 && a.stok.dc.H014 >= 100);
  assert.strictEqual(a.koli, 1);
  assert.strictEqual(a.pgr, 'J99');
  assert.deepStrictEqual([a.rr, a.ds, a.fm], ['', '', '']);
  assert.deepStrictEqual(Object.keys(a.pipe).sort(), ['giBelumGr', 'odBelumGi', 'prBelumPo', 'soBelumOd']);
  assert.deepStrictEqual(FLOW.parseRpaData(JSON.stringify(a)), a);
});

test('mdDepartmentsFor', () => {
  const map = { Bedroom: ['a', 'b'], Kitchen: ['b'], Sofa: ['c'] };
  assert.deepStrictEqual(FLOW.mdDepartmentsFor('b', map), ['Bedroom', 'Kitchen']);
  assert.deepStrictEqual(FLOW.mdDepartmentsFor('zzz', map), []);
  assert.deepStrictEqual(FLOW.mdDepartmentsFor('b', null), []);
  assert.deepStrictEqual(FLOW.mdDepartmentsFor('', map), []);
});

test('runLimited menghormati batas dan menjaga urutan', async () => {
  let running = 0, max = 0;
  const mk = (v, ms) => () => new Promise((res) => {
    running++; max = Math.max(max, running);
    setTimeout(() => { running--; res(v); }, ms);
  });
  const out = await FLOW.runLimited([mk('a', 30), mk('b', 10), mk('c', 5), mk('d', 1)], 2);
  assert.deepStrictEqual(out, ['a', 'b', 'c', 'd']);
  assert.ok(max <= 2, 'konkurensi melebihi batas: ' + max);
  assert.deepStrictEqual(await FLOW.runLimited([], 2), []);
});

test('dummyRpa tidak pernah negatif dan tetap dalam rentang', () => {
  let n = 0;
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 10; j++) {
      const r = FLOW.dummyRpa('J' + i * 7, 'A' + j * 13 + i);
      n++;
      assert.ok(r.stok.store >= 0 && r.stok.store <= 39, 'store ' + r.stok.store);
      assert.ok(r.stok.rdc >= 0 && r.stok.splt >= 0);
      assert.ok(r.stok.dc.H001 >= 100 && r.stok.dc.H001 <= 499, 'H001 ' + r.stok.dc.H001);
      assert.ok(r.stok.dc.H014 >= 100 && r.stok.dc.H014 <= 499, 'H014 ' + r.stok.dc.H014);
      assert.ok(r.avg3 >= 2.67 && r.avg3 <= 19, 'avg3 ' + r.avg3);
      assert.strictEqual(r.avg3, Math.round(r.avg3 * 100) / 100);
      Object.keys(r.pipe).forEach((k) => assert.ok(r.pipe[k] >= 0 && r.pipe[k] <= 9, k));
    }
  }
  assert.strictEqual(n, 200);
});

test('parseRpaData: defensif dan melengkapi bagian yang hilang', () => {
  assert.strictEqual(FLOW.parseRpaData(''), null);
  assert.strictEqual(FLOW.parseRpaData(null), null);
  assert.strictEqual(FLOW.parseRpaData('bukan json'), null);
  assert.strictEqual(FLOW.parseRpaData('{"v":2}'), null);
  assert.strictEqual(FLOW.parseRpaData('{}'), null);
  assert.strictEqual(FLOW.parseRpaData('[1]'), null);
  assert.deepStrictEqual(FLOW.parseRpaData('{"v":1}'), { v: 1, stok: { store: 0, rdc: 0, splt: 0, dc: {} },
    pipe: { prBelumPo: 0, soBelumOd: 0, odBelumGi: 0, giBelumGr: 0 }, avg3: 0, koli: 1, pgr: '', rr: '', ds: '', fm: '' });
  const r = FLOW.parseRpaData('{"v":1,"stok":{"store":"5","splt":"x","dc":{"H001":"7","H014":3}},"pipe":{"prBelumPo":"2"},"avg3":"1.5","koli":"6","pgr":"J15","rr":"a"}');
  assert.strictEqual(r.stok.store, 5);
  assert.strictEqual(r.stok.splt, 0);
  assert.deepStrictEqual(r.stok.dc, { H001: 7, H014: 3 });
  assert.strictEqual(r.pipe.prBelumPo, 2);
  assert.strictEqual(r.avg3, 1.5);
  assert.strictEqual(r.koli, 6);
  assert.strictEqual(r.pgr, 'J15');
  assert.strictEqual(r.rr, 'a');
  assert.strictEqual(FLOW.parseRpaData('{"v":1,"koli":0}').koli, 1);
});

test('rpaDcStock: kolom DC sesuai site pemasok, tanpa peduli huruf', () => {
  const rpa = FLOW.parseRpaData('{"v":1,"stok":{"dc":{"H001":12,"H014":0}}}');
  assert.strictEqual(FLOW.rpaDcStock(rpa, 'H001'), 12);
  assert.strictEqual(FLOW.rpaDcStock(rpa, 'h014'), 0);
  assert.strictEqual(FLOW.rpaDcStock(rpa, 'H999'), null);
  assert.strictEqual(FLOW.rpaDcStock(rpa, ''), null);
  assert.strictEqual(FLOW.rpaDcStock(null, 'H001'), null);
});

test('rpaSummary: null bila tidak ada RPA Data', () => {
  assert.strictEqual(FLOW.rpaSummary(null), null);
  assert.strictEqual(FLOW.rpaSummary(null, 'H001'), null);
});

test('rpaSummary: toko, RDC, SPLT, semua DC berurutan; detail tanpa RDC dan Stok DC', () => {
  const rpa = FLOW.parseRpaData(JSON.stringify({
    v: 1, stok: { store: 5, rdc: 7, splt: 2, dc: { H001: 12, H014: 3 } },
    pipe: { prBelumPo: 1, soBelumOd: 2, odBelumGi: 3, giBelumGr: 4 },
    avg3: 6.5, koli: 12, pgr: 'J99', rr: 'Replenish', ds: 'DS', fm: 'FM'
  }));
  const s = FLOW.rpaSummary(rpa, 'h001');
  assert.strictEqual(s.store, 5);
  assert.strictEqual(s.rdc, 7);
  assert.strictEqual(s.splt, 2);
  assert.strictEqual(s.avg3, 6.5);
  assert.strictEqual(s.dc, undefined);
  assert.deepStrictEqual(s.dcs, [{ code: 'H001', value: 12 }, { code: 'H014', value: 3 }]);
  assert.deepStrictEqual(s.extras.map(e => e.label), ['PR belum PO', 'SO belum OD', 'OD belum GI', 'GI belum GR', 'Koli', 'PGR', 'Remark replenishment', 'Deadstock', 'Tag fixmix']);
  assert.strictEqual(s.extras[4].value, 12);
});

test('rpaSummary: dcs mengikuti urutan sheet, tidak diurutkan', () => {
  const rpa = FLOW.parseRpaData('{"v":1,"stok":{"dc":{"H064":1,"H001":2,"H014":0,"H026":4}}}');
  assert.deepStrictEqual(FLOW.rpaSummary(rpa).dcs.map(d => d.code), ['H064', 'H001', 'H014', 'H026']);
  assert.strictEqual(FLOW.rpaSummary(rpa).dcs[2].value, 0);
});

test('rpaSummary: dc kosong -> dcs array kosong; koli 1 dan teks kosong tidak masuk detail', () => {
  const rpa = FLOW.parseRpaData('{"v":1,"stok":{"store":1},"avg3":2}');
  const s = FLOW.rpaSummary(rpa);
  assert.deepStrictEqual(s.dcs, []);
  assert.deepStrictEqual(s.extras.map(e => e.label), ['PR belum PO', 'SO belum OD', 'OD belum GI', 'GI belum GR']);
});

test('buildCsv: sel dengan kutip, newline, dan \\r tunggal di-quote', () => {
  const header = { strNumber: 'S1', site: 'J1', kodeVendor: 'V1', planReceiveMs: new Date(2026, 10, 20).getTime() };
  const items = [{ seq: 1, article: '1', description: 'a"b\nc\rd', requestQty: 1, approvalQty: 1 }];
  const csv = FLOW.buildCsv(header, items, {});
  assert.ok(csv.indexOf('"a""b\nc\rd"') !== -1, csv);
  const lone = FLOW.buildCsv(header, [{ seq: 1, article: '1', description: 'x\ry', requestQty: 1, approvalQty: 1 }], {});
  assert.ok(lone.indexOf('"x\ry"') !== -1, lone);
});

test('buildCsv: tanggal dari string numerik, kosong bila tidak valid', () => {
  const items = [{ seq: 1, article: '1', description: 'd', requestQty: 1, approvalQty: 1 }];
  const ms = new Date(2026, 10, 20).getTime();
  const col = function (v) {
    return FLOW.buildCsv({ strNumber: 'S', site: 'J1', kodeVendor: 'V', planReceiveMs: v }, items, {}).split('\r\n')[1].split(',')[6];
  };
  assert.strictEqual(col(String(ms)), '20.11.2026');
  assert.strictEqual(col(undefined), '');
  assert.strictEqual(col('abc'), '');
});

test('runLimited: limit tidak valid tetap menjalankan semua tugas', async () => {
  const mk = (v) => () => Promise.resolve(v);
  assert.deepStrictEqual(await FLOW.runLimited([mk(1), mk(2), mk(3)], undefined), [1, 2, 3]);
  assert.deepStrictEqual(await FLOW.runLimited([mk(1), mk(2), mk(3)], 0), [1, 2, 3]);
  assert.deepStrictEqual(await FLOW.runLimited([mk(1), mk(2)], NaN), [1, 2]);
});

test('runLimited: setelah satu tugas gagal, sisa tugas tidak dimulai', async () => {
  const started = [];
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const tasks = [
    () => { started.push('A'); return delay(20).then(() => 'A'); },
    () => { started.push('B'); return delay(5).then(() => { throw new Error('boom'); }); },
    () => { started.push('C'); return Promise.resolve('C'); },
    () => { started.push('D'); return Promise.resolve('D'); }
  ];
  await assert.rejects(FLOW.runLimited(tasks, 2), /boom/);
  await delay(60);
  assert.deepStrictEqual(started, ['A', 'B']);
});

test('runLimited: throw sinkron menjadi promise ditolak', async () => {
  const p = FLOW.runLimited([() => { throw new Error('sync'); }], 2);
  await assert.rejects(p, /sync/);
});

test('validateMdDecisions: q hanya spasi tidak valid', () => {
  const items = [{ seq: 1, requestQty: 5, approvalQty: 5 }];
  const v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'qty', q: '  ' }]);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(FLOW.validateMdDecisions(items, [{ seq: 1, d: 'qty', q: null }]).ok, false);
  assert.strictEqual(FLOW.validateMdDecisions(items, [{ seq: 1, d: 'qty' }]).ok, false);
});

test('finalQty dan parseMdReview: kasus tepi', () => {
  assert.strictEqual(FLOW.finalQty({ seq: 1, requestQty: 12, approvalQty: 0 }, {}), 0);
  assert.strictEqual(FLOW.finalQty({ seq: 1, requestQty: 12, approvalQty: 10 }, null), 10);
  assert.deepStrictEqual(FLOW.parseMdReview('null'), {});
  assert.deepStrictEqual(FLOW.parseMdReview('5'), {});
});

test('roleOverride: kosong bila sessionStorage tidak ada (node)', () => {
  assert.strictEqual(typeof sessionStorage, 'undefined');
  assert.strictEqual(FLOW.roleOverride(), '');
});

test('roleOverride: mengembalikan nilai tersimpan, kosong bila null', () => {
  global.sessionStorage = { getItem: (k) => (k === '_roleOverride' ? 'md' : null) };
  try {
    assert.strictEqual(FLOW.roleOverride(), 'md');
    global.sessionStorage = { getItem: () => null };
    assert.strictEqual(FLOW.roleOverride(), '');
  } finally {
    delete global.sessionStorage;
  }
});

test('roleOverride: kosong bila getItem melempar error', () => {
  global.sessionStorage = { getItem: () => { throw new Error('blocked'); } };
  try {
    assert.strictEqual(FLOW.roleOverride(), '');
  } finally {
    delete global.sessionStorage;
  }
});

test('scopeSites: ICO, manager, anonim', () => {
  assert.strictEqual(FLOW.scopeSites({ isICO: true, override: 'ico', icoSites: ['A'] }), null);
  assert.deepStrictEqual(FLOW.scopeSites({ isICO: true, override: '', icoSites: ['A', 'B'] }), ['A', 'B']);
  assert.deepStrictEqual(FLOW.scopeSites({ isICO: true, override: '' }), []);
  assert.deepStrictEqual(FLOW.scopeSites({ isICO: false, openId: 'u1', mySites: ['J1'] }), ['J1']);
  assert.deepStrictEqual(FLOW.scopeSites({ isICO: false, openId: 'u1' }), []);
  assert.deepStrictEqual(FLOW.scopeSites({ isICO: false, openId: '', mySites: ['J1'] }), []);
});

test('scopedFilter: tanpa site, satu site, banyak site, terlalu banyak site', () => {
  const base = [{ field_name: 'Status', operator: 'is', value: ['X'] }];
  assert.deepStrictEqual(FLOW.scopedFilter(base, null), { conjunction: 'and', conditions: base });
  assert.deepStrictEqual(FLOW.scopedFilter(base, []), { conjunction: 'and', conditions: base });

  const one = FLOW.scopedFilter(base, ['J347']);
  assert.deepStrictEqual(one.conditions[1], { field_name: 'Site', operator: 'is', value: ['J347'] });
  assert.strictEqual(one.children, undefined);
  assert.strictEqual(base.length, 1, 'conditions asli tidak boleh berubah');

  const two = FLOW.scopedFilter(base, ['J347', 'J999']);
  assert.strictEqual(two.conditions.length, 1);
  assert.deepStrictEqual(two.children, [{ conjunction: 'or', conditions: [
    { field_name: 'Site', operator: 'is', value: ['J347'] },
    { field_name: 'Site', operator: 'is', value: ['J999'] }
  ] }]);

  const many = [];
  for (let i = 0; i < 21; i++) many.push('S' + i);
  const big = FLOW.scopedFilter(base, many);
  assert.strictEqual(big.children, undefined);
  assert.strictEqual(big.conditions.length, 1);
});

test('monthMarkers', () => {
  const ms = (y, m, d) => new Date(y, m - 1, d).getTime();
  assert.deepStrictEqual(FLOW.monthMarkers(ms(2026, 11, 1), ms(2026, 11, 9)), ['/11/2026']);
  assert.deepStrictEqual(FLOW.monthMarkers(ms(2026, 11, 20), ms(2027, 1, 3)), ['/11/2026', '/12/2026', '/01/2027']);
  assert.strictEqual(FLOW.monthMarkers(ms(2026, 1, 1), ms(2026, 6, 30)).length, 6);
  assert.strictEqual(FLOW.monthMarkers(ms(2026, 1, 1), ms(2026, 7, 1)), null);
  assert.deepStrictEqual(FLOW.monthMarkers(ms(2026, 1, 1), ms(2026, 3, 1), 2), null);
  // rentang terbalik lintas bulan = kosong; dalam bulan yang sama tetap satu penanda
  assert.deepStrictEqual(FLOW.monthMarkers(ms(2026, 6, 1), ms(2026, 5, 1)), []);
  assert.deepStrictEqual(FLOW.monthMarkers(ms(2026, 5, 9), ms(2026, 5, 1)), ['/05/2026']);
});

test('detailFilters: per bulan, dibatasi site lewat nomor dokumen', () => {
  const ms = (y, m, d) => new Date(y, m - 1, d).getTime();
  const all = FLOW.detailFilters('STR Number', null, ms(2026, 10, 1), ms(2026, 11, 9));
  assert.deepStrictEqual(all, [
    { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'contains', value: ['/10/2026'] }] },
    { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'contains', value: ['/11/2026'] }] }
  ]);
  const one = FLOW.detailFilters('STR Number', ['J999'], ms(2026, 11, 1), ms(2026, 11, 9));
  assert.deepStrictEqual(one, [{ conjunction: 'and', conditions: [
    { field_name: 'STR Number', operator: 'contains', value: ['/11/2026'] },
    { field_name: 'STR Number', operator: 'contains', value: ['/J999/'] }
  ] }]);
  const two = FLOW.detailFilters('ADJ Number', ['J1', 'J2'], ms(2026, 11, 1), ms(2026, 11, 9));
  assert.strictEqual(two[0].conditions.length, 1);
  assert.deepStrictEqual(two[0].children[0].conditions.map((c) => c.value[0]), ['/J1/', '/J2/']);
  assert.strictEqual(FLOW.detailFilters('STR Number', null, ms(2024, 11, 1), ms(2026, 11, 9)), null);
});

test('clampRangeStart: rentang lebih dari 6 bulan dipotong ke awal bulan ke-6 terakhir', () => {
  const ms = (y, m, d) => new Date(y, m - 1, d).getTime();
  assert.strictEqual(FLOW.clampRangeStart(ms(2026, 1, 1), ms(2026, 6, 30)), ms(2026, 1, 1));
  assert.strictEqual(FLOW.clampRangeStart(ms(2024, 11, 1), ms(2026, 11, 9)), ms(2026, 6, 1));
  assert.strictEqual(FLOW.clampRangeStart(ms(2026, 5, 9), ms(2026, 5, 1)), ms(2026, 5, 9));
  assert.strictEqual(FLOW.clampRangeStart(ms(2026, 1, 15), ms(2026, 11, 9), 3), ms(2026, 9, 1));
});
test('filterItems: cari nomor/site/nama site, filter site, tanpa filter = semua', () => {
  const items = [
    { strNumber: '0001/J999/Kitchen/11/2026', site: 'J999', siteName: 'Jakarta Test' },
    { strNumber: '0002/H001/Bedroom/11/2026', site: 'H001', siteName: 'Batam' },
    { strNumber: '0003/J999/Bedroom/11/2026', site: 'J999', siteName: 'Jakarta Test' }
  ];
  assert.strictEqual(FLOW.filterItems(items, {}).length, 3);
  assert.strictEqual(FLOW.filterItems(items, { q: '  0002 ' }).length, 1);
  assert.strictEqual(FLOW.filterItems(items, { q: 'batam' }).length, 1);
  assert.strictEqual(FLOW.filterItems(items, { q: 'j999' }).length, 2);
  assert.strictEqual(FLOW.filterItems(items, { site: 'J999' }).length, 2);
  assert.strictEqual(FLOW.filterItems(items, { site: 'J999', q: 'bedroom' }).length, 1);
  assert.strictEqual(FLOW.filterItems(items, { site: 'X' }).length, 0);
});

test('siteOptions: site unik terurut dengan nama', () => {
  const o = FLOW.siteOptions([
    { site: 'J999', siteName: 'Jakarta Test' }, { site: 'H001', siteName: 'Batam' }, { site: 'J999', siteName: 'Jakarta Test' }, { site: '' }
  ]);
  assert.deepStrictEqual(o, [{ site: 'H001', label: 'H001 — Batam' }, { site: 'J999', label: 'J999 — Jakarta Test' }]);
});

test('koliCheck: vektor bersama', () => {
  const c = (q, k) => FLOW.koliCheck(q, k);
  assert.deepStrictEqual(c(4, 2), { ok: true });
  assert.deepStrictEqual(c(5, 2), { ok: false, lower: 4, upper: 6, error: 'Qty harus kelipatan 2 (terdekat: 4 atau 6)' });
  assert.deepStrictEqual(c(1, 5), { ok: false, lower: 0, upper: 5, error: 'Qty harus kelipatan 5 (terdekat: 5)' });
  assert.deepStrictEqual(c(0, 5), { ok: true });
  assert.deepStrictEqual(c(7, 1), { ok: true });
  assert.deepStrictEqual(c(7, 0), { ok: true });
  assert.deepStrictEqual(c(7, ''), { ok: true });
  assert.deepStrictEqual(c(7, undefined), { ok: true });
  assert.deepStrictEqual(c(NaN, 3), { ok: true });
  assert.deepStrictEqual(c(90, 90), { ok: true });
  const r = c(91, 90);
  assert.deepStrictEqual([r.ok, r.lower, r.upper], [false, 90, 180]);
});

test('validateApprovalQtys', () => {
  assert.deepStrictEqual(FLOW.validateApprovalQtys([]), { ok: true, error: '' });
  assert.deepStrictEqual(FLOW.validateApprovalQtys([{ seq: 1, qty: 4, koli: 2 }, { seq: 2, qty: 0, koli: 5 }, { seq: 3, qty: 7 }]),
    { ok: true, error: '' });
  assert.deepStrictEqual(FLOW.validateApprovalQtys([{ seq: 1, qty: 4, koli: 2 }, { seq: 2, qty: 5, koli: 2 }, { seq: 3, qty: 1, koli: 5 }]),
    { ok: false, error: 'Item 2: Qty harus kelipatan 2 (terdekat: 4 atau 6)' });
});

test('validateMdDecisions memakai Koli hanya untuk keputusan qty', () => {
  const items = [{ seq: 1, requestQty: 5, approvalQty: 5, koli: 2 }, { seq: 2, requestQty: 4, approvalQty: 4 }];
  let v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'qty', q: '6' }, { seq: 2, d: 'qty', q: '3' }]);
  assert.deepStrictEqual([v.ok, v.kept], [true, 2]);
  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'qty', q: '5' }, { seq: 2, d: 'ok' }]);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.error, 'Item 1: Qty harus kelipatan 2 (terdekat: 4 atau 6)');
  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'ok' }, { seq: 2, d: 'ok' }]);
  assert.strictEqual(v.ok, true);
  v = FLOW.validateMdDecisions(items, [{ seq: 1, d: 'qty', q: '0' }, { seq: 2, d: 'reject' }]);
  assert.strictEqual(v.ok, true);
});

test('buildCsv: kolom Purchasing Group diisi dari pgrMap (kunci kode huruf kecil), kosong bila tak ada', () => {
  const header = { strNumber: 'S1', site: 'J1', kodeVendor: 'V1', planReceiveMs: new Date(2026, 10, 20).getTime() };
  const items = [
    { seq: 1, article: ' 10432739 ', description: 'a', requestQty: 1, approvalQty: 1 },
    { seq: 2, article: 'ABC-1', description: 'b', requestQty: 2, approvalQty: 2 },
    { seq: 3, article: '10559370', description: 'c', requestQty: 3, approvalQty: 3 },
    { seq: 4, article: '10709927', description: 'd', requestQty: 4, approvalQty: 4 }
  ];
  const map = { '10432739': 'J15', 'abc-1': 'J33', '10709927': 'J10' };
  const lines = FLOW.buildCsv(header, items, { 4: { d: 'reject' } }, map).split('\r\n');
  assert.strictEqual(lines.length, 4);   // item 4 (tolak) tidak ikut
  assert.strictEqual(lines[1].split(',')[9], 'J15');
  assert.strictEqual(lines[2].split(',')[9], 'J33');
  assert.strictEqual(lines[3].split(',')[9], '');   // tidak ada di peta
  assert.strictEqual(FLOW.buildCsv(header, items, {}).split('\r\n')[1].split(',')[9], '');   // tanpa peta = seperti sebelumnya
});

test('csvMissingPgr: kode dengan qty final > 0 yang tak punya PGR', () => {
  const items = [
    { seq: 1, article: '10432739', requestQty: 1, approvalQty: 1 },
    { seq: 2, article: 'ABC-1', requestQty: 2, approvalQty: 2 },
    { seq: 3, article: '10559370', requestQty: 3, approvalQty: 3 },
    { seq: 4, article: '777', requestQty: 0, approvalQty: 0 }
  ];
  assert.deepStrictEqual(FLOW.csvMissingPgr(items, { 3: { d: 'reject' } }, { '10432739': 'J15' }), ['ABC-1']);
  assert.deepStrictEqual(FLOW.csvMissingPgr(items, {}, { '10432739': 'J15', 'abc-1': 'J33', '10559370': 'J1' }), []);
  assert.deepStrictEqual(FLOW.csvMissingPgr(items, {}, undefined), ['10432739', 'ABC-1', '10559370']);
});

test('parseRpaData: angka berformat (spasi dan koma ribuan) terbaca, teks biasa jadi 0', () => {
  const r = FLOW.parseRpaData(JSON.stringify({ v: 1, stok: { store: '  1,023', rdc: 'seratus', splt: '5 0', dc: {} }, avg3: ' 2.5 ' }));
  assert.strictEqual(r.stok.store, 1023);
  assert.strictEqual(r.stok.rdc, 0);        // huruf 's' tidak boleh ikut terbuang lalu terbaca sebagai angka
  assert.strictEqual(r.stok.splt, 50);
  assert.strictEqual(r.avg3, 2.5);
});

test('buildCsvMany: satu baris judul, baris semua STR berurutan, sama dengan buildCsv per STR', () => {
  const ms = new Date(2026, 10, 20).getTime();
  const h1 = { strNumber: 'S1', site: 'J1', kodeVendor: 'V1', planReceiveMs: ms };
  const h2 = { strNumber: 'S2', site: 'J2', kodeVendor: 'V2', planReceiveMs: ms };
  const i1 = [{ seq: 1, article: 'A1', description: 'a, b', requestQty: 2, approvalQty: 2 },
              { seq: 2, article: 'A2', description: 'c', requestQty: 1, approvalQty: 1 }];
  const i2 = [{ seq: 1, article: 'B1', description: 'd', requestQty: 5, approvalQty: 5 }];
  const r = FLOW.buildCsvMany([{ header: h1, items: i1, review: {} }, { header: h2, items: i2, review: {} }]);
  const lines = r.csv.split('\r\n');
  assert.strictEqual(lines[0], FLOW.CSV_COLS.join(','));
  assert.strictEqual(lines.length, 4);
  assert.strictEqual(r.rowCount, 3);
  assert.deepStrictEqual(r.skipped, []);
  const one = FLOW.buildCsv(h1, i1, {}).split('\r\n').slice(1).concat(FLOW.buildCsv(h2, i2, {}).split('\r\n').slice(1));
  assert.deepStrictEqual(lines.slice(1), one);
});

test('buildCsvMany: entri tanpa baris masuk skipped; pgrMap dipakai lintas entri; kosong = judul saja', () => {
  const h1 = { strNumber: 'S1', site: 'J1', kodeVendor: 'V1', planReceiveMs: 0 };
  const h2 = { strNumber: 'S2', site: 'J2', kodeVendor: 'V2', planReceiveMs: 0 };
  const h3 = { strNumber: 'S3', site: 'J3', kodeVendor: 'V3', planReceiveMs: 0 };
  const mk = (a, q) => [{ seq: 1, article: a, description: 'd', requestQty: q, approvalQty: q }];
  const r = FLOW.buildCsvMany([
    { header: h1, items: mk('X1', 1), review: {} },
    { header: h2, items: mk('X2', 0), review: {} },
    { header: h3, items: mk('X3', 4), review: { 1: { d: 'ok' } } }
  ], { x1: 'J15', x3: 'J33' });
  const lines = r.csv.split('\r\n');
  assert.strictEqual(r.rowCount, 2);
  assert.deepStrictEqual(r.skipped, ['S2']);
  assert.strictEqual(lines[1].split(',')[9], 'J15');
  assert.strictEqual(lines[2].split(',')[9], 'J33');
  const empty = FLOW.buildCsvMany([]);
  assert.strictEqual(empty.csv, FLOW.CSV_COLS.join(','));
  assert.strictEqual(empty.rowCount, 0);
  assert.deepStrictEqual(empty.skipped, []);
});

test('csvFileName: PR-IP-YYYYMMDD-HHMM-<n>STR.csv dari bagian tanggal lokal', () => {
  assert.strictEqual(FLOW.csvFileName(new Date(2026, 0, 5, 9, 7), 3), 'PR-IP-20260105-0907-3STR.csv');
  assert.strictEqual(FLOW.csvFileName(new Date(2026, 10, 13, 23, 59), 12), 'PR-IP-20261113-2359-12STR.csv');
});
