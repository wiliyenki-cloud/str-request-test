var PAGE_SIZE     = 50;
var HEADER_FIELDS = ['STR Number', 'Site', 'Site Name', 'Department', 'Plan Receive Date', 'Submit Date', 'Status'];
var _items = [];
var _shown = PAGE_SIZE;
var _all = [];        // hasil server (sudah dipersempit status)
var _statusSel = '';  // '' = kedua status; 'waiting-ip' / 'csv-ready' = hanya satu
var MAX_BULK = 100;   // batas STR dalam satu file CSV gabungan
var _sel = {};        // STR terpilih: { <record id>: <nomor STR> }; bertahan lewat render ulang dan ganti filter
var _bulkBusy = false;

function show(id) {
  ['screen-loading', 'screen-error', 'screen-empty', 'screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function showError(err) {
  document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
  show('screen-error');
}

function mapHeader(r) {
  return {
    recordId:        r.record_id,
    strNumber:       fieldText(r.fields['STR Number']),
    site:            fieldText(r.fields['Site']),
    siteName:        fieldText(r.fields['Site Name']),
    department:      fieldText(r.fields['Department']),
    status:          fieldText(r.fields['Status']),
    submitRaw:       r.fields['Submit Date'] || 0,
    submitDate:      fmtDate(r.fields['Submit Date']),
    planReceiveDate: fmtDate(r.fields['Plan Receive Date'])
  };
}

function card(item) {
  var label = item.status === FLOW.S.CSV_READY ? 'Menunggu PR' : 'Siap dibuat CSV';
  return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
    '<div class="card-header">' +
      '<span class="card-left"><label class="cb-wrap"><input type="checkbox" class="sel-cb" data-record="' + escHtml(item.recordId) + '"' +
        (_sel[item.recordId] ? ' checked' : '') + (_bulkBusy ? ' disabled' : '') + '></label>' +
      '<span class="str-num">' + escHtml(item.strNumber) + '</span></span>' +
      '<span class="badge-ico">' + label + '</span>' +
    '</div>' +
    '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
    '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
    '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
    '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
  '</div>';
}

function applyFilters() {
  _items = FLOW.filterItems(_all, {
    q:    document.getElementById('search-input').value,
    site: document.getElementById('site-select').value
  });
  _shown = PAGE_SIZE;
  render();
}

function fillSiteSelect() {
  var sel = document.getElementById('site-select');
  var keep = sel.value;
  var opts = FLOW.siteOptions(_all);
  sel.innerHTML = '<option value="">Semua site</option>' + opts.map(function(o) {
    return '<option value="' + escHtml(o.site) + '">' + escHtml(o.label) + '</option>';
  }).join('');
  sel.value = opts.some(function(o) { return o.site === keep; }) ? keep : '';
}

function render() {
  if (_items.length === 0) {
    document.getElementById('empty-text').textContent = _all.length > 0 ? 'Tidak ada STR yang cocok dengan filter.' : 'Tidak ada STR yang perlu diproses.';
    show('screen-empty'); return;
  }
  var container = document.getElementById('list-container');
  var html = _items.slice(0, _shown).map(card).join('');
  if (_items.length > _shown) {
    html += '<button id="btn-more" class="btn-more">Tampilkan lebih (' + (_items.length - _shown) + ')</button>';
  }
  container.innerHTML = '<div class="result-count">' + _items.length + ' STR' + (_items.length !== _all.length ? ' dari ' + _all.length : '') + '</div>' + html;
  container.querySelectorAll('.cb-wrap').forEach(function(w) {
    w.addEventListener('click', function(ev) { ev.stopPropagation(); });   // jangan buka detail
  });
  container.querySelectorAll('.sel-cb').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var it = _all.filter(function(x) { return x.recordId === cb.dataset.record; })[0];
      if (!it) return;
      if (cb.checked) _sel[it.recordId] = it.strNumber; else delete _sel[it.recordId];
      updateBar();
    });
  });
  container.querySelectorAll('.card').forEach(function(el) {
    el.addEventListener('click', function() {
      window.location.href = '../ip-detail/index.html?str=' + encodeURIComponent(el.dataset.str) +
        '&record=' + encodeURIComponent(el.dataset.record);
    });
  });
  var more = document.getElementById('btn-more');
  if (more) more.addEventListener('click', function() { _shown += PAGE_SIZE; render(); });
  show('screen-list');
  updateBar();
}

