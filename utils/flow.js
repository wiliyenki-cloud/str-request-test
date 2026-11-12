// Logika murni alur STR V2 — tanpa DOM dan tanpa jaringan, supaya bisa diuji dengan node --test.
// Di browser file ini membuat global FLOW; di node diekspor lewat module.exports.
var FLOW = (function () {
  var S = {
    WAITING_MGR:  'Waiting Approval by Mgr',
    APPROVED_RPA: 'Approved - Waiting RPA',
    WAITING_MD:   'Waiting MD Review',
    WAITING_IP:   'Waiting IP Release',
    CSV_READY:    'CSV Ready - Waiting PR',
    DONE:         'Done Create STR',
    REJECT:       'Reject'
  };

  // 14 kolom tab "Mockup CSV File Lark" + kolom ke-15 (usulan referensi pengajuan Lark).
  var CSV_COLS = ['Doc Type', 'PR NUMBER', 'PR Item', 'Article', 'Description', 'Quantity', 'Delivery Date',
    'Site', 'Storage Location', 'Purchasing Group', 'Purchasing Organization', 'Info Record', 'Vendor',
    'Shipping Mode', 'Lark STR Number'];

  // Keputusan MD disimpan sebagai satu JSON di header: {"1":{"d":"qty","q":3},"2":{"d":"ok"},"3":{"d":"reject"}}
  function parseMdReview(text) {
    if (!text) return {};
    try {
      var o = JSON.parse(text);
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }

  function serializeMdReview(decisions) {
    var out = {};
    decisions.forEach(function (x) {
      if (x.d === 'qty') out[String(x.seq)] = { d: 'qty', q: Number(x.q) };
      else out[String(x.seq)] = { d: x.d };
    });
    return JSON.stringify(out);
  }

  function approvedQty(item) {
    if (item.approvalQty !== '' && item.approvalQty != null) return Number(item.approvalQty) || 0;
    return Number(item.requestQty) || 0;
  }

  function finalQty(item, review) {
    var r = review && review[String(item.seq)];
    if (!r) return approvedQty(item);
    if (r.d === 'reject') return 0;
    if (r.d === 'qty') return Number(r.q) || 0;
    return approvedQty(item);
  }

  // Aturan kelipatan Koli (sama dengan pureKoliCheck di google-apps-script/Pure.gs).
  function koliCheck(qty, koli) {
    var k = Number(koli);
    k = (isFinite(k) && k >= 1 && Math.floor(k) === k) ? k : 1;
    var q = Number(qty);
    if (k === 1 || !isFinite(q) || q % k === 0) return { ok: true };
    var lower = Math.floor(q / k) * k, upper = lower + k;
    return { ok: false, lower: lower, upper: upper,
      error: 'Qty harus kelipatan ' + k + ' (terdekat: ' + (lower > 0 ? lower + ' atau ' + upper : upper) + ')' };
  }

  // items: [{seq, qty, koli}] -> kegagalan item pertama; qty 0 lolos.
  function validateApprovalQtys(items) {
    for (var i = 0; i < items.length; i++) {
      var chk = koliCheck(items[i].qty, items[i].koli);
      if (!chk.ok) return { ok: false, error: 'Item ' + items[i].seq + ': ' + chk.error };
    }
    return { ok: true, error: '' };
  }

  // items: [{seq, requestQty, approvalQty, koli?}], decisions: [{seq, d, q}]
  function validateMdDecisions(items, decisions) {
    var kept = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var dec = null;
      for (var j = 0; j < decisions.length; j++) {
        if (String(decisions[j].seq) === String(it.seq)) { dec = decisions[j]; break; }
      }
      if (!dec || ['ok', 'qty', 'reject'].indexOf(dec.d) === -1) {
        return { ok: false, error: 'Keputusan item ' + it.seq + ' belum dipilih', kept: 0 };
      }
      var qty = approvedQty(it);
      if (dec.d === 'qty') {
        var q = Number(dec.q);
        if (dec.q == null || String(dec.q).trim() === '' || !isFinite(q) || Math.floor(q) !== q || q < 0 || q > 999) {
          return { ok: false, error: 'Qty item ' + it.seq + ' harus bilangan bulat 0 sampai 999', kept: 0 };
        }
        var kc = koliCheck(q, it.koli);
        if (!kc.ok) return { ok: false, error: 'Item ' + it.seq + ': ' + kc.error, kept: 0 };
        qty = q;
      } else if (dec.d === 'reject') {
        qty = 0;
      }
      if (qty > 0) kept++;
    }
    return { ok: true, error: '', kept: kept };
  }

  function statusAfterMd(kept) { return kept > 0 ? S.WAITING_IP : S.REJECT; }

  function pad2(n) { return ('0' + n).slice(-2); }
  function ddmmyyyy(ms) {
    var t = Number(ms);
    if (!t) return '';
    var d = new Date(t);
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[,"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // header: {strNumber, site, kodeVendor, planReceiveMs}; items: [{seq, article, description, requestQty, approvalQty}]
  // pgrMap (opsional): { <kode huruf kecil>: purchasing group } dari master artikel; tanpa peta kolom Purchasing Group kosong.
  function pgrOf(it, pgrMap) {
    return (pgrMap && pgrMap[String(it.article).trim().toLowerCase()]) || '';
  }

  function buildCsv(header, items, review, pgrMap) {
    var rows = [];
    items.forEach(function (it) {
      var qty = finalQty(it, review);
      if (qty <= 0) return;
      rows.push([
        'ZNB1', '', '', it.article, it.description, qty, ddmmyyyy(header.planReceiveMs),
        header.site, '1000', pgrOf(it, pgrMap), 'RJ20', '', header.kodeVendor, 'Y1', header.strNumber
      ].map(csvCell).join(','));
    });
    return [CSV_COLS.join(',')].concat(rows).join('\r\n');
  }

  // Kode artikel (qty final > 0) yang tidak punya PGR di pgrMap.
  function csvMissingPgr(items, review, pgrMap) {
    return items.filter(function (it) {
      return finalQty(it, review) > 0 && !pgrOf(it, pgrMap);
    }).map(function (it) { return it.article; });
  }

  function hash(s) {
    var h = 7;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  // Data RPA karangan untuk uji, bentuk sama dengan kolom RPA Data. Di produksi GAS menyalin hasil RPA dari sheet.
  function dummyRpa(site, article) {
    var h = hash(site + '|' + article);
    var sales = 8 + (h >>> 3) % 50;
    return {
      v: 1,
      stok: { store: h % 40, rdc: (h >>> 7) % 60, splt: (h >>> 9) % 30,
        dc: { H001: 100 + (h >>> 5) % 400, H014: 100 + (h >>> 11) % 400 } },
      pipe: { prBelumPo: (h >>> 13) % 10, soBelumOd: (h >>> 15) % 10, odBelumGi: (h >>> 17) % 10, giBelumGr: (h >>> 19) % 10 },
      avg3: Math.round(sales / 3 * 100) / 100,
      koli: 1, pgr: 'J99', rr: '', ds: '', fm: ''
    };
  }

  function rpaNum(v) {
    var n = Number(String(v == null ? '' : v).replace(/[s,]/g, ''));
    return isFinite(n) ? n : 0;
  }

  // Urai teks JSON kolom RPA Data. Kosong, rusak, atau v bukan 1 -> null. Bagian yang hilang diisi bawaan.
  function parseRpaData(text) {
    var o;
    try { o = JSON.parse(String(text == null ? '' : text)); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || o.v !== 1) return null;
    var stok = o.stok && typeof o.stok === 'object' ? o.stok : {};
    var pipe = o.pipe && typeof o.pipe === 'object' ? o.pipe : {};
    var dcIn = stok.dc && typeof stok.dc === 'object' ? stok.dc : {};
    var dc = {};
    Object.keys(dcIn).forEach(function (k) { dc[k] = rpaNum(dcIn[k]); });
    var koli = rpaNum(o.koli);
    function txt(v) { return v == null ? '' : String(v); }
    return {
      v: 1,
      stok: { store: rpaNum(stok.store), rdc: rpaNum(stok.rdc), splt: rpaNum(stok.splt), dc: dc },
      pipe: { prBelumPo: rpaNum(pipe.prBelumPo), soBelumOd: rpaNum(pipe.soBelumOd), odBelumGi: rpaNum(pipe.odBelumGi), giBelumGr: rpaNum(pipe.giBelumGr) },
      avg3: rpaNum(o.avg3),
      koli: (koli >= 1 && Math.floor(koli) === koli) ? koli : 1,
      pgr: txt(o.pgr), rr: txt(o.rr), ds: txt(o.ds), fm: txt(o.fm)
    };
  }

  // Stok kolom DC bernama sama dengan site pemasok (tanpa peduli huruf besar/kecil); kolom tidak ada -> null.
  function rpaDcStock(rpa, supplyingSite) {
    var want = String(supplyingSite == null ? '' : supplyingSite).trim().toLowerCase();
    if (!rpa || !rpa.stok || !rpa.stok.dc || !want) return null;
    var keys = Object.keys(rpa.stok.dc);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === want) return rpa.stok.dc[keys[i]];
    }
    return null;
  }

  // Saring daftar di sisi layar: o.q = teks bebas (nomor STR, kode site, nama site), o.site = kode site persis.
  function filterItems(items, o) {
    o = o || {};
    var q = String(o.q || '').trim().toLowerCase();
    return items.filter(function (it) {
      if (o.site && it.site !== o.site) return false;
      if (!q) return true;
      return (String(it.strNumber || '') + ' ' + String(it.site || '') + ' ' + String(it.siteName || '')).toLowerCase().indexOf(q) !== -1;
    });
  }

  // Pilihan dropdown site dari data yang sudah termuat: unik, terurut, dengan nama.
  function siteOptions(items) {
    var seen = {}, out = [];
    items.forEach(function (it) {
      if (!it.site || seen[it.site]) return;
      seen[it.site] = true;
      out.push({ site: it.site, label: it.site + (it.siteName ? ' — ' + it.siteName : '') });
    });
    out.sort(function (a, b) { return a.site < b.site ? -1 : a.site > b.site ? 1 : 0; });
    return out;
  }

  function mdDepartmentsFor(openId, mdMap) {
    if (!openId || !mdMap) return [];
    return Object.keys(mdMap).filter(function (d) { return (mdMap[d] || []).indexOf(openId) !== -1; });
  }

  // Jalankan fungsi-fungsi yang mengembalikan Promise dengan konkurensi terbatas; hasil tetap berurutan.
  function runLimited(tasks, limit) {
    var results = new Array(tasks.length);
    var next = 0;
    var failed = false;
    limit = Math.max(1, Number(limit) || 1);
    function worker() {
      if (failed || next >= tasks.length) return Promise.resolve();
      var i = next++;
      var p;
      try { p = tasks[i](); } catch (e) { failed = true; return Promise.reject(e); }
      return Promise.resolve(p).then(function (r) { results[i] = r; return worker(); }, function (e) { failed = true; throw e; });
    }
    var workers = [];
    for (var k = 0; k < Math.min(limit, tasks.length); k++) workers.push(worker());
    return Promise.all(workers).then(function () { return results; });
  }

  // Role yang dipilih lewat panel DBG (sessionStorage), '' bila tidak ada atau tidak tersedia.
  function roleOverride() {
    try { return sessionStorage.getItem('_roleOverride') || ''; } catch (e) { return ''; }
  }

  // ── Cakupan data di server (untuk skala banyak store) ───────────────────────
  var MAX_SCOPE_SITES   = 20;   // di atas ini filter site tidak dikirim (halaman tetap menyaring di klien)
  var MAX_DETAIL_MONTHS = 6;    // rentang maksimal tarikan tabel detail

  // Cakupan site untuk satu user. null = semua site, [] = tidak punya akses.
  function scopeSites(o) {
    if (o.isICO) return o.override === 'ico' ? null : (o.icoSites || []);
    if (o.openId) return o.mySites || [];
    return [];
  }

  // Filter header dengan cakupan site di server.
  // sites null atau kosong = tanpa batas site (halaman yang memanggil harus menangani [] sendiri).
  // INGAT: setiap field yang dipakai di conditions harus ikut di fieldNames, karena GAS
  // menerapkan ulang conditions pada field hasil proyeksi (children tidak diterapkan ulang).
  function scopedFilter(conditions, sites, fieldName) {
    var f = { conjunction: 'and', conditions: conditions.slice() };
    fieldName = fieldName || 'Site';
    if (!sites || sites.length === 0 || sites.length > MAX_SCOPE_SITES) return f;
    if (sites.length === 1) {
      f.conditions.push({ field_name: fieldName, operator: 'is', value: [sites[0]] });
      return f;
    }
    f.children = [{
      conjunction: 'or',
      conditions: sites.map(function (s) { return { field_name: fieldName, operator: 'is', value: [s] }; })
    }];
    return f;
  }

  // Penanda bulan '/MM/YYYY' yang tercakup rentang tanggal. null bila lebih dari maxMonths.
  function monthMarkers(fromMs, toMs, maxMonths) {
    var max = maxMonths || MAX_DETAIL_MONTHS;
    var d = new Date(fromMs), end = new Date(toMs);
    var y = d.getFullYear(), m = d.getMonth();
    var out = [];
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      if (out.length >= max) return null;
      out.push('/' + pad2(m + 1) + '/' + y);
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return out;
  }

  // Awal rentang yang dipakai untuk tarikan detail: fromMs bila rentang <= maxMonths bulan kalender,
  // selain itu tanggal 1 pukul 00:00 (waktu lokal) pada bulan ke-(maxMonths-1) sebelum bulan toMs.
  function clampRangeStart(fromMs, toMs, maxMonths) {
    var max = maxMonths || MAX_DETAIL_MONTHS;
    var f = new Date(fromMs), t = new Date(toMs);
    var span = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1;
    if (span <= max) return fromMs;
    return new Date(t.getFullYear(), t.getMonth() - (max - 1), 1, 0, 0, 0, 0).getTime();
  }

  // Filter tabel detail: satu filter per bulan, dibatasi site lewat teks nomor dokumen
  // ('NNN/SITE/DEPT/MM/YYYY'). null bila rentang lebih dari maxMonths.
  function detailFilters(numberField, sites, fromMs, toMs, maxMonths) {
    var markers = monthMarkers(fromMs, toMs, maxMonths);
    if (!markers) return null;
    var scoped = !!sites && sites.length > 0 && sites.length <= MAX_SCOPE_SITES;
    return markers.map(function (mk) {
      var f = { conjunction: 'and', conditions: [{ field_name: numberField, operator: 'contains', value: [mk] }] };
      if (scoped && sites.length === 1) {
        f.conditions.push({ field_name: numberField, operator: 'contains', value: ['/' + sites[0] + '/'] });
      } else if (scoped) {
        f.children = [{
          conjunction: 'or',
          conditions: sites.map(function (s) { return { field_name: numberField, operator: 'contains', value: ['/' + s + '/'] }; })
        }];
      }
      return f;
    });
  }

  return {
    S: S, CSV_COLS: CSV_COLS,
    parseMdReview: parseMdReview, serializeMdReview: serializeMdReview,
    finalQty: finalQty, koliCheck: koliCheck, validateApprovalQtys: validateApprovalQtys, validateMdDecisions: validateMdDecisions, statusAfterMd: statusAfterMd,
    buildCsv: buildCsv, csvMissingPgr: csvMissingPgr, dummyRpa: dummyRpa, parseRpaData: parseRpaData, rpaDcStock: rpaDcStock, mdDepartmentsFor: mdDepartmentsFor, runLimited: runLimited, filterItems: filterItems, siteOptions: siteOptions,
    scopeSites: scopeSites, scopedFilter: scopedFilter, monthMarkers: monthMarkers, detailFilters: detailFilters, clampRangeStart: clampRangeStart,
    roleOverride: roleOverride
  };
})();

if (typeof module !== 'undefined') module.exports = FLOW;
