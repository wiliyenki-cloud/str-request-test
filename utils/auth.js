// getUserInfo — requestAuthCode HANYA dipanggil dari home page (URL terdaftar di Dev Console).
// Sub-page lain: baca dari localStorage cache. Kalau tidak ada cache → redirect ke home.
// Cache TTL = 30 menit.
//
// Redirect URL yang perlu didaftarkan di Developer Console:
//   https://wiliyenki-sudo.github.io/str-request/lark-mini-app/pages/home/index.html

var _userInfoMem = null;
var _CACHE_KEY   = '_larkUser';
var _CACHE_TTL   = 30 * 60 * 1000; // 30 menit

function _saveCache(user) {
  _userInfoMem = user;
  // Hanya simpan ke localStorage kalau openId ada (jangan cache anonymous)
  if (user.openId) {
    try {
      localStorage.setItem(_CACHE_KEY, JSON.stringify({
        openId:   user.openId,
        nickName: user.nickName,
        ts:       Date.now()
      }));
    } catch(e) {}
  }
}

function _readCache() {
  if (_userInfoMem && _userInfoMem.openId) return _userInfoMem;
  try {
    var raw = localStorage.getItem(_CACHE_KEY);
    if (!raw) return null;
    var c = JSON.parse(raw);
    if (!c || !c.ts || !c.openId) return null;
    if (Date.now() - c.ts > _CACHE_TTL) {
      localStorage.removeItem(_CACHE_KEY);
      return null;
    }
    return { openId: c.openId, nickName: c.nickName || 'User' };
  } catch(e) { return null; }
}

function _isHomePage() {
  return location.pathname.indexOf('/home/') !== -1;
}

function getUserInfo() {
  return new Promise(function(resolve) {
    // 1. Check localStorage cache — berlaku untuk semua halaman
    var cached = _readCache();
    if (cached) {
      _userInfoMem = cached;
      if (typeof dbg === 'function') dbg('auth: cache hit openId=' + cached.openId + ' nick=' + cached.nickName);
      resolve(cached);
      return;
    }

    // 2. Tidak ada cache — kalau bukan home page, redirect ke home untuk auth
    if (!_isHomePage()) {
      if (typeof dbg === 'function') dbg('auth: no cache + not home → redirect to home');
      window.location.href = '../home/index.html';
      return; // halaman akan navigate away, Promise tidak perlu resolve
    }

    // 3. Di home page tanpa cache — lakukan requestAuthCode
    if (typeof tt === 'undefined' || typeof tt.requestAuthCode !== 'function') {
      if (typeof dbg === 'function') dbg('auth: tt not available → anonymous');
      resolve({ openId: '', nickName: 'User' });
      return;
    }

    if (typeof dbg === 'function') dbg('auth: requestAuthCode dari home...');
    tt.requestAuthCode({
      appId: CONFIG.APP_ID,
      success: function(res) {
        if (typeof dbg === 'function') dbg('auth: authCode OK → GAS exchange...');
        gasProxy({ action: 'getUserByCode', code: res.code })
          .then(function(data) {
            var user = { openId: data.openId || '', nickName: data.nickName || 'User' };
            if (typeof dbg === 'function') dbg('auth: GAS OK openId=' + user.openId + ' nick=' + user.nickName);
            _saveCache(user);
            resolve(user);
          })
          .catch(function(e) {
            if (typeof dbg === 'function') dbg('auth: GAS FAIL ' + (e.message || String(e)));
            resolve({ openId: '', nickName: 'User' });
          });
      },
      fail: function(err) {
        var msg = (err && (err.errString || err.errMsg)) || JSON.stringify(err || {});
        if (typeof dbg === 'function') dbg('auth: requestAuthCode FAIL ' + msg.slice(0, 150));
        resolve({ openId: '', nickName: 'User' });
      }
    });
  });
}

// isICO — returns true if current user is an ICO for any site.
// Supports role override via sessionStorage._roleOverride for testing:
//   'ico'     → always ICO regardless of openId
//   'manager' → never ICO (force manager role)
//   absent    → auto-detect from icoMap (Master Mapping ICO table)
function isICO(openId, icoMap) {
  try {
    var ov = sessionStorage.getItem('_roleOverride');
    if (ov === 'ico')     return true;
    if (ov === 'manager') return false;
  } catch(e) {}
  if (icoMap) return !!(icoMap[openId] && icoMap[openId].length > 0);
  return !!openId && CONFIG.ICO_USER_IDS.indexOf(openId) !== -1;
}

// clearUserCache — force re-auth (call saat logout / switch user)
function clearUserCache() {
  _userInfoMem = null;
  try { localStorage.removeItem(_CACHE_KEY); } catch(e) {}
}