// ── Pilih banyak STR dan buat satu CSV gabungan ─────────────────────────────

function readyVisible() {
  return _items.filter(function(it) { return it.status === FLOW.S.WAITING_IP; });
}

function updateBar() {
  var n = Object.keys(_sel).length, m = readyVisible().length;
  document.getElementById('sel-count').textContent = n + ' dipilih';
  document.getElementById('btn-bulk-sel').textContent = 'Buat CSV (' + n + ')';
  document.getElementById('btn-bulk-all').textContent = 'Buat semua yang belum dibuat (' + m + ')';
  document.getElementById('btn-bulk-sel').disabled = _bulkBusy || n === 0;
  document.getElementById('btn-bulk-all').disabled = _bulkBusy || m === 0;
  document.getElementById('btn-sel-ready').disabled = _bulkBusy || m === 0;
  document.getElementById('btn-sel-clear').disabled = _bulkBusy || n === 0;
}

function setBulkBusy(v) {
  _bulkBusy = v;
  document.querySelectorAll('.sel-cb').forEach(function(cb) { cb.disabled = v; });
  updateBar();
}

function setBulkStatus(lines, kind) {
  var el = document.getElementById('bulk-status');
  var arr = [].concat(lines || []);
  el.textContent = arr.join('\n');
  el.className = 'bulk-status' + (kind ? ' ' + kind : '');
  el.style.display = arr.length ? '' : 'none';
}

function downloadBulkCsv(csv, fileName) {
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function listCodes(codes) {
  return codes.slice(0, 5).join(', ') + (codes.length > 5 ? ' (+' + (codes.length - 5) + ' lainnya)' : '');
}

// strList: [{ recordId, strNumber }]. Satu file CSV untuk semuanya; status WAITING_IP -> CSV_READY hanya setelah file dibuat.
function bulkCreateCsv(strList) {
  if (_bulkBusy || strList.length === 0) return Promise.resolve();
  if (strList.length > MAX_BULK) {
    setBulkStatus('Terlalu banyak STR (' + strList.length + '). Maksimal ' + MAX_BULK + ' per file; persempit dengan filter lalu coba lagi.', 'err');
    return Promise.resolve();
  }
  setBulkBusy(true);
  var done = 0, failed = [], mats = [], summary = [];
  setBulkStatus('Memuat 0/' + strList.length + '...');
  var tasks = strList.map(function(s) {
    return function() {
      return ipLoadCsvMaterial(s.strNumber).then(function(m) { mats.push(m); }, function() { failed.push(s.strNumber); })
        .then(function() { done++; setBulkStatus('Memuat ' + done + '/' + strList.length + '...'); });
    };
  });
  return FLOW.runLimited(tasks, 3).then(function() {
    var order = {};   // urutan file = urutan daftar
    strList.forEach(function(s, i) { order[s.strNumber] = i; });
    var entries = mats.sort(function(a, b) { return order[a.header.strNumber] - order[b.header.strNumber]; });
    if (entries.length === 0) {
      setBulkStatus(['Tidak ada STR yang berhasil dimuat.', 'Gagal dimuat: ' + listCodes(failed)], 'err');
      return false;
    }
    setBulkStatus('Membaca Purchasing Group...');
    return ipFetchPgrMap(entries).catch(function() {
      throw new Error('Gagal membaca Purchasing Group dari master artikel, coba lagi.');
    }).then(function(pgrMap) {
      var res = FLOW.buildCsvMany(entries, pgrMap);
      summary.push(entries.length + ' STR, ' + res.rowCount + ' baris CSV');
      if (failed.length) summary.push('Gagal dimuat: ' + listCodes(failed));
      if (res.skipped.length) summary.push('Tidak ada baris (semua qty 0): ' + listCodes(res.skipped));
      var missing = [], seen = {};
      entries.forEach(function(e) {
        FLOW.csvMissingPgr(e.items, e.review, pgrMap).forEach(function(c) {
          var k = String(c).trim().toLowerCase();
          if (!seen[k]) { seen[k] = true; missing.push(c); }
        });
      });
      if (missing.length) summary.push('Purchasing Group kosong untuk artikel: ' + listCodes(missing));
      if (res.rowCount === 0) {
        summary.unshift('Tidak ada baris untuk diunduh; status tidak diubah.');
        setBulkStatus(summary, 'warn');
        return false;
      }
      downloadBulkCsv(res.csv, FLOW.csvFileName(new Date(), entries.length));
      var records = entries.filter(function(e) {
        return e.status === FLOW.S.WAITING_IP && res.skipped.indexOf(e.header.strNumber) === -1;
      }).map(function(e) { return { record_id: e.recordId, fields: { 'Status': FLOW.S.CSV_READY } }; });
      setBulkStatus('Memperbarui status ' + records.length + ' STR...');
      return larkBatchUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, records).then(function() {
        _sel = {};
        setBulkStatus(summary, (failed.length || res.skipped.length || missing.length) ? 'warn' : 'ok');
        return true;
      }, function(err) {
        summary.unshift('CSV terunduh, tetapi status gagal diubah: ' + (err.message || err));
        setBulkStatus(summary, 'err');
        return true;
      });
    });
  }).catch(function(err) {
    setBulkStatus(err.message || String(err), 'err');
    return false;
  }).then(function(reload) {
    setBulkBusy(false);
    if (reload) return fetchList(true);
  });
}

