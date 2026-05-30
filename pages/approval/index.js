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

function renderList(list) {
  var container = document.getElementById('list-container');
  container.innerHTML = list.map(function(item) {
    return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
      '<div class="card-header"><span class="str-num">' + escHtml(item.strNumber) + '</span><span class="badge-pending">Waiting Approval</span></div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Type</span><span>' + escHtml(item.typeStr) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Diajukan</span><span>' + escHtml(item.requestedBy) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
    '</div>';
  }).join('');

  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      window.location.href = '../approval-detail/index.html?str=' + encodeURIComponent(card.dataset.str) + '&record=' + encodeURIComponent(card.dataset.record);
    });
  });
}

function loadList() {
  show('screen-loading');
  getUserInfo().then(function(user) {
    var openId = user.openId;
    larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null).then(function(siteRecords) {
      var mySites = siteRecords
        .filter(function(r) {
          var smUsers = r.fields[CONFIG.MASTER_SM_USER_FIELD];
          if (!smUsers) return false;
          var arr = Array.isArray(smUsers) ? smUsers : [smUsers];
          return arr.some(function(u) { return (u.id || u.open_id || u.openId) === openId; });
        })
        .map(function(r) { return fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]); });

      if (mySites.length === 0) { show('screen-empty'); return; }

      larkSearch(
        CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
        { conjunction: 'and', conditions: [{ field_name: 'Status', operator: 'is', value: [CONFIG.STATUS_WAITING_MGR] }] }
      ).then(function(strRecords) {
        var list = strRecords
          .filter(function(r) { return mySites.indexOf(fieldText(r.fields['Site'])) !== -1; })
          .map(function(r) {
            return {
              recordId:    r.record_id,
              strNumber:   fieldText(r.fields['STR Number']),
              site:        fieldText(r.fields['Site']),
              siteName:    fieldText(r.fields['Site Name']),
              typeStr:     fieldText(r.fields['Type STR']),
              department:  fieldText(r.fields['Department']),
              requestedBy: fieldText(r.fields['Requested By']),
              submitDate:  fmtDate(r.fields['Submit Date'])
            };
          });

        if (list.length === 0) { show('screen-empty'); return; }
        renderList(list);
        show('screen-list');
      }).catch(function(err) {
        document.getElementById('err-text').textContent = 'Gagal memuat STR: ' + (err.message || String(err));
        show('screen-error');
      });
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat site: ' + (err.message || String(err));
      show('screen-error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal login: ' + (err.message || String(err));
    show('screen-error');
  });
}

document.getElementById('btn-retry').addEventListener('click', loadList);
document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
