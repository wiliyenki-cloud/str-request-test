var _recordId  = '';
var _strNumber = '';
var _acting    = false;
var _detailItems = [];

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
  setTimeout(function() { t.style.display = 'none'; }, 2000);
}

function setActing(val) {
  _acting = val;
  document.getElementById('btn-approve').disabled = val;
  document.getElementById('btn-start-reject').disabled = val;
  document.getElementById('btn-approve').textContent = val ? 'Menyimpan...' : 'Approve';
  var confirmBtn = document.getElementById('btn-confirm-reject');
  confirmBtn.disabled = val || !document.getElementById('reject-reason').value.trim();
  confirmBtn.textContent = val ? 'Menyimpan...' : 'Konfirmasi Reject';
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
    ['Submit Date',   h.submitDate, false]
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(r[1]) + '</span></div>';
    }).join('');
}

function koliTag(k) {
  return k > 1 ? '<div class="koli-tag">Koli ' + escHtml(String(k)) + '</div>' : '';
}

// Sel Deadstock: pil merah bila deadstock, '-' bila tanpa informasi, kosong bila bukan deadstock.
function deadCell(sd) {
  return '<td>' + (sd.dead ? '<span class="pill-dead">Deadstock</span>' : escHtml(sd.deadLabel)) + '</td>';
}

