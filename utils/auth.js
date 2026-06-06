// getUserInfo — requestAuthCode HANYA dipanggil dari home page (URL terdaftar di Dev Console).
// Sub-page lain: baca dari cache (localStorage → sessionStorage).
// Kalau tidak ada cache sama sekali → redirect ke home.
//
// Cache strategy:
//   localStorage  — hanya jika openId ada (real user, persists 30 menit)
//   sessionStorage — selalu disimpan (termasuk anonymous), prevents redirect loop
//
// Redirect URL yang perlu didaftarkan di Developer Console:
//   https://wiliyenki-sudo.github.io/str-request/lark-mini-app/pages/home/index.html

var _userInfoMem = null;
var _CACHE_KEY   = '_larkUser';
var _SESS_KEY    = '_larkUserSess';
var _CACHE_TTL   = 30 * 60 * 1000; // 30 menit

function _saveCache(user) {
  _userInfoMem = user;
  var entry = JSON.stringify({
    openId:   user.openId   || '',
    nickName: user.nickName || 'User',
    ts:       Date.now()
  });
  // Simpan ke sessionStorage
  try { sessionStorage.setItem(_SESS_KEY, entry); } catch(e) {}
  // Simpan ke localStorage untuk SEMUA user (termasuk anonymous) supaya survive
  // cross-origin navigation (misal: navigate ke GAS upload lalu balik ke mini app)
  try { localStorage.setItem(_CACHE_KEY, entry); } catch(e) {}
}

function _readCache() {
  // 1. In-memory (sama page lifetime, cek dulu)
  if (_userInfoMem !== null) return _userInfoMem;
  // 2. localStorage — persistent (termasuk anonymous), survive cross-origin navigation
  try {
    var raw = localStorage.getItem(_CACHE_KEY);
    if (raw) {
      var c = JSON.parse(raw);
      if (c && c.ts && (Date.now() - c.ts <= _CACHE_TTL)) {
        return { openId: c.openId || '', nickName: c.nickName || 'User' };
      }
      localStorage.removeItem(_CACHE_KEY);
    }
  } catch(e) {}
  // 3. sessionStorage — any auth result (termasuk anonymous)
  try {
    var sraw = sessionStorage.getItem(_SESS_KEY);
    if (sraw) {
      var sc = JSON.parse(sraw);
      if (sc && sc.ts && (Date.now() - sc.ts <= _CACHE_TTL)) {
        return { openId: sc.openId || '', nickName: sc.nickName || 'User' };
      }
      sessionStorage.removeItem(_SESS_KEY);
    }
  } catch(e) {}
  return null;
}

function _isHomePage() {
  return location.pathname.indexOf('/home/') !== -1;
}

function getUserInfo() {
  return new Promise(function(resolve) {
    var cached = _readCache();

    // Sub-page: cache APA SAJA (termasuk anon) cegah redirect loop
    if (!_isHomePage()) {
      if (cached !== null) {
        _saveCache(cached); // refresh TTL — selama aktif, cache tidak expired
        if (typeof dbg === 'function') dbg('auth: sub-page cache hit openId=' + (cached.openId || '(anon)') + ' nick=' + cached.nickName);
        resolve(cached);
        return;
      }
      // Benar-benar tidak ada cache → redirect ke home
      if (typeof dbg === 'function') dbg('auth: no cache + not home → redirect to home');
      window.location.href = '../home/index.html';
      return;
    }

    // Home page: hanya pakai cache kalau openId ADA (real user)
    // Kalau cache-nya anonymous → tetap jalankan requestAuthCode untuk upgrade ke real user
    if (cached !== null && cached.openId) {
      _saveCache(cached); // refresh TTL
      if (typeof dbg === 'function') dbg('auth: home cache hit openId=' + cached.openId + ' nick=' + cached.nickName);
      resolve(cached);
      return;
    }

    // Home page tanpa real user → requestAuthCode
    if (typeof tt === 'undefined' || typeof tt.requestAuthCode !== 'function') {
      if (typeof dbg === 'function') dbg('auth: tt not available → anonymous (saved to session)');
      var anon = { openId: '', nickName: 'User' };
      _saveCache(anon); // simpan ke sessionStorage supaya sub-page tidak redirect terus
      resolve(anon);
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
            if (typeof dbg === 'function') dbg('auth: GAS OK openId=' + (user.openId || '(anon)') + ' nick=' + user.nickName);
            _saveCache(user);
            resolve(user);
          })
          .catch(function(e) {
            if (typeof dbg === 'function') dbg('auth: GAS FAIL ' + (e.message || String(e)));
            var fallback = { openId: '', nickName: 'User' };
            _saveCache(fallback); // simpan ke sessionStorage supaya sub-page tidak redirect terus
            resolve(fallback);
          });
      },
      fail: function(err) {
        var msg = (err && (err.errString || err.errMsg)) || JSON.stringify(err || {});
        if (typeof dbg === 'function') dbg('auth: requestAuthCode FAIL ' + msg.slice(0, 150));
        var fallback = { openId: '', nickName: 'User' };
        _saveCache(fallback); // simpan ke sessionStorage supaya sub-page tidak redirect terus
        resolve(fallback);
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
  try { localStorage.removeItem(_CACHE_KEY); }   catch(e) {}
  try { sessionStorage.removeItem(_SESS_KEY); }  catch(e) {}
}
