var _recordId      = '';
var _adjNumber     = '';
var _acting        = false;
var _currentStatus = '';
var _keterangan    = '';
var _itemsCache    = [];
var _currentUser   = { openId: '', nickName: 'User' };

function getParams() {
  var qs = location.search.substring(1);
  var p = {};
  qs.split('&').forEach(function(kv) { var a = kv.split('='); if (a[0]) p[a[0]] = decodeURIComponent(a[1] || ''); });
  return p;
}

function show(id) {
  ['screen-loading','screen-error','screen-content'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function showFooter(which) {
  ['footer-state1','footer-state2'].forEach(function(id) {
    document.getElementById(id).style.display = (id === which) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function showToast(msg, color, dur) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.style.background = color || '#333'; t.style.display = '';
  setTimeout(function() { t.style.display = 'none'; }, dur || 2500);
}

function setActing(val) {
  _acting = val;
  ['btn-process-done','btn-mark-posted','btn-start-reject1','btn-start-reject2',
   'btn-csv','modal-ok','modal-cancel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.disabled = val;
  });
}

// ── Confirmation modal (generic) ───────────────────────────────────────────────
var _confirmCb = null;
function openConfirm(opts) {
  document.getElementById('modal-msg').textContent = opts.message || 'Apakah anda yakin lanjutkan proses?';
  var wrap = document.getElementById('modal-reason-wrap');
  wrap.style.display = opts.showReason ? '' : 'none';
  var okBtn = document.getElementById('modal-ok');
  okBtn.textContent = opts.okLabel || 'Ya, Lanjutkan';
  okBtn.className   = opts.danger ? 'modal-ok modal-ok-danger' : 'modal-ok';
  if (opts.showReason) document.getElementById('modal-reject-reason').value = '';
  _confirmCb = opts.onConfirm || null;
  document.getElementById('confirm-modal').style.display = 'flex';
  if (opts.showReason) setTimeout(function() { document.getElementById('modal-reject-reason').focus(); }, 0);
}
function closeConfirm() {
  document.getElementById('confirm-modal').style.display = 'none';
  _confirmCb = null;
}
document.getElementById('modal-cancel').addEventListener('click', function() { if (!_acting) closeConfirm(); });
document.getElementById('confirm-modal').addEventListener('click', function(e) {
  if (e.target === this && !_acting) closeConfirm();
});
document.getElementById('modal-ok').addEventListener('click', function() {
  if (_acting) return;
  var cb = _confirmCb;
  if (!cb) { closeConfirm(); return; }
  if (document.getElementById('modal-reason-wrap').style.display !== 'none') {
    var reason = document.getElementById('modal-reject-reason').value.trim();
    if (!reason) { document.getElementById('modal-reject-reason').focus(); return; }
    closeConfirm();
    cb(reason);
  } else {
    closeConfirm();
    cb();
  }
});

function renderHeader(h) {
  var rows = [
    ['ADJ Number',       h.adjNumber,      true],
    ['Site',             h.site + (h.siteName ? ' — ' + h.siteName : ''), false],
    ['Department',       h.department,     false],
    ['Jenis Adjusment', h.jenis,          false],
    ['Keterangan',       h.keterangan,     false],
    ['Status',           h.status,         false],
    ['Requested By',     h.requestedBy,    false],
    ['Submit Date',      h.submitDate,     false],
    ['Nomor Reservasi',  h.nomorReservasi, false]
  ].filter(function(r) { return r[1] !== '' && r[1] != null; });
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info ADJ</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span>' +
             '<span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(String(r[1])) + '</span></div>';
    }).join('');
}

function renderItemsEditable(items) {
  _itemsCache = items;
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>System</th><th>Fisik</th><th>Disc</th><th>Receipt/Email</th><th>Article Doc *</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    return '<tr data-rid="' + escHtml(it.recordId) + '">' +
      '<td>' + escHtml(it.seq) + '</td>' +
      '<td>' + escHtml(it.article) + '</td>' +
      '<td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(String(it.system !== '' ? it.system : '')) + '</td>' +
      '<td class="num">' + escHtml(String(it.fisik   !== '' ? it.fisik   : '')) + '</td>' +
      '<td class="num">' + escHtml(String(it.disc    !== '' ? it.disc    : '')) + '</td>' +
      '<td>' + escHtml(it.receiptEmail) + '</td>' +
      '<td><input type="text" class="article-doc-input" placeholder="Doc No." value="' + escHtml(it.articleDoc) + '"></td>' +
    '</tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

function renderItemsReadonly(items) {
  _itemsCache = items;
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>System</th><th>Fisik</th><th>Disc</th><th>Receipt/Email</th><th>Article Doc</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    return '<tr>' +
      '<td>' + escHtml(it.seq) + '</td>' +
      '<td>' + escHtml(it.article) + '</td>' +
      '<td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(String(it.system !== '' ? it.system : '')) + '</td>' +
      '<td class="num">' + escHtml(String(it.fisik   !== '' ? it.fisik   : '')) + '</td>' +
      '<td class="num">' + escHtml(String(it.disc    !== '' ? it.disc    : '')) + '</td>' +
      '<td>' + escHtml(it.receiptEmail) + '</td>' +
      '<td>' + escHtml(it.articleDoc) + '</td>' +
    '</tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

function downloadCsv() {
  var BOM    = '﻿';
  var header = 'No,Article,Description,System,Fisik,Disc,Receipt/Email,Article Doc\n';
  var rows   = _itemsCache.map(function(it) {
    function c(v) { var s = String(v == null ? '' : v); return s.indexOf(',') !== -1 ? '"' + s.replace(/"/g,'""') + '"' : s; }
    return [c(it.seq), c(it.article), c(it.description), c(it.system), c(it.fisik), c(it.disc), c(it.receiptEmail), c(it.articleDoc)].join(',');
  }).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(BOM + header + rows);
  a.download = _adjNumber + '-items.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function loadDetail() {
  show('screen-loading');
  getUserInfo().then(function(user) {
    _currentUser = user;
    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID,
      { conjunction: 'and', conditions: [{ field_name: 'ADJ Number', operator: 'is', value: [_adjNumber] }] }
    );
  }).then(function(headers) {
    if (headers.length === 0) throw new Error('ADJ tidak ditemukan');
    var h = headers[0];
    _recordId      = h.record_id;
    _currentStatus = fieldText(h.fields['Status']);
    _keterangan    = fieldText(h.fields['Keterangan Adjustment']);
    var jenis = fieldText(h.fields['Jenis Adjusment']);

    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_DETAIL_TABLE_ID,
      { conjunction: 'and', conditions: [{ field_name: 'ADJ Number', operator: 'is', value: [_adjNumber] }] }
    ).then(function(details) {
      details.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });
      var items = details.map(function(r) {
        return {
          recordId:     r.record_id,
          seq:          fieldText(r.fields['Row Sequence']),
          article:      fieldText(r.fields['Article']),
          description:  fieldText(r.fields['Description']),
          system:       r.fields['System Qty'] != null ? r.fields['System Qty'] : '',
          fisik:        r.fields['Fisik Qty']  != null ? r.fields['Fisik Qty']  : '',
          disc:         r.fields['Disc']       != null ? r.fields['Disc']       : '',
          receiptEmail: fieldText(r.fields['Receipt Email']),
          articleDoc:   fieldText(r.fields['Article Doc Adjustment'])
        };
      });

      renderHeader({
        adjNumber:      fieldText(h.fields['ADJ Number']),
        site:           fieldText(h.fields['Site']),
        siteName:       fieldText(h.fields['Site Name']),
        department:     fieldText(h.fields['Department']),
        jenis:          jenis,
        keterangan:     _keterangan,
        status:         _currentStatus,
        requestedBy:    fieldText(h.fields['Requested By']),
        submitDate:     fmtDate(h.fields['Submit Date']),
        nomorReservasi: fieldText(h.fields['Nomor Reservasi'])
      });

      if (_currentStatus === CONFIG.STATUS_ADJ_WAITING_ICO) {
        renderItemsEditable(items);
        document.getElementById('section-reservasi').style.display = '';
        var existingReservasi = fieldText(h.fields['Nomor Reservasi']);
        if (existingReservasi) {
          document.getElementById('reservasi-input').value = existingReservasi;
        }
        if (_keterangan === 'Salah Jual Rugi') {
          document.getElementById('section-ba').style.display = '';
          document.getElementById('btn-ba-upload').onclick = function() {
            var url = CONFIG.GAS_URL +
              '?action=baUploadForm' +
              '&adjNumber=' + encodeURIComponent(_adjNumber);
            document.getElementById('upload-iframe').src = url;
            document.getElementById('upload-modal').style.display = 'flex';
          };
        }
        showFooter('footer-state1');
      } else {
        renderItemsReadonly(items);
        showFooter(null);
      }
      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

// ── State 1: Process Done ──────────────────────────────────────────────────────
document.getElementById('btn-process-done').addEventListener('click', function() {
  if (_acting) return;
  var reservasi = document.getElementById('reservasi-input').value.trim();
  if (!reservasi) { showToast('Nomor Reservasi wajib diisi', '#c62828'); return; }
  openConfirm({
    message:   'Pastikan Nomor Reservasi & Article Doc sudah benar. Apakah anda yakin lanjutkan proses?',
    onConfirm: doProcessDone
  });
});

function doProcessDone() {
  var reservasi = document.getElementById('reservasi-input').value.trim();
  setActing(true);
  var rows  = Array.prototype.slice.call(document.querySelectorAll('#items-table tbody tr[data-rid]'));
  var chain = rows.reduce(function(p, row) {
    return p.then(function() {
      var docVal = row.querySelector('.article-doc-input').value.trim();
      return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_DETAIL_TABLE_ID, row.dataset.rid, {
        'Article Doc Adjustment': docVal
      });
    });
  }, Promise.resolve());
  chain.then(function() {
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID, _recordId, {
      'Status':           CONFIG.STATUS_ADJ_DONE,
      'Nomor Reservasi':  reservasi,
      'ICO Process Date': Date.now()
    });
  }).then(function() {
    setActing(false);
    showToast('ADJ berhasil diproses!', '#2e7d32');
    setTimeout(function() { window.location.href = '../adj-list/index.html'; }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || String(err)), '#c62828', 5000);
    setActing(false);
  });
}

// ── State 2: Mark as Posted ────────────────────────────────────────────────────
document.getElementById('btn-mark-posted').addEventListener('click', function() {
  if (_acting) return;
  var approvedBy = document.getElementById('approvedby-input').value.trim();
  if (!approvedBy) { showToast('Approved By wajib diisi', '#c62828'); return; }
  openConfirm({
    message:   'Pastikan ADJ sudah diposting di SAP. Apakah anda yakin lanjutkan proses?',
    onConfirm: doMarkPosted
  });
});

function doMarkPosted() {
  var approvedBy = document.getElementById('approvedby-input').value.trim();
  setActing(true);
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID, _recordId, {
    'Status':      CONFIG.STATUS_ADJ_DONE,
    'Approved By': approvedBy
  }).then(function() {
    setActing(false);
    showToast('ADJ Done! Posting selesai.', '#2e7d32');
    setTimeout(function() { window.location.href = '../adj-list/index.html'; }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || String(err)), '#c62828', 5000);
    setActing(false);
  });
}

// ── Reject (both states) ───────────────────────────────────────────────────────
['btn-start-reject1','btn-start-reject2'].forEach(function(btnId) {
  var el = document.getElementById(btnId);
  if (el) el.addEventListener('click', function() {
    if (_acting) return;
    openConfirm({
      message:    'Apakah anda yakin reject pengajuan ini? Tuliskan alasannya:',
      showReason: true,
      okLabel:    'Ya, Reject',
      danger:     true,
      onConfirm:  doReject
    });
  });
});

function doReject(reason) {
  setActing(true);
  var rejectedByName = _currentUser.nickName && _currentUser.nickName !== 'User'
    ? _currentUser.nickName : (_currentUser.openId || '');
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.ADJ_HEADER_TABLE_ID, _recordId, {
    'Status':        CONFIG.STATUS_ADJ_REJECT,
    'Reject Reason': reason,
    'Rejected By':   rejectedByName
  }).then(function() {
    setActing(false);
    showToast('ADJ Rejected.', '#c62828');
    setTimeout(function() { window.location.href = '../adj-list/index.html'; }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || String(err)), '#c62828', 5000);
    setActing(false);
  });
}

// ── CSV ────────────────────────────────────────────────────────────────────────
document.getElementById('btn-csv').addEventListener('click', function() {
  if (_itemsCache.length === 0) { showToast('Tidak ada item.', '#c62828'); return; }
  downloadCsv();
});

// ── Init ───────────────────────────────────────────────────────────────────────
var _params = getParams();
_adjNumber  = _params.adj || '';
document.getElementById('btn-back').addEventListener('click', function() { window.history.back(); });

// ── BA Upload iframe modal ─────────────────────────────────────────────────
document.getElementById('btn-close-upload').addEventListener('click', function() {
  document.getElementById('upload-modal').style.display = 'none';
  document.getElementById('upload-iframe').src = '';
});
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'BA_UPLOAD_SUCCESS') {
    document.getElementById('upload-modal').style.display = 'none';
    document.getElementById('upload-iframe').src = '';
    showToast('BA berhasil diupload! ✓', '#2e7d32');
    setTimeout(function() { loadDetail(); }, 800);
  }
});

if (!_adjNumber) {
  document.getElementById('err-text').textContent = 'Parameter ADJ tidak ditemukan.';
  show('screen-error');
} else {
  loadDetail();
}
