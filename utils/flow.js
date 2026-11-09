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

  // items: [{seq, requestQty, approvalQty}], decisions: [{seq, d, q}]
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
  function buildCsv(header, items, review) {
    var rows = [];
    items.forEach(function (it) {
      var qty = finalQty(it, review);
      if (qty <= 0) return;
      rows.push([
        'ZNB1', '', '', it.article, it.description, qty, ddmmyyyy(header.planReceiveMs),
        header.site, '1000', '', 'RJ20', '', header.kodeVendor, 'Y1', header.strNumber
      ].map(csvCell).join(','));
    });
    return [CSV_COLS.join(',')].concat(rows).join('\r\n');
  }

  function hash(s) {
    var h = 7;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  // Data RPA karangan untuk uji. Di produksi RPA STR yang menulis nilai ini.
  function dummyRpa(site, article) {
    var h = hash(site + '|' + article);
    var stock = h % 40;
    var sales = 8 + (h >>> 3) % 50;
    return { stockQty: stock, stockDc: 100 + (h >>> 5) % 400, salesQty: sales, suggestedQty: Math.max(0, sales - stock) };
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

  return {
    S: S, CSV_COLS: CSV_COLS,
    parseMdReview: parseMdReview, serializeMdReview: serializeMdReview,
    finalQty: finalQty, validateMdDecisions: validateMdDecisions, statusAfterMd: statusAfterMd,
    buildCsv: buildCsv, dummyRpa: dummyRpa, mdDepartmentsFor: mdDepartmentsFor, runLimited: runLimited,
    roleOverride: roleOverride
  };
})();

if (typeof module !== 'undefined') module.exports = FLOW;
