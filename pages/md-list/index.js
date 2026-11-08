var PAGE_SIZE     = 50;
var HEADER_FIELDS = ['STR Number', 'Site', 'Site Name', 'Department', 'Plan Receive Date', 'Submit Date'];
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
    submitRaw:       r.fields['Submit Date'] || 0,
    submitDate:      fmtDate(r.fields['Submit Date']),
    planReceiveDate: fmtDate(r.fields['Plan Receive Date'])
  };
}

function card(item) {
  return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
    '<div class="card-header">' +
      '<span class="str-num">' + escHtml(item.strNumber) + '</span>' +
      '<span class="badge-ico">Review MD</span>' +
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
      window.location.href = '../md-detail/index.html?str=' + encodeURIComponent(el.dataset.str) +
        '&record=' + encodeURIComponent(el.dataset.record);
    });
  });
  var more = document.getElementById('btn-more');
  if (more) more.addEventListener('click', function() { _shown += PAGE_SIZE; render(); });
  show('screen-list');
}

function load() {
  if (!CONFIG.FLOW_V2) {
    document.getElementById('empty-text').textContent = 'Halaman ini hanya tersedia di mode uji.';
    show('screen-empty');
    return;
  }
  show('screen-loading');
  getUserInfo().then(function(user) {
    var depts = FLOW.mdDepartmentsFor(user.openId, CONFIG.MD_MAP);
    if (depts.length === 0) {
      document.getElementById('empty-text').textContent = 'Anda tidak terdaftar sebagai MD.';
      show('screen-empty');
      return null;
    }
    // Satu pencarian per department, status dan department difilter di server, paling banyak 2 paralel.
    var tasks = depts.map(function(d) {
      return function() {
        return larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, {
          conjunction: 'and',
          conditions: [
            { field_name: 'Status',     operator: 'is', value: [FLOW.S.WAITING_MD] },
            { field_name: 'Department', operator: 'is', value: [d] }
          ]
        }, { fieldNames: HEADER_FIELDS });
      };
    });
    return FLOW.runLimited(tasks, 2).then(function(results) {
      _items = [].concat.apply([], results).map(mapHeader);
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
