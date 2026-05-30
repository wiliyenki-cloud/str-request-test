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

// ─── JSONP helper (bypass CORS untuk GAS) ────────────────────────────────────
function jsonpFetch(url) {
  return new Promise(function(resolve, reject) {
    var cbName = '_cb' + Date.now() + Math.floor(Math.random() * 1e6);
    var script = document.createElement('script');
    var timer = setTimeout(function() {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 15000);
    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch(e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cbName] = function(data) { cleanup(); resolve(data); };
    script.onerror = function() { cleanup(); reject(new Error('JSONP load error')); };
    script.src = url + '&callback=' + cbName;
    document.head.appendChild(script);
  });
}

// ─── Token cache ─────────────────────────────────────────────────────────────
var _larkToken = null;
var _tokenFetching = null;

function getLarkApiToken() {
  if (_larkToken) return Promise.resolve(_larkToken);
  if (_tokenFetching) return _tokenFetching;
  _tokenFetching = jsonpFetch(CONFIG.GAS_URL + '?action=getToken')
    .then(function(data) {
      if (data.status !== 'ok') throw new Error('getToken: ' + data.message);
      _larkToken = data.data.token;
      _tokenFetching = null;
      // Token berlaku 2 jam — clear setelah 90 menit
      setTimeout(function() { _larkToken = null; }, 90 * 60 * 1000);
      return _larkToken;
    });
  return _tokenFetching;
}

// ─── Lark Bitable helpers ─────────────────────────────────────────────────────

function larkSearch(appToken, tableId, filter, pageSize) {
  return getLarkApiToken().then(function(token) {
    var body = { page_size: pageSize || 500 };
    if (filter) body.filter = filter;
    return fetch(
      CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body)
      }
    ).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.code === 0) return d.data.items || [];
      throw new Error('larkSearch error: code=' + d.code + ' msg=' + d.msg);
    });
  });
}

function larkUpdate(appToken, tableId, recordId, fields) {
  return getLarkApiToken().then(function(token) {
    return fetch(
      CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/' + recordId,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ fields: fields })
      }
    ).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.code === 0) return d.data.record;
      throw new Error('larkUpdate error: code=' + d.code + ' msg=' + d.msg);
    });
  });
}

function larkCreate(appToken, tableId, fields) {
  return getLarkApiToken().then(function(token) {
    return fetch(
      CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ fields: fields })
      }
    ).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.code === 0) return d.data.record;
      throw new Error('larkCreate error: code=' + d.code + ' msg=' + d.msg);
    });
  });
}
