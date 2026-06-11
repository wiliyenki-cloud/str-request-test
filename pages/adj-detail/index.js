var _adjNumber = '';

function getParams() {
  var qs = location.search.substring(1);
  var p  = {};
  qs.split('&').forEach(function(kv) { var a = kv.split('='); if (a[0]) p[a[0]] = decodeURIComponent(a[1] || ''); });
  return p;
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

function renderHeader(h) {
  var rows = [
    ['ADJ Number',        h.adjNumber,      true],
    ['Site',              h.site + (h.siteName ? ' — ' + h.siteName : ''), false],
    ['Department',        h.department,     false],
    ['Jenis Adjusment',  h.jenis,          false],
    ['Keterangan',        h.keterangan,     false],
    ['Status',            h.status,         false],
    ['Requested By',      h.requestedBy,    false],
    ['Submit Date',       h.submitDate,     false],
    ['Nomor Reservasi',   h.nomorReservasi, false],
    ['Approved By',       h.approvedBy,     false],
    ['Reject Reason',     h.rejectReason,   false]
  ].filter(function(r) { return r[1] !== '' && r[1] != null; });

  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info ADJ</div>' +
    rows.map(function(r) {
      return '<div class="info-row">' +
        '<span class="info-lbl">' + r[0] + '</span>' +
        '<span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(String(r[1])) + '</span>' +
      '</div>';
    }).join('');
}

function renderItems(items) {
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>System</th><th>Fisik</th><th>Disc</th><th>Receipt/Email</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    return '<tr>' +
      '<td>' + escHtml(it.seq) + '</td>' +
      '<td>' + escHtml(it.article) + '</td>' +
      '<td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(String(it.system !== '' ? it.system : '')) + '</td>' +
      '<td class="num">' + escHtml(String(it.fisik   !== '' ? it.fisik   : '')) + '</td>' +
      '<td class="num">' + escHtml(String(it.disc    !== '' ? it.disc    : '')) + '</td>' +
      '<td>' + escHtml(it.receiptEmail) + '</td>' +
    '</tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

function loadDetail() {
  show('screen-loading');
  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID,
    { conjunction: 'and', conditions: [{ field_name: 'ADJ Number', operator: 'is', value: [_adjNumber] }] }
  ).then(function(headers) {
    if (headers.length === 0) throw new Error('ADJ tidak ditemukan');
    var h = headers[0];

    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_DETAIL_TABLE_ID,
      { conjunction: 'and', conditions: [{ field_name: 'ADJ Number', operator: 'is', value: [_adjNumber] }] }
    ).then(function(details) {
      details.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });

      renderHeader({
        adjNumber:      fieldText(h.fields['ADJ Number']),
        site:           fieldText(h.fields['Site']),
        siteName:       fieldText(h.fields['Site Name']),
        department:     fieldText(h.fields['Department']),
        jenis:          fieldText(h.fields['Jenis Adjusment']),
        keterangan:     fieldText(h.fields['Keterangan Adjustment']),
        status:         fieldText(h.fields['Status']),
        requestedBy:    fieldText(h.fields['Requested By']),
        submitDate:     fmtDate(h.fields['Submit Date']),
        nomorReservasi: fieldText(h.fields['Nomor Reservasi']),
        approvedBy:     fieldText(h.fields['Approved By']),
        rejectReason:   fieldText(h.fields['Reject Reason'])
      });

      renderItems(details.map(function(r) {
        return {
          seq:          fieldText(r.fields['Row Sequence']),
          article:      fieldText(r.fields['Article']),
          description:  fieldText(r.fields['Description']),
          system:       r.fields['System Qty'] != null ? r.fields['System Qty'] : '',
          fisik:        r.fields['Fisik Qty']  != null ? r.fields['Fisik Qty']  : '',
          disc:         r.fields['Disc']       != null ? r.fields['Disc']       : '',
          receiptEmail: fieldText(r.fields['Receipt Email'])
        };
      }));

      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

var _params = getParams();
_adjNumber  = _params.adj || '';
document.getElementById('btn-back').addEventListener('click', function() { window.history.back(); });

if (!_adjNumber) {
  document.getElementById('err-text').textContent = 'Parameter ADJ tidak ditemukan.';
  show('screen-error');
} else {
  loadDetail();
}
