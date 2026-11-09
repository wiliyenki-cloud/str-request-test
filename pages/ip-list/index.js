var PAGE_SIZE     = 50;
var HEADER_FIELDS = ['STR Number', 'Site', 'Site Name', 'Department', 'Plan Receive Date', 'Submit Date', 'Status'];
var _items = [];
var _shown = PAGE_SIZE;

function show(id) {
  ['screen-loading', 'screen-error', 'screen-empty', 'screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function showError(err) {
  document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
  show('screen-error');
}

function mapHeader(r) {
  return {
    recordId:        r.record_id,
    strNumber:       fieldText(r.fields['STR Number']),
    site:            fieldText(r.fields['Site']),
    siteName:        fieldText(r.fields['Site Name']),
    department:      fieldText(r.fields['Department']),
    status:          fieldText(r.fields['Status']),
    submitRaw:       r.fields['Submit Date'] || 0,
    submitDate:      fmtDate(r.fields['Submit Date']),
    planReceiveDate: fmtDate(r.fields['Plan Receive Date'])
  };
}

function card(item) {
  var label = item.status === FLOW.S.CSV_READY ? 'Menunggu PR' : 'Siap dibuat CSV';
  return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
    '<div class="card-header">' +
      '<span class="str-num">' + escHtml(item.strNumber) + '</span>' +
      '<span class="badge-ico">' + label + '</span>' +
    '</div>' +
    '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
    '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
    '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
    '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
  '</div>';
}

function render() {
  if (_items.length === 0) { show('screen-empty'); return; }
  var container = document.getElementById('list-container');
  var html = _items.slice(0, _shown).map(card).join('');
  if (_items.length > _shown) {
    html += '<button id="btn-more" class="btn-more">Tampilkan lebih (' + (_items.length - _shown) + ')</button>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.card').forEach(function(el) {
    el.addEventListener('click', function() {
      window.location.href = '../ip-detail/index.html?str=' + encodeURIComponent(el.dataset.str) +
        '&record=' + encodeURIComponent(el.dataset.record);
    });
  });
  var more = document.getElementById('btn-more');
  if (more) more.addEventListener('click', function() { _shown += PAGE_SIZE; render(); });
  show('screen-list');
}

function searchByStatus(status) {
  return larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, {
    conjunction: 'and',
    conditions: [{ field_name: 'Status', operator: 'is', value: [status] }]
  }, { fieldNames: HEADER_FIELDS });
}

function load() {
  if (!CONFIG.FLOW_V2) {
    document.getElementById('empty-text').textContent = 'Halaman ini hanya tersedia di mode uji.';
    show('screen-empty');
    return;
  }
  show('screen-loading');
  getUserInfo().then(function(user) {
    var asIp = FLOW.roleOverride() === 'ip';   // mode uji dari panel DBG
    if (!asIp && (!user.openId || CONFIG.IP_USER_IDS.indexOf(user.openId) === -1)) {
      document.getElementById('empty-text').textContent = 'Anda tidak terdaftar sebagai IP.';
      show('screen-empty');
      return null;
    }
    return Promise.all([searchByStatus(FLOW.S.WAITING_IP), searchByStatus(FLOW.S.CSV_READY)]).then(function(results) {
      _items = [].concat(results[0], results[1]).map(mapHeader);
      _items.sort(function(a, b) { return a.submitRaw - b.submitRaw; });
      _shown = PAGE_SIZE;
      render();
    });
  }).catch(showError);
}

document.getElementById('btn-back').addEventListener('click', function() {
  window.location.href = '../home/index.html';
});
document.getElementById('btn-retry').addEventListener('click', load);
load();
