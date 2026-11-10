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

if (typeof module !== 'undefined') module.exports = listScope;
