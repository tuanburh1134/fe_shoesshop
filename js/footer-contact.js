(function () {
  function getHomeUrl() {
    try {
      var p = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
      return p.indexOf('/admin/') >= 0 ? '../index.html' : 'index.html';
    } catch (e) {
      return 'index.html';
    }
  }

  function bindLogoHome() {
    try {
      var logo = document.getElementById('site-logo');
      if (!logo) return;
      logo.style.cursor = 'pointer';
      if (logo.dataset.homeBound === '1') return;
      logo.dataset.homeBound = '1';
      logo.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = getHomeUrl();
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLogoHome);
  } else {
    bindLogoHome();
  }

  function applySavedTheme() {
    try {
      var isDark = localStorage.getItem('ui_dark_mode') === '1';
      document.body.classList.toggle('app-dark', isDark);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySavedTheme);
  } else {
    applySavedTheme();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'ui_dark_mode') applySavedTheme();
  });

  function injectFooter() {
    if (document.getElementById('global-contact-footer')) return;

    // Remove legacy copyright footer if present so copyright is only shown at the bottom.
    try {
      var oldFooters = document.querySelectorAll('footer.bg-light.py-4');
      oldFooters.forEach(function (f) { f.remove(); });
    } catch (e) {}

    var footer = document.createElement('footer');
    footer.id = 'global-contact-footer';
    footer.className = 'bg-light border-top mt-4';
    footer.innerHTML =
      '<div class="container py-3 small text-muted">' +
      '<div><strong>Liên hệ:</strong></div>' +
      '<div>Facebook: <a href="https://www.facebook.com/?locale=vi_VN" target="_blank" rel="noopener noreferrer">https://www.facebook.com/?locale=vi_VN</a></div>' +
      '<div>Gmail: <a href="mailto:tuan75035@gmail.com">tuan75035@gmail.com</a></div>' +
      '<div>SĐT: <a href="tel:0869034205">0869034205</a></div>' +
      '<div>Địa chỉ: 128 Hà Đông, Hà Nội, Việt Nam</div>' +
      '<div class="pt-3 mt-3 border-top">© 2026 myshoes - All rights reserved</div>' +
      '</div>';

    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }

  function installModernNotifier() {
    if (window.__modernToastInstalled) return;
    window.__modernToastInstalled = true;

    if (!document.getElementById('global-toast-style-v2')) {
      var style = document.createElement('style');
      style.id = 'global-toast-style-v2';
      style.textContent = [
        '.toast-v2-wrap{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:none;padding:12px;}',
        '.toast-v2{width:min(92vw,560px);pointer-events:auto;display:flex;gap:12px;align-items:flex-start;background:rgba(255,255,255,0.98);border:1px solid #eceff3;border-left:5px solid #0b69a3;border-radius:14px;padding:14px 16px;box-shadow:0 18px 40px rgba(0,0,0,.18);color:#1f2a37;backdrop-filter:blur(4px);transform:translateY(6px) scale(.98);opacity:0;animation:toastIn .22s ease forwards;}',
        '.toast-v2.ok{border-left-color:#16a34a;}',
        '.toast-v2.err{border-left-color:#dc2626;}',
        '.toast-v2.warn{border-left-color:#d97706;}',
        '.toast-v2 .ic{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex:0 0 30px;margin-top:1px;background:#0b69a3;}',
        '.toast-v2.ok .ic{background:#16a34a;}',
        '.toast-v2.err .ic{background:#dc2626;}',
        '.toast-v2.warn .ic{background:#d97706;}',
        '.toast-v2 .ct{min-width:0;}',
        '.toast-v2 .tt{font-weight:800;font-size:20px;line-height:1.25;}',
        '.toast-v2 .tx{font-size:15px;color:#64748b;line-height:1.4;margin-top:4px;word-break:break-word;}',
        '.toast-v2 .x{margin-left:auto;border:none;background:transparent;color:#64748b;font-size:18px;line-height:1;cursor:pointer;padding:0 0 0 8px;}',
        '.toast-v2.hide{animation:toastOut .18s ease forwards;}',
        '@keyframes toastIn{to{transform:translateY(0) scale(1);opacity:1;}}',
        '@keyframes toastOut{to{transform:translateY(-8px) scale(.98);opacity:0;}}'
      ].join('');
      document.head.appendChild(style);
    }

    function parseArgs(a, b, c, d) {
      var title = a || '';
      var message = '';
      var type = 'info';
      var duration = 2200;
      var types = ['success', 'error', 'info', 'warning', 'ok', 'err', 'warn'];

      if (arguments.length === 2) {
        if (typeof b === 'number') duration = b;
        else if (types.indexOf(String(b)) >= 0) type = b;
        else message = b || '';
      } else if (arguments.length === 3) {
        if (typeof c === 'number') {
          message = b || '';
          duration = c;
        } else {
          message = b || '';
          type = c || 'info';
        }
      } else if (arguments.length >= 4) {
        message = b || '';
        type = c || 'info';
        duration = d;
      }

      type = String(type || 'info').toLowerCase();
      if (type === 'success') type = 'ok';
      if (type === 'error') type = 'err';
      if (type === 'warning') type = 'warn';
      duration = parseInt(duration, 10);
      if (!duration || duration < 800) duration = 2200;

      return { title: String(title || ''), message: String(message || ''), type: type, duration: duration };
    }

    function getWrap() {
      var wrap = document.getElementById('toast-v2-wrap');
      if (wrap) return wrap;
      wrap = document.createElement('div');
      wrap.id = 'toast-v2-wrap';
      wrap.className = 'toast-v2-wrap';
      document.body.appendChild(wrap);
      return wrap;
    }

    function iconFor(type) {
      if (type === 'ok') return 'OK';
      if (type === 'err') return '!';
      if (type === 'warn') return '!';
      return 'i';
    }

    function show(a, b, c, d) {
      var parsed = parseArgs(a, b, c, d);
      var wrap = getWrap();

      var toast = document.createElement('div');
      toast.className = 'toast-v2 ' + parsed.type;
      toast.innerHTML =
        '<div class="ic">' + iconFor(parsed.type) + '</div>' +
        '<div class="ct"><div class="tt"></div><div class="tx"></div></div>' +
        '<button class="x" aria-label="Đóng">x</button>';

      toast.querySelector('.tt').textContent = parsed.title || 'Thông báo';
      toast.querySelector('.tx').textContent = parsed.message || '';
      if (!parsed.message) toast.querySelector('.tx').style.display = 'none';

      var closed = false;
      function closeNow() {
        if (closed) return;
        closed = true;
        toast.classList.add('hide');
        setTimeout(function () { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); }, 180);
      }

      toast.querySelector('.x').addEventListener('click', closeNow);
      wrap.appendChild(toast);
      setTimeout(closeNow, parsed.duration);
    }

    window.showNotification = show;

    try {
      if (window._notifyQueue && Array.isArray(window._notifyQueue) && window._notifyQueue.length) {
        window._notifyQueue.forEach(function (args) {
          try { show.apply(null, args); } catch (e) {}
        });
        window._notifyQueue = [];
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installModernNotifier);
  } else {
    installModernNotifier();
  }

  function installConfirmDialog() {
    if (window.__modernConfirmInstalled) return;
    window.__modernConfirmInstalled = true;

    if (!document.getElementById('global-confirm-style-v1')) {
      var style = document.createElement('style');
      style.id = 'global-confirm-style-v1';
      style.textContent = [
        '.confirm-v1-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(2px);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;}',
        '.confirm-v1-card{width:min(92vw,520px);background:#fff;border-radius:16px;box-shadow:0 24px 50px rgba(0,0,0,.28);overflow:hidden;animation:confirmIn .18s ease forwards;}',
        '.confirm-v1-head{padding:14px 16px;background:#fff7f1;border-bottom:1px solid #ffe4d1;font-weight:800;color:#d55b22;font-size:18px;}',
        '.confirm-v1-body{padding:18px 16px;color:#1f2937;font-size:18px;line-height:1.45;}',
        '.confirm-v1-actions{display:flex;justify-content:flex-end;gap:10px;padding:0 16px 16px;}',
        '.confirm-v1-btn{border:none;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:15px;}',
        '.confirm-v1-btn.cancel{background:#eef2f7;color:#334155;}',
        '.confirm-v1-btn.ok{background:#0b69a3;color:#fff;}',
        '.confirm-v1-btn:hover{filter:brightness(.97);}',
        '@keyframes confirmIn{from{transform:translateY(8px) scale(.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}'
      ].join('');
      document.head.appendChild(style);
    }

    window.showConfirm = function (message, title) {
      return new Promise(function (resolve) {
        var old = document.getElementById('confirm-v1-backdrop');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        var backdrop = document.createElement('div');
        backdrop.id = 'confirm-v1-backdrop';
        backdrop.className = 'confirm-v1-backdrop';
        backdrop.innerHTML =
          '<div class="confirm-v1-card" role="dialog" aria-modal="true">' +
            '<div class="confirm-v1-head"></div>' +
            '<div class="confirm-v1-body"></div>' +
            '<div class="confirm-v1-actions">' +
              '<button class="confirm-v1-btn cancel" type="button">Không</button>' +
              '<button class="confirm-v1-btn ok" type="button">Có</button>' +
            '</div>' +
          '</div>';

        var head = backdrop.querySelector('.confirm-v1-head');
        var body = backdrop.querySelector('.confirm-v1-body');
        var okBtn = backdrop.querySelector('.confirm-v1-btn.ok');
        var cancelBtn = backdrop.querySelector('.confirm-v1-btn.cancel');

        head.textContent = title || 'Xác nhận';
        body.textContent = message || 'Bạn có chắc chắn không?';

        var done = false;
        function close(result) {
          if (done) return;
          done = true;
          if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          resolve(!!result);
        }

        okBtn.addEventListener('click', function () { close(true); });
        cancelBtn.addEventListener('click', function () { close(false); });
        backdrop.addEventListener('click', function (e) {
          if (e.target === backdrop) close(false);
        });
        document.addEventListener('keydown', function onKey(e) {
          if (!document.getElementById('confirm-v1-backdrop')) {
            document.removeEventListener('keydown', onKey);
            return;
          }
          if (e.key === 'Escape') {
            document.removeEventListener('keydown', onKey);
            close(false);
          }
        });

        document.body.appendChild(backdrop);
        setTimeout(function () { try { okBtn.focus(); } catch (e) {} }, 0);
      });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installConfirmDialog);
  } else {
    installConfirmDialog();
  }
})();
