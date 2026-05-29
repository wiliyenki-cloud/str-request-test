function getUserInfo() {
  return new Promise(function(resolve) {
    if (typeof tt === 'undefined' || typeof tt.getUserInfo !== 'function') {
      resolve({ openId: '', nickName: 'User' });
      return;
    }
    tt.getUserInfo({
      withCredentials: false,
      success: function(res) {
        var info = res.userInfo || res;
        resolve({
          openId:   info.openId   || info.open_id   || '',
          nickName: info.nickName || info.nick_name  || info.displayName || 'User'
        });
      },
      fail: function() {
        resolve({ openId: '', nickName: 'User' });
      }
    });
  });
}
