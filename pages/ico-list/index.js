var _activeModule = 'str';
var _strList      = [];
var _adjList      = [];
var _icoMap       = {};
var _currentUser  = { openId: '', nickName: 'User' };

function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

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

function renderList(module) {
  var list = module === 'str' ? _strList : _adjList;
  var container = document.getElementById('list-container');
  if (list.length === 0) { show('screen-empty'); return; }

  if (module === 'str') {
    container.innerHTML = list.map(function(item) {
      return '<div class="card" data-str="' + escHtml(item.strNumber) +
             '" data-record="' + escHtml(item.recordId) + '">' +
        '<div class="card-header">' +
          '<span class="str-num">' + escHtml(item.strNumber) + '</span>' +
          '<span class="badge-ico">Waiting Create</span>' +
        '</div>' +
        '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
        '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
        '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
        '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
      '</div>';
    }).join('');
    container.querySelectorAll('.card').forEach(function(card) {
      card.addEventListener('click', function() {
        window.location.href = '../ico-detail/index.html?str=' +
          encodeURIComponent(card.dataset.str) + '&record=' + encodeURIComponent(card.dataset.record);
      });
    });
  } else {
    container.innerHTML = list.map(function(item) {
      return '<div class="card" data-adj="' + escHtml(item.adjNumber) +
             '" data-record="' + escHtml(item.recordId) + '">' +
        '<div class="card-header">' +
          '<span class="str-num">' + escHtml(item.adjNumber) + '</span>' +
          '<span class="badge-adj">Waiting Create</span>' +
        '</div>' +
        '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
        '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
        '<div class="card-row"><span class="lbl">Jenis</span><span>' + escHtml(item.jenis) + '</span></div>' +
        '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
      '</div>';
    }).join('');
    container.querySelectorAll('.card').forEach(function(card) {
      card.addEventListener('click', function() {
        window.location.href = '../adj-ico-detail/index.html?adj=' +
          encodeURIComponent(card.dataset.adj) + '&record=' + encodeURIComponent(card.dataset.record);
      });
    });
  }
  show('screen-list');
}

function loadList() {
  show('screen-loading');
  getUserInfo().then(function(user) {
    _currentUser = user;
    Promise.all([
      larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.MASTER_ICO_TABLE_ID, null),
      larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
        { conjunction: 'and', conditions: [{ field_name: 'Status', operator: 'is', value: [CONFIG.STATUS_WAITING_ICO] }] }),
      larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID,
        { conjunction: 'and', conditions: [{ field_name: 'Status', operator: 'is', value: [CONFIG.STATUS_ADJ_WAITING_ICO] }] })
    ]).then(function(results) {
      _icoMap = buildIcoMap(results[0]);

      var icoSites;
      try {
        icoSites = sessionStorage.getItem('_roleOverride') === 'ico'
          ? null
          : (_icoMap[user.openId] || []);
      } catch(e) {
        icoSites = _icoMap[user.openId] || [];
      }

      function filterBySite(records, siteField) {
        if (!icoSites) return records;
        return records.filter(function(r) {
          return icoSites.indexOf(fieldText(r.fields[siteField])) !== -1;
        });
      }

      _strList = filterBySite(results[1], 'Site').map(function(r) {
        return {
          recordId:        r.record_id,
          strNumber:       fieldText(r.fields['STR Number']),
          site:            fieldText(r.fields['Site']),
          siteName:        fieldText(r.fields['Site Name']),
          department:      fieldText(r.fields['Department']),
          submitDate:      fmtDate(r.fields['Submit Date']),
          planReceiveDate: fmtDate(r.fields['Plan Receive Date'])
        };
      });

      _adjList = filterBySite(results[2], 'Site').map(function(r) {
        return {
          recordId:   r.record_id,
          adjNumber:  fieldText(r.fields['ADJ Number']),
          site:       fieldText(r.fields['Site']),
          siteName:   fieldText(r.fields['Site Name']),
          department: fieldText(r.fields['Department']),
          jenis:      fieldText(r.fields['Jenis Adjusment']),
          submitDate: fmtDate(r.fields['Submit Date'])
        };
      });

      renderList(_activeModule);
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
      show('screen-error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

document.getElementById('filter-tabs').querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('#filter-tabs .filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    _activeModule = tab.dataset.module;
    renderList(_activeModule);
  });
});

document.getElementById('btn-back').addEventListener('click', function() {
  window.location.href = '../home/index.html';
});
document.getElementById('btn-retry').addEventListener('click', loadList);
document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
