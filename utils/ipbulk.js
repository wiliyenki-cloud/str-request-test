// Bahan CSV gabungan untuk halaman daftar IP: muat header + detail satu STR dan ambil peta Purchasing Group.
// Bentuk data sama persis dengan pages/ip-detail/index.js supaya FLOW.buildCsv / FLOW.buildCsvMany dapat dipakai.
var IP_HEADER_FIELDS = ['STR Number', 'Site', 'Kode Vendor', 'Plan Receive Date', 'Status', 'MD Review'];
var IP_DETAIL_FIELDS = ['STR Number', 'Row Sequence', 'Article', 'Description', 'Request Qty', 'Approval Qty'];
// Field 'RPA Data' hanya ada di Base uji; di produksi tidak diminta.
if (CONFIG.RPA_DATA_FIELD) IP_DETAIL_FIELDS.push('RPA Data');

// Resolve { recordId, status, header, items, review }. Reject bila STR tidak ditemukan atau pencarian gagal.
function ipLoadCsvMaterial(strNumber) {
  var filter = { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [strNumber] }] };
  return Promise.all([
    larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, filter, { fieldNames: IP_HEADER_FIELDS }),
    larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID, filter, { fieldNames: IP_DETAIL_FIELDS })
  ]).then(function(results) {
    if (results[0].length === 0) throw new Error('STR tidak ditemukan');
    var h = results[0][0];
    var details = results[1].slice();
    details.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });
    return {
      recordId: h.record_id,
      status:   fieldText(h.fields['Status']),
      header: {
        strNumber:     fieldText(h.fields['STR Number']),
        site:          fieldText(h.fields['Site']),
        kodeVendor:    fieldText(h.fields['Kode Vendor']),
        planReceiveMs: h.fields['Plan Receive Date'] || 0
      },
      items: details.map(function(r) {
        return {
          seq:         fieldText(r.fields['Row Sequence']),
          article:     fieldText(r.fields['Article']),
          description: fieldText(r.fields['Description']),
          requestQty:  r.fields['Request Qty']  != null ? r.fields['Request Qty']  : '',
          approvalQty: r.fields['Approval Qty'] != null ? r.fields['Approval Qty'] : '',
          rpa:         FLOW.parseRpaData(fieldText(r.fields['RPA Data']))
        };
      }),
      review: FLOW.parseMdReview(fieldText(h.fields['MD Review']))
    };
  });
}

// entries: [{ header, items, review }]. Hasil: { <kode huruf kecil>: pgr }.
// PGR dari RPA Data dipakai lebih dulu; GAS (articlePgr, per 100 kode) hanya ditanya untuk artikel qty final > 0 yang masih kosong.
// Hasil GAS tidak menimpa nilai RPA. Gagal GAS = reject.
function ipFetchPgrMap(entries) {
  var seen = {}, codes = [], base = {};
  entries.forEach(function(e) {
    e.items.forEach(function(it) {
      var c = String(it.article || '').trim();
      var key = c.toLowerCase();
      if (!c || FLOW.finalQty(it, e.review) <= 0) return;
      if (it.rpa && it.rpa.pgr && String(it.rpa.pgr).trim()) base[key] = String(it.rpa.pgr).trim();
    });
  });
  entries.forEach(function(e) {
    e.items.forEach(function(it) {
      var c = String(it.article || '').trim();
      var key = c.toLowerCase();
      if (!c || FLOW.finalQty(it, e.review) <= 0) return;
      if (!base[key] && !seen[key]) { seen[key] = true; codes.push(c); }
    });
  });
  var chunks = [];
  for (var i = 0; i < codes.length; i += 100) chunks.push(codes.slice(i, i + 100));
  return Promise.all(chunks.map(function(ch) {
    return gasProxy({ action: 'articlePgr', codes: ch.join(',') });
  })).then(function(results) {
    var map = {};
    Object.keys(base).forEach(function(k) { map[k] = base[k]; });
    results.forEach(function(d) {
      var m = (d && d.pgr) || {};
      Object.keys(m).forEach(function(k) { if (!map[k]) map[k] = m[k]; });
    });
    return map;
  });
}
