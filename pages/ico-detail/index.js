var _recordId   = '';
var _strNumber  = '';
var _acting     = false;
var _itemsCache = [];   // cache for CSV export
var _headerData = {};   // header fields for CSV export

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
  ['screen-loading','screen-error','screen-content'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#333';
  t.style.display = '';
  setTimeout(function() { t.style.display = 'none'; }, 2500);
}

function setActing(val) {
  _acting = val;
  ['btn-csv','btn-start-reject','btn-start-done','btn-confirm-done','btn-confirm-reject'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.disabled = val;
  });
  if (val) {
    document.getElementById('btn-confirm-done').textContent   = 'Menyimpan...';
    document.getElementById('btn-confirm-reject').textContent = 'Menyimpan...';
  } else {
    document.getElementById('btn-confirm-done').textContent   = 'Konfirmasi Done';
    document.getElementById('btn-confirm-reject').textContent = 'Konfirmasi Reject';
  }
}

function showFooter(which) {
  ['footer-main','footer-pr','footer-reject'].forEach(function(id) {
    document.getElementById(id).style.display = (id === which) ? '' : 'none';
  });
}

function renderHeader(h) {
  var rows = [
    ['STR Number',    h.strNumber, true],
    ['Site',          h.site + (h.siteName ? ' — ' + h.siteName : ''), false],
    ['Type STR',      h.typeStr, false],
    ['Supplying Site',h.supplyingSite, false],
    ['Department',    h.department, false],
    ['Plan Receive',  h.planReceiveDate, false],
    ['Requested By',  h.requestedBy, false],
    ['Approved By',   h.approvedBy, false],
    ['Submit Date',   h.submitDate, false]
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(r[1]) + '</span></div>';
    }).join('');
}

