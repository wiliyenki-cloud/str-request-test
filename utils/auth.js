// getUserInfo — withCredentials:true returns openId for published H5 apps.
// No extra scope needed. Falls back to anonymous if session invalid.

function getUserInfo() {
  return new Promise(function(resolve) {
    if (typeof tt === 'undefined' || typeof tt.getUserInfo !== 'function') {
      resolve({ openId: '', nickName: 'User' });
      return;
    }

    // withCredentials:true → Lark returns openId (requires published app + trusted domain)
    tt.getUserInfo({
      withCredentials: true,
      success: function(res) {
        var info = res.userInfo || res;
        resolve({
          openId:   info.openId   || info.open_id   || '',
          nickName: info.nickName || info.nick_name  || info.displayName || 'User'
        });
      },
      fail: function() {
        // Fallback: no openId but still get nickname
        tt.getUserInfo({
          withCredentials: false,
          success: function(res) {
            var info = res.userInfo || res;
            resolve({ openId: '', nickName: info.nickName || info.nick_name || 'User' });
          },
          fail: function() { resolve({ openId: '', nickName: 'User' }); }
        });
      }
    });
  });
}

// isICO — returns true if current user is in the ICO list
function isICO(openId) {
  return !!openId && CONFIG.ICO_USER_IDS.indexOf(openId) !== -1;
}
