// getUserInfo — getUserInfo (both variants) returns errCode:105 in this H5 context.
// Use requestAuthCode as primary method to get openId via GAS exchange.
// Falls back to anonymous if requestAuthCode also fails.

function getUserInfo() {
  return new Promise(function(resolve) {
    if (typeof tt === 'undefined') {
      if (typeof dbg === 'function') dbg('auth: tt not available (browser mode)');
      resolve({ openId: '', nickName: 'User' });
      return;
    }

    if (typeof tt.requestAuthCode !== 'function') {
      if (typeof dbg === 'function') dbg('auth: requestAuthCode not available');
      resolve({ openId: '', nickName: 'User' });
      return;
    }

    if (typeof dbg === 'function') dbg('auth: trying requestAuthCode appId=' + CONFIG.APP_ID);
    tt.requestAuthCode({
      appId: CONFIG.APP_ID,
      success: function(res) {
        if (typeof dbg === 'function') dbg('auth: authCode OK code=' + String(res.code || '').slice(0, 15) + '...');
        // Exchange code via GAS to get openId (requires GAS to be deployed with latest Code.gs)
        gasProxy({ action: 'getUserByCode', code: res.code })
          .then(function(data) {
            if (typeof dbg === 'function') dbg('auth: GAS exchange OK openId=' + (data.openId || '(empty)') + ' nick=' + data.nickName);
            resolve({ openId: data.openId || '', nickName: data.nickName || 'User' });
          })
          .catch(function(e) {
            if (typeof dbg === 'function') dbg('auth: GAS exchange FAIL — ' + (e.message || String(e)));
            if (typeof dbg === 'function') dbg('auth: → pastikan GAS sudah di-redeploy dengan Code.gs terbaru!');
            resolve({ openId: '', nickName: 'User' });
          });
      },
      fail: function(err) {
        if (typeof dbg === 'function') dbg('auth: requestAuthCode FAIL err=' + JSON.stringify(err || {}).slice(0, 150));
        resolve({ openId: '', nickName: 'User' });
      }
    });
  });
}

// isICO — returns true if current user is in the ICO list
function isICO(openId) {
  return !!openId && CONFIG.ICO_USER_IDS.indexOf(openId) !== -1;
}
