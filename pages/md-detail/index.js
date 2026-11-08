var HEADER_FIELDS = ['STR Number', 'Site', 'Site Name', 'Type STR', 'Supplying Site', 'Department',
                     'Plan Receive Date', 'Requested By', 'Submit Date', 'Status'];
var DETAIL_FIELDS = ['STR Number', 'Row Sequence', 'Article', 'Description', 'Stock Qty', 'Stock DC',
                     'Sales Qty', 'Suggested Qty', 'Request Qty', 'Approval Qty', 'Reason'];

var _recordId  = '';
var _strNumber = '';
var _acting    = false;
var _items     = [];

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

function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#333';
  t.style.display = '';
  setTimeout(function() { t.style.display = 'none'; }, 2500);
}

function setActing(val) {
  _acting = val;
  document.getElementById('btn-send').disabled = val;
  document.getElementById('btn-start-reject').disabled = val;
  document.getElementById('btn-send').textContent = val ? 'Menyimpan...' : 'Kirim ke IP';
  document.getElementById('btn-confirm-reject').disabled = val || !document.getElementById('reject-reason').value.trim();
}

function num(v) { return v != null ? v : ''; }

function renderHeader(h) {
  var rows = [
    ['STR Number', h.strNumber, true],
    ['Site', h.site + (h.siteName ? ' — ' + h.siteName : ''), false],
    ['Type STR', h.typeStr, false],
    ['Supplying Site', h.supplyingSite, false],
    ['Department', h.department, false],
    ['Plan Receive', h.planReceiveDate, false],
    ['Requested By', h.requestedBy, false],
    ['Submit Date', h.submitDate, false]
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(r[1]) + '</span></div>';
    }).join('');
}

function renderItems(items) {
  _items = items;
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th class="num">Stok</th><th class="num">Stok DC</th>' +
    '<th class="num">Jual</th><th class="num">Saran</th><th class="num">Apv Qty</th><th>Keputusan</th><th>Qty MD</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    var apv = it.approvalQty !== '' ? it.approvalQty : it.requestQty;
    return '<tr data-seq="' + escHtml(it.seq) + '">' +
      '<td>' + escHtml(it.seq) + '</td><td>' + escHtml(it.article) + '</td><td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(String(it.stockQty)) + '</td><td class="num">' + escHtml(String(it.stockDc)) + '</td>' +
      '<td class="num">' + escHtml(String(it.salesQty)) + '</td><td class="num">' + escHtml(String(it.suggestedQty)) + '</td>' +
      '<td class="num">' + escHtml(String(apv)) + '</td>' +
      '<td><select class="md-dec"><option value="">Pilih</option><option value="ok">Setuju</option>' +
        '<option value="qty">Ubah qty</option><option value="reject">Tolak</option></select></td>' +
      '<td><input type="number" class="md-qty" min="0" max="999" disabled value="' + escHtml(String(apv)) + '"></td>' +
      '</tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
  document.querySelectorAll('#items-table select.md-dec').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var input = sel.closest('tr').querySelector('.md-qty');
      input.disabled = (sel.value !== 'qty');
    });
  });
}

function collectDecisions() {
  return Array.prototype.map.call(document.querySelectorAll('#items-table tbody tr'), function(tr) {
    return { seq: Number(tr.dataset.seq), d: tr.querySelector('.md-dec').value, q: tr.querySelector('.md-qty').value };
  });
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
    var status = fieldText(h.fields['Status']);
    if (status !== FLOW.S.WAITING_MD) {
      showFail('STR ini tidak sedang menunggu review MD (status: ' + status + ').');
      return;
    }
    var details = results[1];
    details.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });
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
    renderItems(details.map(function(r) {
      return {
        seq:          fieldText(r.fields['Row Sequence']),
        article:      fieldText(r.fields['Article']),
        description:  fieldText(r.fields['Description']),
        stockQty:     num(r.fields['Stock Qty']),
        stockDc:      num(r.fields['Stock DC']),
        salesQty:     num(r.fields['Sales Qty']),
        suggestedQty: num(r.fields['Suggested Qty']),
        requestQty:   num(r.fields['Request Qty']),
        approvalQty:  num(r.fields['Approval Qty'])
      };
    }));
    document.getElementById('footer-main').style.display = '';
    show('screen-content');
  }).catch(function(err) {
    showFail('Gagal memuat: ' + (err.message || String(err)));
  });
}

// Kirim ke IP: satu update header (Status + MD Review). Semua item ditolak = STR ditolak.
document.getElementById('btn-send').addEventListener('click', function() {
  if (_acting) return;
  var decisions = collectDecisions();
  var v = FLOW.validateMdDecisions(_items, decisions);
  if (!v.ok) { showToast(v.error, '#c62828'); return; }
  setActing(true);
  getUserInfo().then(function(user) {
    var fields = {
      'Status':         FLOW.statusAfterMd(v.kept),
      'MD Review':      FLOW.serializeMdReview(decisions),
      'MD Reviewed By': user.nickName || 'MD'
    };
    if (v.kept === 0) {
      fields['Reject Stage']  = 'MD';
      fields['Reject Reason'] = 'Semua item ditolak MD';
    }
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, fields)
      .then(function() { return v.kept; });
  }).then(function(kept) {
    showToast(kept > 0 ? 'Terkirim ke IP.' : 'Semua item ditolak, STR ditolak.', kept > 0 ? '#2e7d32' : '#c62828');
    setTimeout(function() { window.history.back(); }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

document.getElementById('btn-start-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = '';
  document.getElementById('footer-main').style.display = 'none';
  document.getElementById('footer-reject').style.display = '';
});

document.getElementById('btn-cancel-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = 'none';
  document.getElementById('reject-reason').value = '';
  document.getElementById('footer-reject').style.display = 'none';
  document.getElementById('footer-main').style.display = '';
});

document.getElementById('reject-reason').addEventListener('input', function() {
  document.getElementById('btn-confirm-reject').disabled = !this.value.trim();
});

document.getElementById('btn-confirm-reject').addEventListener('click', function() {
  var reason = document.getElementById('reject-reason').value.trim();
  if (_acting || !reason) return;
  setActing(true);
  getUserInfo().then(function(user) {
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
      'Status':         FLOW.S.REJECT,
      'Reject Stage':   'MD',
      'Reject Reason':  reason,
      'MD Reviewed By': user.nickName || 'MD'
    });
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
