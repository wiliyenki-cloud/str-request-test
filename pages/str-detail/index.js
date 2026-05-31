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

function fmtDate(ms) {
  if (!ms) return '-';
  return new Date(ms).toLocaleDateString('id-ID');
}

function statusBadgeClass(status) {
  if (status === CONFIG.STATUS_WAITING_MGR) return 'badge-waiting-mgr';
  if (status === CONFIG.STATUS_WAITING_ICO) return 'badge-waiting-ico';
  if (status === CONFIG.STATUS_DONE)        return 'badge-done';
  if (status === CONFIG.STATUS_REJECT)      return 'badge-reject';
  return 'badge-waiting-mgr';
}

function renderHeader(h) {
  var rows = [
    ['STR Number',    '<span class="bold">' + escHtml(h.strNumber) + '</span>'],
    ['Status',        '<span class="badge ' + statusBadgeClass(h.status) + '">' + escHtml(h.status) + '</span>'],
    ['Site',          escHtml(h.site) + (h.siteName ? ' � ' + escHtml(h.siteName) : '')],
    ['Type STR',      escHtml(h.typeStr)],
    ['Supplying Site',escHtml(h.supplyingSite)],
    ['Department',    escHtml(h.department)],
    ['Plan Receive',  escHtml(h.planReceiveDate)],
    ['Requested By',  escHtml(h.requestedBy)],
    ['Submit Date',   escHtml(h.submitDate)],
    ['Approved By',   escHtml(h.approvedBy)],
    ['Approved Date', escHtml(h.approvedDate)],
    ['PR Number',     escHtml(h.prNumber) || '-'],
    ['Reject Reason', escHtml(h.rejectReason) || '-']
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val">' + r[1] + '</span></div>';
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
  var params = getParams();
  var strNumber = params.str || '';

  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [strNumber] }] }
  ).then(function(headerRecords) {
    if (headerRecords.length === 0) throw new Error('STR tidak ditemukan');
    var h = headerRecords[0];

    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
      { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [strNumber] }] }
    ).then(function(detailRecords) {
      detailRecords.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });

      renderHeader({
        strNumber:       fieldText(h.fields['STR Number']),
        status:          fieldText(h.fields['Status']),
        site:            fieldText(h.fields['Site']),
        siteName:        fieldText(h.fields['Site Name']),
        typeStr:         fieldText(h.fields['Type STR']),
        supplyingSite:   fieldText(h.fields['Supplying Site']),
        department:      fieldText(h.fields['Department']),
        planReceiveDate: fmtDate(h.fields['Plan Receive Date']),
        requestedBy:     fieldText(h.fields['Requested By']),
        submitDate:      fmtDate(h.fields['Submit Date']),
        approvedBy:      fieldText(h.fields['Approved By']),
        approvedDate:    fmtDate(h.fields['Approved Date']),
        prNumber:        fieldText(h.fields['PR Number']),
        rejectReason:    fieldText(h.fields['Reject Reason'])
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

      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

loadDetail();
document.getElementById('btn-back').addEventListener('click', function() { window.history.back(); });