function searchByStatus(status) {
  return larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, {
    conjunction: 'and',
    conditions: [{ field_name: 'Status', operator: 'is', value: [status] }]
  }, { fieldNames: HEADER_FIELDS });
}

// Status dipilih -> hanya satu pencarian ke server (bukan dua lalu disaring di layar).
function fetchList(keepScreen) {
  if (!keepScreen) show('screen-loading');
  var statuses = _statusSel === 'waiting-ip' ? [FLOW.S.WAITING_IP]
               : _statusSel === 'csv-ready'  ? [FLOW.S.CSV_READY]
               : [FLOW.S.WAITING_IP, FLOW.S.CSV_READY];
  return Promise.all(statuses.map(searchByStatus)).then(function(results) {
    _all = [].concat.apply([], results).map(mapHeader);
    _all.sort(function(a, b) { return a.submitRaw - b.submitRaw; });
    var ids = {};
    _all.forEach(function(x) { ids[x.recordId] = true; });
    Object.keys(_sel).forEach(function(id) { if (!ids[id]) delete _sel[id]; });   // pilihan yang tak ada lagi di daftar
    fillSiteSelect();
    applyFilters();
  }).catch(showError);
}

function load() {
  if (!CONFIG.FLOW_V2) {
    document.getElementById('empty-text').textContent = 'Halaman ini hanya tersedia di mode uji.';
    show('screen-empty');
    return;
  }
  show('screen-loading');
  getUserInfo().then(function(user) {
    var asIp = FLOW.roleOverride() === 'ip';   // mode uji dari panel DBG
    if (!asIp && (!user.openId || CONFIG.IP_USER_IDS.indexOf(user.openId) === -1)) {
      document.getElementById('empty-text').textContent = 'Anda tidak terdaftar sebagai IP.';
      show('screen-empty');
      return null;
    }
    return fetchList();
  }).catch(showError);
}

document.getElementById('btn-back').addEventListener('click', function() {
  window.location.href = '../home/index.html';
});
document.getElementById('btn-retry').addEventListener('click', load);
document.getElementById('search-input').addEventListener('input', applyFilters);
document.getElementById('site-select').addEventListener('change', applyFilters);
document.getElementById('btn-sel-ready').addEventListener('click', function() {
  readyVisible().forEach(function(it) { _sel[it.recordId] = it.strNumber; });
  render();
});
document.getElementById('btn-sel-clear').addEventListener('click', function() {
  _sel = {};
  render();
});
document.getElementById('btn-bulk-sel').addEventListener('click', function() {
  bulkCreateCsv(_all.filter(function(it) { return _sel[it.recordId]; })
    .map(function(it) { return { recordId: it.recordId, strNumber: it.strNumber }; }));
});
document.getElementById('btn-bulk-all').addEventListener('click', function() {
  bulkCreateCsv(readyVisible().map(function(it) { return { recordId: it.recordId, strNumber: it.strNumber }; }));
});
document.getElementById('status-select').addEventListener('change', function() {
  _statusSel = this.value;
  fetchList();
});
load();
