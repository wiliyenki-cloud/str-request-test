var _allRecords   = [];
var _activeFilter = 'all';
var _currentUser  = { openId: '', nickName: 'User' };
var _mySites      = [];

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
      planReceiveDate: fmtDate(r.fields['Plan Receive Date']),
      prNumber:        fieldText(r.fields['PR Number'])
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
        // Hanya manager yg bisa approve
        dest = '../approval-detail/index.html' + qs;
      } else if (s === CONFIG.STATUS_WAITING_ICO && userIsICO) {
        // Hanya ICO yg bisa process
        dest = '../ico-detail/index.html' + qs;
      } else {
        // Semua lainnya: read-only
        dest = '../str-detail/index.html' + qs;
      }
      if (typeof dbg === 'function') dbg('nav → ' + dest.split('/').slice(-2).join('/') + ' (role:' + (userIsICO ? 'ICO' : userIsMgr ? 'Mgr' : 'anon') + ' status:' + s + ')');
      window.location.href = dest;
    });
  });
  show('screen-list');
}

function applyFilter(allSTR, user, mySites) {
  // ICO sees all records
  if (isICO(user.openId)) {
    if (typeof dbg === 'function') dbg('role: ICO → show all ' + allSTR.length + ' records');
    return allSTR;
  }
  // Manager with known openId → filter by site
  if (user.openId && mySites.length > 0) {
    var filtered = allSTR.filter(function(r) {
      return mySites.indexOf(fieldText(r.fields['Site'])) !== -1;
    });
    if (typeof dbg === 'function') dbg('role: Manager sites=[' + mySites.join(',') + '] → ' + filtered.length + ' records');
    return filtered;
  }
  // No openId or no sites mapped → show all
  if (typeof dbg === 'function') dbg('role: anonymous/unmatched → show all ' + allSTR.length + ' records');
  return allSTR;
}

function loadList() {
  show('screen-loading');
  if (typeof dbg === 'function') dbg('--- loadList start ---');

  getUserInfo().then(function(user) {
    if (typeof dbg === 'function') dbg('getUserInfo → openId=' + (user.openId || '(empty)') + ' nick=' + user.nickName);
    if (typeof dbg === 'function') dbg('isICO=' + isICO(user.openId));

    // Fetch STR records and MASTER SITE in parallel
    var pSTR   = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, null);
    var pSites = user.openId && !isICO(user.openId)
      ? larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null)
      : Promise.resolve([]);

    Promise.all([pSTR, pSites]).then(function(results) {
      var strRecords  = results[0];
      var siteRecords = results[1];

      if (typeof dbg === 'function') dbg('STR records: ' + strRecords.length + ', site records: ' + siteRecords.length);

      // Resolve manager's sites from MASTER SITE table
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
    // Fallback: load all without filtering
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
document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
