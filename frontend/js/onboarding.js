// ── SwingRush Onboarding Questionnaire ────────────────────────────
const Onboarding = {

  show() {
    if (document.getElementById('sr-onboarding')) return;

    const modal = document.createElement('div');
    modal.id = 'sr-onboarding';
    modal.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(8,15,36,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    modal.innerHTML = `
      <div class="sr-ob-card" style="background:#fff;border-radius:24px;padding:0;max-width:520px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,0.3);overflow:hidden;animation:obIn .4s cubic-bezier(.34,1.56,.64,1);margin:auto;">
        <style>
          @keyframes obIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
          @media(max-width:480px){
            .sr-ob-card{border-radius:16px;max-width:100%;}
            .sr-ob-header{padding:20px 18px !important;}
            .sr-ob-header div:first-child{font-size:32px !important;margin-bottom:4px !important;}
            .sr-ob-header h2{font-size:18px !important;}
            .sr-ob-header p{font-size:12px !important;}
            #ob-form{padding:18px !important;}
            .sr-ob-amt-grid{grid-template-columns:1fr 1fr !important;gap:6px !important;}
            .sr-ob-3col{grid-template-columns:1fr 1fr 1fr !important;gap:6px !important;}
            .sr-ob-3col button{padding:8px 4px !important;}
            .sr-ob-style-grid button{padding:10px 12px !important;}
          }
        </style>
        
        <!-- Header -->
        <div class="sr-ob-header" style="background:linear-gradient(135deg,#0D47A1,#1565C0,#1976D2);padding:28px 32px;color:#fff;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">🎯</div>
          <h2 style="font-size:22px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px;">Your Trader Profile</h2>
          <p style="font-size:13px;opacity:0.9;margin:0;line-height:1.6;">At SwingRush, we care deeply about every investor's goals.<br>Our AI personalizes every signal and recommendation based on YOUR profile.<br><strong>Please fill this in carefully and accurately — it matters!</strong></p>
          <div style="margin-top:12px;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 14px;font-size:12px;opacity:0.9;">
            ⚠️ Tip: Don't update this frequently — your profile shapes all AI advice. Make it accurate from the start.
          </div>
        </div>

        <!-- Form -->
        <div style="padding:28px 32px;" id="ob-form">
          <div id="ob-err" style="display:none;background:#FFEBEE;color:#C62828;font-size:13px;font-weight:600;padding:10px 14px;border-radius:10px;margin-bottom:12px;"></div>
          
          <!-- Step indicator -->
          <div style="display:flex;gap:6px;margin-bottom:24px;justify-content:center;">
            <div id="ob-step-1" style="width:32px;height:4px;border-radius:2px;background:#0D47A1;"></div>
            <div id="ob-step-2" style="width:32px;height:4px;border-radius:2px;background:#E3EEFF;"></div>
            <div id="ob-step-3" style="width:32px;height:4px;border-radius:2px;background:#E3EEFF;"></div>
          </div>

          <!-- Step 1 -->
          <div id="ob-page-1">
            <div style="margin-bottom:18px;">
              <label style="font-size:13px;font-weight:700;color:#1a1a2e;display:block;margin-bottom:8px;">How old are you?</label>
              <input id="ob-age" type="number" min="18" max="100" placeholder="e.g. 35"
                style="width:100%;padding:12px 16px;border:1.5px solid #E3EEFF;border-radius:12px;font-size:14px;outline:none;transition:border .2s;"
                onfocus="this.style.borderColor='#1565C0'" onblur="this.style.borderColor='#E3EEFF'"/>
            </div>
            <div style="margin-bottom:18px;">
              <label style="font-size:13px;font-weight:700;color:#1a1a2e;display:block;margin-bottom:8px;">How much are you planning to invest? (USD)</label>
              <div class="sr-ob-amt-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${['Under $1,000','$1,000–$5,000','$5,000–$20,000','$20,000–$50,000','$50,000–$100,000','$100,000+'].map(a =>
                  `<button class="ob-option" data-group="amount" data-val="${a}" onclick="Onboarding.select(this)"
                    style="padding:10px;border-radius:10px;border:1.5px solid #E3EEFF;background:#F8FAFF;font-size:12px;font-weight:600;color:#475569;cursor:pointer;transition:all .2s;">
                    ${a}
                  </button>`
                ).join('')}
              </div>
            </div>
            <button onclick="Onboarding.nextStep(2)" style="width:100%;padding:14px;background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;border:none;border-radius:14px;font-weight:700;font-size:15px;cursor:pointer;margin-top:4px;">
              Continue →
            </button>
          </div>

          <!-- Step 2 -->
          <div id="ob-page-2" style="display:none;">
            <div style="margin-bottom:18px;">
              <label style="font-size:13px;font-weight:700;color:#1a1a2e;display:block;margin-bottom:8px;">What type of trader are you?</label>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${[
                  {val:'day', label:'⚡ Day Trader', desc:'Open and close trades within the same day'},
                  {val:'swing', label:'📊 Swing Trader', desc:'Hold trades for days to a few weeks'},
                  {val:'longterm', label:'📈 Long-Term Investor', desc:'Hold for months or years'},
                ].map(o =>
                  `<button class="ob-option" data-group="style" data-val="${o.val}" onclick="Onboarding.select(this)"
                    style="padding:12px 16px;border-radius:12px;border:1.5px solid #E3EEFF;background:#F8FAFF;text-align:left;cursor:pointer;transition:all .2s;">
                    <div style="font-size:14px;font-weight:700;color:#1a1a2e;">${o.label}</div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${o.desc}</div>
                  </button>`
                ).join('')}
              </div>
            </div>
            <div style="margin-bottom:18px;">
              <label style="font-size:13px;font-weight:700;color:#1a1a2e;display:block;margin-bottom:8px;">Your experience level?</label>
              <div class="sr-ob-3col" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                ${[
                  {val:'beginner', label:'🌱 Beginner'},
                  {val:'intermediate', label:'📊 Intermediate'},
                  {val:'advanced', label:'🚀 Advanced'},
                ].map(o =>
                  `<button class="ob-option" data-group="experience" data-val="${o.val}" onclick="Onboarding.select(this)"
                    style="padding:10px;border-radius:10px;border:1.5px solid #E3EEFF;background:#F8FAFF;font-size:12px;font-weight:600;color:#475569;cursor:pointer;transition:all .2s;text-align:center;">
                    ${o.label}
                  </button>`
                ).join('')}
              </div>
            </div>
            <div style="display:flex;gap:10px;">
              <button onclick="Onboarding.nextStep(1)" style="flex:1;padding:14px;background:#F0F4FF;color:#0D47A1;border:none;border-radius:14px;font-weight:600;font-size:14px;cursor:pointer;">← Back</button>
              <button onclick="Onboarding.nextStep(3)" style="flex:2;padding:14px;background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;border:none;border-radius:14px;font-weight:700;font-size:15px;cursor:pointer;">Continue →</button>
            </div>
          </div>

          <!-- Step 3 -->
          <div id="ob-page-3" style="display:none;">
            <div style="margin-bottom:18px;">
              <label style="font-size:13px;font-weight:700;color:#1a1a2e;display:block;margin-bottom:8px;">Risk tolerance?</label>
              <div class="sr-ob-3col" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                ${[
                  {val:'low', label:'🛡️ Low', desc:'Safety first'},
                  {val:'medium', label:'⚖️ Medium', desc:'Balanced'},
                  {val:'high', label:'🔥 High', desc:'Aggressive'},
                ].map(o =>
                  `<button class="ob-option" data-group="risk" data-val="${o.val}" onclick="Onboarding.select(this)"
                    style="padding:12px;border-radius:12px;border:1.5px solid #E3EEFF;background:#F8FAFF;cursor:pointer;transition:all .2s;text-align:center;">
                    <div style="font-size:16px;">${o.label.split(' ')[0]}</div>
                    <div style="font-size:12px;font-weight:700;color:#1a1a2e;">${o.label.split(' ').slice(1).join(' ')}</div>
                    <div style="font-size:10px;color:#94a3b8;">${o.desc}</div>
                  </button>`
                ).join('')}
              </div>
            </div>
            <div style="margin-bottom:20px;">
              <label style="font-size:13px;font-weight:700;color:#1a1a2e;display:block;margin-bottom:8px;">What are your trading goals? (optional)</label>
              <textarea id="ob-goals" placeholder="e.g. Save for retirement, generate passive income, grow my portfolio by 20% this year..."
                style="width:100%;padding:12px 16px;border:1.5px solid #E3EEFF;border-radius:12px;font-size:13px;outline:none;resize:none;height:80px;font-family:inherit;transition:border .2s;"
                onfocus="this.style.borderColor='#1565C0'" onblur="this.style.borderColor='#E3EEFF'"></textarea>
            </div>
            <div style="display:flex;gap:10px;">
              <button onclick="Onboarding.nextStep(2)" style="flex:1;padding:14px;background:#F0F4FF;color:#0D47A1;border:none;border-radius:14px;font-weight:600;font-size:14px;cursor:pointer;">← Back</button>
              <button onclick="Onboarding.save()" id="ob-save-btn" style="flex:2;padding:14px;background:linear-gradient(135deg,#00C853,#00897B);color:#fff;border:none;border-radius:14px;font-weight:700;font-size:15px;cursor:pointer;">
                🚀 Start Trading!
              </button>
            </div>
          </div>

          <!-- Skip -->
          <div style="text-align:center;margin-top:14px;">
            <button onclick="Onboarding.skip()" style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;">Skip for now</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);
  },

  selections: {},

  select(btn) {
    var group = btn.dataset.group;
    var val   = btn.dataset.val;
    this.selections[group] = val;
    // Update UI
    document.querySelectorAll('.ob-option[data-group="' + group + '"]').forEach(function(b) {
      b.style.borderColor = '#E3EEFF';
      b.style.background  = '#F8FAFF';
      b.style.color       = '#475569';
    });
    btn.style.borderColor = '#1565C0';
    btn.style.background  = '#EEF4FF';
    btn.style.color       = '#0D47A1';
  },

  showErr(msg) {
    var el = document.getElementById('ob-err');
    if (!el) { alert(msg); return; }
    el.textContent = '⚠️ ' + msg;
    el.style.display = 'block';
    el.scrollIntoView({ block: 'nearest' });
    setTimeout(function() { el.style.display = 'none'; }, 3500);
  },

  currentPage() {
    if (document.getElementById('ob-page-3').style.display === 'block') return 3;
    if (document.getElementById('ob-page-2').style.display === 'block') return 2;
    return 1;
  },

  validatePage(p) {
    if (p === 1) {
      var age = parseInt(document.getElementById('ob-age').value);
      if (!age || age < 13 || age > 100) return 'Please enter your age (13-100)';
      if (!this.selections.amount) return 'Please select your investment amount';
    }
    if (p === 2) {
      if (!this.selections.style) return 'Please select your trading style';
      if (!this.selections.experience) return 'Please select your experience level';
    }
    if (p === 3) {
      if (!this.selections.risk) return 'Please select your risk tolerance';
    }
    return null;
  },

  nextStep(step) {
    var cur = this.currentPage();
    if (step > cur) {
      var err = this.validatePage(cur);
      if (err) { this.showErr(err); return; }
    }
    document.getElementById('ob-page-1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('ob-page-2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('ob-page-3').style.display = step === 3 ? 'block' : 'none';
    document.getElementById('ob-step-1').style.background = step >= 1 ? '#0D47A1' : '#E3EEFF';
    document.getElementById('ob-step-2').style.background = step >= 2 ? '#0D47A1' : '#E3EEFF';
    document.getElementById('ob-step-3').style.background = step >= 3 ? '#0D47A1' : '#E3EEFF';
  },

  async save() {
    var err = this.validatePage(3);
    if (err) { this.showErr(err); return; }
    var btn = document.getElementById('ob-save-btn');
    btn.textContent = 'Saving...';
    btn.disabled = true;
    try {
      var result = await API.onboarding({
        age:              parseInt(document.getElementById('ob-age').value),
        investmentAmount: this.selections.amount,
        tradingStyle:     this.selections.style,
        experience:       this.selections.experience,
        riskTolerance:    this.selections.risk,
        goals:            document.getElementById('ob-goals').value.trim(),
      });
      document.getElementById('sr-onboarding').remove();
      // Instantly refresh the profile section without a page reload
      if (result && result.traderProfile && document.getElementById('trader-profile-section')) {
        if (typeof displayTraderProfile === 'function') {
          displayTraderProfile(result.traderProfile, true);
        } else {
          location.reload();
        }
      }
      // Mark as done in localStorage
      var userId = Auth.userId ? Auth.userId() : 'user';
      localStorage.setItem('sr_onboarding_done_' + userId, '1');
      if (typeof toast === 'function') toast('✅ Profile saved! SwingRush AI will now personalize all recommendations for you 🎯', 'success', 5000);
    } catch(e) {
      btn.textContent = '🚀 Start Trading!';
      btn.disabled = false;
      if (typeof toast === 'function') toast('Could not save profile', 'error');
    }
  },

  skip() {
    document.getElementById('sr-onboarding').remove();
    // Don't show again this session
    var userId = Auth.userId ? Auth.userId() : 'user';
    sessionStorage.setItem('sr_onboarding_skipped_' + userId, '1');
  },

  // Check if user needs onboarding (call after login)
  async checkAndShow() {
    if (!Auth.token()) return;
    // Check localStorage to avoid showing on every page load
    var userId = Auth.userId ? Auth.userId() : null;
    var localKey = 'sr_onboarding_done_' + userId;
    try {
      var me = await API.me();
      var profile = me.user && me.user.traderProfile;
      var isDone = profile && profile.onboardingDone;
      // Mark in localStorage if done
      if (isDone) {
        localStorage.setItem(localKey, '1');
        return;
      }
      // Already dismissed locally this session
      if (localStorage.getItem(localKey)) return;
      if (sessionStorage.getItem('sr_onboarding_skipped_' + userId)) return;
      // Show after 1.5 seconds
      setTimeout(function() { Onboarding.show(); }, 1500);
    } catch(e) {}
  },
};

window.Onboarding = Onboarding;
