function getUserInfo() {
  return new Promise(function(resolve, reject) {
    if (typeof tt === 'undefined') {
      reject(new Error('tt is not defined — buka dari Lark, bukan browser biasa'));
      return;
    }

    function exchangeCode(code) {
      fetch(CONFIG.GAS_URL + '?action=getUserByCode&code=' + encodeURIComponent(code))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.status !== 'ok') throw new Error(data.message || 'getUserByCode failed');
          resolve({ openId: data.data.openId, nickName: data.data.nickName });
        })
        .catch(function(err) {
          reject(new Error('getUserByCode error: ' + (err.message || String(err))));
        });
    }

    function fallbackGetUserInfo() {
      // Fallback: pakai getUserInfo withCredentials:false — tidak dapat openId
      // Role detection akan skip, user diperlakukan sebagai default
      tt.getUserInfo({
        withCredentials: false,
        success: function(res) {
          var info = res.userInfo || res;
          resolve({
            openId:   '',  // Tidak tersedia tanpa requestAuthCode
            nickName: info.nickName || info.nick_name || info.displayName || 'User'
          });
        },
        fail: function(err) {
          var msg = (err && (err.errMsg || err.errString || err.message)) || JSON.stringify(err);
          reject(new Error('getUserInfo fail: ' + msg));
        }
      });
    }

    if (typeof tt.requestAuthCode === 'function') {
      tt.requestAuthCode({
        appId: CONFIG.APP_ID,
        success: function(res) { exchangeCode(res.code); },
        fail: function(err) {
          // requestAuthCode gagal — coba fallback
          console.warn('requestAuthCode failed, trying fallback:', err);
          fallbackGetUserInfo();
        }
      });
    } else {
      fallbackGetUserInfo();
    }
  });
}
