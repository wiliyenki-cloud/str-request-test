// Cakupan site satu user untuk daftar STR/ADJ: null = semua site, [] = tidak punya akses.
// Bergantung pada global browser: isICO (auth.js), fieldText (api.js), CONFIG, FLOW (flow.js).
// siteRecords = hasil MASTER_SITE; icoMap = peta openId -> [site] dari MASTER_ICO.
function listScope(user, siteRecords, icoMap) {
  var userIsICO = isICO(user.openId, icoMap);
  var override = '';
  try { override = sessionStorage.getItem('_roleOverride') || ''; } catch (e) {}
  var mySites = [];
  if (!userIsICO && user.openId) {
    mySites = (siteRecords || []).filter(function (r) {
      var sm = r.fields[CONFIG.MASTER_SM_USER_FIELD];
      if (!sm) return false;
      var arr = Array.isArray(sm) ? sm : [sm];
      return arr.some(function (u) { return (u.id || u.open_id || u.openId) === user.openId; });
    }).map(function (r) { return fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]); }).filter(Boolean);
  }
  return FLOW.scopeSites({
    isICO: userIsICO, override: override, icoSites: (icoMap || {})[user.openId] || [],
    mySites: mySites, openId: user.openId
  });
}

// Tarik tabel detail per bulan dan per site (maksimal 2 panggilan paralel).
// Mengembalikan Promise<Array> atau Promise.reject(Error) bila rentang lebih dari 6 bulan.
function loadDetailRows(tableId, numberField, sites, fromMs, toMs) {
  var filters = FLOW.detailFilters(numberField, sites, fromMs, toMs);
  if (!filters) return Promise.reject(new Error('Pilih rentang tanggal paling lama 6 bulan.'));
  var tasks = filters.map(function (f) {
    return function () { return larkSearch(CONFIG.STR_BASE_APP_TOKEN, tableId, f); };
  });
  return FLOW.runLimited(tasks, 2).then(function (parts) { return [].concat.apply([], parts); });
}

if (typeof module !== 'undefined') { module.exports = listScope; module.exports.loadDetailRows = loadDetailRows; }
