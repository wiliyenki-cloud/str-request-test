function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function renderList(list) {
  var container = document.getElementById('list-container');
  container.innerHTML = list.map(function(item) {
    return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
      '<div class="card-header"><span class="str-num">' + escHtml(item.strNumber) + '</span><span class="badge-ico">Waiting Create</span></div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
    '</div>';
  }).join('');

  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      window.location.href = '../ico-detail/index.html?str=' + encodeURIComponent(card.dataset.str) + '&record=' + encodeURIComponent(card.dataset.record);
    });
  });
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
    Promise.all([
      larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.MASTER_ICO_TABLE_ID, null),
      larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
        { conjunction: 'and', conditions: [{ field_name: 'Status', operator: 'is', value: [CONFIG.STATUS_WAITING_ICO] }] })
    ]).then(function(results) {
      var icoMap   = buildIcoMap(results[0]);
      var icoSites = isICO(user.openId, icoMap) ? (icoMap[user.openId] || []) : [];

      var list = results[1].map(function(r) {
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

      // Filter by ICO's assigned sites (override 'ico' skips filter)
      var filtered;
      try {
        filtered = sessionStorage.getItem('_roleOverride') === 'ico'
          ? list
          : icoSites.length > 0
            ? list.filter(function(item) { return icoSites.indexOf(item.site) !== -1; })
            : [];
      } catch(e) {
        filtered = icoSites.length > 0
          ? list.filter(function(item) { return icoSites.indexOf(item.site) !== -1; })
          : [];
      }

      if (filtered.length === 0) { show('screen-empty'); return; }
      renderList(filtered);
      show('screen-list');
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
      show('screen-error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

document.getElementById('btn-retry').addEventListener('click', loadList);
document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
