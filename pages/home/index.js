var TABS_ALL = [
  { id: 'str-list', label: 'STR List', desc: 'Lihat & kelola request STR', icon: '📋', url: '../str-list/index.html' },
  { id: 'adj-list', label: 'ADJ List', desc: 'Lihat & kelola request ADJ', icon: '📝', url: '../adj-list/index.html' }
];

var DEV_RPA_MAX = 10;   // batas STR per klik tombol uji (setiap STR = banyak panggilan GAS berurutan)

function showEl(id) {
  document.getElementById('screen-loading').style.display = 'none';
  document.getElementById('screen-error').style.display   = 'none';
  document.getElementById('tab-nav').style.display        = 'none';
  if (id === 'error') document.getElementById('screen-error').style.display = '';
  if (id === 'tabs')  document.getElementById('tab-nav').style.display      = '';
}

// Tile tambahan hanya untuk mode uji (FLOW_V2).
function extraTabs(user) {
  var tabs = [];
  if (!CONFIG.FLOW_V2) return tabs;
  var uid = user && user.openId;
  if (FLOW.roleOverride() === 'md' || FLOW.mdDepartmentsFor(uid, CONFIG.MD_MAP).length > 0) {
    tabs.push({ id: 'md-list', label: 'MD Review', desc: 'Review STR per department', icon: '🧾', url: '../md-list/index.html' });
  }
  if (FLOW.roleOverride() === 'ip' || (uid && CONFIG.IP_USER_IDS.indexOf(uid) !== -1)) {
    tabs.push({ id: 'ip-list', label: 'IP Release', desc: 'CSV dan nomor PR', icon: '📦', url: '../ip-list/index.html' });
  }
  return tabs;
}

function renderTabs(user) {
  var nav = document.getElementById('tab-nav');
  var tabs = TABS_ALL.concat(extraTabs(user));
  nav.innerHTML = tabs.map(function(t) {
    return '<div class="menu-card" data-url="' + t.url + '">' +
      '<span class="card-icon">' + t.icon + '</span>' +
      '<span class="card-label">' + t.label + '</span>' +
      '<span class="card-desc">' + t.desc + '</span>' +
      '</div>';
  }).join('');
  nav.querySelectorAll('.menu-card').forEach(function(el) {
    el.addEventListener('click', function() {
      window.location.href = el.dataset.url;
    });
  });
}

// ── Panel uji: isi hasil RPA dummy (hanya developer, hanya Base uji) ──────────
// Di alur nyata GAS menyalin hasil RPA dari Google Sheet ke kolom 'RPA Data' (JSON). Tombol ini menulis
// RPA Data karangan untuk menguji alur dengan sedikit data, makanya dibatasi DEV_RPA_MAX.
function fillOne(h) {
  var strNo = fieldText(h.fields['STR Number']);
  var site  = fieldText(h.fields['Site']);
  return larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
    { conjunction: 'and', conditions: [{ field_name: 'STR Number', operator: 'is', value: [strNo] }] },
    { fieldNames: ['STR Number', 'Article'] })
    .then(function(details) {
      var chain = Promise.resolve();
      details.forEach(function(d) {
        chain = chain.then(function() {
          // Satu field saja: RPA Data (JSON). Isian PS (Stock Qty / Sales Qty / Stock DC / Suggested Qty) tidak disentuh.
          var rpa = FLOW.dummyRpa(site, fieldText(d.fields['Article']));
          return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID, d.record_id, {
            'RPA Data': JSON.stringify(rpa)
          });
        });
      });
      return chain;
    })
    .then(function() {
      return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, h.record_id, { 'Status': FLOW.S.WAITING_MD });
    });
}

function fillRpaDummy() {
  return larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'and', conditions: [{ field_name: 'Status', operator: 'is', value: [FLOW.S.APPROVED_RPA] }] },
    // Status dipakai di filter, jadi wajib ada di fieldNames (GAS menerapkan ulang filter pada field proyeksi).
    { fieldNames: ['STR Number', 'Site', 'Status'] })
    .then(function(headers) {
      var batch = headers.slice(0, DEV_RPA_MAX);
      var chain = Promise.resolve(0);
      batch.forEach(function(h) {
        chain = chain.then(function(n) { return fillOne(h).then(function() { return n + 1; }); });
      });
      return chain.then(function(n) { return { done: n, total: headers.length }; });
    });
}

function renderDevPanel(user) {
  if (!CONFIG.FLOW_V2 || !user || CONFIG.DEV_USER_IDS.indexOf(user.openId) === -1) return;
  var box = document.createElement('div');
  box.style.cssText = 'margin:16px;padding:12px;border:1px dashed #999;border-radius:8px;background:#fff;font-size:13px;';
  box.innerHTML = '<div style="font-weight:700;margin-bottom:8px">Panel uji (Base uji)</div>' +
    '<button id="btn-fill-rpa" style="padding:8px 14px;border:1px solid #1565c0;background:#fff;color:#1565c0;border-radius:6px;font-size:13px;cursor:pointer">Isi hasil RPA (dummy)</button>' +
    '<div id="dev-status" style="margin-top:8px;color:#555"></div>';
  document.querySelector('.page').appendChild(box);
  var btn = document.getElementById('btn-fill-rpa');
  var out = document.getElementById('dev-status');
  btn.addEventListener('click', function() {
    btn.disabled = true;
    out.textContent = 'Memproses... (satu STR sekitar beberapa detik)';
    fillRpaDummy().then(function(r) {
      out.textContent = r.done + ' STR diisi' + (r.total > r.done ? ' (masih ada ' + (r.total - r.done) + ', klik lagi)' : '') + '.';
      btn.disabled = false;
    }).catch(function(err) {
      out.textContent = 'Gagal: ' + (err.message || String(err));
      btn.disabled = false;
    });
  });
}

function init() {
  document.getElementById('screen-loading').style.display = '';
  document.getElementById('screen-error').style.display   = 'none';

  getUserInfo().then(function(user) {
    var name = (user && user.nickName) ? user.nickName : '';
    var label = name ? 'Halo, ' + name : '';
    if (CONFIG.FLOW_V2) label += ' — MODE UJI';
    document.getElementById('home-user').textContent = label;
    renderTabs(user);
    renderDevPanel(user);
    showEl('tabs');
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal login: ' + (err.message || String(err));
    showEl('error');
  });
}

document.getElementById('btn-retry').addEventListener('click', init);
init();
