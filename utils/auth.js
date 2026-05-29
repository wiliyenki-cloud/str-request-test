function getUserInfo() {
  return new Promise(function(resolve, reject) {
    if (typeof tt === 'undefined') {
      reject(new Error('tt is not defined — pastikan app dibuka dari dalam Lark, bukan browser biasa.'));
      return;
    }
    tt.ready(function() {
      tt.getUserInfo({
        withCredentials: false,
        success: function(res) {
          resolve({
            openId:   res.userInfo.openId   || res.userInfo.open_id  || '',
            nickName: res.userInfo.nickName || res.userInfo.nick_name || ''
          });
        },
        fail: function(err) { reject(err); }
      });
    });
  });
}
