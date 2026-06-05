// ADJ Master Detail — flat per-article report of ICO-created ADJ (Need Posting + Done).
// Role-filtered by site (ICO sees their sites, Manager sees their sites, no-role → empty).
// Download = CSV per-article of currently filtered rows.

var _allRows      = [];   // flattened article rows (after role+status filter)
var _activeFilter = 'all';
var _searchText   = '';
var _currentUser  = { openId: '', nickName: 'User' };
var _icoMap       = {};

function toDateInput(d) {
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0'+m : m) + '-' + (day < 10 ? '0'+day : day);
}
var _today        = new Date();
var _firstOfMonth = new Date(_today.getFullYear(), _today.getMonth(), 1);
var _dateFrom     = toDateInput(_firstOfMonth);
var _dateTo       = toDateInput(_today);

function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function merge(base, extra) {
  var out = {}, k;
  for (k in base)  { if (base.hasOwnProperty(k))  out[k] = base[k]; }
  for (k in extra) { if (extra.hasOwnProperty(k)) out[k] = extra[k]; }
  return out;
}

function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.style.background = color || '#333'; t.style.display = '';
  setTimeout(function() { t.style.display = 'none'; }, 2500);
}

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

function statusBadgeClass(status) {
  if (status === CONFIG.STATUS_ADJ_NEED_POSTING) return 'badge-need-posting';
  if (status === CONFIG.STATUS_ADJ_DONE)         return 'badge-done';
  return 'badge-need-posting';
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

// Build flat per-article rows from header + detail records (already site/status filtered headers).
function buildRows(headers, details) {
  // Group details by ADJ Number
  var byAdj = {};
  details.forEach(function(d) {
    var num = fieldText(d.fields['ADJ Number']);
    if (!num) return;
    if (!byAdj[num]) byAdj[num] = [];
    byAdj[num].push(d);
  });

  var rows = [];
  headers.forEach(function(h) {
    var num    = fieldText(h.fields['ADJ Number']);
    var common = {
      adjNumber:      num,
      site:           fieldText(h.fields['Site']),
      siteName:       fieldText(h.fields['Site Name']),
      department:     fieldText(h.fields['Department']),
      jenis:          fieldText(h.fields['Jenis Adjusment']),
      keterangan:     fieldText(h.fields['Keterangan Adjustment']),
      status:         fieldText(h.fields['Status']),
      nomorReservasi: fieldText(h.fields['Nomor Reservasi']),
      approvedBy:     fieldText(h.fields['Approved By']),
      requestedBy:    fieldText(h.fields['Requested By']),
      submitDateRaw:  h.fields['Submit Date'] || 0,
      submitDate:     fmtDate(h.fields['Submit Date']),
      icoProcessDate: fmtDate(h.fields['ICO Process Date'])
    };
    var dets = byAdj[num] || [];
    if (dets.length === 0) {
      // header tanpa detail — tetap tampilkan 1 baris kosong agar terlihat di laporan
      rows.push(merge(common, { fromArticle: '', toArticle: '', qty: '', articleDoc: '' }));
      return;
    }
    dets.forEach(function(d) {
      rows.push(merge(common, {
        fromArticle: fieldText(d.fields['From Article']),
        toArticle:   fieldText(d.fields['To Article']),
        qty:         d.fields['Qty'] != null ? d.fields['Qty'] : '',
        articleDoc:  fieldText(d.fields['Article Doc Adjustment'])
      }));
    });
  });
  return rows;
}

function loadData() {
  show('screen-loading');
  getUserInfo().then(function(user) {
    _currentUser = user;
    var pHeaders = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID, null);
    var pDetails = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_DETAIL_TABLE_ID, null);
    var pICO     = larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.MASTER_ICO_TABLE_ID, null);
    var pSites   = user.openId
      ? larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null)
      : Promise.resolve([]);

    Promise.all([pHeaders, pDetails, pICO, pSites]).then(function(res) {
      var headers = res[0], details = res[1], icoRecords = res[2], siteRecords = res[3];
      _icoMap = buildIcoMap(icoRecords);

      // Status filter: hanya yang sudah di-create ICO ke atas (Need Posting + Done)
      var allowedStatus = [CONFIG.STATUS_ADJ_NEED_POSTING, CONFIG.STATUS_ADJ_DONE];
      headers = headers.filter(function(h) {
        return allowedStatus.indexOf(fieldText(h.fields['Status'])) !== -1;
      });

      // Role/site filter
      var userIsICO = isICO(user.openId, _icoMap);
      var visible;
      if (userIsICO) {
        var ovr = '';
        try { ovr = sessionStorage.getItem('_roleOverride') || ''; } catch(e) {}
        if (ovr === 'ico') {
          visible = headers;
        } else {
          var icoSites = _icoMap[user.openId] || [];
          visible = headers.filter(function(h) { return icoSites.indexOf(fieldText(h.fields['Site'])) !== -1; });
        }
      } else if (user.openId) {
        var mySites = siteRecords
          .filter(function(r) {
            var sm = r.fields[CONFIG.MASTER_SM_USER_FIELD];
            if (!sm) return false;
            var arr = Array.isArray(sm) ? sm : [sm];
            return arr.some(function(u) { return (u.id || u.open_id || u.openId) === user.openId; });
          })
          .map(function(r) { return fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]); })
          .filter(Boolean);
        visible = mySites.length > 0
          ? headers.filter(function(h) { return mySites.indexOf(fieldText(h.fields['Site'])) !== -1; })
          : [];
      } else {
        visible = [];
      }

      _allRows = buildRows(visible, details);
      render();
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
      show('screen-error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

function applyFilters(rows) {
  var result = rows;
  if (_activeFilter !== 'all') {
    var map = { 'need-posting': CONFIG.STATUS_ADJ_NEED_POSTING, 'done': CONFIG.STATUS_ADJ_DONE };
    result = result.filter(function(r) { return r.status === map[_activeFilter]; });
  }
  if (_searchText) {
    var q = _searchText.toLowerCase();
    result = result.filter(function(r) {
      return (r.adjNumber   && r.adjNumber.toLowerCase().indexOf(q)   !== -1) ||
             (r.fromArticle && r.fromArticle.toLowerCase().indexOf(q) !== -1) ||
             (r.toArticle   && r.toArticle.toLowerCase().indexOf(q)   !== -1) ||
             (r.requestedBy && r.requestedBy.toLowerCase().indexOf(q) !== -1) ||
             (r.nomorReservasi && r.nomorReservasi.toLowerCase().indexOf(q) !== -1);
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

function render() {
  var rows = applyFilters(_allRows);
  document.getElementById('result-count').textContent = rows.length + ' baris article';
  if (rows.length === 0) { show('screen-empty'); return; }

  var thead = '<thead><tr>' +
    '<th>ADJ Number</th><th>Site</th><th>From Art.</th><th>To Art.</th><th>Qty</th>' +
    '<th>Status</th><th>No Reservasi</th><th>Article Doc</th><th>Submit</th>' +
    '</tr></thead>';
  var tbody = '<tbody>' + rows.map(function(r) {
    return '<tr>' +
      '<td class="adj-cell">' + escHtml(r.adjNumber) + '</td>' +
      '<td>' + escHtml(r.site) + '</td>' +
      '<td>' + escHtml(r.fromArticle) + '</td>' +
      '<td>' + escHtml(r.toArticle) + '</td>' +
      '<td class="num">' + escHtml(String(r.qty)) + '</td>' +
      '<td><span class="badge ' + statusBadgeClass(r.status) + '">' + escHtml(r.status) + '</span></td>' +
      '<td>' + escHtml(r.nomorReservasi) + '</td>' +
      '<td>' + escHtml(r.articleDoc) + '</td>' +
      '<td>' + escHtml(r.submitDate) + '</td>' +
    '</tr>';
  }).join('') + '</tbody>';

  document.getElementById('table-wrap').innerHTML = '<table>' + thead + tbody + '</table>';
  show('screen-list');
}

function csvCell(v) {
  var s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadHistory() {
  var rows = applyFilters(_allRows);
  if (rows.length === 0) { showToast('Tidak ada data untuk diunduh.', '#c62828'); return; }
  var BOM = '﻿';
  var header = ['ADJ Number','Site','Site Name','Department','Jenis Adjustment','Keterangan',
                'Status','No Reservasi','Requested By','Submit Date','ICO Process Date',
                'From Article','To Article','Qty','Article Doc','Approved By'].join(',') + '\n';
  var body = rows.map(function(r) {
    return [
      csvCell(r.adjNumber), csvCell(r.site), csvCell(r.siteName), csvCell(r.department),
      csvCell(r.jenis), csvCell(r.keterangan), csvCell(r.status), csvCell(r.nomorReservasi),
      csvCell(r.requestedBy), csvCell(r.submitDate), csvCell(r.icoProcessDate),
      csvCell(r.fromArticle), csvCell(r.toArticle), csvCell(r.qty), csvCell(r.articleDoc),
      csvCell(r.approvedBy)
    ].join(',');
  }).join('\n');

  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(BOM + header + body);
  a.download = 'ADJ-History-' + toDateInput(new Date()) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast('History diunduh (' + rows.length + ' baris).', '#2e7d32');
}

// ── Events ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', function() {
  window.location.href = '../home/index.html';
});
document.getElementById('btn-retry').addEventListener('click', loadData);
document.getElementById('btn-download').addEventListener('click', downloadHistory);

document.getElementById('filter-tabs').querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    _activeFilter = tab.dataset.filter;
    render();
  });
});

var _searchTimer = null;
document.getElementById('search-input').addEventListener('input', function() {
  clearTimeout(_searchTimer);
  var val = this.value;
  _searchTimer = setTimeout(function() { _searchText = val.trim(); render(); }, 300);
});
document.getElementById('date-from').addEventListener('change', function() { _dateFrom = this.value; render(); });
document.getElementById('date-to').addEventListener('change',   function() { _dateTo   = this.value; render(); });
document.getElementById('btn-clear-dates').addEventListener('click', function() {
  _dateFrom = ''; _dateTo = '';
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value   = '';
  render();
});

document.getElementById('date-from').value = _dateFrom;
document.getElementById('date-to').value   = _dateTo;

document.addEventListener('visibilitychange', function() { if (!document.hidden) loadData(); });
loadData();

