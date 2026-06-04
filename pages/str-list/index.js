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

var _allDetails    = [];
var _detailsLoaded = false;
var _currentPage   = 1;
var _pageSize      = 10;
var _headerMap     = {};   // strNumber → mapped header record
var _icoMap        = {};   // openId → [siteCode, ...]

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
      requestedBy:     fieldText(r.fields['Requested By']),
      supplyingSite:   fieldText(r.fields['Supplying Site'])
    };
  });
}

function renderList(records) {
  if (_activeFilter === 'master-detail') {
    if (!_detailsLoaded) { loadDetails(); } else { renderMasterDetail(); }
    return;
  }
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
      var userIsICO  = isICO(_currentUser.openId, _icoMap);
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

// Helper: build icoMap from Master Mapping ICO records
function buildIcoMap(icoRecords) {
  var map = {};
  icoRecords.forEach(function(r) {
    var site     = fieldText(r.fields['Site']);
    var icoUsers = r.fields['ICO'];
    if (!site || !icoUsers) return;
    (Array.isArray(icoUsers) ? icoUsers : [icoUsers]).forEach(function(u) {
      var oid = u.id || u.open_id || u.openId || '';
      if (!oid) return;
      if (!map[oid]) map[oid] = [];
      if (map[oid].indexOf(site) === -1) map[oid].push(site);
    });
  });
  return map;
}

function applyFilter(allSTR, user, mySites, icoMap) {
  if (isICO(user.openId, icoMap)) {
    // Debug override 'ico' → see all (no site restriction)
    try { if (sessionStorage.getItem('_roleOverride') === 'ico') {
      if (typeof dbg === 'function') dbg('role: ICO (override) → show all ' + allSTR.length + ' records');
      return allSTR;
    }} catch(e) {}
    var icoSites = (icoMap[user.openId] || []);
    var filtered = allSTR.filter(function(r) {
      return icoSites.indexOf(fieldText(r.fields['Site'])) !== -1;
    });
    if (typeof dbg === 'function') dbg('role: ICO sites=[' + icoSites.join(',') + '] → ' + filtered.length + ' records');
    return filtered;
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

    var pSTR   = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, null);
    var pICO   = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.MASTER_ICO_TABLE_ID, null);
    var pSites = user.openId
      ? larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null)
      : Promise.resolve([]);

    Promise.all([pSTR, pSites, pICO]).then(function(results) {
      var strRecords  = results[0];
      var siteRecords = results[1];
      var icoRecords  = results[2];

      if (typeof dbg === 'function') dbg('STR records: ' + strRecords.length + ', site records: ' + siteRecords.length + ', ico records: ' + icoRecords.length);

      // Build ICO map from Master Mapping ICO table
      _icoMap = buildIcoMap(icoRecords);
      if (typeof dbg === 'function') dbg('isICO=' + isICO(user.openId, _icoMap) + ' icoSites=[' + ((_icoMap[user.openId] || []).join(',')) + ']');

      // Manager sites (only relevant if not ICO)
      var mySites = !isICO(user.openId, _icoMap) ? siteRecords
        .filter(function(r) {
          var smUsers = r.fields[CONFIG.MASTER_SM_USER_FIELD];
          if (!smUsers) return false;
          var arr = Array.isArray(smUsers) ? smUsers : [smUsers];
          return arr.some(function(u) {
            return (u.id || u.open_id || u.openId) === user.openId;
          });
        })
        .map(function(r) { return fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]); })
        .filter(Boolean) : [];

      if (typeof dbg === 'function') dbg('mySites: [' + mySites.join(',') + ']');

      _currentUser = user;
      _mySites     = mySites;
      var visibleRecords = applyFilter(strRecords, user, mySites, _icoMap);
      _allRecords = mapRecords(visibleRecords);
      // Build lookup map for Master Detail join; reset detail cache
      _headerMap     = {};
      _allRecords.forEach(function(h) { _headerMap[h.strNumber] = h; });
      _detailsLoaded = false;
      _allDetails    = [];
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

// ── Master Detail ─────────────────────────────────────────────────────────────

