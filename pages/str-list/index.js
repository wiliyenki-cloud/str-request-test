var _allRecords   = [];
var _activeFilter = 'all';
var _currentUser  = { openId: '', nickName: 'User' };
var _mySites      = [];
var _searchText   = '';

// ── Default date range: 1st of current month → today ─────────────────────────
function toDateInput(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart ? String(d.getMonth() + 1).padStart(2, '0') : (d.getMonth() + 1 < 10 ? '0' + (d.getMonth() + 1) : '' + (d.getMonth() + 1));
  var day = d.getDate() < 10 ? '0' + d.getDate() : '' + d.getDate();
  return y + '-' + m + '-' + day;
}
var _today          = new Date();
var _firstOfMonth   = new Date(_today.getFullYear(), _today.getMonth(), 1);
var _dateFrom       = toDateInput(_firstOfMonth);   // 'YYYY-MM-DD'
var _dateTo         = toDateInput(_today);           // 'YYYY-MM-DD'

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

// ── Parse date string YYYY-MM-DD to start/end of day (local time) ────────────
function dayStartMs(dateStr) {
  if (!dateStr) return 0;
  var p = dateStr.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2], 0, 0, 0, 0).getTime();
}
function dayEndMs(dateStr) {
  if (!dateStr) return Infinity;
  var p = dateStr.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59, 999).getTime();
}

// ── Filter: status tab + text search + date range ────────────────────────────
function filterRecords(records, filter) {
  var result = records;

  // Status tab
  if (filter !== 'all') {
    var map = {
      'waiting-mgr': CONFIG.STATUS_WAITING_MGR,
      'waiting-ico': CONFIG.STATUS_WAITING_ICO,
      'done':        CONFIG.STATUS_DONE,
      'reject':      CONFIG.STATUS_REJECT
    };
    var target = map[filter];
    result = result.filter(function(r) { return r.status === target; });
  }

  // Text search — STR Number atau Requester (case-insensitive)
  if (_searchText) {
    var q = _searchText.toLowerCase();
    result = result.filter(function(r) {
      return r.strNumber.toLowerCase().indexOf(q) !== -1 ||
             r.requestedBy.toLowerCase().indexOf(q) !== -1;
    });
  }

  // Date range — by Submit Date
  if (_dateFrom) {
    var from = dayStartMs(_dateFrom);
    result = result.filter(function(r) { return r.submitDateRaw >= from; });
  }
  if (_dateTo) {
    var to = dayEndMs(_dateTo);
    result = result.filter(function(r) { return r.submitDateRaw <= to; });
  }

  return result;
}

function mapRecords(records) {
  return records.map(function(r) {
    return {
      recordId:        r.record_id,
      strNumber:       fieldText(r.fields['STR Number']),
      site:            fieldText(r.fields['Site']),
      siteName:        fieldText(r.fields['Site Name']),
      department:      fieldText(r.fields['Department']),
      status:          fieldText(r.fields['Status']),
      submitDate:      fmtDate(r.fields['Submit Date']),
      submitDateRaw:   r.fields['Submit Date'] || 0,
      planReceiveDate: fmtDate(r.fields['Plan Receive Date']),
      prNumber:        fieldText(r.fields['PR Number']),
      requestedBy:     fieldText(r.fields['Requested By'])
    };
  });
}

function renderList(records) {
  var filtered = filterRecords(records, _activeFilter);
  if (filtered.length === 0) { show('screen-empty'); return; }
  var container = document.getElementById('list-container');
  container.innerHTML = filtered.map(function(item) {
    return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '" data-status="' + escHtml(item.status) + '">' +
      '<div class="card-header">' +
        '<span class="str-num">' + escHtml(item.strNumber) + '</span>' +
        '<span class="badge ' + statusBadgeClass(item.status) + '">' + escHtml(item.status) + '</span>' +
      '</div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Department</span><span>' + escHtml(item.department) + '</span></div>' +
      (item.requestedBy ? '<div class="card-row"><span class="lbl">Requester</span><span>' + escHtml(item.requestedBy) + '</span></div>' : '') +
      '<div class="card-row"><span class="lbl">Submit Date</span><span>' + escHtml(item.submitDate) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
      (item.prNumber ? '<div class="card-row"><span class="lbl">PR Number</span><span>' + escHtml(item.prNumber) + '</span></div>' : '') +
    '</div>';
  }).join('');
  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      var s          = card.dataset.status;
      var qs         = '?str=' + encodeURIComponent(card.dataset.str) + '&record=' + encodeURIComponent(card.dataset.record);
      var userIsICO  = isICO(_currentUser.openId);
      var userIsMgr  = !userIsICO && !!_currentUser.openId && _mySites.length > 0;
      var dest;
      if (s === CONFIG.STATUS_WAITING_MGR && userIsMgr) {
        dest = '../approval-detail/index.html' + qs;
      } else if (s === CONFIG.STATUS_WAITING_ICO && userIsICO) {
        dest = '../ico-detail/index.html' + qs;
      } else {
        dest = '../str-detail/index.html' + qs;
      }
      if (typeof dbg === 'function') dbg('nav → ' + dest.split('/').slice(-2).join('/') + ' (role:' + (userIsICO ? 'ICO' : userIsMgr ? 'Mgr' : 'anon') + ' status:' + s + ')');
      window.location.href = dest;
    });
  });
  show('screen-list');
}

