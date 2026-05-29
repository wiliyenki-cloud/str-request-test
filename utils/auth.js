function getUserInfo() {
  return new Promise(function(resolve, reject) {
    if (typeof tt === 'undefined') {
      reject(new Error('tt is not defined — buka dari Lark, bukan browser biasa'));
      return;
    }
    if (!CONFIG.GAS_URL || !CONFIG.APP_ID) {
      reject(new Error('CONFIG.GAS_URL dan CONFIG.APP_ID belum diisi di config.js'));
      return;
    }

    // Step 1: Ambil jsapi config dari GAS backend
    var pageUrl = window.location.href.split('#')[0];
    fetch(CONFIG.GAS_URL + '?action=jsapiConfig&url=' + encodeURIComponent(pageUrl))
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp.status !== 'ok') throw new Error('jsapiConfig error: ' + resp.message);
        var cfg = resp.data;

        // Step 2: Panggil tt.config()
        tt.config({
          appId:     cfg.appId,
          timestamp: cfg.timestamp,
          nonceStr:  cfg.nonceStr,
          signature: cfg.signature,
          jsApiList: ['getUserInfo']
        });

        tt.error(function(res) {
          reject(new Error('tt.config error: ' + JSON.stringify(res)));
        });

        // Step 3: Tunggu ready lalu getUserInfo
        function doGet() {
          tt.getUserInfo({
            withCredentials: true,
            success: function(res) {
              var info = res.userInfo || res;
              resolve({
                openId:   info.openId   || info.open_id   || '',
                nickName: info.nickName || info.nick_name  || info.displayName || ''
              });
            },
            fail: function(err) {
              var msg = (err && (err.errMsg || err.errString || err.message))
                        ? (err.errMsg || err.errString || err.message)
                        : JSON.stringify(err);
              reject(new Error('getUserInfo fail: ' + msg));
            }
          });
        }

        if (typeof tt.ready === 'function') {
          tt.ready(doGet);
        } else {
          doGet();
        }
      })
      .catch(function(err) {
        reject(new Error('Gagal fetch jsapiConfig: ' + (err.message || String(err))));
      });
  });
}
