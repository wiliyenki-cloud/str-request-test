// getUserInfo — requestAuthCode as primary method with sessionStorage caching.
//
// IMPORTANT: requestAuthCode is only called from pages whose URL is registered
// in Developer Console → Security Settings → Redirect URLs.
// Only HOME page URL is registered. Other pages read from sessionStorage cache.
//
// Flow:
//   Home (registered URL) → requestAuthCode → GAS exchange → cache → redirect to str-list
//   Other pages → read from sessionStorage cache (no requestAuthCode)

var _userInfoMem = null; // in-memory cache (per page load)

function getUserInfo() {
  return new Promise(function(resolve) {
    // 1. In-memory cache
    if (_userInfoMem) {
      if (typeof dbg === 'function') dbg('auth: mem cache openId=' + (_userInfoMem.openId || '(empty)'));
      resolve(_userInfoMem);
      return;
    }

    // 2. sessionStorage cache (persists across page navigations in same WebView)
    try {
      var stored = sessionStorage.getItem('_larkUser');
      if (stored) {
        _userInfoMem = JSON.parse(stored);
        if (typeof dbg === 'function') dbg('auth: session cache openId=' + (_userInfoMem.openId || '(empty)') + ' nick=' + _userInfoMem.nickName);
        resolve(_userInfoMem);
        return;
      }
    } catch(e) {}

    if (typeof tt === 'undefined' || typeof tt.requestAuthCode !== 'function') {
      if (typeof dbg === 'function') dbg('auth: tt not available → anonymous');
      resolve({ openId: '', nickName: 'User' });
      return;
    }

    // 3. requestAuthCode (only works when current page URL is in registered Redirect URLs)
    if (typeof dbg === 'function') dbg('auth: PAGE_URL = ' + location.href);
    if (typeof dbg === 'function') dbg('auth: requestAuthCode from ' + location.pathname.split('/').pop() + '...');
    tt.requestAuthCode({
      appId: CONFIG.APP_ID,
      success: function(res) {
        if (typeof dbg === 'function') dbg('auth: authCode OK → GAS exchange...');
        gasProxy({ action: 'getUserByCode', code: res.code })
          .then(function(data) {
            var user = { openId: data.openId || '', nickName: data.nickName || 'User' };
            if (typeof dbg === 'function') dbg('auth: GAS OK openId=' + (user.openId || '(empty)') + ' nick=' + user.nickName);
            _userInfoMem = user;
            try { sessionStorage.setItem('_larkUser', JSON.stringify(user)); } catch(e) {}
            resolve(user);
          })
          .catch(function(e) {
            if (typeof dbg === 'function') dbg('auth: GAS FAIL ' + (e.message || String(e)));
            if (typeof dbg === 'function') dbg('auth: → pastikan GAS sudah di-redeploy!');
            var anon = { openId: '', nickName: 'User' };
            _userInfoMem = anon;
            resolve(anon);
          });
      },
      fail: function(err) {
        var msg = (err && (err.errString || err.errMsg)) || JSON.stringify(err || {});
        if (typeof dbg === 'function') dbg('auth: requestAuthCode FAIL ' + msg.slice(0, 120));
        var anon = { openId: '', nickName: 'User' };
        _userInfoMem = anon;
        // Save anonymous to sessionStorage so other pages don't retry requestAuthCode
        try { sessionStorage.setItem('_larkUser', JSON.stringify(anon)); } catch(e) {}
        resolve(anon);
      }
    });
  });
}

// isICO — returns true if current user is in the ICO list
function isICO(openId) {
  return !!openId && CONFIG.ICO_USER_IDS.indexOf(openId) !== -1;
}

// clearUserCache — call to force re-authentication
function clearUserCache() {
  _userInfoMem = null;
  try { sessionStorage.removeItem('_larkUser'); } catch(e) {}
}
