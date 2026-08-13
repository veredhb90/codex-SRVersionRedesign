// ── Profile Page ───────────────────────────────────────────────────
(function () {
  if (!Auth.require()) return;

  const params   = new URLSearchParams(location.search);
  const targetId = params.get('id');
  const me       = Auth.user();
  const isOwn    = !targetId || targetId === me?.id;
  let profileTradeFilter = 'all';
  let manualTrades = [];

  document.querySelectorAll('.nav-username').forEach(el => el.textContent = me?.username ? '@'+me.username : (me?.fullName||''));

  async function loadProfile() {
    try {
      const data = isOwn ? await API.me() : await API.user(targetId);
      renderHeader(data);
      renderStats(data.stats);
      renderAllRecs(data.recommendations || []);
    } catch (err) { toast(err.message, 'error'); }
  }
  window.reloadSwingRushProfile = loadProfile;

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
    var expiryEl = document.getElementById('prof-plan-expiry');
    if (expiryEl) {
      if (isOwn && user.plan === 'pro' && user.subscriptionEnd) {
        var dateStr = new Date(user.subscriptionEnd).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
        expiryEl.textContent = (user.cancelledAt ? 'Access ends ' : 'Renews ') + dateStr + ' →';
        expiryEl.style.display = 'block';
      } else {
        expiryEl.style.display = 'none';
      }
    }
    const context = document.getElementById('prof-context');
    if (context) context.textContent = isOwn
      ? SRLang.t('profile.your_workspace', 'YOUR TRADING WORKSPACE')
      : SRLang.t('profile.trader_workspace', 'TRADER WORKSPACE');
    const accountStatus = document.getElementById('profile-snapshot-status');
    if (accountStatus) accountStatus.textContent = user.plan === 'pro' ? 'PRO' : 'FREE';
    document.getElementById('prof-avatar').innerHTML = avatarHtml(user);
    if (isOwn) {
      document.getElementById('prof-email').textContent = user.email || '';
      const editBtn = document.getElementById('prof-av-edit');
      const removeBtn = document.getElementById('prof-av-remove');
      if (editBtn) { editBtn.style.display = 'flex'; editBtn.classList.toggle('no-photo', !user.avatar); }
      if (removeBtn) removeBtn.style.display = user.avatar ? 'flex' : 'none';
    }
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
      // Educational explainer — own profile only
      const explainer = document.getElementById('profile-explainer');
      if (explainer) explainer.style.display = 'block';
      // "Why real inputs matter" nudge — own profile only
      const inputsExpl = document.getElementById('inputs-explainer');
      if (inputsExpl) inputsExpl.style.display = 'block';
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
    btn.textContent = isFollowing ? '✓ ' + SRLang.t('profile.following_action', 'Following') : (theyFollowMe ? '↩ ' + SRLang.t('profile.follow_back', 'Follow Back') : '+ ' + SRLang.t('profile.follow', 'Follow'));
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
    const setPerformanceTone = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      const container = el.closest('.stat-box, .snapshot-item');
      const tone = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
      el.style.color = '';
      if (container) {
        container.classList.remove('metric-positive', 'metric-negative', 'metric-neutral');
        container.classList.add('metric-' + tone);
      }
    };
    const setReturn = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = (value > 0 ? '+' : '') + value + '%';
      setPerformanceTone(id, value);
    };
    set('stat-total',   s.total);
    set('stat-winrate', s.winRate + '%');
    setReturn('stat-return', s.totalReturn);
    setReturn('stat-open-return', s.openReturn || 0);
    setReturn('stat-closed-return', s.closedReturn || 0);
    set('stat-open',    s.open);
    set('profile-snapshot-calls', s.total);
    const snapshotReturn = document.getElementById('profile-snapshot-return');
    if (snapshotReturn) {
      snapshotReturn.textContent = (s.totalReturn > 0 ? '+' : '') + s.totalReturn + '%';
      snapshotReturn.classList.toggle('is-positive', s.totalReturn > 0);
      snapshotReturn.classList.toggle('is-negative', s.totalReturn < 0);
      setPerformanceTone('profile-snapshot-return', s.totalReturn);
    }
    // A win rate is only meaningful after a trade has actually closed.
    // At 50% or more it is shown as a win; below 50% it is shown as a loss.
    setPerformanceTone('stat-winrate', s.closed > 0 ? (s.winRate >= 50 ? 1 : -1) : 0);
  }

  // ── Render 3 boxes ─────────────────────────────────────────────
  function renderAllRecs(recs) {
    recs = [...recs].sort((a, b) => new Date(b.openedAt || b.createdAt) - new Date(a.openedAt || a.createdAt));
    manualTrades     = recs.filter(r => !r.source || r.source === 'manual');
    const reposts    = recs.filter(r => r.source === 'repost');
    const engineRecs = recs.filter(r => r.source === 'engine');

    const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n + ' trades'; };
    setCount('count-reposts', reposts.length);
    setCount('count-engine',  engineRecs.length);

    renderProfileTrades();
    renderBox('profile-reposts',    reposts,    'No reposts yet.', isOwn);
    renderBox('profile-engine-recs',engineRecs, 'No engine signals saved yet.', isOwn);
  }

  function renderProfileTrades() {
    const filtered = profileTradeFilter === 'open'
      ? manualTrades.filter(r => r.isOpen)
      : profileTradeFilter === 'closed'
        ? manualTrades.filter(r => !r.isOpen)
        : manualTrades;
    const count = document.getElementById('count-my');
    if (count) count.textContent = profileTradeFilter === 'all'
      ? manualTrades.length + ' trades'
      : filtered.length + ' of ' + manualTrades.length + ' trades';
    document.querySelectorAll('.profile-trade-filter').forEach(button => {
      button.classList.toggle('active', button.dataset.tradeFilter === profileTradeFilter);
    });
    const empty = profileTradeFilter === 'open'
      ? 'No open trades.'
      : profileTradeFilter === 'closed'
        ? 'No closed trades yet.'
        : 'No trades yet. Share your first trade when you are ready.';
    renderBox('profile-recs', filtered, empty, isOwn);
  }

  function renderBox(elId, recs, emptyMsg, ownerViewing) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!recs.length) {
      el.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">${emptyMsg}</p>`;
      return;
    }
    el.innerHTML = recs.map(r => buildProfileCard(r, ownerViewing)).join('');
  }

  // ── Reply-aware comment renderer ───────────────────────────────
  window.threadProfileComments = function(comments) {
    const items = (comments || []).map(c => {
      const m = String(c.text || '').match(/^@([a-zA-Z0-9_.\-]+)\s+([\s\S]*)$/);
      return { c: c, id: String(c._id || ''), parentId: String(c.parentCommentId || ''), mention: m ? m[1].toLowerCase() : null, children: [], depth: 0 };
    });
    const authorOf = it => String(it.c.user?.username || it.c.user?.fullName || '').toLowerCase();
    const byId = new Map(items.filter(it => it.id).map(it => [it.id, it]));
    const roots = [];
    items.forEach((it, idx) => {
      let parent = it.parentId ? byId.get(it.parentId) : null;
      if (!parent && it.mention) {
        for (let j = idx - 1; j >= 0; j--) {
          if (authorOf(items[j]) === it.mention) { parent = items[j]; break; }
        }
      }
      if (parent) { parent.children.push(it); it.depth = Math.min(parent.depth + 1, 4); }
      else roots.push(it);
    });
    const out = [];
    const walk = it => { out.push(it); it.children.forEach(walk); };
    roots.forEach(walk);
    return out;
  };

  window.renderProfileComment = function(c, recId, depth) {
    const uname = c.user?.username ? '@' + c.user.username : (c.user?.fullName || 'trader');
    const dataU = c.user?.username || c.user?.fullName || 'trader';
    const text  = String(c.text || '');
    const m     = text.match(/^@([a-zA-Z0-9_.\-]+)\s+([\s\S]*)$/);
    const ind   = 20 * Math.min(Math.max(depth || (m ? 1 : 0), m ? 1 : 0), 2);
    const initial  = (dataU || '?').charAt(0).toUpperCase();
    const isReply  = !!m;
    const bodyText = m ? m[2] : text;
    const commentId = String(c._id || '');
    const replyBtn = `<button class="pc-reply-btn" data-username="${dataU}" data-recid="${recId}" data-comment-id="${commentId}" style="margin-left:auto;background:#F0F5FE;border:1px solid #D6E4F5;border-radius:12px;color:var(--accent2);font-size:10.5px;cursor:pointer;font-weight:700;padding:3px 10px;flex-shrink:0;">↩ Reply</button>`;
    const nameLink = c.user?._id
      ? `<a href="/profile.html?id=${c.user._id}" style="text-decoration:none;color:var(--accent2);font-weight:800;font-size:12.5px;">${uname}</a>`
      : `<strong style="color:var(--accent2);font-size:12.5px;">${uname}</strong>`;
    const replyChip = isReply ? `<div style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#64748b;background:#EEF4FF;border-radius:8px;padding:2px 8px;margin-bottom:5px;">↩ Reply to <b style="color:var(--accent2);">@${m[1]}</b></div>` : '';
    return `<div id="profile-comment-${commentId}" class="pc-item" data-comment-id="${commentId}" data-author="${dataU.toLowerCase()}" style="margin:6px 0 6px ${ind}px;${isReply?'border-left:2.5px solid #90CAF9;':''}padding:9px 11px;background:${isReply?'rgba(21,101,192,0.045)':'#fff'};border:1px solid #E3EEFF;border-radius:${isReply?'0 12px 12px 12px':'12px'};">
      ${replyChip}
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="width:26px;height:26px;border-radius:50%;background:#1565C0;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${initial}</span>
        ${nameLink}
        <span class="pc-time" style="font-size:10.5px;">${timeAgo(c.createdAt||new Date())}</span>
        ${replyBtn}
      </div>
      <div class="pc-text" style="margin:6px 0 0 34px;">${bodyText}</div>
    </div>`;
  };

  // ── Event delegation for comments ──────────────────────────────
  document.addEventListener('click', async (e) => {
    const filterButton = e.target.closest('.profile-trade-filter');
    if (filterButton) {
      profileTradeFilter = filterButton.dataset.tradeFilter || 'all';
      renderProfileTrades();
      return;
    }
    const unsaveBtn = e.target.closest('[data-action="unsave-engine"]');
    if (unsaveBtn) {
      const recId = unsaveBtn.dataset.recid;
      unsaveBtn.disabled = true;
      unsaveBtn.textContent = 'Removing…';
      try {
        await API.unsaveEngine(recId);
        toast('Saved engine trade removed', 'success');
        window.reloadSwingRushProfile && window.reloadSwingRushProfile();
      } catch (err) {
        toast(err.message, 'error');
        unsaveBtn.disabled = false;
        unsaveBtn.textContent = 'Unsave Signal';
      }
      return;
    }

    // Undo repost
    const undoBtn = e.target.closest('[data-action="undo-repost"]');
    if (undoBtn) {
      const recId = undoBtn.dataset.recid;
      undoBtn.disabled = true;
      undoBtn.textContent = 'Removing…';
      try {
        await API.undoRepost(recId);
        toast('Repost removed', 'success');
        window.reloadSwingRushProfile && window.reloadSwingRushProfile();
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
        const comment = await API.postComment(recId, text, inp.dataset.replyTo);
        inp.value = '';
        const list = document.getElementById('pcl-' + recId);
        if (list) {
          const commentId = String(comment._id || '');
          if (commentId && document.getElementById('profile-comment-' + commentId)) return;
          const wrap = document.createElement('div');
          wrap.innerHTML = renderProfileComment(comment, recId);
          const el2 = wrap.firstElementChild;
          const parent = comment.parentCommentId && document.getElementById('profile-comment-' + comment.parentCommentId);
          const mm = String(comment.text || '').match(/^@([a-zA-Z0-9_.\-]+)\s/);
          let placed = false;
          if (parent) { parent.insertAdjacentElement('afterend', el2); placed = true; }
          else if (mm) {
            const kin = list.querySelectorAll('[data-author="' + mm[1].toLowerCase() + '"]');
            if (kin.length) { kin[kin.length - 1].insertAdjacentElement('afterend', el2); placed = true; }
          }
          if (!placed) list.appendChild(el2);
        }
        delete inp.dataset.replyTo;
        inp.placeholder = 'Add a comment… (Enter to post)';
        // Update count
        const tb = document.querySelector(`[data-action="toggle-comments"][data-recid="${recId}"]`);
        if (tb) {
          const n = (tb.dataset.count|0) + 1;
          tb.dataset.count = n;
          tb.innerHTML = `<svg class="sr-ic sr-ic-comment" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.9 7.1L3 20l1.4-4.6A8.4 8.4 0 1 1 21 11.5z"/></svg> ${n} Comments`;
        }
        toast('Comment posted!', 'success');
      } catch (err) { toast(err.message, 'error'); }
      finally { submitBtn.disabled = false; }
      return;
    }

    // Reply to a comment — prefill @username
    const pcReply = e.target.closest('.pc-reply-btn');
    if (pcReply) {
      const rid = pcReply.dataset.recid;
      const input = document.getElementById('pci-' + rid) || document.querySelector('[data-recid="' + rid + '"].pc-input, input[data-recid="' + rid + '"]') || (document.getElementById('rec-' + rid) && document.getElementById('rec-' + rid).querySelector('input[maxlength="500"]'));
      const card = document.getElementById('rec-' + rid);
      const realInput = input || (card && card.querySelector('input[maxlength="500"]'));
      if (realInput) {
        if (realInput.offsetParent === null) {
          const tog = document.querySelector('[data-action="toggle-comments"][data-recid="' + rid + '"]');
          if (tog) tog.click();
        }
        setTimeout(function() {
          realInput.dataset.replyTo = pcReply.dataset.commentId || '';
          realInput.value = '@' + pcReply.dataset.username + ' ';
          realInput.placeholder = 'Replying to @' + pcReply.dataset.username + '…';
          realInput.focus();
          realInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 120);
      }
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
  const entryInput = document.getElementById('share-entry');
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
    const entry = entryInput?.value ? parseFloat(entryInput.value) : livePrice;
    const tp   = tpInput.value ? parseFloat(tpInput.value) : null;
    const sl   = slInput.value ? parseFloat(slInput.value) : null;
    const note = document.getElementById('share-note')?.value?.trim();
    const errEl = document.getElementById('share-error');
    errEl && (errEl.textContent = '');

    if (!sym)       return errEl && (errEl.textContent = 'Enter a symbol');
    if (!livePrice) return errEl && (errEl.textContent = 'Fetch a valid symbol first');
    if (!Number.isFinite(entry) || entry <= 0) return errEl && (errEl.textContent = 'Enter a valid entry price');
    if (tp && dir==='BUY'  && tp<=entry) return errEl && (errEl.textContent = 'TP must be above entry for BUY');
    if (tp && dir==='SELL' && tp>=entry) return errEl && (errEl.textContent = 'TP must be below entry for SELL');
    if (sl&&dir==='BUY'  &&sl>=entry) return errEl && (errEl.textContent = 'SL must be below entry for BUY');
    if (sl&&dir==='SELL' &&sl<=entry) return errEl && (errEl.textContent = 'SL must be above entry for SELL');

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Posting…';
    try {
      await API.postRec({ symbol:sym, entryPrice:entryInput?.value || undefined, takeProfit:tp, stopLoss:sl, direction:dir, note });
      toast('🚀 Posted to feed!', 'success');
      e.target.reset(); priceDisp.innerHTML = ''; livePrice = null;
      if (typeof closeShareForm === 'function') closeShareForm();
      loadProfile();
    } catch (err) {
      errEl && (errEl.textContent = err.message);
    } finally { btn.disabled=false; btn.textContent='🚀 Post to Feed'; }
  });

  loadProfile();

  // ── Profile photo (own profile only) ────────────────────────────
  if (isOwn) {
    const avWrap   = document.getElementById('prof-av-wrap');
    const avInput  = document.getElementById('prof-av-input');
    const avEdit   = document.getElementById('prof-av-edit');
    const avRemove = document.getElementById('prof-av-remove');

    const openPicker = () => avInput && avInput.click();
    avEdit && avEdit.addEventListener('click', openPicker);
    avWrap && avWrap.addEventListener('click', (e) => {
      if (e.target === avEdit || e.target === avRemove) return;
      openPicker();
    });

    avInput && avInput.addEventListener('change', async () => {
      const file = avInput.files && avInput.files[0];
      avInput.value = ''; // allow re-picking the same file later
      if (!file) return;
      if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) {
        return toast('Please choose a JPEG, PNG or WebP image', 'error');
      }
      try {
        const dataUrl = await resizeImageToDataUrl(file, 320);
        const res = await API.uploadAvatar(dataUrl);
        Auth.updateUser({ avatar: res.avatar });
        document.getElementById('prof-avatar').innerHTML = avatarHtml({ avatar: res.avatar });
        avRemove.style.display = 'flex';
        avEdit.classList.remove('no-photo');
        toast('✅ Profile photo updated', 'success');
      } catch (err) {
        toast(err.message || 'Could not update photo', 'error');
      }
    });

    avRemove && avRemove.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Remove your profile photo?')) return;
      try {
        await API.removeAvatar();
        Auth.updateUser({ avatar: null });
        document.getElementById('prof-avatar').innerHTML = avatarHtml({ avatar: null, fullName: me?.fullName });
        avRemove.style.display = 'none';
        avEdit.classList.add('no-photo');
        toast('Profile photo removed', 'success');
      } catch (err) {
        toast(err.message || 'Could not remove photo', 'error');
      }
    });
  }

  // Downscales+crops to a square JPEG data URL so uploads stay small
  // regardless of the original photo's size.
  function resizeImageToDataUrl(file, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = () => {
        img.onerror = () => reject(new Error('Could not load image'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

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

let activeCloseCall = null;

async function openCloseCall(recId, symbol, entryPrice, direction) {
  activeCloseCall = { recId, symbol, entryPrice, direction };
  const overlay = document.getElementById('close-call-overlay');
  const priceEl = document.getElementById('close-call-price');
  const stateEl = document.getElementById('close-call-market-state');
  const submit = document.getElementById('close-call-submit');
  const summary = document.getElementById('close-call-summary');
  document.getElementById('close-call-title').textContent = 'Close $' + symbol + ' ' + direction + ' trade';
  summary.textContent = 'Checking the current market price. Your realized return will be recorded at the live quote when you confirm.';
  priceEl.textContent = '—';
  stateEl.textContent = 'Fetching live price…';
  submit.disabled = true;
  document.getElementById('close-call-error').textContent = '';
  overlay.style.display = 'flex';
  try {
    const quote = await API.closeQuote(recId);
    if (!activeCloseCall || activeCloseCall.recId !== recId) return;
    activeCloseCall.quote = quote;
    priceEl.textContent = fmtPrice(quote.price);
    stateEl.textContent = quote.marketState || 'Market price';
    summary.textContent = 'Entry: ' + fmtPrice(entryPrice) + ' · This is the latest ' + (quote.marketState || 'market price') + ' quote. The price is refreshed once more when you confirm.';
    submit.disabled = false;
  } catch (err) {
    if (!activeCloseCall || activeCloseCall.recId !== recId) return;
    stateEl.textContent = 'Price unavailable';
    document.getElementById('close-call-error').textContent = err.message || 'Could not retrieve the current market price. Please try again.';
  }
}

function closeCallModal() {
  document.getElementById('close-call-overlay').style.display = 'none';
  activeCloseCall = null;
}

document.getElementById('close-call-overlay')?.addEventListener('click', function(event) {
  if (event.target === this) closeCallModal();
});

document.getElementById('close-call-submit')?.addEventListener('click', async function() {
  if (!activeCloseCall) return;
  const btn = this;
  const error = document.getElementById('close-call-error');
  if (!activeCloseCall.quote) return;
  btn.disabled = true;
  btn.textContent = 'Closing…';
  try {
    const rec = await API.closeRec(activeCloseCall.recId);
    toast((rec.returnPct >= 0 ? 'Profit closed: +' : 'Loss closed: ') + rec.returnPct.toFixed(2) + '% at ' + fmtPrice(rec.closePrice), rec.returnPct >= 0 ? 'success' : 'info');
    closeCallModal();
    window.reloadSwingRushProfile && window.reloadSwingRushProfile();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Close Trade';
  }
});

// ── Profile card builder ───────────────────────────────────────────
function buildProfileCard(r, isOwn) {
  const isBuy    = r.direction === 'BUY';
  const isClosed = !r.isOpen;
  const isWin    = r.outcome === 'WIN';
  const current = Number(r.currentPrice || r.entryPrice);
  const openReturn = r.isOpen && r.entryPrice
    ? (isBuy ? ((current-r.entryPrice)/r.entryPrice*100) : ((r.entryPrice-current)/r.entryPrice*100))
    : Number(r.returnPct || 0);
  const retColor = openReturn >= 0 ? 'var(--green)' : 'var(--red)';
  const viewer = Auth.user();
  const viewerId = String(viewer?._id || viewer?.id || '');
  const likedByViewer = (r.likes || []).some(like => String(like?._id || like) === viewerId);
  const openedDate = new Intl.DateTimeFormat(document.documentElement.lang === 'ar' ? 'ar' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(r.openedAt || r.createdAt));

  const outcomeBadge = isClosed
    ? (isWin ? '<span class="badge-win">🏆 WIN</span>' : '<span class="badge-loss">💸 LOSS</span>')
    : '<span class="badge-open">● OPEN</span>';

  const repostOrigin = r.source==='repost' && r.repostedFrom
    ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;padding:5px 8px;background:var(--bg2);border-radius:6px;display:flex;align-items:center;gap:6px;">
        ↩ Originally by <a href="/profile.html?id=${r.repostedFrom._id||r.repostedFrom}" style="color:var(--accent2);text-decoration:none;font-weight:700;">${r.repostedFrom.user?.username || r.repostedFrom.user?.fullName || 'trader'}</a>
       </div>`
    : '';

  const commentsHtml = threadProfileComments(r.comments||[]).map(t => renderProfileComment(t.c, r._id, t.depth)).join('');

  const commentCount = r.comments?.length || 0;

  return `
  <div class="rec-card ${r.direction==='BUY'?'buy':'sell'}" id="rec-${r._id}" data-recid="${r._id}" data-symbol="${r.symbol}" data-entry="${r.entryPrice}" data-direction="${r.direction}" data-isopen="${r.isOpen?'true':'false'}" style="margin-bottom:12px;">
    <div class="rec-header">
      <div>
        <div class="rec-symbol">${r.symbol}</div>
        ${r.companyName&&r.companyName!==r.symbol?`<div class="rec-company">${r.companyName}</div>`:''}
      </div>
      <span class="${isBuy?'badge-buy':'badge-sell'}">${isBuy?'▲':'▼'} ${r.direction}</span>
      ${outcomeBadge}
      <div class="rec-time rec-opened-date" style="margin-left:auto;" title="Trade opened date">Opened · ${openedDate}</div>
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
    </span>` : `<span style="font-size:12px;color:var(--muted);">${r.manualClose?'✓ Closed manually':(r.outcome==='WIN'?'🎯 Hit TP':'🛑 Hit SL')} @ <span style="font-weight:700;font-family:var(--font-mono);color:${r.outcome==='WIN'?'var(--green)':'var(--red)'};">${fmtPrice(r.closePrice || (r.outcome==='WIN'?r.takeProfit:(r.stopLoss||r.currentPrice)))}</span>
      <span style="font-size:11px;color:var(--muted);margin-left:4px;">${r.closedAt?new Date(r.closedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+' · '+new Date(r.closedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):''}</span>
    </span>`}
      <span class="live-return" style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:${retColor};">${openReturn >= 0 ? '+' : ''}${openReturn.toFixed(2)}%</span>
      <button class="like-btn ${likedByViewer ? 'liked' : ''}" data-id="${r._id}" aria-pressed="${likedByViewer}" style="margin-left:auto;font-size:12px;color:var(--muted);background:none;border:1px solid var(--border);border-radius:14px;padding:4px 11px;cursor:pointer;"><svg class="sr-ic sr-ic-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 5.6a5.4 5.4 0 0 0-7.7 0l-1.1 1.1-1.1-1.1a5.4 5.4 0 1 0-7.7 7.7l1.1 1.1 7.7 7.6 7.7-7.6 1.1-1.1a5.4 5.4 0 0 0 0-7.7z"/></svg> <span class="like-count" title="See who liked" style="cursor:pointer;font-weight:700;">${r.likes?.length||0}</span></button>
      ${!isOwn && r.source !== 'repost' ? `<button class="pf-repost-btn" data-id="${r._id}" style="font-size:12px;color:var(--muted);background:none;border:1px solid var(--border);border-radius:14px;padding:4px 11px;cursor:pointer;">↻ Repost</button>` : ''}
      <button class="btn btn-sm btn-ghost"
        data-action="toggle-comments" data-recid="${r._id}" data-count="${commentCount}"
        style="font-size:12px;padding:5px 10px;cursor:pointer;">
        <svg class="sr-ic sr-ic-comment" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.9 7.1L3 20l1.4-4.6A8.4 8.4 0 1 1 21 11.5z"/></svg> ${commentCount} Comment${commentCount!==1?'s':''}
      </button>
      ${isOwn && r.source==='repost' ? `<button class="btn btn-sm btn-outline" data-action="undo-repost" data-recid="${r._id}"
        style="font-size:12px;padding:5px 10px;cursor:pointer;color:var(--red);border-color:var(--red);">
        ✕ Undo Repost
      </button>` : ''}
      ${isOwn && r.source==='engine' ? `<button class="btn btn-sm btn-outline" data-action="unsave-engine" data-recid="${r._id}"
        style="font-size:12px;padding:5px 10px;cursor:pointer;color:var(--gold);border-color:rgba(246,183,60,.5);">Unsave Signal</button>` : ''}
      ${isOwn && r.isOpen && (!r.source || r.source === 'manual') ? `<button type="button" class="btn btn-sm btn-outline" onclick="openCloseCall('${r._id}','${r.symbol}',${Number(r.entryPrice)},'${r.direction}')" style="font-size:12px;padding:5px 10px;color:var(--gold);border-color:rgba(246,183,60,.5);">Close Trade</button>` : ''}
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


// NOTE: live return% for open trades is refreshed by refreshProfilePrices()
// in profile.html (which already updates price, change AND return for the same
// open cards on the same 30s tick). A second refresher here just duplicated the
// API.quote calls, so it was removed.


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
      // Auto-open comments so replies are visible right away
      setTimeout(function() {
        var tog = el.querySelector('.comment-toggle, [class*="comment"][class*="toggle"]');
        if (tog) tog.click();
      }, 700);
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
    var rp = e.target.closest('.pf-repost-btn');
    if (rp && rp.dataset.id) {
      e.preventDefault();
      rp.disabled = true;
      try {
        await API.repost(rp.dataset.id, '');
        rp.textContent = '✓ Reposted';
        if (window.toast) toast('Reposted!', 'success');
      } catch (err) { if (window.toast) toast(err.message, 'error'); rp.disabled = false; }
      return;
    }
    var countEl = e.target.closest('.like-count');
    if (countEl) {
      var b1 = countEl.closest('.like-btn');
      if (b1 && b1.dataset.id) { e.preventDefault(); showLikesList(b1.dataset.id); }
      return;
    }
    var likeBtn = e.target.closest('.like-btn');
    if (likeBtn && likeBtn.dataset.id) {
      e.preventDefault();
      if (likeBtn.disabled) return;
      likeBtn.disabled = true;
      try {
        var res = await fetch('/api/recommendations/' + likeBtn.dataset.id + '/like', { method: 'POST', headers: authHdr() });
        var d = await res.json();
        if (!res.ok) throw new Error(d.message || 'Like failed');
        var c = likeBtn.querySelector('.like-count');
        if (c) c.textContent = d.likes;
        likeBtn.classList.toggle('liked', d.liked);
        likeBtn.setAttribute('aria-pressed', String(d.liked));
      } catch (err) { if (window.toast) toast(err.message, 'error'); }
      finally { likeBtn.disabled = false; }
    }
  });
})();
