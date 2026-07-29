// SwingRush account and Pro access prompts.
const Paywall = {
  text(key, fallback) {
    return window.SRLang ? SRLang.t(key, fallback) : fallback;
  },

  remove() {
    document.getElementById('sr-paywall-modal')?.remove();
  },

  mount(kind) {
    this.remove();
    const modal = document.createElement('div');
    modal.id = 'sr-paywall-modal';
    modal.className = 'sr-paywall';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'sr-paywall-title');
    modal.dataset.kind = kind;
    document.body.appendChild(modal);

    const close = () => this.remove();
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });
    requestAnimationFrame(() => modal.querySelector('.sr-paywall-panel')?.focus());
    return modal;
  },

  showRegisterPrompt() {
    const t = this.text.bind(this);
    const modal = this.mount('register');
    modal.innerHTML = `
      <section class="sr-paywall-panel sr-register-panel" tabindex="-1">
        <button type="button" class="sr-paywall-close" aria-label="${t('paywall.close', 'Close')}" data-paywall-close>×</button>
        <div class="sr-paywall-eyebrow"><span class="sr-paywall-pulse"></span>${t('paywall.free_access', 'FREE ACCESS')}</div>
        <div class="sr-paywall-mark" aria-hidden="true"><span>SR</span><i></i></div>
        <h2 id="sr-paywall-title">${t('paywall.register_title', 'Build your trading workspace.')}</h2>
        <p class="sr-paywall-copy">${t('paywall.register_copy', 'Create a free account to save calls, follow the market, and keep every decision in one clear workspace.')}</p>
        <div class="sr-paywall-feature-list" role="list">
          <div role="listitem"><b>01</b><span>${t('paywall.free_engine', 'One Signal Engine analysis to evaluate a setup')}</span></div>
          <div role="listitem"><b>02</b><span>${t('paywall.free_scanner', 'Latest ranked market scan and real-time market feed')}</span></div>
          <div role="listitem"><b>03</b><span>${t('paywall.free_profile', 'Call history, performance tracking, and trader network')}</span></div>
        </div>
        <div class="sr-paywall-actions">
          <a class="sr-paywall-main" href="/index.html#register" data-paywall-link>${t('paywall.create', 'Create free account')}</a>
          <a class="sr-paywall-secondary" href="/login.html" data-paywall-link>${t('paywall.login', 'Log in to your account')}</a>
        </div>
        <button type="button" class="sr-paywall-dismiss" data-paywall-close>${t('paywall.later', 'Continue exploring')}</button>
      </section>`;
    this.bind(modal);
  },

  showSubscribePaywall(type = 'engine') {
    const t = this.text.bind(this);
    const isEngine = type === 'engine';
    const title = isEngine
      ? t('paywall.engine_title', 'Keep the AI analyst working.')
      : t('paywall.chat_title', 'Keep the AI desk open.')
    const copy = isEngine
      ? t('paywall.engine_copy', 'Your free analysis has been used. Pro keeps the research workflow moving without a usage ceiling.')
      : t('paywall.chat_copy', 'Your free AI messages are complete. Pro gives your trading desk an always-on market partner.')
    const modal = this.mount('pro');
    modal.innerHTML = `
      <section class="sr-paywall-panel sr-pro-panel" tabindex="-1">
        <button type="button" class="sr-paywall-close" aria-label="${t('paywall.close', 'Close')}" data-paywall-close>×</button>
        <div class="sr-paywall-pro-rail"><span>${t('paywall.pro_access', 'PRO INTELLIGENCE')}</span><span>${t('paywall.always_on', '24 / 7')}</span></div>
        <div class="sr-paywall-eyebrow"><span class="sr-paywall-pulse"></span>${t('paywall.pro_plan', 'SWINGRUSH PRO')}</div>
        <h2 id="sr-paywall-title">${title}</h2>
        <p class="sr-paywall-copy">${copy}</p>
        <div class="sr-paywall-price"><strong>$75</strong><span>${t('paywall.month', '/ month')}</span><small>${t('paywall.cancel', 'Cancel anytime')}</small></div>
        <div class="sr-pro-grid" role="list">
          <div role="listitem"><span>AI</span><p>${t('paywall.pro_ai', 'Unlimited Signal Engine and AI chat')}</p></div>
          <div role="listitem"><span>SC</span><p>${t('paywall.pro_scanner', 'Full ranked scanner with live research context')}</p></div>
          <div role="listitem"><span>NW</span><p>${t('paywall.pro_network', 'Follow traders, instruments, and live call outcomes')}</p></div>
          <div role="listitem"><span>RK</span><p>${t('paywall.pro_risk', 'Entry, target, and risk workflow in one place')}</p></div>
        </div>
        <button type="button" class="sr-paywall-main sr-paywall-button" data-paywall-subscribe>${t('paywall.start_pro', 'Request Pro access')}</button>
        <button type="button" class="sr-paywall-dismiss" data-paywall-close>${t('paywall.later', 'Continue exploring')}</button>
        <p class="sr-paywall-footnote">${t('paywall.contact_note', 'Secure billing setup is handled with the SwingRush team.')}</p>
      </section>`;
    this.bind(modal);
  },

  bind(modal) {
    modal.querySelectorAll('[data-paywall-close]').forEach(button => {
      button.addEventListener('click', () => this.remove());
    });
    modal.querySelectorAll('[data-paywall-link]').forEach(link => {
      link.addEventListener('click', () => this.remove());
    });
    modal.querySelector('[data-paywall-subscribe]')?.addEventListener('click', () => this.startSubscription());
  },

  startSubscription() {
    this.remove();
    const toastEl = document.createElement('div');
    toastEl.className = 'sr-pro-contact-toast';
    toastEl.textContent = this.text('paywall.contact', 'Pro access: contact swingrush.admin@gmail.com.');
    document.body.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 5500);
  },

  async checkEngineAccess() {
    if (!Auth.token()) {
      this.showRegisterPrompt();
      return false;
    }
    return true;
  },
};

window.Paywall = Paywall;
