const Auth = {
  save(token, user) {
    localStorage.setItem('sr_token', token);
    const u = { ...user, id: String(user.id || user._id) };
    localStorage.setItem('sr_user', JSON.stringify(u));
  },
  token:  () => localStorage.getItem('sr_token'),
  user:   () => JSON.parse(localStorage.getItem('sr_user') || 'null'),
  userId: () => {
    const u = JSON.parse(localStorage.getItem('sr_user') || 'null');
    return u ? String(u.id || u._id) : null;
  },
  logout() {
    localStorage.removeItem('sr_token');
    localStorage.removeItem('sr_user');
    location.href = '/index.html';
  },
  require() {
    if (!this.token()) { location.href = '/login.html'; return false; }
    return true;
  },
};

function toast(msg, type, ms) {
  type = type || 'info'; ms = ms || 3500;
  let wrap = document.getElementById('toast-container');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-container';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(function() {
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '0';
    setTimeout(function() { el.remove(); }, 300);
  }, ms);
}

function fmtPrice(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtPct(n, forceSign) {
  if (n == null || isNaN(n)) return '—';
  forceSign = forceSign !== false;
  return (forceSign && n > 0 ? '+' : '') + Number(n).toFixed(2) + '%';
}
function timeAgo(iso) {
  if (!iso) return '';
  var d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60)    return d + 's ago';
  if (d < 3600)  return Math.floor(d/60) + 'm ago';
  if (d < 86400) return Math.floor(d/3600) + 'h ago';
  return Math.floor(d/86400) + 'd ago';
}
function initials(name) {
  return (name||'?').split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
}

window.Auth     = Auth;
window.toast    = toast;
window.fmtPrice = fmtPrice;
window.fmtPct   = fmtPct;
window.timeAgo  = timeAgo;
window.initials = initials;
