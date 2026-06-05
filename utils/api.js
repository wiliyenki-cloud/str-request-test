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
    }, 20000);
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

function larkSearch(appToken, tableId, filter, pageSize) {
  var params = { action: 'larkSearch', appToken: appToken, tableId: tableId, pageSize: pageSize || 500 };
  if (filter) params.filter = JSON.stringify(filter);
  return gasProxy(params).then(function(d) { return d.items || []; });
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
