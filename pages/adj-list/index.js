var _allRecords    = [];
var _activeFilter  = 'all';
var _currentUser   = { openId: '', nickName: 'User' };
var _mySites       = [];
var _searchText    = '';
var _icoMap        = {};

// Master Detail state
var _allDetails    = [];
var _detailsLoaded = false;
var _headerMap     = {};
var _currentPage   = 1;
var _pageSize      = 10;

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

function fmtDate(ms) { if (!ms) return '-'; var d=new Date(ms); return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear(); }

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
      recordId:        r.record_id,
      adjNumber:       fieldText(r.fields['ADJ Number']),
      site:            fieldText(r.fields['Site']),
      siteName:        fieldText(r.fields['Site Name']),
      department:      fieldText(r.fields['Department']),
      jenis:           fieldText(r.fields['Jenis Adjusment']),
      keterangan:      fieldText(r.fields['Keterangan Adjustment']),
      status:          fieldText(r.fields['Status']),
      requestedBy:     fieldText(r.fields['Requested By']),
      submitDate:      fmtDate(r.fields['Submit Date']),
      submitDateRaw:   r.fields['Submit Date'] || 0,
      nomorReservasi:  fieldText(r.fields['Nomor Reservasi']),
      approvedBy:      fieldText(r.fields['Approved By']),
      icoProcessDate:  fmtDate(r.fields['ICO Process Date'])
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
      var s        = card.dataset.status;
      var qs       = '?adj=' + encodeURIComponent(card.dataset.adj) +
                     '&record=' + encodeURIComponent(card.dataset.record);
      var userIsICO = isICO(_currentUser.openId, _icoMap);
      var userIsMgr = !userIsICO && !!_currentUser.openId && _mySites.length > 0;
      var dest;
      if (userIsICO && s === CONFIG.STATUS_ADJ_WAITING_ICO) {
        dest = '../adj-ico-detail/index.html' + qs;
      } else {
        dest = '../adj-detail/index.html' + qs;
      }
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
        visible = [];
      }

      _allRecords = mapRecords(visible);
      // Build lookup map for Master Detail join; reset detail cache
      // Key di-trim untuk guard terhadap whitespace tak terduga
      _headerMap     = {};
      _allRecords.forEach(function(h) { _headerMap[(h.adjNumber || '').trim()] = h; });
      _detailsLoaded = false;
      _allDetails    = [];
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

// ── Master Detail ─────────────────────────────────────────────────────────────

function loadDetails() {
  show('screen-loading');
  larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_DETAIL_TABLE_ID, null)
    .then(function(records) {
      var hdrKeys   = Object.keys(_headerMap);
      var hdrCount  = hdrKeys.length;
      var rawCount  = records.length;

      _allDetails = records.map(function(r) {
        // Trim adjNum untuk handle whitespace tak terduga dari Lark field
        var adjNum = (fieldText(r.fields['ADJ Number']) || '').trim();
        var hdr    = _headerMap[adjNum] || {};
        return {
          adjNumber:      adjNum,
          site:           hdr.site           || '',
          siteName:       hdr.siteName       || '',
          department:     hdr.department     || '',
          jenis:          hdr.jenis          || '',
          keterangan:     hdr.keterangan     || '',
          status:         hdr.status         || '',
          submitDate:     hdr.submitDate     || '-',
          submitDateRaw:  hdr.submitDateRaw  || 0,
          requestedBy:    hdr.requestedBy    || '',
          nomorReservasi: hdr.nomorReservasi || '',
          approvedBy:     hdr.approvedBy     || '',
          icoProcessDate: hdr.icoProcessDate || '-',
          article:        fieldText(r.fields['Article']),
          description:    fieldText(r.fields['Description']),
          system:         r.fields['System Qty'] != null ? r.fields['System Qty'] : '',
          fisik:          r.fields['Fisik Qty']  != null ? r.fields['Fisik Qty']  : '',
          disc:           r.fields['DISC']       != null ? r.fields['DISC']       : '',
          receiptEmail:   fieldText(r.fields['Receipt Email']),
          articleDoc:     fieldText(r.fields['Article Doc Adjustment'])
        };
      }).filter(function(d) {
        // Hanya baris yang header-nya visible (punya site) + status Done
        var allowed = [CONFIG.STATUS_ADJ_DONE];
        return !!d.site && allowed.indexOf(d.status) !== -1;
      });

      // ── Diagnostic: update pesan empty screen supaya ketahuan root cause ──
      var emptyEl = document.getElementById('screen-empty').querySelector('p');
      if (_allDetails.length === 0) {
        var sampleDetail = rawCount > 0
          ? '"' + (fieldText(records[0].fields['ADJ Number']) || '').trim() + '"'
          : '(tidak ada record detail)';
        var sampleHdr = hdrCount > 0
          ? '"' + hdrKeys.slice(0, 2).join('", "') + '"'
          : '(tidak ada ADJ visible untuk role Anda)';
        emptyEl.textContent =
          'Tidak ada data Master Detail.' +
          ' [detail:' + rawCount + ', hdr:' + hdrCount + ']' +
          ' contoh ADJ detail: ' + sampleDetail +
          ' | contoh hdr key: ' + sampleHdr;
      } else {
        emptyEl.textContent = 'Tidak ada data ADJ.';
      }

      _detailsLoaded = true;
      renderMasterDetail();
    })
    .catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat detail: ' + (err.message || String(err));
      show('screen-error');
    });
}

