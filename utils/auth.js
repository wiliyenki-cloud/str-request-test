function getUserInfo() {
  return new Promise(function(resolve, reject) {
    if (typeof tt === 'undefined') {
      reject(new Error('tt is not defined — buka dari Lark, bukan browser'));
      return;
    }

    function doGet() {
      tt.getUserInfo({
        withCredentials: false,
        success: function(res) {
          var info = res.userInfo || res;
          resolve({
            openId:   info.openId   || info.open_id   || '',
            nickName: info.nickName || info.nick_name  || info.displayName || ''
          });
        },
        fail: function(err) {
          // Tampilkan error detail supaya bisa didiagnosa
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
      // SDK versi lama tidak punya tt.ready
      doGet();
    }
  });
}
