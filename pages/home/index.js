var TABS_ALL = [
  { id: 'str-list', label: 'STR List',      desc: 'Lihat & kelola request STR', icon: '📋', url: '../str-list/index.html' },
  { id: 'adj-list', label: 'ADJ List',      desc: 'Lihat & kelola request ADJ', icon: '📝', url: '../adj-list/index.html' },
  { id: 'approval', label: 'Need Approval', desc: 'STR menunggu persetujuan',   icon: '✅', url: '../approval/index.html' },
  { id: 'ico-list', label: 'Need Create',   desc: 'STR & ADJ siap diproses',   icon: '📦', url: '../ico-list/index.html' }
];

function showEl(id) {
  document.getElementById('screen-loading').style.display = 'none';
  document.getElementById('screen-error').style.display   = 'none';
  document.getElementById('tab-nav').style.display        = 'none';
  if (id === 'error') document.getElementById('screen-error').style.display = '';
  if (id === 'tabs')  document.getElementById('tab-nav').style.display      = '';
}

function renderTabs() {
  var nav = document.getElementById('tab-nav');
  nav.innerHTML = TABS_ALL.map(function(t) {
    return '<div class="menu-card" data-url="' + t.url + '">' +
      '<span class="card-icon">' + t.icon + '</span>' +
      '<span class="card-label">' + t.label + '</span>' +
      '<span class="card-desc">' + t.desc + '</span>' +
      '</div>';
  }).join('');
  nav.querySelectorAll('.menu-card').forEach(function(el) {
    el.addEventListener('click', function() {
      window.location.href = el.dataset.url;
    });
  });
}

function init() {
  document.getElementById('screen-loading').style.display = '';
  document.getElementById('screen-error').style.display   = 'none';

  getUserInfo().then(function(user) {
    var name = (user && user.nickName) ? user.nickName : '';
    if (name) document.getElementById('home-user').textContent = 'Halo, ' + name;
    else       document.getElementById('home-user').textContent = '';
    renderTabs();
    showEl('tabs');
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal login: ' + (err.message || String(err));
    showEl('error');
  });
}

document.getElementById('btn-retry').addEventListener('click', init);
init();
