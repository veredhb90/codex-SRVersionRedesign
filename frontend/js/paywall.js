// ── SwingRush Paywall & Subscription System ───────────────────────
const Paywall = {

  // Show register prompt for non-logged-in users
  showRegisterPrompt() {
    const modal = document.createElement('div');
    modal.id = 'sr-paywall-modal';
    modal.innerHTML = `
    <div style="position:fixed;inset:0;z-index:10000;background:rgba(8,15,36,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:#fff;border-radius:24px;padding:40px;max-width:460px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,0.3);text-align:center;animation:pwIn .35s cubic-bezier(.34,1.56,.64,1);">
        <style>@keyframes pwIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>
        <div style="font-size:56px;margin-bottom:16px;">⚡</div>
        <h2 style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;color:#0D47A1;margin-bottom:8px;letter-spacing:-0.5px;">
          Free Signal Engine
        </h2>
        <p style="color:#64748b;font-size:15px;margin-bottom:24px;line-height:1.6;">
          Create a free account to analyze your first stock with our AI-powered engine — RSI, MACD, Bollinger Bands, news sentiment and more.
        </p>
        <div style="background:#F0F4FF;border-radius:16px;padding:16px;margin-bottom:24px;text-align:left;">
          <div style="font-size:13px;color:#0D47A1;font-weight:700;margin-bottom:10px;">✅ FREE account includes:</div>
          <div style="font-size:13px;color:#475569;line-height:2;">
            📊 1 free stock analysis<br>
            💬 2 AI chat messages<br>
            📰 Latest news & analyst ratings<br>
            🏆 View Top 5 Scanner results
          </div>
        </div>
        <a href="/index.html#register" onclick="document.getElementById('sr-paywall-modal').remove();document.getElementById('sr-chat-box').style.display='none'"
          style="display:block;padding:16px;background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;border-radius:14px;font-weight:700;font-size:16px;text-decoration:none;margin-bottom:12px;box-shadow:0 6px 20px rgba(13,71,161,0.4);transition:transform .2s;"
          onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          🚀 Create Free Account
        </a>
        <a href="/login.html" onclick="document.getElementById('sr-paywall-modal').remove()"
          style="display:block;padding:13px;background:#F0F4FF;color:#0D47A1;border-radius:14px;font-weight:600;font-size:14px;text-decoration:none;">
          Already have an account? Log in
        </a>
        <button onclick="document.getElementById('sr-paywall-modal').remove()"
          style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;margin-top:12px;">
          Maybe later
        </button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal.firstChild.parentElement || e.target === modal) modal.remove(); });
  },

  // Show subscription paywall
  showSubscribePaywall(type = 'engine') {
    const isEngine = type === 'engine';
    const modal = document.createElement('div');
    modal.id = 'sr-paywall-modal';
    modal.innerHTML = `
    <div style="position:fixed;inset:0;z-index:10000;background:rgba(8,15,36,0.8);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:#fff;border-radius:24px;padding:40px;max-width:500px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,0.35);text-align:center;animation:pwIn .35s cubic-bezier(.34,1.56,.64,1);">
        <style>@keyframes pwIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}</style>

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0D47A1,#1565C0,#1976D2);border-radius:16px;padding:24px;margin-bottom:24px;color:#fff;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.07);"></div>
          <div style="font-size:40px;margin-bottom:8px;">${isEngine ? '⚡' : '🤖'}</div>
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">
            ${isEngine ? 'You\'ve used your free analysis!' : 'You\'ve used your free AI chats!'}
          </div>
          <div style="font-size:13px;opacity:0.85;margin-top:6px;">
            ${isEngine ? 'Upgrade to analyze unlimited stocks' : 'Upgrade for unlimited AI trading assistant'}
          </div>
        </div>

        <!-- Price -->
        <div style="margin-bottom:24px;">
          <div style="font-size:14px;color:#64748b;margin-bottom:4px;">SwingRush Pro</div>
          <div style="display:flex;align-items:baseline;justify-content:center;gap:4px;">
            <span style="font-size:48px;font-weight:900;color:#0D47A1;letter-spacing:-2px;">$75</span>
            <span style="font-size:18px;color:#64748b;font-weight:500;">/month</span>
          </div>
          <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Cancel anytime</div>
        </div>

        <!-- Features -->
        <div style="background:#F8FAFF;border-radius:16px;padding:20px;margin-bottom:24px;text-align:left;">
          <div style="font-size:13px;font-weight:700;color:#0D47A1;margin-bottom:12px;">🏆 PRO includes everything:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;color:#475569;">
            <div>✅ Unlimited engine analyses</div>
            <div>✅ Unlimited AI chat</div>
            <div>✅ Full scanner results</div>
            <div>✅ WIN/LOSS notifications</div>
            <div>✅ Follow traders & stocks</div>
            <div>✅ Post recommendations</div>
            <div>✅ News + analyst ratings</div>
            <div>✅ Priority support</div>
          </div>
        </div>

        <!-- CTA -->
        <button onclick="Paywall.startSubscription()"
          style="display:block;width:100%;padding:18px;background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;border:none;border-radius:14px;font-weight:800;font-size:17px;cursor:pointer;box-shadow:0 8px 24px rgba(13,71,161,0.4);margin-bottom:12px;transition:transform .2s;"
          onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          🚀 Start Pro — $75/month
        </button>
        <button onclick="document.getElementById('sr-paywall-modal').remove()"
          style="display:block;width:100%;padding:13px;background:#F0F4FF;color:#0D47A1;border:none;border-radius:14px;font-weight:600;font-size:14px;cursor:pointer;">
          Maybe later
        </button>
        <div style="font-size:11px;color:#94a3b8;margin-top:12px;">
          🔒 Secure payment · Cancel anytime · No hidden fees
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
  },

  startSubscription() {
    // Will integrate Stripe here later
    // For now show coming soon
    document.getElementById('sr-paywall-modal').remove();
    const toast_el = document.createElement('div');
    toast_el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#0D47A1;color:#fff;padding:16px 28px;border-radius:14px;font-weight:600;font-size:14px;z-index:10001;box-shadow:0 8px 24px rgba(13,71,161,0.4);';
    toast_el.textContent = '💳 Payment coming soon! Contact us at swingrush.admin@gmail.com to subscribe.';
    document.body.appendChild(toast_el);
    setTimeout(() => toast_el.remove(), 5000);
  },

  // Check if user can use engine (called from engine.js)
  async checkEngineAccess() {
    if (!Auth.token()) {
      this.showRegisterPrompt();
      return false;
    }
    return true;
  },
};

window.Paywall = Paywall;
