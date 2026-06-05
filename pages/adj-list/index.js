var _allRecords   = [];
var _activeFilter = 'all';
var _currentUser  = { openId: '', nickName: 'User' };
var _mySites      = [];
var _searchText   = '';
var _icoMap       = {};

function toDateInput(d) {
  var m = d.getMonth() + 1; var day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0'+m : m) + '-' + (day < 10 ? '0'+day : day);
}
var _today        = new Date();
var _firstOfMonth = new Date(_today.getFullYear(), _today.getMonth(), 1);
var _dateFrom     = toDateInput(_firstOfMonth);
var _dateTo       = toDateInput(_today);

function statusBadgeClass(status) {
  if (status === CONFIG.STATUS_ADJ_WAITING_ICO)  return 'badge-waiting-ico';
  if (status === CONFIG.STATUS_ADJ_NEED_POSTING) return 'badge-need-posting';
  if (status === CONFIG.STATUS_ADJ_DONE)         return 'badge-done';
  if (status === CONFIG.STATUS_ADJ_REJECT)       return 'badge-reject';
  return 'badge-waiting-ico';
}

function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function dayStartMs(ds) {
  if (!ds) return 0;
  var p = ds.split('-');
  return new Date(+p[0], +p[1]-1, +p[2], 0,0,0,0).getTime();
}
function dayEndMs(ds) {
  if (!ds) return Infinity;
  var p = ds.split('-');
  return new Date(+p[0], +p[1]-1, +p[2], 23,59,59,999).getTime();
}

function filterRecords(records, filter) {
  var result = records;
  if (filter !== 'all') {
    var map = {
      'waiting-ico':  CONFIG.STATUS_ADJ_WAITING_ICO,
      'need-posting': CONFIG.STATUS_ADJ_NEED_POSTING,
      'done':         CONFIG.STATUS_ADJ_DONE,
      'reject':       CONFIG.STATUS_ADJ_REJECT
    };
    result = result.filter(function(r) { return r.status === map[filter]; });
  }
  if (_searchText) {
    var q = _searchText.toLowerCase();
    result = result.filter(function(r) {
      return r.adjNumber.toLowerCase().indexOf(q) !== -1 ||
             r.requestedBy.toLowerCase().indexOf(q) !== -1;
    });
  }
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
      recordId:      r.record_id,
      adjNumber:     fieldText(r.fields['ADJ Number']),
      site:          fieldText(r.fields['Site']),
      siteName:      fieldText(r.fields['Site Name']),
      department:    fieldText(r.fields['Department']),
      jenis:         fieldText(r.fields['Jenis Adjusment']),
      keterangan:    fieldText(r.fields['Keterangan Adjustment']),
      status:        fieldText(r.fields['Status']),
      requestedBy:   fieldText(r.fields['Requested By']),
      submitDate:    fmtDate(r.fields['Submit Date']),
      submitDateRaw: r.fields['Submit Date'] || 0
    };
  });
}

function renderList(records) {
  var filtered = filterRecords(records, _activeFilter);
  if (filtered.length === 0) { show('screen-empty'); return; }
  var container = document.getElementById('list-container');
  container.innerHTML = filtered.map(function(item) {
    return '<div class="card" data-adj="' + escHtml(item.adjNumber) +
           '" data-record="' + escHtml(item.recordId) +
           '" data-status="' + escHtml(item.status) + '">' +
      '<div class="card-header">' +
        '<span class="str-num">' + escHtml(item.adjNumber) + '</span>' +
        '<span class="badge ' + statusBadgeClass(item.status) + '">' + escHtml(item.status) + '</span>' +
      '</div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Jenis</span><span>' + escHtml(item.jenis) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Ket.</span><span>' + escHtml(item.keterangan) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
    '</div>';
  }).join('');

  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      var s         = card.dataset.status;
      var qs        = '?adj=' + encodeURIComponent(card.dataset.adj) +
                      '&record=' + encodeURIComponent(card.dataset.record);
      var userIsICO = isICO(_currentUser.openId, _icoMap);
      var dest = (userIsICO &&
                  (s === CONFIG.STATUS_ADJ_WAITING_ICO || s === CONFIG.STATUS_ADJ_NEED_POSTING))
        ? '../adj-ico-detail/index.html' + qs
        : '../adj-detail/index.html'     + qs;
      window.location.href = dest;
    });
  });
  show('screen-list');
}

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

function loadList() {
  show('screen-loading');
  getUserInfo().then(function(user) {
    var pADJ   = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID, null);
    var pICO   = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.MASTER_ICO_TABLE_ID, null);
    var pSites = user.openId
      ? larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null)
      : Promise.resolve([]);

    Promise.all([pADJ, pSites, pICO]).then(function(results) {
      var adjRecords  = results[0];
      var siteRecords = results[1];
      var icoRecords  = results[2];
      _icoMap = buildIcoMap(icoRecords);

      var mySites = !isICO(user.openId, _icoMap)
        ? siteRecords
            .filter(function(r) {
              var smUsers = r.fields[CONFIG.MASTER_SM_USER_FIELD];
              if (!smUsers) return false;
              var arr = Array.isArray(smUsers) ? smUsers : [smUsers];
              return arr.some(function(u) { return (u.id || u.open_id || u.openId) === user.openId; });
            })
            .map(function(r) { return fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]); })
            .filter(Boolean)
        : [];

      _currentUser = user;
      _mySites     = mySites;

      var visible;
      if (isICO(user.openId, _icoMap)) {
        try {
          if (sessionStorage.getItem('_roleOverride') === 'ico') { visible = adjRecords; }
          else {
            var icoSites = _icoMap[user.openId] || [];
            visible = adjRecords.filter(function(r) { return icoSites.indexOf(fieldText(r.fields['Site'])) !== -1; });
          }
        } catch(e) {
          var icoSites2 = _icoMap[user.openId] || [];
          visible = adjRecords.filter(function(r) { return icoSites2.indexOf(fieldText(r.fields['Site'])) !== -1; });
        }
      } else if (user.openId && mySites.length > 0) {
        visible = adjRecords.filter(function(r) { return mySites.indexOf(fieldText(r.fields['Site'])) !== -1; });
      } else {
        visible = []; // No role / no site → no data
      }

      _allRecords = mapRecords(visible);
      renderList(_allRecords);
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
      show('screen-error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

document.getElementById('btn-back').addEventListener('click', function() {
  window.location.href = '../home/index.html';
});
document.getElementById('btn-retry').addEventListener('click', loadList);

document.getElementById('filter-tabs').querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    _activeFilter = tab.dataset.filter;
    renderList(_allRecords);
  });
});

var _searchTimer = null;
document.getElementById('search-input').addEventListener('input', function() {
  clearTimeout(_searchTimer);
  var val = this.value;
  _searchTimer = setTimeout(function() { _searchText = val.trim(); renderList(_allRecords); }, 300);
});
document.getElementById('date-from').addEventListener('change', function() { _dateFrom = this.value; renderList(_allRecords); });
document.getElementById('date-to').addEventListener('change',   function() { _dateTo   = this.value; renderList(_allRecords); });
document.getElementById('btn-clear-dates').addEventListener('click', function() {
  _dateFrom = ''; _dateTo = '';
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value   = '';
  renderList(_allRecords);
});

document.getElementById('date-from').value = _dateFrom;
document.getElementById('date-to').value   = _dateTo;

document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