function renderItems(items) {
  _itemsCache = items;
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>Stock</th><th>Sales</th><th>Req Qty</th><th>Apv Qty</th><th>Reason</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    var apv = it.approvalQty !== '' ? it.approvalQty : it.requestQty;
    return '<tr><td>' + escHtml(it.seq) + '</td><td>' + escHtml(it.article) + '</td><td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(it.stockQty) + '</td><td class="num">' + escHtml(it.salesQty) + '</td>' +
      '<td class="num">' + escHtml(it.requestQty) + '</td>' +
      '<td class="num" style="font-weight:700;color:#1a6fe8;">' + escHtml(String(apv)) + '</td>' +
      '<td>' + escHtml(it.reason) + '</td></tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

// CSV download — format SAP upload per template
function downloadCsv() {
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  var cols = [
    'STR ID','Type STR','Article','Description','Request Qty',
    'Unit','C','Delivery Date','Mdse','Site',
    'Stor.Loc','PGr','Requisnr','Tracking','Des.Vendor',
    'Supplying Site','Splt','POrg','Reason'
  ];
  var rows = _itemsCache.map(function(it) {
    var apvQty = it.approvalQty !== '' ? it.approvalQty : it.requestQty;
    return [
      _headerData.strNumber,      // STR ID
      _headerData.typeStr,         // Type STR
      it.article,                  // Article
      it.description,              // Description
      apvQty,                      // Request Qty (ambil dari Apv Qty)
      '',                          // Unit
      '',                          // C
      _headerData.planReceiveDate, // Delivery Date (Plan Receive Date)
      '',                          // Mdse
      _headerData.site,            // Site
      '',                          // Stor.Loc
      '',                          // PGr
      '',                          // Requisnr
      '',                          // Tracking
      _headerData.kodeVendor,      // Des.Vendor (Kode Vendor)
      _headerData.supplyingSite,   // Supplying Site
      '',                          // Splt
      'RJ20',                      // POrg (hardcode)
      it.reason                    // Reason
    ].map(csvCell).join(',');
  });
  var csv = '﻿' + cols.join(',') + '\r\n' + rows.join('\r\n');
  var uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  var a = document.createElement('a');
  a.href = uri;
  a.download = _strNumber + '-items.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function loadDetail() {
  show('screen-loading');
  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
  ).then(function(headerRecords) {
    if (headerRecords.length === 0) throw new Error('STR tidak ditemukan');
    var h = headerRecords[0];
    _recordId = h.record_id;

    // Note: larkSearch uses page_size 500. In practice STR forms cap at 10 items so no truncation.
    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
      { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
    ).then(function(detailRecords) {
      detailRecords.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });

      _headerData = {
        strNumber:       fieldText(h.fields['STR Number']),
        site:            fieldText(h.fields['Site']),
        siteName:        fieldText(h.fields['Site Name']),
        typeStr:         fieldText(h.fields['Type STR']),
        supplyingSite:   fieldText(h.fields['Supplying Site']),
        kodeVendor:      fieldText(h.fields['Kode Vendor']),
        department:      fieldText(h.fields['Department']),
        planReceiveDate: fmtDate(h.fields['Plan Receive Date']),
        requestedBy:     fieldText(h.fields['Requested By']),
        approvedBy:      fieldText(h.fields['Approved By']),
        submitDate:      fmtDate(h.fields['Submit Date'])
      };
      renderHeader(_headerData);

      renderItems(detailRecords.map(function(r) {
        return {
          seq:         fieldText(r.fields['Row Sequence']),
          article:     fieldText(r.fields['Article']),
          description: fieldText(r.fields['Description']),
          stockQty:    r.fields['Stock Qty']     != null ? r.fields['Stock Qty'] : '',
          salesQty:    r.fields['Sales Qty']     != null ? r.fields['Sales Qty'] : '',
          requestQty:  r.fields['Request Qty']   != null ? r.fields['Request Qty'] : '',
          approvalQty: r.fields['Approval Qty']  != null ? r.fields['Approval Qty'] : '',
          reason:      fieldText(r.fields['Reason'])
        };
      }));

      showFooter('footer-main');
      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

// CSV download
document.getElementById('btn-csv').addEventListener('click', function() {
  if (_itemsCache.length === 0) { showToast('Tidak ada item.', '#c62828'); return; }
  downloadCsv();
});

// Start Process Done flow: show PR input
document.getElementById('btn-start-done').addEventListener('click', function() {
  document.getElementById('section-pr').style.display = '';
  document.getElementById('section-reject').style.display = 'none';
  showFooter('footer-pr');
  document.getElementById('pr-number-input').focus();
});

// Cancel PR input
document.getElementById('btn-cancel-pr').addEventListener('click', function() {
  document.getElementById('section-pr').style.display = 'none';
  document.getElementById('pr-number-input').value = '';
  document.getElementById('btn-confirm-done').disabled = true;
  setActing(false);
  showFooter('footer-main');
});

// Enable Done confirm when PR input filled
document.getElementById('pr-number-input').addEventListener('input', function() {
  document.getElementById('btn-confirm-done').disabled = !this.value.trim();
});

// Confirm Done: Status → 'Done Create STR', PR Number = entered value
document.getElementById('btn-confirm-done').addEventListener('click', function() {
  var prNumber = document.getElementById('pr-number-input').value.trim();
  if (_acting || !prNumber) return;
  setActing(true);
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
    'Status':    CONFIG.STATUS_DONE,
    'PR Number': prNumber
  }).then(function() {
    setActing(false);
    showToast('STR Done! PR: ' + prNumber, '#2e7d32');
    setTimeout(function() { window.history.back(); }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Start Reject flow
document.getElementById('btn-start-reject').addEventListener('click', function() {
  document.getElementById('section-pr').style.display = 'none';
  document.getElementById('section-reject').style.display = '';
  showFooter('footer-reject');
  document.getElementById('reject-reason').focus();
});

// Cancel Reject
document.getElementById('btn-cancel-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = 'none';
  document.getElementById('reject-reason').value = '';
  document.getElementById('btn-confirm-reject').disabled = true;
  setActing(false);
  showFooter('footer-main');
});

// Enable Reject confirm when reason filled
document.getElementById('reject-reason').addEventListener('input', function() {
  document.getElementById('btn-confirm-reject').disabled = !this.value.trim();
});

// Confirm Reject: Status → 'Reject', PR Number = '-'
document.getElementById('btn-confirm-reject').addEventListener('click', function() {
  var reason = document.getElementById('reject-reason').value.trim();
  if (_acting || !reason) return;
  setActing(true);
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
    'Status':        CONFIG.STATUS_REJECT,
    'PR Number':     '-',
    'Reject Reason': reason
  }).then(function() {
    setActing(false);
    showToast('STR Rejected by ICO.', '#c62828');
    setTimeout(function() { window.history.back(); }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Init — _recordId is set by loadDetail() after re-fetching header by STR Number
var params = getParams();
_strNumber = params.str || '';

document.getElementById('btn-back').addEventListener('click', function() { window.history.back(); });

if (!_strNumber) {
  document.getElementById('err-text').textContent = 'Parameter STR tidak ditemukan.';
  show('screen-error');
} else {
  loadDetail();
}
