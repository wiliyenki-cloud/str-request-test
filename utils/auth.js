function getUserInfo() {
  return new Promise(function(resolve, reject) {
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
}