function loadDetails() {
  show('screen-loading');
  larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID, null)
    .then(function(records) {
      _allDetails = records.map(function(r) {
        var strNum = fieldText(r.fields['STR Number']);
        var hdr    = _headerMap[strNum] || {};
        return {
          strNumber:    strNum,
          site:         hdr.site          || '',
          siteName:     hdr.siteName      || '',
          department:   hdr.department    || '',
          status:       hdr.status        || '',
          submitDate:   hdr.submitDate    || '-',
          submitDateRaw: hdr.submitDateRaw || 0,
          article:      fieldText(r.fields['Article']),
          description:  fieldText(r.fields['Description']),
          requestQty:   fieldText(r.fields['Request QTY']),
          approvalQty:  r.fields['Approval Qty'] != null ? r.fields['Approval Qty'] : '',
          supplyingSite: hdr.supplyingSite || '',
          prNumber:     hdr.prNumber      || ''
        };
      }).filter(function(d) {
        // Hanya tampilkan: header visible (role) + status Done + sudah ada PR Number
        return !!d.site &&
               d.status === CONFIG.STATUS_DONE &&
               !!d.prNumber;
      });
      _detailsLoaded = true;
      if (typeof dbg === 'function') dbg('loadDetails: ' + _allDetails.length + ' rows');
      renderMasterDetail();
    })
    .catch(function(err) {
      if (typeof dbg === 'function') dbg('❌ loadDetails error: ' + (err.message || String(err)));
      document.getElementById('err-text').textContent = 'Gagal memuat detail: ' + (err.message || String(err));
      show('screen-error');
    });
}

function filterDetails() {
  var result = _allDetails;
  if (_searchText) {
    var q = _searchText.toLowerCase();
    result = result.filter(function(d) {
      return d.strNumber.toLowerCase().indexOf(q)   !== -1 ||
             d.article.toLowerCase().indexOf(q)     !== -1 ||
             d.description.toLowerCase().indexOf(q) !== -1;
    });
  }
  if (_dateFrom) {
    var from = dayStartMs(_dateFrom);
    result = result.filter(function(d) { return d.submitDateRaw >= from; });
  }
  if (_dateTo) {
    var to = dayEndMs(_dateTo);
    result = result.filter(function(d) { return d.submitDateRaw <= to; });
  }
  return result;
}

