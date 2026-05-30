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

// ─── Token cache ─────────────────────────────────────────────────────────────
var _larkToken = null;
var _tokenFetching = null;

function getLarkApiToken() {
  if (_larkToken) return Promise.resolve(_larkToken);
  if (_tokenFetching) return _tokenFetching;
  _tokenFetching = fetch(CONFIG.GAS_URL + '?action=getToken')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.status !== 'ok') throw new Error('getToken failed: ' + data.message);
      _larkToken = data.data.token;
      _tokenFetching = null;
      // Token berlaku 2 jam — clear cache setelah 90 menit
      setTimeout(function() { _larkToken = null; }, 90 * 60 * 1000);
      return _larkToken;
    });
  return _tokenFetching;
}

// ─── Lark Bitable helpers ─────────────────────────────────────────────────────

// larkSearch: POST /records/search — filter is optional {conjunction, conditions}
// Returns array of {record_id, fields: {...}}
function larkSearch(appToken, tableId, filter, pageSize) {
  return getLarkApiToken().then(function(token) {
    var body = { page_size: pageSize || 500 };
    if (filter) body.filter = filter;
    return fetch(
      CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(body)
      }
    ).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.code === 0) return d.data.items || [];
      throw new Error('larkSearch failed: ' + JSON.stringify(d));
    });
  });
}

// larkUpdate: PUT /records/:recordId
function larkUpdate(appToken, tableId, recordId, fields) {
  return getLarkApiToken().then(function(token) {
    return fetch(
      CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/' + recordId,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ fields: fields })
      }
    ).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.code === 0) return d.data.record;
      throw new Error('larkUpdate failed: ' + JSON.stringify(d));
    });
  });
}

// larkCreate: POST /records
function larkCreate(appToken, tableId, fields) {
  return getLarkApiToken().then(function(token) {
    return fetch(
      CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ fields: fields })
      }
    ).then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.code === 0) return d.data.record;
      throw new Error('larkCreate failed: ' + JSON.stringify(d));
    });
  });
}
