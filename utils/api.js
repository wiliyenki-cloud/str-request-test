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
function jsonpFetch(url) {
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

  var allItems = [];
  function fetchPage(pageToken) {
    var params = { action: 'larkSearch', appToken: appToken, tableId: tableId, pageSize: pageSize };
    if (filter)          params.filter     = JSON.stringify(filter);
    if (pageToken)       params.pageToken  = pageToken;
    if (opts.fieldNames) params.fieldNames = JSON.stringify(opts.fieldNames);
    if (opts.cacheTtl)   params.cacheTtl   = opts.cacheTtl;
    return gasProxy(params).then(function(d) {
      allItems = allItems.concat(d.items || []);
      if (d.hasMore && d.pageToken) return fetchPage(d.pageToken);
      return allItems;
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