function exportCSV(data) {
  var cols = ['ID STR','SITE','DEPARTMENT','REQUEST DATE','ARTICLE','DESCRIPTION','REQUEST QTY','APPROVAL QTY','SUPPLYING SITE','NO PR'];
  var rows = [cols.join(',')];
  data.forEach(function(d) {
    rows.push([
      '"' + String(d.strNumber).replace(/"/g,'""')    + '"',
      '"' + String(d.site).replace(/"/g,'""')         + '"',
      '"' + String(d.department).replace(/"/g,'""')   + '"',
      '"' + String(d.submitDate).replace(/"/g,'""')   + '"',
      '"' + String(d.article).replace(/"/g,'""')      + '"',
      '"' + String(d.description).replace(/"/g,'""')  + '"',
      String(d.requestQty),
      String(d.approvalQty !== '' ? d.approvalQty : d.requestQty),
      '"' + String(d.supplyingSite).replace(/"/g,'""')+ '"',
      '"' + String(d.prNumber).replace(/"/g,'""')     + '"'
    ].join(','));
  });
  var csv  = '﻿' + rows.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'STR-Master-Detail-' + toDateInput(new Date()) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderMasterDetail() {
  var filtered   = filterDetails();
  var totalPages = Math.ceil(filtered.length / _pageSize) || 1;
  if (_currentPage > totalPages) _currentPage = 1;
  var start    = (_currentPage - 1) * _pageSize;
  var pageData = filtered.slice(start, start + _pageSize);
  var container = document.getElementById('list-container');

  if (filtered.length === 0) { show('screen-empty'); return; }

  // Toolbar
  var toolbar = '<div class="tbl-toolbar">' +
    '<span class="tbl-info">' + filtered.length + ' data</span>' +
    '<button class="btn-export" id="btn-export-csv">&#128229; Export Excel</button>' +
    '</div>';

  // Table
  var tbl = '<div class="tbl-wrap"><table class="str-table">' +
    '<thead><tr>' +
      '<th>ID STR</th><th>SITE</th><th>DEPT</th><th>REQ DATE</th>' +
      '<th>ARTICLE</th><th>DESCRIPTION</th><th>REQ QTY</th><th>APV QTY</th>' +
      '<th>SUPPLYING SITE</th><th>NO PR</th>' +
    '</tr></thead><tbody>' +
    pageData.map(function(d) {
      return '<tr>' +
        '<td>' + escHtml(d.strNumber)    + '</td>' +
        '<td>' + escHtml(d.site)         + '</td>' +
        '<td>' + escHtml(d.department)   + '</td>' +
        '<td>' + escHtml(d.submitDate)   + '</td>' +
        '<td>' + escHtml(d.article)      + '</td>' +
        '<td>' + escHtml(d.description)  + '</td>' +
        '<td class="num">' + escHtml(String(d.requestQty)) + '</td>' +
        '<td class="num" style="font-weight:700;color:#1a6fe8;">' + escHtml(String(d.approvalQty !== '' ? d.approvalQty : d.requestQty)) + '</td>' +
        '<td>' + escHtml(d.supplyingSite)+ '</td>' +
        '<td>' + (d.prNumber ? '<span class="pr-val">' + escHtml(d.prNumber) + '</span>' : '') + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';

  // Pagination
  var pag = '';
  if (totalPages > 1) {
    var rangeStart = Math.max(1, _currentPage - 2);
    var rangeEnd   = Math.min(totalPages, _currentPage + 2);
    var pBtns = '';
    if (rangeStart > 1) { pBtns += '<button class="pg-btn" data-page="1">1</button>'; if (rangeStart > 2) pBtns += '<span class="pg-ell">…</span>'; }
    for (var i = rangeStart; i <= rangeEnd; i++) {
      pBtns += '<button class="pg-btn' + (i === _currentPage ? ' pg-active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (rangeEnd < totalPages) { if (rangeEnd < totalPages - 1) pBtns += '<span class="pg-ell">…</span>'; pBtns += '<button class="pg-btn" data-page="' + totalPages + '">' + totalPages + '</button>'; }
    pag = '<div class="pagination">' +
      '<button class="pg-btn" id="pg-prev"' + (_currentPage === 1 ? ' disabled' : '') + '>&#8249;</button>' +
      pBtns +
      '<button class="pg-btn" id="pg-next"' + (_currentPage === totalPages ? ' disabled' : '') + '>&#8250;</button>' +
    '</div>';
  }

  container.innerHTML = toolbar + tbl + pag;

  document.getElementById('btn-export-csv').addEventListener('click', function() { exportCSV(filtered); });
  container.querySelectorAll('.pg-btn[data-page]').forEach(function(btn) {
    btn.addEventListener('click', function() { _currentPage = parseInt(btn.dataset.page, 10); renderMasterDetail(); });
  });
  var prev = document.getElementById('pg-prev');
  var next = document.getElementById('pg-next');
  if (prev) prev.addEventListener('click', function() { if (_currentPage > 1) { _currentPage--; renderMasterDetail(); } });
  if (next) next.addEventListener('click', function() { if (_currentPage < totalPages) { _currentPage++; renderMasterDetail(); } });

  show('screen-list');
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
    _currentPage  = 1;
    renderList(_allRecords);
  });
});

// Text search (debounce 300ms)
var _searchTimer = null;
document.getElementById('search-input').addEventListener('input', function() {
  clearTimeout(_searchTimer);
  var val = this.value;
  _searchTimer = setTimeout(function() {
    _searchText  = val.trim();
    _currentPage = 1;
    renderList(_allRecords);
  }, 300);
});

// Date from
document.getElementById('date-from').addEventListener('change', function() {
  _dateFrom    = this.value;
  _currentPage = 1;
  renderList(_allRecords);
});

// Date to
document.getElementById('date-to').addEventListener('change', function() {
  _dateTo      = this.value;
  _currentPage = 1;
  renderList(_allRecords);
});

// Clear dates
document.getElementById('btn-clear-dates').addEventListener('click', function() {
  _dateFrom = ''; _dateTo = '';
  _currentPage = 1;
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