function filterDetails() {
  var result = _allDetails;
  if (_searchText) {
    var q = _searchText.toLowerCase();
    result = result.filter(function(d) {
      return (d.adjNumber    && d.adjNumber.toLowerCase().indexOf(q)    !== -1) ||
             (d.article      && d.article.toLowerCase().indexOf(q)      !== -1) ||
             (d.description  && d.description.toLowerCase().indexOf(q)  !== -1) ||
             (d.receiptEmail && d.receiptEmail.toLowerCase().indexOf(q) !== -1) ||
             (d.requestedBy  && d.requestedBy.toLowerCase().indexOf(q)  !== -1) ||
             (d.nomorReservasi && d.nomorReservasi.toLowerCase().indexOf(q) !== -1);
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
  var cols = ['ADJ Number','Site','Dept','Jenis','Keterangan','Status','No Reservasi',
              'Article','Description','System','Fisik','Disc','Receipt/Email','Article Doc',
              'Requester','Submit Date','ICO Process Date','Approved By'];
  var rows = [cols.join(',')];
  data.forEach(function(d) {
    rows.push([
      '"' + String(d.adjNumber).replace(/"/g,'""')      + '"',
      '"' + String(d.site).replace(/"/g,'""')           + '"',
      '"' + String(d.department).replace(/"/g,'""')     + '"',
      '"' + String(d.jenis).replace(/"/g,'""')          + '"',
      '"' + String(d.keterangan).replace(/"/g,'""')     + '"',
      '"' + String(d.status).replace(/"/g,'""')         + '"',
      '"' + String(d.nomorReservasi).replace(/"/g,'""') + '"',
      '"' + String(d.article).replace(/"/g,'""')        + '"',
      '"' + String(d.description).replace(/"/g,'""')    + '"',
      String(d.system !== '' ? d.system : ''),
      String(d.fisik  !== '' ? d.fisik  : ''),
      String(d.disc   !== '' ? d.disc   : ''),
      '"' + String(d.receiptEmail).replace(/"/g,'""')   + '"',
      '"' + String(d.articleDoc).replace(/"/g,'""')     + '"',
      '"' + String(d.requestedBy).replace(/"/g,'""')    + '"',
      '"' + String(d.submitDate).replace(/"/g,'""')     + '"',
      '"' + String(d.icoProcessDate).replace(/"/g,'""') + '"',
      '"' + String(d.approvedBy).replace(/"/g,'""')     + '"'
    ].join(','));
  });
  var csv  = '﻿' + rows.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'ADJ-Master-Detail-' + toDateInput(new Date()) + '.csv';
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

  var toolbar = '<div class="tbl-toolbar">' +
    '<span class="tbl-info">' + filtered.length + ' data</span>' +
    '<button class="btn-export" id="btn-export-csv">&#128229; Export Excel</button>' +
    '</div>';

  var tbl = '<div class="tbl-wrap"><table class="str-table">' +
    '<thead><tr>' +
      '<th>ADJ Number</th><th>Site</th><th>Status</th>' +
      '<th>Article</th><th>Description</th><th>System</th><th>Fisik</th><th>Disc</th>' +
      '<th>Receipt/Email</th><th>Article Doc</th><th>No Reservasi</th><th>Submit</th>' +
    '</tr></thead><tbody>' +
    pageData.map(function(d) {
      return '<tr>' +
        '<td style="font-weight:700;color:#1565c0;">' + escHtml(d.adjNumber) + '</td>' +
        '<td>' + escHtml(d.site) + '</td>' +
        '<td><span class="badge ' + statusBadgeClass(d.status) + '">' + escHtml(d.status) + '</span></td>' +
        '<td>' + escHtml(d.article) + '</td>' +
        '<td>' + escHtml(d.description) + '</td>' +
        '<td class="num">' + escHtml(String(d.system !== '' ? d.system : '')) + '</td>' +
        '<td class="num">' + escHtml(String(d.fisik  !== '' ? d.fisik  : '')) + '</td>' +
        '<td class="num">' + escHtml(String(d.disc   !== '' ? d.disc   : '')) + '</td>' +
        '<td>' + escHtml(d.receiptEmail) + '</td>' +
        '<td>' + escHtml(d.articleDoc) + '</td>' +
        '<td>' + escHtml(d.nomorReservasi) + '</td>' +
        '<td>' + escHtml(d.submitDate) + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';

  var pag = '';
  if (totalPages > 1) {
    var rangeStart = Math.max(1, _currentPage - 2);
    var rangeEnd   = Math.min(totalPages, _currentPage + 2);
    var pBtns = '';
    if (rangeStart > 1) {
      pBtns += '<button class="pg-btn" data-page="1">1</button>';
      if (rangeStart > 2) pBtns += '<span class="pg-ell">…</span>';
    }
    for (var i = rangeStart; i <= rangeEnd; i++) {
      pBtns += '<button class="pg-btn' + (i === _currentPage ? ' pg-active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (rangeEnd < totalPages) {
      if (rangeEnd < totalPages - 1) pBtns += '<span class="pg-ell">…</span>';
      pBtns += '<button class="pg-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
    }
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

document.getElementById('btn-back').addEventListener('click', function() {
  window.location.href = '../home/index.html';
});
document.getElementById('btn-retry').addEventListener('click', loadList);

document.getElementById('filter-tabs').querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    _activeFilter = tab.dataset.filter;
    _currentPage  = 1;
    renderList(_allRecords);
  });
});

var _searchTimer = null;
document.getElementById('search-input').addEventListener('input', function() {
  clearTimeout(_searchTimer);
  var val = this.value;
  _searchTimer = setTimeout(function() { _searchText = val.trim(); _currentPage = 1; renderList(_allRecords); }, 300);
});
document.getElementById('date-from').addEventListener('change', function() { _dateFrom = this.value; _currentPage = 1; renderList(_allRecords); });
document.getElementById('date-to').addEventListener('change',   function() { _dateTo   = this.value; _currentPage = 1; renderList(_allRecords); });
document.getElementById('btn-clear-dates').addEventListener('click', function() {
  _dateFrom = ''; _dateTo = '';
  _currentPage = 1;
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value   = '';
  renderList(_allRecords);
});

document.getElementById('date-from').value = _dateFrom;
document.getElementById('date-to').value   = _dateTo;

// Reload hanya jika kembali ke tab setelah >60 detik (hemat GAS quota)
document.addEventListener('visibilitychange', (function() {
  var _t = 0;
  return function() { if (!document.hidden && Date.now() - _t > 60000) { _t = Date.now(); loadList(); } };
})());
loadList();
