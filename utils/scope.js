// Cakupan site satu user untuk daftar STR/ADJ: null = semua site, [] = tidak punya akses.
// Bergantung pada global browser: isICO (auth.js), fieldText (api.js), CONFIG, FLOW (flow.js).
// siteRecords = hasil MASTER_SITE; icoMap = peta openId -> [site] dari MASTER_ICO.
// Site yang dikelola user sebagai Store Manager (kolom STORE di Master Site) ditambah site tambahan
// khusus mode uji (CONFIG.MANAGER_SITE_OVERRIDE; kosong di produksi). Dipakai semua halaman daftar.
function managerSitesOf(user, siteRecords) {
  var out = [];
  if (!user || !user.openId) return out;
  (siteRecords || []).forEach(function (r) {
    var sm = r.fields[CONFIG.MASTER_SM_USER_FIELD];
    if (!sm) return;
    var arr = Array.isArray(sm) ? sm : [sm];
    if (arr.some(function (u) { return (u.id || u.open_id || u.openId) === user.openId; })) {
      var site = fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]);
      if (site && out.indexOf(site) === -1) out.push(site);
    }
  });
  var extra = (CONFIG.MANAGER_SITE_OVERRIDE && CONFIG.MANAGER_SITE_OVERRIDE[user.openId]) || [];
  extra.forEach(function (s) { if (out.indexOf(s) === -1) out.push(s); });
  return out;
}

function listScope(user, siteRecords, icoMap) {
  var userIsICO = isICO(user.openId, icoMap);
  var override = '';
  try { override = sessionStorage.getItem('_roleOverride') || ''; } catch (e) {}
  var mySites = userIsICO ? [] : managerSitesOf(user, siteRecords);
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

if (typeof module !== 'undefined') { module.exports = listScope; module.exports.loadDetailRows = loadDetailRows; module.exports.managerSitesOf = managerSitesOf; }
