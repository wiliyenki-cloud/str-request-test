var HEADER_FIELDS = ['STR Number', 'Site', 'Site Name', 'Type STR', 'Supplying Site', 'Kode Vendor', 'Department',
                     'Plan Receive Date', 'Requested By', 'Submit Date', 'Status', 'MD Review'];
var DETAIL_FIELDS = ['STR Number', 'Row Sequence', 'Article', 'Description', 'Request Qty', 'Approval Qty'];
// Field 'RPA Data' (hasil RPA STR) hanya ada di Base uji; di produksi tidak diminta.
if (CONFIG.RPA_DATA_FIELD) DETAIL_FIELDS.push('RPA Data');
// Field 'Deadstock' (dari DATA MASTER) hanya ada di Base uji; di produksi tidak diminta.
if (CONFIG.SALES_FIELDS) DETAIL_FIELDS.push('Deadstock');

var _recordId  = '';
var _strNumber = '';
var _acting    = false;
var _header    = {};
var _items     = [];
var _review    = {};
var _status    = '';

function getParams() {
  var qs = location.search.substring(1);
  var params = {};
  qs.split('&').forEach(function(p) {
    var kv = p.split('=');
    if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
  });
  return params;
}

function show(id) {
  ['screen-loading', 'screen-error', 'screen-content'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function showFail(msg) {
  document.getElementById('err-text').textContent = msg;
  show('screen-error');
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function showToast(msg, color, ms) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#333';
  t.style.display = '';
  setTimeout(function() { t.style.display = 'none'; }, ms || 2500);
}

function setActing(val) {
  _acting = val;
  ['btn-make-csv', 'btn-start-reject', 'btn-csv-again'].forEach(function(id) {
    document.getElementById(id).disabled = val;
  });
  document.getElementById('btn-save-pr').disabled = val || !document.getElementById('pr-number-input').value.trim();
  document.getElementById('btn-confirm-reject').disabled = val || !document.getElementById('reject-reason').value.trim();
}

function showFooter(which) {
  ['footer-wait', 'footer-ready', 'footer-reject'].forEach(function(id) {
    document.getElementById(id).style.display = (id === which) ? '' : 'none';
  });
}

function renderHeader(h) {
  var rows = [
    ['STR Number', h.strNumber, true],
    ['Site', h.site + (h.siteName ? ' — ' + h.siteName : ''), false],
    ['Type STR', h.typeStr, false],
    ['Supplying Site', h.supplyingSite, false],
    ['Kode Vendor', h.kodeVendor, false],
    ['Department', h.department, false],
    ['Plan Receive', h.planReceiveDate, false],
    ['Requested By', h.requestedBy, false],
    ['Status', h.status, false]
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(r[1]) + '</span></div>';
    }).join('');
}

function mdLabel(seq) {
  var r = _review[String(seq)];
  if (!r) return '-';
  return r.d === 'ok' ? 'Setuju' : r.d === 'qty' ? 'Diubah' : r.d === 'reject' ? 'Ditolak' : '-';
}

function rpaCell(v) { return (v == null || v === '') ? '-' : escHtml(String(v)); }

// Gabungan kode DC dari semua item, urutan kemunculan pertama (urutan kolom sheet RPA).
function dcCodesOf(items) {
  var seen = {}, out = [];
  items.forEach(function(it) {
    var s = FLOW.rpaSummary(it.rpa);
    if (!s) return;
    s.dcs.forEach(function(d) { if (!seen[d.code]) { seen[d.code] = true; out.push(d.code); } });
  });
  return out;
}

// Sel stok: Toko, RDC, SPLT, lalu satu sel per kode DC; jumlahnya selalu 3 + dcCodes.length.
function stockCells(sum, dcCodes) {
  var cells = ['<td class="num">' + rpaCell(sum && sum.store) + '</td>',
               '<td class="num">' + rpaCell(sum && sum.rdc) + '</td>',
               '<td class="num">' + rpaCell(sum && sum.splt) + '</td>'];
  dcCodes.forEach(function(code) {
    var v = null;
    if (sum) sum.dcs.forEach(function(d) { if (d.code === code) v = d.value; });
    cells.push('<td class="num">' + rpaCell(v) + '</td>');
  });
  return cells.join('');
}

function stockHeads(dcCodes) {
  return '<th class="num">Stok Toko</th><th class="num">RDC</th><th class="num">SPLT</th>' +
    dcCodes.map(function(c) { return '<th class="num">' + escHtml(c) + '</th>'; }).join('');
}

// Baris detail RPA (hidden bawaan): pasangan label: nilai sebagai chip; kosong bila tidak ada RPA Data.
function rpaExtraRow(sum, colspan) {
  if (!sum || !sum.extras.length) return '';
  return '<tr class="rpa-extra" style="display:none"><td colspan="' + colspan + '">' + sum.extras.map(function(e) {
    return '<span class="rpa-chip">' + escHtml(e.label) + ': ' + escHtml(String(e.value)) + '</span>';
  }).join('') + '</td></tr>';
}

// Sel Deadstock: pil merah bila deadstock, '-' bila tanpa informasi, kosong bila bukan deadstock.
function deadCell(sd) {
  return '<td>' + (sd.dead ? '<span class="pill-dead">Deadstock</span>' : escHtml(sd.deadLabel)) + '</td>';
}

function renderItems() {
  document.getElementById('items-title').textContent = 'Item List (' + _items.length + ')';
  var dcCodes = dcCodesOf(_items);
  var sales = !!CONFIG.SALES_FIELDS;
  document.getElementById('sales-note').style.display = sales ? '' : 'none';
  var colCount = 3 + 3 + dcCodes.length + 1 + (sales ? 1 : 0) + 4; // #/Article/Description + Toko/RDC/SPLT + DC + Jual 3 bln + [Deadstock] + Req/Apv/MD/Final
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th>' + stockHeads(dcCodes) +
    '<th class="num">Jual 3 bln</th>' + (sales ? '<th>Deadstock</th>' : '') + '<th class="num">Req</th><th class="num">Apv</th><th>MD</th><th class="num">Final</th></tr></thead>';
  var tbody = '<tbody>' + _items.map(function(it) {
    var fq = FLOW.finalQty(it, _review);
    var apv = it.approvalQty !== '' ? it.approvalQty : it.requestQty;
    var sum = FLOW.rpaSummary(it.rpa);
    var toggle = sum && sum.extras.length ? ' <button type="button" class="rpa-toggle" title="Detail RPA">&#9656;</button>' : '';
    return '<tr><td>' + escHtml(it.seq) + toggle + '</td><td>' + escHtml(it.article) + '</td><td>' + escHtml(it.description) + '</td>' +
      stockCells(sum, dcCodes) + '<td class="num">' + rpaCell(sum && sum.avg3) + '</td>' +
      (sales ? deadCell(FLOW.salesDisplay(sum ? sum.avg3 : null, it.deadText)) : '') +
      '<td class="num">' + escHtml(String(it.requestQty)) + '</td><td class="num">' + escHtml(String(apv)) + '</td>' +
      '<td>' + mdLabel(it.seq) + '</td>' +
      '<td class="num' + (fq === 0 ? ' zero' : '') + '">' + fq + '</td></tr>' + rpaExtraRow(sum, colCount);
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
  document.querySelectorAll('#items-table button.rpa-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var extra = btn.closest('tr').nextElementSibling;
      var open = extra.style.display === 'none';
      extra.style.display = open ? '' : 'none';
      btn.innerHTML = open ? '&#9662;' : '&#9656;';
    });
  });
}

