// ─── Debug Panel ─────────────────────────────────────────────────────────────
// Inject a floating debug panel. Visible only when user taps "DBG" button.
// Include this script in every page during development.

(function() {
  var panel, visible = false;

  function createPanel() {
    // Toggle button
    var btn = document.createElement('div');
    btn.id  = 'dbg-btn';
    btn.textContent = 'DBG';
    btn.style.cssText = 'position:fixed;top:6px;right:6px;background:#e53;color:#fff;' +
      'font:bold 11px monospace;padding:3px 8px;border-radius:4px;z-index:99999;cursor:pointer;opacity:0.85';
    btn.addEventListener('click', function() {
      visible = !visible;
      panel.style.display = visible ? 'block' : 'none';
    });

    // Log panel
    panel = document.createElement('div');
    panel.id = 'dbg-panel';
    panel.style.cssText = 'display:none;position:fixed;top:30px;left:0;right:0;bottom:0;' +
      'background:rgba(0,0,0,0.92);color:#0f0;font:12px monospace;' +
      'padding:10px;overflow-y:auto;z-index:99998;white-space:pre-wrap;word-break:break-all';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  // Public log function
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
    // Also log to console if available
    try { console.log('[DBG] ' + msg); } catch(e) {}
  };

  // Auto-run checks when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    dbg('=== PAGE: ' + location.pathname.split('/').pop() + ' ===');
    dbg('FULL_URL: ' + location.href);
    dbg('CONFIG: '      + (typeof CONFIG      !== 'undefined' ? 'OK (GAS=' + CONFIG.GAS_URL.slice(-30) + ')' : '❌ UNDEFINED'));
    dbg('tt SDK: '      + (typeof tt          !== 'undefined' ? 'OK' : '❌ UNDEFINED'));
    dbg('getUserInfo: ' + (typeof getUserInfo  === 'function'  ? 'OK' : '❌ UNDEFINED'));
    dbg('larkSearch: '  + (typeof larkSearch   === 'function'  ? 'OK' : '❌ UNDEFINED'));
  });

  // Catch global JS errors
  window.addEventListener('error', function(e) {
    dbg('❌ JS ERROR: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')');
  });
})();
