var TABS_ALL = [
  { id: 'str-list',  label: 'STR List',      icon: '📋', url: '../str-list/index.html',      roles: ['manager','ico','default'] },
  { id: 'approval',  label: 'Need Approval', icon: '✅', url: '../approval/index.html',       roles: ['manager'] },
  { id: 'ico-list',  label: 'Need Create',   icon: '📦', url: '../ico-list/index.html',       roles: ['ico'] }
];

function showEl(id) {
  document.getElementById('screen-loading').style.display = 'none';
  document.getElementById('screen-error').style.display   = 'none';
  if (id === 'error') document.getElementById('screen-error').style.display = '';
}

function renderTabs(role) {
  var tabs = TABS_ALL.filter(function(t) { return t.roles.indexOf(role) !== -1; });
  var nav = document.getElementById('tab-nav');
  nav.innerHTML = tabs.map(function(t) {
    return '<div class="tab-item" data-url="' + t.url + '">' +
      '<span class="tab-icon">' + t.icon + '</span>' +
      '<span>' + t.label + '</span></div>';
  }).join('');
  nav.style.display = '';
  nav.querySelectorAll('.tab-item').forEach(function(el) {
    el.addEventListener('click', function() {
      nav.querySelectorAll('.tab-item').forEach(function(x) { x.classList.remove('active'); });
      el.classList.add('active');
      window.location.href = el.dataset.url;
    });
  });
  // Activate first tab
  if (nav.querySelector('.tab-item')) nav.querySelector('.tab-item').classList.add('active');
}

function init() {
  document.getElementById('screen-loading').style.display = '';
  document.getElementById('screen-error').style.display   = 'none';

  getUserInfo().then(function(user) {
    var openId = user.openId;

    // Check ICO first (simple array lookup)
    if (CONFIG.ICO_USER_IDS.indexOf(openId) !== -1) {
      renderTabs('ico');
      window.location.href = '../str-list/index.html';
      document.getElementById('screen-loading').style.display = 'none';
      return;
    }

    // Fetch master site to check Manager
    larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null).then(function(siteRecords) {
      var isManager = siteRecords.some(function(r) {
        var smUsers = r.fields[CONFIG.MASTER_SM_USER_FIELD];
        if (!smUsers) return false;
        var arr = Array.isArray(smUsers) ? smUsers : [smUsers];
        return arr.some(function(u) { return (u.id || u.open_id || u.openId) === openId; });
      });

      var role = isManager ? 'manager' : 'default';
      renderTabs(role);
      window.location.href = '../str-list/index.html';
      document.getElementById('screen-loading').style.display = 'none';
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat role: ' + (err.message || String(err));
      showEl('error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal login: ' + (err.message || String(err));
    showEl('error');
  });
}

document.getElementById('btn-retry').addEventListener('click', init);
init();