function renderItems(items) {
  _detailItems = items;
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  // Flag SALES_FIELDS: Jual 3 bln + Deadstock dari DATA MASTER menggantikan Sales isian PS.
  var sales = !!CONFIG.SALES_FIELDS;
  var salesHead = sales ? '<th class="num">Jual 3 bln</th><th>Deadstock</th>' : '<th class="num">Sales</th>';
  document.getElementById('sales-note').style.display = sales ? '' : 'none';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th class="num">Stock</th>' + salesHead + '<th class="num">Req Qty</th><th class="num">Apv Qty</th><th>Reason</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    var sd = sales ? FLOW.salesDisplay(it.avgSales, it.deadText) : null;
    var salesCells = sales
      ? '<td class="num">' + escHtml(sd.avg) + '</td>' + deadCell(sd)
      : '<td class="num">' + escHtml(it.salesQty) + '</td>';
    return '<tr data-rid="' + escHtml(it.recordId) + '">' +
      '<td>' + escHtml(it.seq) + '</td>' +
      '<td>' + escHtml(it.article) + '</td>' +
      '<td>' + escHtml(it.description) + koliTag(it.koli) + '</td>' +
      '<td class="num">' + escHtml(it.stockQty) + '</td>' +
      salesCells +
      '<td class="num">' + escHtml(it.requestQty) + '</td>' +
      '<td class="num"><input type="number" class="apv-qty-input" min="' + (it.koli > 1 ? it.koli : 0) + '"' + (it.koli > 1 ? ' step="' + it.koli + '"' : '') + ' value="' + escHtml(String(it.requestQty !== '' ? it.requestQty : 0)) + '"></td>' +
      '<td>' + escHtml(it.reason) + '</td></tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

function loadDetail() {
  show('screen-loading');
  Promise.all([
    larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
      { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
    ),
    larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
      { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
    )
  ]).then(function(results) {
    var headerRecords = results[0];
    var detailRecords = results[1];
    if (headerRecords.length === 0) throw new Error('STR tidak ditemukan');
    var h = headerRecords[0];
    _recordId = h.record_id;

    detailRecords.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });

    renderHeader({
      strNumber:       fieldText(h.fields['STR Number']),
      site:            fieldText(h.fields['Site']),
      siteName:        fieldText(h.fields['Site Name']),
      typeStr:         fieldText(h.fields['Type STR']),
      supplyingSite:   fieldText(h.fields['Supplying Site']),
      department:      fieldText(h.fields['Department']),
      planReceiveDate: fmtDate(h.fields['Plan Receive Date']),
      requestedBy:     fieldText(h.fields['Requested By']),
      submitDate:      fmtDate(h.fields['Submit Date'])
    });

    renderItems(detailRecords.map(function(r) {
      return {
        recordId:    r.record_id,
        seq:         fieldText(r.fields['Row Sequence']),
        article:     fieldText(r.fields['Article']),
        description: fieldText(r.fields['Description']),
        stockQty:    r.fields['Stock Qty']     != null ? r.fields['Stock Qty'] : '',
        salesQty:    r.fields['Sales Qty']     != null ? r.fields['Sales Qty'] : '',
        requestQty:  r.fields['Request Qty']   != null ? r.fields['Request Qty'] : '',
        reason:      fieldText(r.fields['Reason']),
        // larkSearch halaman ini tanpa fieldNames; Koli hanya dibaca di mode uji (di produksi field-nya tidak ada).
        koli:        (CONFIG.KOLI_FIELD && Number(r.fields['Koli']) > 1) ? Number(r.fields['Koli']) : 1,
        // Avg Sales 3M / Deadstock hanya dibaca bila CONFIG.SALES_FIELDS (di produksi field-nya belum ada).
        avgSales:    (CONFIG.SALES_FIELDS && typeof r.fields['Avg Sales 3M'] === 'number') ? r.fields['Avg Sales 3M'] : null,
        deadText:    CONFIG.SALES_FIELDS ? fieldText(r.fields['Deadstock']) : ''
      };
    }));

    document.getElementById('footer-main').style.display = '';
    show('screen-content');
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

// Approve: simpan Approval Qty tiap item → Status 'Waiting Create by ICO'
document.getElementById('btn-approve').addEventListener('click', function() {
  if (_acting) return;
  // Aturan kelipatan Koli: periksa sebelum ada update yang terkirim.
  var kv = FLOW.validateApprovalQtys(_detailItems.map(function(it) {
    var row = document.querySelector('#items-table tbody tr[data-rid="' + it.recordId + '"]');
    return { seq: it.seq, qty: parseFloat(row.querySelector('.apv-qty-input').value) || 0, koli: it.koli };
  }));
  if (!kv.ok) { showToast(kv.error, '#c62828'); return; }
  setActing(true);
  // Simpan Approval Qty semua item dalam satu panggilan batch (jatuh ke satu-per-satu
  // bila CONFIG.GAS_BATCH mati, lihat larkBatchUpdate di api.js).
  var rows = Array.prototype.slice.call(
    document.querySelectorAll('#items-table tbody tr[data-rid]')
  );
  var records = rows.map(function(row) {
    return {
      record_id: row.dataset.rid,
      fields: { 'Approval Qty': parseFloat(row.querySelector('.apv-qty-input').value) || 0 }
    };
  });
  larkBatchUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID, records).then(function() {
    return getUserInfo();
  }).then(function(user) {
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
      'Status':        CONFIG.STATUS_AFTER_APPROVE || CONFIG.STATUS_WAITING_ICO,
      'Approved By':   user.nickName || 'Manager',
      'Approved Date': Date.now()
    });
  }).then(function() {
    setActing(false);
    showToast('STR Approved! → ' + (CONFIG.STATUS_AFTER_APPROVE || CONFIG.STATUS_WAITING_ICO), '#2e7d32');
    setTimeout(function() { window.history.back(); }, 1500);
  }).catch(function(err) {
    showToast('Approve gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Start reject flow
document.getElementById('btn-start-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = '';
  document.getElementById('footer-main').style.display = 'none';
  document.getElementById('footer-reject').style.display = '';
});

// Cancel reject
document.getElementById('btn-cancel-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = 'none';
  document.getElementById('reject-reason').value = '';
  document.getElementById('footer-reject').style.display = 'none';
  document.getElementById('footer-main').style.display = '';
});

// Enable confirm button when reason is filled
document.getElementById('reject-reason').addEventListener('input', function() {
  document.getElementById('btn-confirm-reject').disabled = !this.value.trim();
});

// Confirm reject: Status → 'Reject'
document.getElementById('btn-confirm-reject').addEventListener('click', function() {
  var reason = document.getElementById('reject-reason').value.trim();
  if (_acting || !reason) return;
  setActing(true);
  getUserInfo().then(function(user) {
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
      'Status':        CONFIG.STATUS_REJECT,
      'Approved By':   user.nickName || 'Manager',
      'Approved Date': Date.now(),
      'Reject Reason': reason
    });
  }).then(function() {
    setActing(false);
    showToast('STR Rejected.', '#c62828');
    setTimeout(function() { window.history.back(); }, 1500);
  }).catch(function(err) {
    showToast('Reject gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Init
var params = getParams();
_strNumber = params.str || '';
_recordId  = params.record || '';

document.getElementById('btn-back').addEventListener('click', function() { window.history.back(); });

if (!_strNumber) {
  document.getElementById('err-text').textContent = 'Parameter STR tidak ditemukan.';
  show('screen-error');
} else {
  loadDetail();
}
