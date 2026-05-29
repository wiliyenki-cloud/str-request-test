var TABS_ALL = [
  { id: 'str-list', label: 'STR List',      icon: '📋', url: '../str-list/index.html' },
  { id: 'approval', label: 'Need Approval', icon: '✅', url: '../approval/index.html' },
  { id: 'ico-list', label: 'Need Create',   icon: '📦', url: '../ico-list/index.html' }
];

function showEl(id) {
  document.getElementById('screen-loading').style.display = 'none';
  document.getElementById('screen-error').style.display   = 'none';
  if (id === 'error') document.getElementById('screen-error').style.display = '';
}

function renderTabs() {
  var nav = document.getElementById('tab-nav');
  nav.innerHTML = TABS_ALL.map(function(t) {
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
  if (nav.querySelector('.tab-item')) nav.querySelector('.tab-item').classList.add('active');
}

function init() {
  document.getElementById('screen-loading').style.display = '';
  document.getElementById('screen-error').style.display   = 'none';

  getUserInfo().then(function() {
    renderTabs();
    window.location.href = '../str-list/index.html';
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal login: ' + (err.message || String(err));
    showEl('error');
  });
}

document.getElementById('btn-retry').addEventListener('click', init);
init();
