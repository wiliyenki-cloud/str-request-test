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

    if (typeof tt.requestAuthCode === 'function') {
      tt.requestAuthCode({
        appId: CONFIG.APP_ID,
        success: function(res) { exchangeCode(res.code); },
        fail: function(err) {
          var msg = (err && (err.errMsg || err.errString || err.message)) || JSON.stringify(err);
          reject(new Error('requestAuthCode fail: ' + msg));
        }
      });
    } else {
      // Fallback: getUserInfo tanpa openId
      tt.getUserInfo({
        withCredentials: false,
        success: function(res) {
          var info = res.userInfo || res;
          resolve({
            openId:   info.openId   || info.open_id   || '',
            nickName: info.nickName || info.nick_name  || ''
          });
        },
        fail: function(err) {
          var msg = (err && (err.errMsg || err.errString || err.message)) || JSON.stringify(err);
          reject(new Error('getUserInfo fail: ' + msg));
        }
      });
    }
  });
}
