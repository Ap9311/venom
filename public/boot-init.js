(function () {
  'use strict';
  try {
    var path = window.location.pathname || '/';
    var host = (window.location.hostname || '').toLowerCase();
    var isAdmin = path.indexOf('/admin') === 0 || host.indexOf('admin.') === 0;
    var isAdminReport =
      path.indexOf('/admin/report') === 0 || path.indexOf('/community-reports') !== -1;

    var manifestUrl = isAdmin || isAdminReport ? '/api/admin-manifest' : '/manifest.json';
    var iconUrl = isAdmin ? '/nonum-admin-logo.svg' : '/nonum-logo.svg';

    var manifestEl = document.getElementById('pwa-manifest-link');
    if (manifestEl) manifestEl.setAttribute('href', manifestUrl);

    var fav32 = document.getElementById('favicon-link-32');
    var fav16 = document.getElementById('favicon-link-16');
    var appleIcon = document.getElementById('apple-icon-link');
    if (fav32) fav32.setAttribute('href', iconUrl);
    if (fav16) fav16.setAttribute('href', iconUrl);
    if (appleIcon) appleIcon.setAttribute('href', iconUrl);

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      window.pwaInstallPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
    });
  } catch (_e) {
    // ignore boot init errors
  }
})();
