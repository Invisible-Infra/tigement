(function() {
  const BLANK_RELOAD_KEY = 'tigement_blank_reload';
  const OFFLINE_RELOAD_KEY = 'tigement_offline_reload_attempted';
  const OFFLINE_MSG = 'You\'re offline. Pull down to refresh when back online.';
  var hiddenAt;

  function hasRealContent(root) {
    if (!root || !root.firstChild) return false;
    return !root.querySelector('[data-tigement-offline-msg]');
  }

  function showOfflineMessage(root) {
    if (root.querySelector('[data-tigement-offline-msg]')) return;
    var div = document.createElement('div');
    div.setAttribute('data-tigement-offline-msg', '1');
    div.style.cssText = 'padding:24px;text-align:center;font-family:system-ui,sans-serif;font-size:16px;color:#374151;';
    div.textContent = OFFLINE_MSG;
    root.appendChild(div);
  }

  function handleBlankRoot() {
    var root = document.getElementById('root');
    if (!root) return;
    if (hasRealContent(root)) return; // Real content, nothing to do
    if (hiddenAt && (Date.now() - hiddenAt) < 3000) return; // Was hidden < 3s, skip
    if (navigator.onLine) {
      if (sessionStorage.getItem(BLANK_RELOAD_KEY)) return;
      sessionStorage.setItem(BLANK_RELOAD_KEY, '1');
      window.location.reload();
    } else {
      if (!sessionStorage.getItem(OFFLINE_RELOAD_KEY)) {
        sessionStorage.setItem(OFFLINE_RELOAD_KEY, '1');
        window.location.reload();
      } else {
        showOfflineMessage(root);
      }
    }
  }

  window.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    if (document.visibilityState === 'visible') {
      setTimeout(handleBlankRoot, 500);
    }
  });

  window.addEventListener('focus', function() {
    setTimeout(handleBlankRoot, 500);
  });

  window.addEventListener('pageshow', function(e) {
    if (e.persisted) setTimeout(handleBlankRoot, 500);
  });

  window.addEventListener('online', function() {
    setTimeout(handleBlankRoot, 500);
  });

  setInterval(function() {
    if (document.visibilityState !== 'visible') return;
    var root = document.getElementById('root');
    if (!root || root.firstChild) return;
    if (root.querySelector('[data-tigement-offline-msg]')) return;
    setTimeout(handleBlankRoot, 0);
  }, 2000);

  window.__tigementClearBlankReloadFlag = function() {
    sessionStorage.removeItem(BLANK_RELOAD_KEY);
    sessionStorage.removeItem(OFFLINE_RELOAD_KEY);
  };

  if (document.visibilityState === 'visible' && !navigator.onLine) {
    setTimeout(handleBlankRoot, 3500);
  }
})();
