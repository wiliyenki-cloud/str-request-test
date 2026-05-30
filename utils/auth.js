// getUserInfo — requestAuthCode HANYA dipanggil dari home page (URL terdaftar di Dev Console).
// Halaman lain baca dari localStorage cache. Cache TTL = 30 menit.
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
  // Hanya gunakan cache kalau openId ada (abaikan anonymous yang tersimpan)
  if (_userInfoMem && _userInfoMem.openId) return _userInfoMem;
  try {
    var raw = localStorage.getItem(_CACHE_KEY);
    if (!raw) return null;
    var c = JSON.parse(raw);
    if (!c || !c.ts || !c.openId) return null;   // abaikan cache anonymous
    if (Date.now() - c.ts > _CACHE_TTL) {
      localStorage.removeItem(_CACHE_KEY);
      return null;
    }
    return { openId: c.openId, nickName: c.nickName || 'User' };
  } catch(e) { return null; }
}

function getUserInfo() {
  return new Promise(function(resolve) {
    // 1. Check localStorage cache
    var cached = _readCache();
    if (cached) {
      _userInfoMem = cached;
      if (typeof dbg === 'function') dbg('auth: cache hit openId=' + (cached.openId || '(empty)') + ' nick=' + cached.nickName);
      resolve(cached);
      return;
    }

    if (typeof tt === 'undefined' || typeof tt.requestAuthCode !== 'function') {
      if (typeof dbg === 'function') dbg('auth: tt not available → anonymous');
      var anon = { openId: '', nickName: 'User' };
      _saveCache(anon);
      resolve(anon);
      return;
    }

    // 2. Try requestAuthCode from any page
    // (Lark allows it once any URL is registered in redirect URLs)
    if (typeof dbg === 'function') dbg('auth: trying requestAuthCode from ' + location.pathname.split('/').pop() + '...');
    tt.requestAuthCode({
      appId: CONFIG.APP_ID,
      success: function(res) {
        if (typeof dbg === 'function') dbg('auth: authCode OK → GAS exchange...');
        gasProxy({ action: 'getUserByCode', code: res.code })
          .then(function(data) {
            var user = { openId: data.openId || '', nickName: data.nickName || 'User' };
            if (typeof dbg === 'function') dbg('auth: GAS OK openId=' + (user.openId || '(empty)') + ' nick=' + user.nickName);
            _saveCache(user);
            resolve(user);
          })
          .catch(function(e) {
            if (typeof dbg === 'function') dbg('auth: GAS FAIL ' + (e.message || String(e)));
            if (typeof dbg === 'function') dbg('auth: → update GAS dulu!');
            var anon3 = { openId: '', nickName: 'User' };
            _saveCache(anon3);
            resolve(anon3);
          });
      },
      fail: function(err) {
        var msg = (err && (err.errString || err.errMsg)) || JSON.stringify(err || {});
        if (typeof dbg === 'function') dbg('auth: requestAuthCode FAIL ' + msg.slice(0, 150));
        var anon4 = { openId: '', nickName: 'User' };
        _saveCache(anon4);
        resolve(anon4);
      }
    });
  });
}

// isICO — returns true if current user is in the ICO list
function isICO(openId) {
  return !!openId && CONFIG.ICO_USER_IDS.indexOf(openId) !== -1;
}

// clearUserCache — force re-auth (call saat logout / switch user)
function clearUserCache() {
  _userInfoMem = null;
  try { localStorage.removeItem(_CACHE_KEY); } catch(e) {}
}
