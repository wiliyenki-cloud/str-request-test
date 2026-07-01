// ─── Debug Panel ─────────────────────────────────────────────────────────────
// Floating debug panel + role-override toolbar for testing.
// Tombol DBG hanya muncul untuk open_id yang ada di CONFIG.DEV_USER_IDS.
// Include this script in every page during development.

(function() {
  var btn, outerDiv, panel, visible = false;

  function getRoleOvr() {
    try { return sessionStorage.getItem('_roleOverride') || 'auto'; } catch(e) { return 'auto'; }
  }

  function updateRoleBtns() {
    if (!outerDiv) return;
    var cur = getRoleOvr();
    outerDiv.querySelectorAll('[data-role]').forEach(function(b) {
      var active = b.dataset.role === cur;
      b.style.background = active ? '#1a7' : '#222';
      b.style.color      = active ? '#fff' : '#888';
      b.style.border     = active ? '1px solid #1a7' : '1px solid #444';
    });
  }

  function createPanel() {
    if (btn) return; // sudah dibuat

    // ── Toggle button — hidden by default, ditampilkan oleh dbgEnable ─────────
    btn = document.createElement('div');
    btn.id  = 'dbg-btn';
    btn.textContent = 'DBG';
    btn.style.cssText =
      'position:fixed;top:6px;right:6px;background:#e53;color:#fff;' +
      'font:bold 11px monospace;padding:3px 8px;border-radius:4px;z-index:99999;cursor:pointer;opacity:0.85;display:none';
    btn.addEventListener('click', function() {
      visible = !visible;
      outerDiv.style.display = visible ? 'flex' : 'none';
    });

    // ── Outer container ────────────────────────────────────────────────────
    outerDiv = document.createElement('div');
    outerDiv.id = 'dbg-outer';
    outerDiv.style.cssText =
      'display:none;position:fixed;top:30px;left:0;right:0;bottom:0;' +
      'background:rgba(0,0,0,0.92);z-index:99998;flex-direction:column';

    // ── Role-override toolbar ──────────────────────────────────────────────
    var toolbar = document.createElement('div');
    toolbar.style.cssText =
      'padding:6px 10px;border-bottom:1px solid #333;display:flex;' +
      'gap:8px;align-items:center;flex-shrink:0';

    var lbl = document.createElement('span');
    lbl.textContent = 'Role:';
    lbl.style.cssText = 'color:#666;font:11px monospace;';
    toolbar.appendChild(lbl);

    [
      { role: 'auto',    label: 'Auto'    },
      { role: 'manager', label: '👔 Mgr' },
      { role: 'ico',     label: '🏢 ICO' }
    ].forEach(function(item) {
      var b = document.createElement('button');
      b.textContent    = item.label;
      b.dataset.role   = item.role;
      b.style.cssText  =
        'padding:3px 12px;font:bold 11px monospace;border-radius:3px;cursor:pointer;';
      b.addEventListener('click', function() {
        if (item.role === 'auto') {
          try { sessionStorage.removeItem('_roleOverride'); } catch(e) {}
        } else {
          try { sessionStorage.setItem('_roleOverride', item.role); } catch(e) {}
        }
        updateRoleBtns();
        dbg('⚙ role override → ' + item.role + ' (reload page untuk apply)');
      });
      toolbar.appendChild(b);
    });

    // Reload button
    var reloadBtn = document.createElement('button');
    reloadBtn.textContent   = '↺ Reload';
    reloadBtn.style.cssText =
      'margin-left:auto;padding:3px 10px;font:11px monospace;border:1px solid #555;' +
      'background:#333;color:#aaa;border-radius:3px;cursor:pointer';
    reloadBtn.addEventListener('click', function() { location.reload(); });
    toolbar.appendChild(reloadBtn);

    // ── Log area ───────────────────────────────────────────────────────────
    panel = document.createElement('div');
    panel.id = 'dbg-panel';
    panel.style.cssText =
      'flex:1;color:#0f0;font:12px monospace;padding:10px;' +
      'overflow-y:auto;white-space:pre-wrap;word-break:break-all';

    outerDiv.appendChild(toolbar);
    outerDiv.appendChild(panel);
    document.body.appendChild(btn);
    document.body.appendChild(outerDiv);
    updateRoleBtns();
  }

  // ── Tampilkan tombol DBG jika openId ada di CONFIG.DEV_USER_IDS ───────────
  window.dbgEnable = function(openId) {
    if (!openId) return;
    var allowed = (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.DEV_USER_IDS))
      ? CONFIG.DEV_USER_IDS : [];
    if (allowed.indexOf(openId) === -1) return;
    if (!btn) createPanel();
    btn.style.display = '';
  };

  // ── Public log function ────────────────────────────────────────────────────
  window.dbg = function(msg) {
    if (!panel) createPanel();
    var t = new Date().toISOString().slice(11, 23);
    var line = document.createElement('div');
    line.style.borderBottom = '1px solid #1a1a1a';
    line.style.paddingBottom = '2px';
    line.style.marginBottom  = '2px';
    line.textContent = '[' + t + '] ' + msg;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
    try { console.log('[DBG] ' + msg); } catch(e) {}
  };

  // ── Auto-run checks on DOMContentLoaded ───────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    dbg('=== PAGE: ' + location.pathname.split('/').pop() + ' ===');
    dbg('FULL_URL: ' + location.href);
    var ov = getRoleOvr();
    if (ov !== 'auto') dbg('⚙ ROLE OVERRIDE: ' + ov.toUpperCase());
    dbg('CONFIG: '      + (typeof CONFIG      !== 'undefined' ? 'OK' : '❌ UNDEFINED'));
    dbg('tt SDK: '      + (typeof tt          !== 'undefined' ? 'OK' : '❌ UNDEFINED'));
    dbg('getUserInfo: ' + (typeof getUserInfo  === 'function'  ? 'OK' : '❌ UNDEFINED'));
    dbg('larkSearch: '  + (typeof larkSearch   === 'function'  ? 'OK' : '❌ UNDEFINED'));
  });

  // ── Global error catcher ─────────────────────────────────────────────────
  window.addEventListener('error', function(e) {
    dbg('❌ JS ERROR: ' + e.message +
        ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')');
  });
})();
