// ── SwingRush "Take a Tour" — first-time feature walkthrough ─────────
// Shows once, right after a new user's first visit to the feed (after the
// mandatory Terms gate and the Trader Profile onboarding have both been
// resolved), spans feed.html -> profile.html, and is skippable at any step.
const SiteTour = {

  STEPS: [
    { id: 'welcome', page: 'feed', target: null,
      icon: '👋', titleKey: 'tour.welcome_title', titleFallback: 'Welcome to SwingRush!',
      bodyKey: 'tour.welcome_body', bodyFallback: 'Want a 60-second tour of how everything works? You can skip anytime.' },
    { id: 'feed-card', page: 'feed', target: '.rec-card',
      icon: '📊', titleKey: 'tour.feed_card_title', titleFallback: 'The Feed',
      bodyKey: 'tour.feed_card_body', bodyFallback: 'Every trade real traders share — entry, take-profit, stop-loss and live P&L, updated in real time.' },
    { id: 'feed-actions', page: 'feed', target: '.rec-card .rec-footer',
      icon: '❤️', titleKey: 'tour.feed_actions_title', titleFallback: 'Engage & Share',
      bodyKey: 'tour.feed_actions_body', bodyFallback: 'Like, comment, share, or repost any trade to your own followers.' },
    { id: 'feed-scanner', page: 'feed', target: '#sidebar-scanner-card',
      icon: '🔍', titleKey: 'tour.scanner_title', titleFallback: 'Market Scanner',
      bodyKey: 'tour.scanner_body', bodyFallback: 'SwingRush continuously scans thousands of stocks for real BUY/SELL setups. Click "View Scanner" anytime to see live results.' },
    { id: 'feed-pro-engine', page: 'feed', target: '#sidebar-pro-engine-card',
      icon: '🧠', titleKey: 'tour.pro_engine_title', titleFallback: 'AI Pro Engine',
      bodyKey: 'tour.pro_engine_body', bodyFallback: 'Run a full AI analysis on any stock — technical signals combined with real news, catalysts and risks in one score.' },
    { id: 'go-profile', page: 'feed', target: 'a[href="/profile.html"]',
      icon: '👤', titleKey: 'tour.go_profile_title', titleFallback: 'Your Profile',
      bodyKey: 'tour.go_profile_body', bodyFallback: "Let's check out your profile next." },
    { id: 'profile-share', page: 'profile', target: '#share-call-btn',
      icon: '📤', titleKey: 'tour.share_title', titleFallback: 'Share a Trade',
      bodyKey: 'tour.share_body', bodyFallback: 'Post your own trade — entry, target, stop loss — straight to the feed for the community to see.' },
    { id: 'profile-follow', page: 'profile', target: '.follow-stats',
      icon: '🤝', titleKey: 'tour.follow_title', titleFallback: 'Followers & Following',
      bodyKey: 'tour.follow_body', bodyFallback: 'Follow other traders to see their trades in your feed. Grow your own following as people follow you back.' },
    { id: 'done', page: 'profile', target: null,
      icon: '🎉', titleKey: 'tour.done_title', titleFallback: "You're all set!",
      bodyKey: 'tour.done_body', bodyFallback: 'That\'s the tour — go find your first trade.' },
  ],

  t(key, fallback) { return window.SRLang ? SRLang.t(key, fallback) : fallback; },

  currentPageName() {
    return location.pathname.replace(/^.*\//, '').replace(/\.html$/, '') || 'feed';
  },

  userId() { return window.Auth && Auth.userId ? Auth.userId() : 'user'; },
  stateKey() { return 'sr_tour_state_' + this.userId(); },

  loadState() {
    try { return JSON.parse(localStorage.getItem(this.stateKey())) || null; } catch (e) { return null; }
  },
  saveState(state) {
    localStorage.setItem(this.stateKey(), JSON.stringify(state));
  },
  clearState() {
    localStorage.removeItem(this.stateKey());
  },

  isVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  },

  waitForTarget(selector, timeoutMs) {
    var self = this;
    return new Promise(function (resolve) {
      var elapsed = 0;
      var step = 150;
      var timer = setInterval(function () {
        var el = document.querySelector(selector);
        if (el && self.isVisible(el)) { clearInterval(timer); resolve(el); return; }
        elapsed += step;
        if (elapsed >= timeoutMs) { clearInterval(timer); resolve(null); }
      }, step);
    });
  },

  waitForBlockingModalsToClear() {
    var self = this;
    return new Promise(function (resolve) {
      var check = function () {
        if (document.getElementById('sr-terms-gate') || document.getElementById('sr-onboarding')) {
          setTimeout(check, 400);
        } else {
          resolve();
        }
      };
      setTimeout(check, 1800);
    });
  },

  // Called once on feed.html after login — decides whether a fresh tour should begin.
  async checkAndShow() {
    if (!window.Auth || !Auth.token()) return;
    if (this.loadState()) return; // an in-progress or already-started tour resumes via init()
    var doneKey = 'sr_tour_done_' + this.userId();
    if (localStorage.getItem(doneKey)) return;
    try {
      var me = await API.me();
      if (me.user && me.user.tourDone) {
        localStorage.setItem(doneKey, '1');
        return;
      }
    } catch (e) { return; }
    await this.waitForBlockingModalsToClear();
    if (this.loadState()) return; // guard against a race if init() already started it
    this.saveState({ stepIndex: 0, active: true });
    this.goToStep(0);
  },

  // Called on every tour-enabled page load — resumes an in-progress tour.
  async init() {
    if (!window.Auth || !Auth.token()) return;
    var state = this.loadState();
    if (!state || !state.active) return;
    var step = this.STEPS[state.stepIndex];
    if (!step || step.page !== this.currentPageName()) return;
    await this.waitForBlockingModalsToClear();
    state = this.loadState();
    if (!state || !state.active) return;
    this.renderStep(state.stepIndex);
  },

  async goToStep(index) {
    if (index >= this.STEPS.length) { this.finish(); return; }
    var step = this.STEPS[index];
    this.saveState({ stepIndex: index, active: true });
    if (step.page !== this.currentPageName()) {
      location.href = '/' + step.page + '.html';
      return;
    }
    this.renderStep(index);
  },

  async renderStep(index) {
    this.teardown();
    var step = this.STEPS[index];
    var target = null;
    if (step.target) {
      target = await this.waitForTarget(step.target, 6000);
      // Re-check we're still on the same step (user may have skipped while waiting)
      var state = this.loadState();
      if (!state || !state.active || state.stepIndex !== index) return;
      if (!target) { this.goToStep(index + 1); return; }
      target.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
      await new Promise(function (r) { setTimeout(r, 150); });
    }
    this.paint(step, index, target);
  },

  paint(step, index, target) {
    var self = this;
    installTourStyles();

    var block = document.createElement('div');
    block.id = 'sr-tour-block';
    block.className = target ? '' : 'sr-tour-dim';
    document.body.appendChild(block);

    var spot = null;
    if (target) {
      var rect = target.getBoundingClientRect();
      var pad = 8;
      spot = document.createElement('div');
      spot.id = 'sr-tour-spot';
      spot.style.top = (rect.top - pad) + 'px';
      spot.style.left = (rect.left - pad) + 'px';
      spot.style.width = (rect.width + pad * 2) + 'px';
      spot.style.height = (rect.height + pad * 2) + 'px';
      document.body.appendChild(spot);
    }

    var isFirst = index === 0;
    var isLast = index === this.STEPS.length - 1;
    var dots = this.STEPS.map(function (s, i) {
      return '<span class="sr-tour-dot' + (i === index ? ' active' : '') + '"></span>';
    }).join('');

    var tip = document.createElement('div');
    tip.id = 'sr-tour-tip';
    tip.innerHTML =
      '<div class="sr-tour-dots">' + dots + '</div>' +
      '<div class="sr-tour-icon">' + step.icon + '</div>' +
      '<div class="sr-tour-title">' + escapeHtml(this.t(step.titleKey, step.titleFallback)) + '</div>' +
      '<div class="sr-tour-body">' + escapeHtml(this.t(step.bodyKey, step.bodyFallback)) + '</div>' +
      '<div class="sr-tour-actions">' +
        '<button type="button" class="sr-tour-skip">' + escapeHtml(this.t('tour.skip', 'Skip tour')) + '</button>' +
        '<div class="sr-tour-nav">' +
          (isFirst ? '' : '<button type="button" class="sr-tour-back">' + escapeHtml(this.t('tour.back', '← Back')) + '</button>') +
          '<button type="button" class="sr-tour-next">' + escapeHtml(isLast ? this.t('tour.done', 'Done') : this.t('tour.next', 'Next →')) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(tip);
    this.positionTip(tip, target);

    tip.querySelector('.sr-tour-skip').addEventListener('click', function () { self.finish(); });
    tip.querySelector('.sr-tour-next').addEventListener('click', function () { self.goToStep(index + 1); });
    var backBtn = tip.querySelector('.sr-tour-back');
    if (backBtn) backBtn.addEventListener('click', function () { self.goToStep(index - 1); });

    this._reposition = function () {
      if (!target) return;
      var r = target.getBoundingClientRect();
      var pad = 8;
      if (spot) {
        spot.style.top = (r.top - pad) + 'px';
        spot.style.left = (r.left - pad) + 'px';
        spot.style.width = (r.width + pad * 2) + 'px';
        spot.style.height = (r.height + pad * 2) + 'px';
      }
      self.positionTip(tip, target);
    };
    window.addEventListener('resize', this._reposition);
    window.addEventListener('scroll', this._reposition, true);
  },

  positionTip(tip, target) {
    var margin = 14;
    var vw = window.innerWidth, vh = window.innerHeight;
    if (!target) {
      tip.style.top = '50%';
      tip.style.left = '50%';
      tip.style.transform = 'translate(-50%,-50%)';
      return;
    }
    var rect = target.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var tipW = tipRect.width || 320;
    var tipH = tipRect.height || 180;
    var top, left;
    if (rect.bottom + margin + tipH <= vh) {
      top = rect.bottom + margin;
    } else if (rect.top - margin - tipH >= 0) {
      top = rect.top - margin - tipH;
    } else {
      top = Math.max(margin, (vh - tipH) / 2);
    }
    left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(margin, Math.min(left, vw - tipW - margin));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.transform = 'none';
  },

  teardown() {
    if (this._reposition) {
      window.removeEventListener('resize', this._reposition);
      window.removeEventListener('scroll', this._reposition, true);
      this._reposition = null;
    }
    ['sr-tour-block', 'sr-tour-spot', 'sr-tour-tip'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
  },

  async finish() {
    this.teardown();
    this.clearState();
    localStorage.setItem('sr_tour_done_' + this.userId(), '1');
    try { await API.tourDone(); } catch (e) {}
  },
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function installTourStyles() {
  if (document.getElementById('sr-tour-styles')) return;
  var style = document.createElement('style');
  style.id = 'sr-tour-styles';
  style.textContent =
    '#sr-tour-block{position:fixed;inset:0;z-index:20040;background:transparent;}' +
    '#sr-tour-block.sr-tour-dim{background:rgba(6,12,28,.72);}' +
    '#sr-tour-spot{position:fixed;z-index:20041;pointer-events:none;border-radius:12px;border:2px solid var(--accent,#36c5f0);box-shadow:0 0 0 9999px rgba(6,12,28,.72),0 0 20px rgba(54,197,240,.35);transition:top .25s ease,left .25s ease,width .25s ease,height .25s ease;}' +
    '#sr-tour-tip{position:fixed;z-index:20042;width:320px;max-width:calc(100vw - 28px);background:var(--bg2,#0d1218);border:1px solid var(--border,rgba(230,237,243,.14));border-radius:16px;padding:16px 18px 18px;box-shadow:0 20px 60px rgba(0,0,0,.4);color:var(--text,#eef3f8);}' +
    '.sr-tour-dots{display:flex;gap:5px;margin-bottom:10px;}' +
    '.sr-tour-dot{width:6px;height:6px;border-radius:50%;background:var(--surface2,#1a232e);}' +
    '.sr-tour-dot.active{background:var(--accent,#36c5f0);}' +
    '.sr-tour-icon{font-size:26px;margin-bottom:4px;}' +
    '.sr-tour-title{font-size:16px;font-weight:800;margin-bottom:6px;color:var(--text,#eef3f8);}' +
    '.sr-tour-body{font-size:13px;line-height:1.55;color:var(--muted,#8997a7);margin-bottom:16px;}' +
    '.sr-tour-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;}' +
    '.sr-tour-skip{background:none;border:none;color:var(--muted,#8997a7);font-size:12px;cursor:pointer;padding:6px 0;}' +
    '.sr-tour-nav{display:flex;gap:8px;}' +
    '.sr-tour-back{background:var(--surface2,#1a232e);color:var(--text,#eef3f8);border:none;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;}' +
    '.sr-tour-next{background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;}';
  document.head.appendChild(style);
}

window.SiteTour = SiteTour;
