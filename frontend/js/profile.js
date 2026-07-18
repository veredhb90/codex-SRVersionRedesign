// ── Profile Page ───────────────────────────────────────────────────
(function () {
  if (!Auth.require()) return;

  const params   = new URLSearchParams(location.search);
  const targetId = params.get('id');
  const me       = Auth.user();
  const isOwn    = !targetId || targetId === me?.id;

  document.querySelectorAll('.nav-username').forEach(el => el.textContent = me?.username ? '@'+me.username : (me?.fullName||''));

  async function loadProfile() {
    try {
      const data = isOwn ? await API.me() : await API.user(targetId);
      renderHeader(data);
      renderStats(data.stats);
      renderAllRecs(data.recommendations || []);
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Header ───────────────────────────────────────────────────
  function renderHeader({ user, isFollowing }) {
    var nameEl = document.getElementById('prof-name');
    if (nameEl.childNodes.length && nameEl.childNodes[0].nodeType === 3) {
      nameEl.childNodes[0].textContent = user.fullName;
    } else {
      nameEl.insertBefore(document.createTextNode(user.fullName), nameEl.firstChild);
    }
    var planBadge = document.getElementById('prof-plan-badge');
    if (planBadge) {
      if (user.plan === 'pro') {
        planBadge.textContent = '⚡ PRO';
        planBadge.style.cssText += 'display:inline-block;background:linear-gradient(135deg,#F5D061,#E6A817);color:#4A3B10;box-shadow:0 2px 8px rgba(245,208,97,0.4);';
      } else {
        planBadge.textContent = 'FREE';
        planBadge.style.cssText += 'display:inline-block;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.25);';
      }
    }
    document.getElementById('prof-avatar').textContent = initials(user.fullName);
    if (isOwn) document.getElementById('prof-email').textContent = user.email || '';
    // Show @username under name
    const unameEl = document.getElementById('prof-username');
    if (unameEl) unameEl.textContent = user.username ? '@' + user.username : '';

    const following  = Array.isArray(user.following) ? user.following : [];
    const followers  = Array.isArray(user.followers) ? user.followers : [];
    const cfEl = document.getElementById('count-following');
    const crEl = document.getElementById('count-followers');
    if (cfEl) cfEl.textContent = following.length;
    if (crEl) crEl.textContent = followers.length;
    if (window._followData) {
      window._followData.following = following;
      window._followData.followers = followers;
    }

    const shareBtn   = document.getElementById('share-call-btn');
    const followBtn  = document.getElementById('follow-btn');
    const repostsBox = document.getElementById('reposts-box');
    const engineBox  = document.getElementById('engine-box');

    if (isOwn) {
      shareBtn  && (shareBtn.style.display  = 'inline-flex');
      followBtn && (followBtn.style.display = 'none');
      const pwdBtn = document.getElementById('change-pwd-btn');
      if (pwdBtn) pwdBtn.style.display = 'inline-flex';
      const tpBtn = document.getElementById('trader-profile-btn');
      if (tpBtn) tpBtn.style.display = 'inline-flex';
      repostsBox && (repostsBox.style.display = 'block');
      engineBox  && (engineBox.style.display  = 'block');
      // Show and load watchlist
      const wlBox = document.getElementById('watchlist-box');
      if (wlBox) { wlBox.style.display = 'block'; loadWatchlist(); }
    } else {
      shareBtn  && (shareBtn.style.display  = 'none');
      followBtn && (followBtn.style.display = 'inline-flex');
      repostsBox && (repostsBox.style.display = 'block');
      engineBox  && (engineBox.style.display  = 'none');
      var me = null;
      try { me = Auth.user(); } catch(e) {}
      var myId = me ? String(me._id || me.id || '') : '';
      var theyFollowMe = following.some(function(f) { return String(f && f._id ? f._id : f) === myId; });
      setFollowBtn(followBtn, isFollowing, user._id, theyFollowMe);
    }

    // Display trader profile for all visitors
    if (user.traderProfile && window.displayTraderProfile) {
      displayTraderProfile(user.traderProfile, isOwn);
    }
  }

  function setFollowBtn(btn, isFollowing, userId, theyFollowMe) {
    btn.textContent = isFollowing ? '✓ Following' : (theyFollowMe ? '↩ Follow Back' : '+ Follow');
    btn.className   = `btn ${isFollowing ? 'btn-outline' : 'btn-primary'}`;
    btn.onclick = async () => {
      try {
        const res = await API.follow(userId);
        setFollowBtn(btn, res.following, userId, theyFollowMe);
        toast(res.following ? 'Now following!' : 'Unfollowed', 'info');
      } catch (err) { toast(err.message, 'error'); }
    };
  }

  // ── Stats ─────────────────────────────────────────────────────
  function renderStats(s) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total',   s.total);
    set('stat-winrate', s.winRate + '%');
    set('stat-return',  (s.totalReturn >= 0 ? '+' : '') + s.totalReturn + '%');
    set('stat-open',    s.open);
    const wr  = document.getElementById('stat-winrate');
    if (wr)  wr.style.color  = s.winRate >= 55 ? 'var(--green)' : s.winRate >= 40 ? 'var(--gold)' : 'var(--red)';
    const ret = document.getElementById('stat-return');
    if (ret) ret.style.color = s.totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // ── Render 3 boxes ─────────────────────────────────────────────
  function renderAllRecs(recs) {
    const myRecs     = recs.filter(r => !r.source || r.source === 'manual');
    const reposts    = recs.filter(r => r.source === 'repost');
    const engineRecs = recs.filter(r => r.source === 'engine');

    const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n + ' calls'; };
    setCount('count-my',      myRecs.length);
    setCount('count-reposts', reposts.length);
    setCount('count-engine',  engineRecs.length);

    renderBox('profile-recs',       myRecs,     'No recommendations yet. Click "Share a Call" to post your first.');
    renderBox('profile-reposts',    reposts,    'No reposts yet.');
    renderBox('profile-engine-recs',engineRecs, 'No engine signals saved yet.');
  }

  function renderBox(elId, recs, emptyMsg) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!recs.length) {
      el.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">${emptyMsg}</p>`;
      return;
    }
    el.innerHTML = recs.map(r => buildProfileCard(r)).join('');
  }

  // ── Event delegation for comments ──────────────────────────────
  document.addEventListener('click', async (e) => {
    // Undo repost
    const undoBtn = e.target.closest('[data-action="undo-repost"]');
    if (undoBtn) {
      const recId = undoBtn.dataset.recid;
      undoBtn.disabled = true;
      undoBtn.textContent = 'Removing…';
      try {
        await API.undoRepost(recId);
        undoBtn.closest('.rec-card').remove();
        toast('Repost removed', 'success');
      } catch (err) {
        toast(err.message, 'error');
        undoBtn.disabled = false;
        undoBtn.textContent = '✕ Undo Repost';
      }
      return;
    }

    // Toggle comments
    const toggleBtn = e.target.closest('[data-action="toggle-comments"]');
    if (toggleBtn) {
      const recId = toggleBtn.dataset.recid;
      const sec   = document.getElementById('pcs-' + recId);
      if (sec) {
        const open = sec.style.display !== 'none';
        sec.style.display = open ? 'none' : 'block';
        if (!open) sec.querySelector('.pc-input')?.focus();
      }
      return;
    }

    // Submit comment
    const submitBtn = e.target.closest('[data-action="submit-comment"]');
    if (submitBtn) {
      const recId = submitBtn.dataset.recid;
      const inp   = document.getElementById('pci-' + recId);
      const text  = inp?.value?.trim();
      if (!text) return;
      submitBtn.disabled = true;
      try {
        const comment = await API.postComment(recId, text);
        inp.value = '';
        const list = document.getElementById('pcl-' + recId);
        if (list) {
          const div = document.createElement('div');
          div.className = 'pc-item';
          const _me = Auth.user();
          div.innerHTML = `<a href="/profile.html?id=${_me?.id}" style="text-decoration:none;"><strong class="pc-name">${_me?.username?'@'+_me.username:(_me?.fullName||'You')}</strong></a>
            <span class="pc-time">just now</span>
            <div class="pc-text">${comment.text}</div>`;
          list.appendChild(div);
        }
        // Update count
        const tb = document.querySelector(`[data-action="toggle-comments"][data-recid="${recId}"]`);
        if (tb) {
          const n = (tb.dataset.count|0) + 1;
          tb.dataset.count = n;
          tb.innerHTML = `💬 ${n} Comments`;
        }
        toast('Comment posted!', 'success');
      } catch (err) { toast(err.message, 'error'); }
      finally { submitBtn.disabled = false; }
      return;
    }

    // Enter key on comment input
    const pcInput = e.target.closest('.pc-input');
    if (pcInput && e.type === 'keydown' && e.key === 'Enter') {
      const recId = pcInput.dataset.recid;
      document.querySelector(`[data-action="submit-comment"][data-recid="${recId}"]`)?.click();
    }
  });

  document.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const pcInput = e.target.closest('.pc-input');
    if (!pcInput) return;
    const recId = pcInput.dataset.recid;
    document.querySelector(`[data-action="submit-comment"][data-recid="${recId}"]`)?.click();
  });

  // ── Share Form ─────────────────────────────────────────────────
  const symInput  = document.getElementById('share-symbol');
  const priceDisp = document.getElementById('share-price-disp');
  const tpInput   = document.getElementById('share-tp');
  const slInput   = document.getElementById('share-sl');
  let livePrice   = null;
  let debouncer;

  symInput?.addEventListener('input', () => {
    clearTimeout(debouncer);
    const sym = symInput.value.trim().toUpperCase();
    livePrice = null;
    if (!sym) { priceDisp.innerHTML = ''; return; }
    priceDisp.innerHTML = '<span class="spinner-sm"></span>';
    debouncer = setTimeout(async () => {
      try {
        const q = await API.quote(sym);
        livePrice = q.price;
        const up = (q.changePct||0) >= 0;
        priceDisp.innerHTML =
          `<span style="color:var(--green);font-weight:700;font-family:var(--font-mono);">$${q.price.toFixed(2)}</span>
           <span style="color:var(--muted);font-size:12px;">${q.shortName||''}</span>
           <span style="color:${up?'var(--green)':'var(--red)'};font-size:12px;">${up?'▲':'▼'}${Math.abs(q.changePct||0).toFixed(2)}%</span>`;
      } catch {
        livePrice = null;
        priceDisp.innerHTML = '<span style="color:var(--red);font-size:12px;">Not found. Try: AAPL, GLD, SLV, USO</span>';
      }
    }, 600);
  });

  document.getElementById('share-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sym  = symInput.value.trim().toUpperCase();
    const dir  = document.querySelector('input[name="direction"]:checked')?.value || 'BUY';
    const tp   = parseFloat(tpInput.value);
    const sl   = slInput.value ? parseFloat(slInput.value) : null;
    const note = document.getElementById('share-note')?.value?.trim();
    const errEl = document.getElementById('share-error');
    errEl && (errEl.textContent = '');

    if (!sym)       return errEl && (errEl.textContent = 'Enter a symbol');
    if (!livePrice) return errEl && (errEl.textContent = 'Fetch a valid symbol first');
    if (isNaN(tp))  return errEl && (errEl.textContent = 'Enter a take profit level');
    if (dir==='BUY'  && tp<=livePrice) return errEl && (errEl.textContent = 'TP must be above current price');
    if (dir==='SELL' && tp>=livePrice) return errEl && (errEl.textContent = 'TP must be below current price');
    if (sl&&dir==='BUY'  &&sl>=livePrice) return errEl && (errEl.textContent = 'SL must be below entry for BUY');
    if (sl&&dir==='SELL' &&sl<=livePrice) return errEl && (errEl.textContent = 'SL must be above entry for SELL');

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Posting…';
    try {
      await API.postRec({ symbol:sym, takeProfit:tp, stopLoss:sl, direction:dir, note });
      toast('🚀 Posted to feed!', 'success');
      e.target.reset(); priceDisp.innerHTML = ''; livePrice = null;
      if (typeof closeShareForm === 'function') closeShareForm();
      loadProfile();
    } catch (err) {
      errEl && (errEl.textContent = err.message);
    } finally { btn.disabled=false; btn.textContent='🚀 Post to Feed'; }
  });

  loadProfile();

  // ── Watchlist ─────────────────────────────────────────────────
  async function loadWatchlist() {
    const el    = document.getElementById('watchlist-list');
    const count = document.getElementById('count-watchlist');
    if (!el) return;
    try {
      const res = await API.getWatchlist();
      const wl  = res.watchlist || [];
      if (count) count.textContent = wl.length + ' instruments';
      if (!wl.length) {
        el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">No instruments followed yet.<br>Search a symbol in the feed and click 🔔 Follow Instrument.</p>';
        return;
      }
      el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0;">
        ${wl.map(sym => `
          <div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border:1.5px solid var(--border);border-radius:8px;padding:6px 12px;">
            <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent);">${sym}</span>
            <button onclick="unfollowInstrument('${sym}')" title="Unfollow"
              style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0;line-height:1;"
              onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'">✕</button>
          </div>`).join('')}
      </div>`;
    } catch (err) { if (el) el.innerHTML = '<p style="color:var(--red);font-size:13px;">' + err.message + '</p>'; }
  }
})();

async function unfollowInstrument(sym) {
  try {
    await API.subscribeInstrument(sym);
    toast(`Unfollowed $${sym}`, 'info');
    // Reload watchlist
    const res = await API.getWatchlist();
    const wl  = res.watchlist || [];
    const el  = document.getElementById('watchlist-list');
    const cnt = document.getElementById('count-watchlist');
    if (cnt) cnt.textContent = wl.length + ' instruments';
    if (el) {
      if (!wl.length) {
        el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">No instruments followed yet.</p>';
      } else {
        el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0;">
          ${wl.map(s => `
            <div style="display:flex;align-items:center;gap:6px;background:var(--bg2);border:1.5px solid var(--border);border-radius:8px;padding:6px 12px;">
              <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent);">${s}</span>
              <button onclick="unfollowInstrument('${s}')" title="Unfollow"
                style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0;"
                onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'">✕</button>
            </div>`).join('')}
        </div>`;
      }
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ── Watchlist renderer ────────────────────────────────────────────
function renderWatchlist(watchlist) {
  const el    = document.getElementById('profile-watchlist');
  const count = document.getElementById('count-watchlist');
  if (count) count.textContent = watchlist.length + ' instruments';
  if (!el) return;
  if (!watchlist.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">No instruments followed yet. Search in the feed and click 🔔 Follow Instrument.</p>';
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;padding:4px 0;">
    ${watchlist.map(sym => `
      <div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg2);border:1.5px solid var(--border);border-radius:10px;padding:8px 14px;">
        <span style="font-family:var(--font-disp);font-size:16px;letter-spacing:1px;color:var(--accent);">${sym}</span>
        <button onclick="unfollowInstrument('${sym}')"
          style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;padding:0;"
          title="Unfollow">✕</button>
      </div>`).join('')}
  </div>`;
}

async function unfollowInstrument(sym) {
  try {
    await API.subscribeInstrument(sym); // toggles off
    toast(`Unfollowed $${sym}`, 'info');
    // Reload profile to update list
    const data = await API.me();
    renderWatchlist(data.user.watchlist || []);
    const count = document.getElementById('count-watchlist');
    if (count) count.textContent = (data.user.watchlist||[]).length + ' instruments';
  } catch(err) { toast(err.message, 'error'); }
}

// ── Profile card builder ───────────────────────────────────────────
function buildProfileCard(r, isOwn) {
  const isBuy    = r.direction === 'BUY';
  const isClosed = !r.isOpen;
  const isWin    = r.outcome === 'WIN';
  const retColor = (r.returnPct||0) >= 0 ? 'var(--green)' : 'var(--red)';

  const outcomeBadge = isClosed
    ? (isWin ? '<span class="badge-win">🏆 WIN</span>' : '<span class="badge-loss">💸 LOSS</span>')
    : '<span class="badge-open">● OPEN</span>';

  const repostOrigin = r.source==='repost' && r.repostedFrom
    ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;padding:5px 8px;background:var(--bg2);border-radius:6px;display:flex;align-items:center;gap:6px;">
        ↩ Originally by <a href="/profile.html?id=${r.repostedFrom._id||r.repostedFrom}" style="color:var(--accent2);text-decoration:none;font-weight:700;">${r.repostedFrom.user?.username || r.repostedFrom.user?.fullName || 'trader'}</a>
       </div>`
    : '';

  const commentsHtml = (r.comments||[]).map(c =>
    `<div class="pc-item">
      <strong class="pc-name">@${c.user?.username||c.user?.fullName||'trader'}</strong>
      <span class="pc-time">${timeAgo(c.createdAt)}</span>
      <div class="pc-text">${c.text}</div>
    </div>`
  ).join('');

  const commentCount = r.comments?.length || 0;

  return `
  <div class="rec-card" id="rec-${r._id}" data-recid="${r._id}" data-symbol="${r.symbol}" data-entry="${r.entryPrice}" data-direction="${r.direction}" data-isopen="${r.isOpen?'true':'false'}" style="margin-bottom:12px;">
    <div class="rec-header">
      <div>
        <div class="rec-symbol">${r.symbol}</div>
        ${r.companyName&&r.companyName!==r.symbol?`<div class="rec-company">${r.companyName}</div>`:''}
      </div>
      <span class="${isBuy?'badge-buy':'badge-sell'}">${isBuy?'▲':'▼'} ${r.direction}</span>
      ${outcomeBadge}
      <div class="rec-time" style="margin-left:auto;">${timeAgo(r.createdAt)}</div>
    </div>
    ${repostOrigin}
    <div class="rec-prices">
      <div class="price-block"><div class="price-val">${fmtPrice(r.entryPrice)}</div><div class="price-lbl">Entry</div></div>
      <div class="price-block"><div class="price-val tp-val">${fmtPrice(r.takeProfit)}</div><div class="price-lbl">Take Profit</div></div>
      <div class="price-block"><div class="price-val sl-val">${r.stopLoss?fmtPrice(r.stopLoss):'—'}</div><div class="price-lbl">Stop Loss</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
      ${r.isOpen ? `<span style="font-size:12px;color:var(--muted);">Live: <span class="live-price" style="font-weight:700;font-family:var(--font-mono);border-radius:4px;padding:1px 4px;">${fmtPrice(r.currentPrice||r.entryPrice)}</span>
      <span class="live-change" style="font-size:11px;color:var(--muted);margin-left:4px;"></span>
    </span>` : `<span style="font-size:12px;color:var(--muted);">${r.outcome==='WIN'?'🎯 Hit TP':'🛑 Hit SL'} @ <span style="font-weight:700;font-family:var(--font-mono);color:${r.outcome==='WIN'?'var(--green)':'var(--red)'};">${fmtPrice(r.outcome==='WIN'?r.takeProfit:(r.stopLoss||r.currentPrice))}</span>
      <span style="font-size:11px;color:var(--muted);margin-left:4px;">${r.closedAt?new Date(r.closedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+' · '+new Date(r.closedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):''}</span>
    </span>`}
      <span class="live-return" style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:${retColor};">${r.returnPct?fmtPct(r.returnPct):'—'}</span>
      <button class="like-btn" data-id="${r._id}" style="margin-left:auto;font-size:12px;color:var(--muted);background:none;border:1px solid var(--border);border-radius:14px;padding:4px 11px;cursor:pointer;">♥ <span class="like-count" title="See who liked" style="cursor:pointer;font-weight:700;">${r.likes?.length||0}</span></button>
      <button class="btn btn-sm btn-ghost"
        data-action="toggle-comments" data-recid="${r._id}" data-count="${commentCount}"
        style="font-size:12px;padding:5px 10px;cursor:pointer;">
        💬 ${commentCount} Comment${commentCount!==1?'s':''}
      </button>
      ${isOwn && r.source==='repost' ? `<button class="btn btn-sm btn-outline" data-action="undo-repost" data-recid="${r._id}"
        style="font-size:12px;padding:5px 10px;cursor:pointer;color:var(--red);border-color:var(--red);">
        ✕ Undo Repost
      </button>` : ''}
    </div>
    ${r.note?`<div class="rec-note">"${r.note}"</div>`:''}
    <div id="pcs-${r._id}" style="display:none;margin-top:10px;border-top:1px solid var(--bg3);padding-top:10px;">
      <div id="pcl-${r._id}" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;max-height:200px;overflow-y:auto;">
        ${commentsHtml}
      </div>
      <div style="display:flex;gap:8px;">
        <input id="pci-${r._id}" class="pc-input" type="text" data-recid="${r._id}"
          placeholder="Add a comment… (Enter to post)" maxlength="500"
          style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;outline:none;background:var(--bg2);font-family:var(--font-body);transition:border-color .2s;"
          onfocus="this.style.borderColor='var(--accent2)'" onblur="this.style.borderColor='var(--border)'"/>
        <button class="btn btn-primary btn-sm"
          data-action="submit-comment" data-recid="${r._id}">Post</button>
      </div>
    </div>
  </div>`;
}


// ── Live return % for OPEN calls: (live price - entry) / entry ─────
(function() {
  async function refreshProfileLive() {
    var cards = document.querySelectorAll('.rec-card[data-isopen="true"]');
    if (!cards.length) return;
    var bySym = {};
    cards.forEach(function(c) {
      var s = c.dataset.symbol;
      if (!s) return;
      if (!bySym[s]) bySym[s] = [];
      bySym[s].push(c);
    });
    for (var sym in bySym) {
      try {
        var q = await API.quote(sym);
        if (!q || !q.price) continue;
        bySym[sym].forEach(function(card) {
          var entry = parseFloat(card.dataset.entry);
          var dir   = card.dataset.direction;
          var retEl = card.querySelector('.live-return');
          if (retEl && entry) {
            var ret = dir === 'BUY'
              ? ((q.price - entry) / entry * 100)
              : ((entry - q.price) / entry * 100);
            retEl.textContent = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%';
            retEl.style.color = ret >= 0 ? 'var(--green)' : 'var(--red)';
          }
        });
      } catch (e) {}
    }
  }
  setTimeout(refreshProfileLive, 2500);
  setInterval(refreshProfileLive, 30000);
})();


// ── Notification deep-link: /profile.html?rec=<id> scrolls to the trade ──
(function() {
  var params = new URLSearchParams(location.search);
  var recId = params.get('rec');
  if (!recId) return;
  var tries = 0;
  var t = setInterval(function() {
    tries++;
    var el = document.getElementById('rec-' + recId);
    if (el) {
      clearInterval(t);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow .4s';
      el.style.boxShadow = '0 0 0 3px #F5D061, 0 8px 24px rgba(245,208,97,0.35)';
      setTimeout(function() { el.style.boxShadow = ''; }, 3500);
    } else if (tries > 40) { clearInterval(t); }
  }, 250);
})();


// ── Likes on profile cards: heart toggles, count shows who liked ──
(function() {
  function authHdr() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('sr_token') || '') };
  }

  async function fetchLikesList(recId) {
    var res = await fetch('/api/recommendations/' + recId + '/likes', { headers: authHdr() });
    if (!res.ok) throw new Error('Could not load likes');
    return res.json();
  }

  async function showLikesList(recId) {
    try {
      var users = await fetchLikesList(recId);
      var oldM = document.getElementById('sr-likes-modal');
      if (oldM) oldM.remove();
      var m = document.createElement('div');
      m.id = 'sr-likes-modal';
      m.style.cssText = 'position:fixed;inset:0;z-index:25000;background:rgba(8,15,36,0.6);display:flex;align-items:center;justify-content:center;padding:20px;';
      var items = users.length
        ? users.map(function(u) {
            var initial = (u.username || u.fullName || '?').charAt(0).toUpperCase();
            return '<a href="/profile.html?id=' + u._id + '" style="display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid #EEF3FB;text-decoration:none;color:#1A2540;"><span style="width:32px;height:32px;border-radius:50%;background:#1565C0;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">' + initial + '</span><span style="font-weight:600;">@' + (u.username || u.fullName) + '</span></a>';
          }).join('')
        : '<div style="text-align:center;color:#94a3b8;padding:16px;">No likes yet</div>';
      m.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:340px;width:100%;max-height:70vh;overflow-y:auto;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,0.3);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong style="color:#0D2244;">&#10084;&#65039; Liked by</strong><button id="sr-likes-close" style="background:none;border:none;font-size:16px;cursor:pointer;color:#94a3b8;">&#10005;</button></div>' + items + '</div>';
      m.addEventListener('click', function(ev) { if (ev.target === m || ev.target.id === 'sr-likes-close') m.remove(); });
      document.body.appendChild(m);
    } catch (e) { if (window.toast) toast(e.message, 'error'); }
  }

  document.addEventListener('click', async function(e) {
    var countEl = e.target.closest('.like-count');
    if (countEl) {
      var b1 = countEl.closest('.like-btn');
      if (b1 && b1.dataset.id) { e.preventDefault(); showLikesList(b1.dataset.id); }
      return;
    }
    var likeBtn = e.target.closest('.like-btn');
    if (likeBtn && likeBtn.dataset.id) {
      e.preventDefault();
      try {
        var res = await fetch('/api/recommendations/' + likeBtn.dataset.id + '/like', { method: 'POST', headers: authHdr() });
        var d = await res.json();
        if (!res.ok) throw new Error(d.message || 'Like failed');
        var c = likeBtn.querySelector('.like-count');
        if (c) c.textContent = d.likes;
        likeBtn.style.color = d.liked ? 'var(--red)' : 'var(--muted)';
      } catch (err) { if (window.toast) toast(err.message, 'error'); }
    }
  });
})();
