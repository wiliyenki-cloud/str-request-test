var _recordId  = '';
var _strNumber = '';
var _acting    = false;

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

function renderItems(items) {
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>Stock</th><th>Sales</th><th>Req Qty</th><th>Reason</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    return '<tr><td>' + escHtml(it.seq) + '</td><td>' + escHtml(it.article) + '</td><td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(it.stockQty) + '</td><td class="num">' + escHtml(it.salesQty) + '</td>' +
      '<td class="num">' + escHtml(it.requestQty) + '</td><td>' + escHtml(it.reason) + '</td></tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

function loadDetail() {
  show('screen-loading');
  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
  ).then(function(headerRecords) {
    if (headerRecords.length === 0) throw new Error('STR tidak ditemukan');
    var h = headerRecords[0];
    _recordId = h.record_id;

    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
      { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
    ).then(function(detailRecords) {
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
          seq:         fieldText(r.fields['Row Sequence']),
          article:     fieldText(r.fields['Article']),
          description: fieldText(r.fields['Description']),
          stockQty:    r.fields['Stock Qty']     != null ? r.fields['Stock Qty'] : '',
          salesQty:    r.fields['Sales Qty']     != null ? r.fields['Sales Qty'] : '',
          requestQty:  r.fields['Request Qty']   != null ? r.fields['Request Qty'] : '',
          reason:      fieldText(r.fields['Reason'])
        };
      }));

      document.getElementById('footer-main').style.display = '';
      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

// Approve: Status → 'Waiting Create by ICO'
document.getElementById('btn-approve').addEventListener('click', function() {
  if (_acting) return;
  setActing(true);
  getUserInfo().then(function(user) {
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
      'Status':        CONFIG.STATUS_WAITING_ICO,
      'Approved By':   user.nickName || 'Manager',
      'Approved Date': Date.now()
    });
  }).then(function() {
    setActing(false);
    showToast('STR Approved! → Waiting Create by ICO', '#2e7d32');
    setTimeout(function() { tt.navigateBack(); }, 1500);
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
    setTimeout(function() { tt.navigateBack(); }, 1500);
  }).catch(function(err) {
    showToast('Reject gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Init
var params = getParams();
_strNumber = params.str || '';
_recordId  = params.record || '';

document.getElementById('btn-back').addEventListener('click', function() { tt.navigateBack(); });

if (!_strNumber) {
  document.getElementById('err-text').textContent = 'Parameter STR tidak ditemukan.';
  show('screen-error');
} else {
  loadDetail();
}
