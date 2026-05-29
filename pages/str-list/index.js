var _allRecords = [];
var _activeFilter = 'all';

function statusBadgeClass(status) {
  if (status === CONFIG.STATUS_WAITING_MGR) return 'badge-waiting-mgr';
  if (status === CONFIG.STATUS_WAITING_ICO) return 'badge-waiting-ico';
  if (status === CONFIG.STATUS_DONE)        return 'badge-done';
  if (status === CONFIG.STATUS_REJECT)      return 'badge-reject';
  return 'badge-waiting-mgr';
}

function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
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

function filterRecords(records, filter) {
  if (filter === 'all') return records;
  var map = {
    'waiting-mgr': CONFIG.STATUS_WAITING_MGR,
    'waiting-ico': CONFIG.STATUS_WAITING_ICO,
    'done':        CONFIG.STATUS_DONE,
    'reject':      CONFIG.STATUS_REJECT
  };
  var target = map[filter];
  return records.filter(function(r) { return r.status === target; });
}

function renderList(records) {
  var filtered = filterRecords(records, _activeFilter);
  if (filtered.length === 0) { show('screen-empty'); return; }
  var container = document.getElementById('list-container');
  container.innerHTML = filtered.map(function(item) {
    return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
      '<div class="card-header">' +
        '<span class="str-num">' + escHtml(item.strNumber) + '</span>' +
        '<span class="badge ' + statusBadgeClass(item.status) + '">' + escHtml(item.status) + '</span>' +
      '</div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Department</span><span>' + escHtml(item.department) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Submit Date</span><span>' + escHtml(item.submitDate) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
      (item.prNumber ? '<div class="card-row"><span class="lbl">PR Number</span><span>' + escHtml(item.prNumber) + '</span></div>' : '') +
    '</div>';
  }).join('');
  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      window.location.href = '../str-detail/index.html?str=' + encodeURIComponent(card.dataset.str) + '&record=' + encodeURIComponent(card.dataset.record);
    });
  });
  show('screen-list');
}

function loadList() {
  show('screen-loading');
  larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, null)
    .then(function(records) {
      _allRecords = records.map(function(r) {
        return {
          recordId:        r.record_id,
          strNumber:       fieldText(r.fields['STR Number']),
          site:            fieldText(r.fields['Site']),
          siteName:        fieldText(r.fields['Site Name']),
          department:      fieldText(r.fields['Department']),
          status:          fieldText(r.fields['Status']),
          submitDate:      fmtDate(r.fields['Submit Date']),
          planReceiveDate: fmtDate(r.fields['Plan Receive Date']),
          prNumber:        fieldText(r.fields['PR Number'])
        };
      });
      renderList(_allRecords);
    })
    .catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
      show('screen-error');
    });
}

// Filter tab clicks
document.getElementById('filter-tabs').querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    _activeFilter = tab.dataset.filter;
    renderList(_allRecords);
  });
});

document.getElementById('btn-retry').addEventListener('click', loadList);

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) loadList();
});

loadList();
