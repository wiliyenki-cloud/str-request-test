// getUserInfo — tries multiple methods to get user identity.
// Logs each step to the debug panel so we can see exactly what fails.

function getUserInfo() {
  return new Promise(function(resolve) {
    if (typeof tt === 'undefined' || typeof tt.getUserInfo !== 'function') {
      if (typeof dbg === 'function') dbg('auth: tt SDK not available');
      resolve({ openId: '', nickName: 'User' });
      return;
    }

    // Step 1: Try withCredentials:true (should return openId for published H5 apps)
    if (typeof dbg === 'function') dbg('auth: trying withCredentials:true...');
    tt.getUserInfo({
      withCredentials: true,
      success: function(res) {
        var raw = JSON.stringify(res || {});
        if (typeof dbg === 'function') dbg('auth: wC:true SUCCESS raw=' + raw.slice(0, 150));
        var info   = res.userInfo || res;
        var openId = info.openId || info.open_id || info.userId || info.union_id || '';
        var nick   = info.nickName || info.nick_name || info.displayName || info.name || 'User';
        if (typeof dbg === 'function') dbg('auth: openId=' + (openId || '(empty)') + ' nick=' + nick);
        resolve({ openId: openId, nickName: nick });
      },
      fail: function(err) {
        if (typeof dbg === 'function') dbg('auth: wC:true FAIL err=' + JSON.stringify(err || {}).slice(0, 100));

        // Step 2: Try withCredentials:false (gets nickName at least, no openId)
        if (typeof dbg === 'function') dbg('auth: trying withCredentials:false...');
        tt.getUserInfo({
          withCredentials: false,
          success: function(res) {
            var raw = JSON.stringify(res || {});
            if (typeof dbg === 'function') dbg('auth: wC:false SUCCESS raw=' + raw.slice(0, 150));
            var info = res.userInfo || res;
            var nick = info.nickName || info.nick_name || info.displayName || info.name || 'User';
            if (typeof dbg === 'function') dbg('auth: nick=' + nick + ' (no openId from wC:false)');

            // Step 3: Try requestAuthCode to get openId via GAS exchange
            if (typeof tt.requestAuthCode === 'function' && typeof gasProxy === 'function') {
              if (typeof dbg === 'function') dbg('auth: trying requestAuthCode...');
              tt.requestAuthCode({
                appId: CONFIG.APP_ID,
                success: function(r) {
                  if (typeof dbg === 'function') dbg('auth: authCode OK, exchanging via GAS...');
                  gasProxy({ action: 'getUserByCode', code: r.code })
                    .then(function(data) {
                      if (typeof dbg === 'function') dbg('auth: GAS exchange OK openId=' + (data.openId || '(empty)'));
                      resolve({ openId: data.openId || '', nickName: data.nickName || nick });
                    })
                    .catch(function(e) {
                      if (typeof dbg === 'function') dbg('auth: GAS exchange FAIL err=' + (e.message || String(e)));
                      resolve({ openId: '', nickName: nick });
                    });
                },
                fail: function(e) {
                  if (typeof dbg === 'function') dbg('auth: requestAuthCode FAIL err=' + JSON.stringify(e || {}).slice(0, 100));
                  resolve({ openId: '', nickName: nick });
                }
              });
            } else {
              if (typeof dbg === 'function') dbg('auth: requestAuthCode not available, giving up');
              resolve({ openId: '', nickName: nick });
            }
          },
          fail: function(err2) {
            if (typeof dbg === 'function') dbg('auth: wC:false FAIL err=' + JSON.stringify(err2 || {}).slice(0, 100));
            resolve({ openId: '', nickName: 'User' });
          }
        });
      }
    });
  });
}

// isICO — returns true if current user is in the ICO list
function isICO(openId) {
  return !!openId && CONFIG.ICO_USER_IDS.indexOf(openId) !== -1;
}