function downloadCsv(pgrMap) {
  var csv = '﻿' + FLOW.buildCsv(_header, _items, _review, pgrMap);
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = _strNumber.replace(/[\\/:*?"<>|&]+/g, '-') + '-PR.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Ambil Purchasing Group (PGR) dari master artikel lewat GAS, per 100 kode. Hasil: { <kode huruf kecil>: pgr }.
// PGR dari RPA Data dipakai lebih dulu; GAS hanya ditanya untuk artikel yang masih kosong.
function fetchPgrMap() {
  var seen = {}, codes = [], base = {};
  _items.forEach(function(it) {
    var c = String(it.article || '').trim();
    var key = c.toLowerCase();
    if (!c || FLOW.finalQty(it, _review) <= 0) return;
    if (it.rpa && it.rpa.pgr && String(it.rpa.pgr).trim()) base[key] = String(it.rpa.pgr).trim();
    if (!base[key] && !seen[key]) { seen[key] = true; codes.push(c); }
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

// Ambil PGR, lalu unduh CSV. Gagal ambil PGR = tidak mengunduh (reject). Hasil: daftar artikel tanpa PGR.
function prepareAndDownloadCsv() {
  return fetchPgrMap().catch(function() {
    throw new Error('Gagal membaca Purchasing Group dari master artikel, coba lagi.');
  }).then(function(pgrMap) {
    downloadCsv(pgrMap);
    return FLOW.csvMissingPgr(_items, _review, pgrMap);
  });
}

function missingPgrMessage(missing) {
  return 'Purchasing Group kosong untuk artikel: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' (+' + (missing.length - 5) + ' lainnya)' : '');
}

function keptCount() {
  return _items.filter(function(it) { return FLOW.finalQty(it, _review) > 0; }).length;
}

function loadDetail() {
  if (!CONFIG.FLOW_V2) { showFail('Halaman ini hanya tersedia di mode uji.'); return; }
  show('screen-loading');
  var filter = { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] };
  Promise.all([
    larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, filter, { fieldNames: HEADER_FIELDS }),
    larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID, filter, { fieldNames: DETAIL_FIELDS })
  ]).then(function(results) {
    if (results[0].length === 0) throw new Error('STR tidak ditemukan');
    var h = results[0][0];
    _recordId = h.record_id;
    _status   = fieldText(h.fields['Status']);
    if (_status !== FLOW.S.WAITING_IP && _status !== FLOW.S.CSV_READY) {
      showFail('STR ini tidak sedang menunggu IP (status: ' + _status + ').');
      return;
    }
    _review = FLOW.parseMdReview(fieldText(h.fields['MD Review']));
    _header = {
      strNumber:    fieldText(h.fields['STR Number']),
      site:         fieldText(h.fields['Site']),
      kodeVendor:   fieldText(h.fields['Kode Vendor']),
      planReceiveMs: h.fields['Plan Receive Date'] || 0
    };
    var details = results[1];
    details.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });
    _items = details.map(function(r) {
      return {
        seq:         fieldText(r.fields['Row Sequence']),
        article:     fieldText(r.fields['Article']),
        description: fieldText(r.fields['Description']),
        requestQty:  r.fields['Request Qty']  != null ? r.fields['Request Qty']  : '',
        approvalQty: r.fields['Approval Qty'] != null ? r.fields['Approval Qty'] : '',
        rpa:         FLOW.parseRpaData(fieldText(r.fields['RPA Data'])),
        deadText:    CONFIG.SALES_FIELDS ? fieldText(r.fields['Deadstock']) : ''
      };
    });
    renderHeader({
      strNumber:       _header.strNumber,
      site:            _header.site,
      siteName:        fieldText(h.fields['Site Name']),
      typeStr:         fieldText(h.fields['Type STR']),
      supplyingSite:   fieldText(h.fields['Supplying Site']),
      kodeVendor:      _header.kodeVendor,
      department:      fieldText(h.fields['Department']),
      planReceiveDate: fmtDate(_header.planReceiveMs),
      requestedBy:     fieldText(h.fields['Requested By']),
      status:          _status
    });
    renderItems();
    var ready = (_status === FLOW.S.CSV_READY);
    document.getElementById('section-pr').style.display = ready ? '' : 'none';
    showFooter(ready ? 'footer-ready' : 'footer-wait');
    show('screen-content');
  }).catch(function(err) {
    showFail('Gagal memuat: ' + (err.message || String(err)));
  });
}

// Buat CSV: unduh file, lalu tandai CSV Ready. Qty final nol di semua item = tidak ada yang dikirim.
document.getElementById('btn-make-csv').addEventListener('click', function() {
  if (_acting) return;
  if (keptCount() === 0) { showToast('Tidak ada item dengan Qty final lebih dari 0.', '#c62828'); return; }
  setActing(true);
  var missing = [];
  prepareAndDownloadCsv()
    .then(function(m) {
      missing = m;
      return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, { 'Status': FLOW.S.CSV_READY });
    })
    .then(function() {
      setActing(false);
      if (missing.length) showToast('CSV dibuat. ' + missingPgrMessage(missing) + '. Lengkapi manual sebelum upload ke SAP.', '#ef6c00', 7000);
      else showToast('CSV dibuat. Isi nomor PR setelah upload ke SAP.', '#2e7d32');
      loadDetail();
    }).catch(function(err) {
      showToast('Gagal: ' + (err.message || err), '#c62828');
      setActing(false);
    });
});

