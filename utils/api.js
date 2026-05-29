// fieldText: safely extract a plain string from any Lark field value.
// Primary/title fields return [{text:'...', type:'text'}] — this handles that case.
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

// larkSearch: POST /records/search — filter is optional {conjunction, conditions}
// Returns array of {record_id, fields: {...}}
function larkSearch(appToken, tableId, filter, pageSize) {
  return new Promise(function(resolve, reject) {
    var body = { page_size: pageSize || 500 };
    if (filter) body.filter = filter;
    tt.request({
      url:    CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/search',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data:   body,
      success: function(res) {
        var d = res.data;
        if (d && d.code === 0) {
          resolve(d.data.items || []);
        } else {
          reject(new Error('larkSearch failed: ' + JSON.stringify(d)));
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

// larkUpdate: PUT /records/:recordId
// Returns updated record object
function larkUpdate(appToken, tableId, recordId, fields) {
  return new Promise(function(resolve, reject) {
    tt.request({
      url:    CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/' + recordId,
      method: 'PUT',
      header: { 'Content-Type': 'application/json' },
      data:   { fields: fields },
      success: function(res) {
        var d = res.data;
        if (d && d.code === 0) {
          resolve(d.data.record);
        } else {
          reject(new Error('larkUpdate failed: ' + JSON.stringify(d)));
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

// larkCreate: POST /records — creates a new record
// Returns created record object
function larkCreate(appToken, tableId, fields) {
  return new Promise(function(resolve, reject) {
    tt.request({
      url:    CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data:   { fields: fields },
      success: function(res) {
        var d = res.data;
        if (d && d.code === 0) {
          resolve(d.data.record);
        } else {
          reject(new Error('larkCreate failed: ' + JSON.stringify(d)));
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}
