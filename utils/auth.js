// getUserInfo — tries requestAuthCode (to get openId) then falls back gracefully.
// NOTE: gasProxy from api.js is used here; api.js must be loaded before auth.js is CALLED
// (order in HTML doesn't matter — by runtime call time all scripts are loaded).

function getUserInfo() {
  return new Promise(function(resolve) {
    // Outside Lark WebView (e.g. desktop browser) — anonymous
    if (typeof tt === 'undefined' || typeof tt.requestAuthCode !== 'function') {
      resolve({ openId: '', nickName: 'User' });
      return;
    }

    tt.requestAuthCode({
      appId: CONFIG.APP_ID,
      success: function(res) {
        // Exchange auth code via GAS to get openId
        gasProxy({ action: 'getUserByCode', code: res.code })
          .then(function(data) {
            resolve({ openId: data.openId || '', nickName: data.nickName || 'User' });
          })
          .catch(function() {
            // GAS exchange failed (e.g. network) — anonymous
            resolve({ openId: '', nickName: 'User' });
          });
      },
      fail: function() {
        // requestAuthCode failed (scope not granted etc.) — fall back to basic getUserInfo
        if (typeof tt.getUserInfo === 'function') {
          tt.getUserInfo({
            withCredentials: false,
            success: function(r) {
              var info = r.userInfo || r;
              resolve({ openId: '', nickName: info.nickName || info.nick_name || 'User' });
            },
            fail: function() { resolve({ openId: '', nickName: 'User' }); }
          });
        } else {
          resolve({ openId: '', nickName: 'User' });
        }
      }
    });
  });
}

// isICO — returns true if current user is in the ICO list
function isICO(openId) {
  return !!openId && CONFIG.ICO_USER_IDS.indexOf(openId) !== -1;
}