document.getElementById('btn-csv-again').addEventListener('click', function() {
  if (_acting) return;
  setActing(true);
  prepareAndDownloadCsv().then(function(missing) {
    setActing(false);
    if (missing.length) showToast(missingPgrMessage(missing), '#ef6c00', 7000);
  }).catch(function(err) {
    showToast(err.message || String(err), '#c62828');
    setActing(false);
  });
});

document.getElementById('pr-number-input').addEventListener('input', function() {
  document.getElementById('btn-save-pr').disabled = !this.value.trim();
});

document.getElementById('btn-save-pr').addEventListener('click', function() {
  var pr = document.getElementById('pr-number-input').value.trim();
  if (_acting || !pr) return;
  setActing(true);
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
    'Status': FLOW.S.DONE, 'PR Number': pr
  }).then(function() {
    showToast('STR Done! PR: ' + pr, '#2e7d32');
    setTimeout(function() { window.history.back(); }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

document.getElementById('btn-start-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = '';
  showFooter('footer-reject');
  document.getElementById('reject-reason').focus();
});

document.getElementById('btn-cancel-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = 'none';
  document.getElementById('reject-reason').value = '';
  showFooter('footer-wait');
});

document.getElementById('reject-reason').addEventListener('input', function() {
  document.getElementById('btn-confirm-reject').disabled = !this.value.trim();
});

document.getElementById('btn-confirm-reject').addEventListener('click', function() {
  var reason = document.getElementById('reject-reason').value.trim();
  if (_acting || !reason) return;
  setActing(true);
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
    'Status': FLOW.S.REJECT, 'Reject Stage': 'IP', 'Reject Reason': reason, 'PR Number': '-'
  }).then(function() {
    showToast('STR ditolak.', '#c62828');
    setTimeout(function() { window.history.back(); }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

var params = getParams();
_strNumber = params.str || '';
document.getElementById('btn-back').addEventListener('click', function() { window.history.back(); });
if (!_strNumber) showFail('Parameter STR tidak ditemukan.');
else loadDetail();
