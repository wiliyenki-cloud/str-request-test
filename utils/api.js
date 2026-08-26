// fieldText: safely extract a plain string from any Lark field value.
function fieldText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    return val.map(function(v) {
      return typeof v === 'string' ? v : (v.text || v.value || '');
    }).join('');
  }
  if (typeof val === 'object') return val.text || val.value || '';
  return String(val);
}

// ─── JSONP — tidak kena CORS, semua call ke Lark via GAS proxy ───────────────
function jsonpFetchOnce(url) {
  return new Promise(function(resolve, reject) {
    var cbName = '_cb' + Date.now() + Math.floor(Math.random() * 1e6);
    var script = document.createElement('script');
    var timer  = setTimeout(function() {
      cleanup(); reject(new Error('Timeout koneksi ke server'));
    }, 40000);
    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch(e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cbName] = function(data) { cleanup(); resolve(data); };
    script.onerror  = function() { cleanup(); reject(new Error('Gagal koneksi ke server')); };
    script.src = url + '&callback=' + cbName;
    document.head.appendChild(script);
  });
}

// Beberapa request ke Apps Script bisa gagal sesaat kalau banyak request lain
// nabrak deployment yang sama bersamaan (kena batas concurrent execution Apps
// Script) — bukan berarti servernya beneran mati. Retry singkat dengan jeda
// sebelum nyerah ke user, biar kontensi sesaat gak langsung jadi error di layar.
var JSONP_RETRIES     = 2;
var JSONP_RETRY_DELAY = 1200;
function jsonpFetch(url, attempt) {
  attempt = attempt || 0;
  return jsonpFetchOnce(url).catch(function(err) {
    if (attempt >= JSONP_RETRIES) throw err;
    return new Promise(function(resolve) { setTimeout(resolve, JSONP_RETRY_DELAY); })
      .then(function() { return jsonpFetch(url, attempt + 1); });
  });
}

function gasProxy(params) {
  var qs = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  return jsonpFetch(CONFIG.GAS_URL + '?' + qs)
    .then(function(data) {
      if (data.status !== 'ok') throw new Error(data.message || JSON.stringify(data));
      return data.data;
    });
}

// ─── Lark Bitable helpers (via GAS proxy) ────────────────────────────────────

// Batas jumlah halaman per larkSearch — 500 baris/halaman, jadi 40 halaman = 20.000
// baris. Semata-mata pengaman supaya bug paginasi gak pernah lagi bikin loop abadi.
var LARK_SEARCH_MAX_PAGES = 40;

// larkSearch — loop ambil semua halaman di sisi client (bukan di 1 eksekusi GAS).
// Tiap panggilan gasProxy cuma ambil 1 halaman: tetap kecil & cepat walau hasilnya
// >500 baris (loop 1 eksekusi GAS untuk banyak halaman ternyata jauh lebih lambat
// daripada linear per halaman, jadi paginasinya dipindah kesini).
// Argumen ke-4 boleh angka (pageSize, gaya lama) atau object opsi:
//   fieldNames — array nama kolom yang dipakai; sisanya gak usah ditarik dari Lark.
//                Tanpa ini Lark balikin SEMUA kolom (avatar_url user, email, dll).
//   cacheTtl   — detik; kalau diisi, hasilnya di-cache di GAS dan dipakai bareng
//                SEMUA user. Cuma buat master data yang jarang berubah — JANGAN
//                dipakai untuk data transaksi (STR/ADJ) yang harus selalu fresh.
function larkSearch(appToken, tableId, filter, pageSizeOrOpts, maybeOpts) {
  var opts     = {};
  var pageSize = 500;
  if (pageSizeOrOpts && typeof pageSizeOrOpts === 'object') {
    opts = pageSizeOrOpts;
  } else {
    if (pageSizeOrOpts) pageSize = pageSizeOrOpts;
    opts = maybeOpts || {};
  }
  if (opts.pageSize) pageSize = opts.pageSize;

  var allItems  = [];
  var seenToken = {};
  var pageCount = 0;

  function fetchPage(pageToken) {
    var params = { action: 'larkSearch', appToken: appToken, tableId: tableId, pageSize: pageSize };
    if (filter)          params.filter     = JSON.stringify(filter);
    if (pageToken)       params.pageToken  = pageToken;
    if (opts.fieldNames) params.fieldNames = JSON.stringify(opts.fieldNames);
    if (opts.cacheTtl)   params.cacheTtl   = opts.cacheTtl;
    return gasProxy(params).then(function(d) {
      allItems = allItems.concat(d.items || []);
      pageCount++;
      if (!d.hasMore || !d.pageToken) return allItems;
      // Pengaman: kalau paginasi gak maju (token berulang) atau kebanyakan halaman,
      // berhenti — jangan loop tanpa henti. Pernah kejadian: page_token dikirim di
      // tempat yang salah ke Lark, tiap halaman balik ke halaman 1, has_more terus
      // true, dan halaman mentok di "Memuat..." sambil membanjiri Apps Script.
      if (seenToken[d.pageToken] || pageCount >= LARK_SEARCH_MAX_PAGES) {
        if (typeof dbg === 'function') {
          dbg('larkSearch stop: ' + (seenToken[d.pageToken] ? 'pageToken berulang' : 'batas ' + LARK_SEARCH_MAX_PAGES + ' halaman')
              + ' (' + tableId + ', ' + allItems.length + ' baris)');
        }
        return allItems;
      }
      seenToken[d.pageToken] = true;
      return fetchPage(d.pageToken);
    });
  }
  return fetchPage(null);
}

function larkUpdate(appToken, tableId, recordId, fields) {
  return gasProxy({
    action: 'larkUpdate',
    appToken: appToken,
    tableId: tableId,
    recordId: recordId,
    fields: JSON.stringify(fields)
  }).then(function(d) {
    if (d == null) return {};
    return d.record || d;
  });
}

function larkCreate(appToken, tableId, fields) {
  return gasProxy({
    action: 'larkCreate',
    appToken: appToken,
    tableId: tableId,
    fields: JSON.stringify(fields)
  }).then(function(d) { return d.record || d; });
}