function applyFilter(allSTR, user, mySites) {
  if (isICO(user.openId)) {
    if (typeof dbg === 'function') dbg('role: ICO → show all ' + allSTR.length + ' records');
    return allSTR;
  }
  if (user.openId && mySites.length > 0) {
    var filtered = allSTR.filter(function(r) {
      return mySites.indexOf(fieldText(r.fields['Site'])) !== -1;
    });
    if (typeof dbg === 'function') dbg('role: Manager sites=[' + mySites.join(',') + '] → ' + filtered.length + ' records');
    return filtered;
  }
  if (typeof dbg === 'function') dbg('role: anonymous/unmatched → show all ' + allSTR.length + ' records');
  return allSTR;
}

function loadList() {
  show('screen-loading');
  if (typeof dbg === 'function') dbg('--- loadList start ---');

  getUserInfo().then(function(user) {
    if (typeof dbg === 'function') dbg('getUserInfo → openId=' + (user.openId || '(empty)') + ' nick=' + user.nickName);
    if (typeof dbg === 'function') dbg('isICO=' + isICO(user.openId));

    var pSTR   = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, null);
    var pSites = user.openId && !isICO(user.openId)
      ? larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null)
      : Promise.resolve([]);

    Promise.all([pSTR, pSites]).then(function(results) {
      var strRecords  = results[0];
      var siteRecords = results[1];

      if (typeof dbg === 'function') dbg('STR records: ' + strRecords.length + ', site records: ' + siteRecords.length);

      var mySites = siteRecords
        .filter(function(r) {
          var smUsers = r.fields[CONFIG.MASTER_SM_USER_FIELD];
          if (!smUsers) return false;
          var arr = Array.isArray(smUsers) ? smUsers : [smUsers];
          return arr.some(function(u) {
            return (u.id || u.open_id || u.openId) === user.openId;
          });
        })
        .map(function(r) { return fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]); })
        .filter(Boolean);

      if (typeof dbg === 'function') dbg('mySites: [' + mySites.join(',') + ']');

      _currentUser = user;
      _mySites     = mySites;
      var visibleRecords = applyFilter(strRecords, user, mySites);
      _allRecords = mapRecords(visibleRecords);
      renderList(_allRecords);
    }).catch(function(err) {
      if (typeof dbg === 'function') dbg('❌ fetch error: ' + (err.message || String(err)));
      document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
      show('screen-error');
    });
  }).catch(function(err) {
    if (typeof dbg === 'function') dbg('❌ getUserInfo error: ' + (err.message || String(err)));
    larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, null)
      .then(function(records) {
        _allRecords = mapRecords(records);
        renderList(_allRecords);
      })
      .catch(function(err2) {
        document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err2.message || String(err2));
        show('screen-error');
      });
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────

// Back → home
document.getElementById('btn-back').addEventListener('click', function() {
  window.location.href = '../home/index.html';
});

// Status tabs
document.getElementById('filter-tabs').querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    _activeFilter = tab.dataset.filter;
    renderList(_allRecords);
  });
});

// Text search (debounce 300ms)
var _searchTimer = null;
document.getElementById('search-input').addEventListener('input', function() {
  clearTimeout(_searchTimer);
  var val = this.value;
  _searchTimer = setTimeout(function() {
    _searchText = val.trim();
    renderList(_allRecords);
  }, 300);
});

// Date from
document.getElementById('date-from').addEventListener('change', function() {
  _dateFrom = this.value;
  renderList(_allRecords);
});

// Date to
document.getElementById('date-to').addEventListener('change', function() {
  _dateTo = this.value;
  renderList(_allRecords);
});

// Clear dates
document.getElementById('btn-clear-dates').addEventListener('click', function() {
  _dateFrom = ''; _dateTo = '';
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value   = '';
  renderList(_allRecords);
});

// Set default date input values
document.getElementById('date-from').value = _dateFrom;
document.getElementById('date-to').value   = _dateTo;

document.getElementById('btn-retry').addEventListener('click', loadList);
document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
