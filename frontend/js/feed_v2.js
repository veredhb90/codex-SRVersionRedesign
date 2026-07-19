// ── Feed Logic ─────────────────────────────────────────────────────
(function () {
  if (!Auth.require()) return;
  const u = Auth.user();
  document.querySelectorAll('.nav-username').forEach(el => el.textContent = u?.fullName || '');

  let currentTab = 'all', page = 1, loading = false;
  const feedEl      = document.getElementById('feed-list');
  const loadMoreBtn = document.getElementById('load-more');

  // ── Socket.io ──────────────────────────────────────────────
  const socket = io();

  // Authenticate socket — send auth on connect and reconnect
  const _myId = Auth.userId();
  function sendSocketAuth() {
    if (_myId) {
      socket.emit('auth', _myId);
      console.log('🔌 Socket auth sent, userId:', _myId);
    }
  }
  sendSocketAuth();
  socket.on('connect', sendSocketAuth);       // re-auth on reconnect
  socket.on('reconnect', sendSocketAuth);

  // Store globally and dispatch
  window._srSocket = socket;
  window.dispatchEvent(new CustomEvent('sr:socket_ready', { detail: socket }));

  socket.on('recommendation:new', (rec) => {
    if (currentTab !== 'all') return;
    feedEl.insertAdjacentHTML('afterbegin', buildCard(rec));
    pulseCard(feedEl.querySelector(`[data-recid="${rec._id}"]`));
    toast(`📡 @${rec.user?.username||rec.user?.fullName||'trader'} posted ${rec.direction} on $${rec.symbol}`, 'info', 4000);
    updatePopular();
  });

  socket.on('recommendation:win', ({ recId, symbol, returnPct }) => {
    const card = feedEl.querySelector(`[data-recid="${recId}"]`);
    if (card) celebrateWin(card, symbol, returnPct);
    toast(`🏆 $${symbol} hit Take Profit! +${returnPct}%`, 'success', 6000);
  });

  socket.on('recommendation:loss', ({ recId, symbol }) => {
    const card = feedEl.querySelector(`[data-recid="${recId}"]`);
    if (card) {
      card.querySelector('.outcome-badge').className = 'outcome-badge badge-loss';
      card.querySelector('.outcome-badge').textContent = '💸 LOSS';
      card.classList.add('closed');
    }
    toast(`💸 $${symbol} hit Stop Loss`, 'error', 4000);
  });

  socket.on('recommendation:comment', ({ recId, comment }) => {
    const section = document.getElementById('comments-' + recId);
    if (section) appendComment(section, comment, recId);
  });

  // ── Tabs ───────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      page = 1; feedEl.innerHTML = '';
      loadFeed();
    });
  });

  // ── Load Feed ──────────────────────────────────────────────
  async function loadFeed() {
    if (loading) return;
    loading = true;
    if (page === 1) feedEl.innerHTML = '<div class="spinner"></div>';
    try {
      const recs = currentTab === 'all' ? await API.feedAll(page) : await API.feedFollowing();
      if (page === 1) feedEl.innerHTML = '';
      if (!recs.length && page === 1) {
        feedEl.innerHTML = `<div style="text-align:center;color:var(--muted);padding:60px 20px;">
          <div style="font-size:40px;margin-bottom:12px;">📭</div>
          <p>${currentTab==='following'?'Follow traders to see their calls here.':'No recommendations yet.'}</p>
        </div>`;
        loadMoreBtn && (loadMoreBtn.style.display = 'none'); return;
      }
      recs.forEach((r, i) => {
        feedEl.insertAdjacentHTML('beforeend', buildCard(r));
        // Staggered entrance animation
        setTimeout(() => {
          const card = feedEl.querySelector(`[data-recid="${r._id}"]`);
          if (card) card.style.animation = 'cardEntrance 0.4s ease forwards';
        }, i * 60);
      });
      loadMoreBtn && (loadMoreBtn.style.display = recs.length < 20 ? 'none' : 'flex');
      page++;
    } catch (err) {
      feedEl.innerHTML = `<p style="color:var(--red);text-align:center;padding:40px;">${err.message}</p>`;
    } finally { loading = false; }
  }

  loadMoreBtn?.addEventListener('click', () => currentTab === 'all' && loadFeed());

  // ── Event delegation ───────────────────────────────────────
  async function showLikesList(recId) {
    try {
      const likesRes = await fetch('/api/recommendations/' + recId + '/likes', { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sr_token') || '') } });
      if (!likesRes.ok) throw new Error('Could not load likes');
      const users = await likesRes.json();
      const oldM = document.getElementById('sr-likes-modal');
      if (oldM) oldM.remove();
      const m = document.createElement('div');
      m.id = 'sr-likes-modal';
      m.style.cssText = 'position:fixed;inset:0;z-index:25000;background:rgba(8,15,36,0.6);display:flex;align-items:center;justify-content:center;padding:20px;';
      const items = users.length
        ? users.map(u => '<a href="/profile.html?id=' + u._id + '" style="display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid #EEF3FB;text-decoration:none;color:#1A2540;"><span style="width:32px;height:32px;border-radius:50%;background:#1565C0;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">' + (u.username||u.fullName||'?').charAt(0).toUpperCase() + '</span><span style="font-weight:600;">@' + (u.username||u.fullName) + '</span></a>').join('')
        : '<div style="text-align:center;color:#94a3b8;padding:16px;">No likes yet</div>';
      m.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:340px;width:100%;max-height:70vh;overflow-y:auto;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,0.3);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong style="color:#0D2244;">&#10084;&#65039; Liked by</strong><button id="sr-likes-close" style="background:none;border:none;font-size:16px;cursor:pointer;color:#94a3b8;">&#10005;</button></div>' + items + '</div>';
      m.addEventListener('click', function(ev) { if (ev.target === m || ev.target.id === 'sr-likes-close') m.remove(); });
      document.body.appendChild(m);
    } catch (err) { toast(err.message, 'error'); }
  }

  feedEl.addEventListener('click', async (e) => {
    // Reply to a comment — prefill @username
    const replyBtn = e.target.closest('.comment-reply-btn');
    if (replyBtn) {
      const rid = replyBtn.dataset.rec;
      const input = document.getElementById('comment-input-' + rid);
      if (input) {
        if (input.offsetParent === null) {
          const card = replyBtn.closest('.rec-card');
          const tog = card && card.querySelector('.comment-toggle');
          if (tog) tog.click();
        }
        setTimeout(() => {
          input.value = '@' + replyBtn.dataset.username + ' ';
          input.focus();
          input.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 120);
      }
      return;
    }

    // Who liked — click the count number
    const likeCountEl = e.target.closest('.like-count');
    if (likeCountEl) {
      const b = likeCountEl.closest('.like-btn');
      if (b) showLikesList(b.dataset.id);
      return;
    }
    // Like
    const likeBtn = e.target.closest('.like-btn');
    if (likeBtn) {
      try {
        const res = await API.likeRec(likeBtn.dataset.id);
        likeBtn.querySelector('.like-count').textContent = res.likes;
        likeBtn.classList.toggle('liked');
        likeBtn.style.animation = 'heartPop 0.3s ease';
        setTimeout(() => likeBtn.style.animation = '', 300);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    // Comment toggle
    const commentToggle = e.target.closest('.comment-toggle');
    if (commentToggle) {
      const section = document.getElementById('comments-' + commentToggle.dataset.id);
      if (section) {
        const isOpen = section.style.display !== 'none';
        section.style.display = isOpen ? 'none' : 'block';
        commentToggle.classList.toggle('active', !isOpen);
      }
      return;
    }

    // Comment submit
    const commentSubmit = e.target.closest('.comment-submit');
    if (commentSubmit) {
      const recId   = commentSubmit.dataset.id;
      const input   = document.getElementById('comment-input-' + recId);
      const text    = input?.value?.trim();
      if (!text) return;
      try {
        const comment = await API.postComment(recId, text);
        const section = document.getElementById('comments-' + recId);
        appendComment(section, comment, recId);
        input.value = '';
        const count = document.querySelector(`[data-recid="${recId}"] .comment-count`);
        if (count) count.textContent = parseInt(count.textContent||0) + 1;
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    // Symbol click → open modal
    const symClick = e.target.closest('.rec-symbol-link');
    if (symClick) { openSymbolModal(symClick.dataset.symbol); return; }

    // Repost / Undo Repost toggle
    const repostBtn = e.target.closest('.repost-btn');
    if (repostBtn) {
      const id         = repostBtn.dataset.id;
      const isReposted = repostBtn.dataset.reposted === 'true';

      if (isReposted) {
        // Undo repost directly
        repostBtn.disabled = true;
        repostBtn.textContent = 'Undoing…';
        try {
          await API.undoRepost(id);
          repostBtn.dataset.reposted = 'false';
          repostBtn.textContent = '↩ Repost';
          repostBtn.style.color = '';
          repostBtn.style.borderColor = '';
          toast('Repost removed from your profile', 'info');
        } catch (err) {
          toast(err.message, 'error');
          repostBtn.textContent = '✓ Undo Repost';
        } finally {
          repostBtn.disabled = false;
        }
      } else {
        // Show repost modal with comment input
        showRepostModal(id, repostBtn);
      }
      return;
    }

    // Share
    const shareBtn = e.target.closest('.share-rec-btn');
    if (shareBtn) {
      const card  = shareBtn.closest('[data-recid]');
      const text  = `📊 ${card.dataset.dir} $${card.dataset.symbol} | Entry: $${Number(card.dataset.entry).toFixed(2)} | TP: $${card.dataset.tp} | SL: $${card.dataset.sl||'N/A'} via SwingRush`;
      if (navigator.share) navigator.share({ title: `SwingRush: ${card.dataset.dir} $${card.dataset.symbol}`, text, url: location.origin }).catch(()=>{});
      else { navigator.clipboard.writeText(text + '\n' + location.origin); toast('📋 Copied to clipboard!', 'success'); }
      return;
    }
  });

  // ── Popular Today ──────────────────────────────────────────
  async function updatePopular() {
    const el = document.getElementById('popular-list');
    if (!el) return;
    try {
      const data = await API.popular();
      el.innerHTML = data.map(item => {
        const buyPct  = item.count > 0 ? Math.round((item.buys  / item.count) * 100) : 0;
        const sellPct = 100 - buyPct;
        return `<div class="popular-item" onclick="openSymbolModal('${item._id}')" style="cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span class="popular-sym">${item._id}</span>
            <span style="font-size:12px;color:var(--muted);">${item.count} calls</span>
          </div>
          <div class="sentiment-bar">
            <div class="sentiment-buy"  style="width:${buyPct}%;">${buyPct>15?buyPct+'%':''}</div>
            <div class="sentiment-sell" style="width:${sellPct}%;">${sellPct>15?sellPct+'%':''}</div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px;">
            <span style="color:var(--green);">▲ ${item.buys} BUY</span>
            <span style="color:var(--red);">▼ ${item.sells} SELL</span>
          </div>
        </div>`;
      }).join('') || '<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">No calls today yet</p>';
    } catch (_) {}
  }
  updatePopular();
  setInterval(updatePopular, 60000);

  // ── Dynamic Market Overview ────────────────────────────────
  const MARKET_POOLS = [
    ['SPY','QQQ','AAPL','NVDA','TSLA','MSFT','AMZN','META','NFLX','AMD'],
    ['GOLD','SILVER','OIL','NATGAS','BTC-USD','ETH-USD','JPM','GS','BABA','COIN'],
  ];
  let marketPool = 0;

  async function updateMarket() {
    const el = document.getElementById('mkt-overview');
    if (!el) return;
    const syms = MARKET_POOLS[marketPool % 2];
    marketPool++;
    try {
      const results = await Promise.allSettled(syms.slice(0,8).map(s => API.quote(s)));
      el.innerHTML = results.map((r,i) => {
        if (r.status !== 'fulfilled') return '';
        const q = r.value; const up = (q.changePct||0) >= 0;
        return `<div class="mkt-row" onclick="openSymbolModal('${syms[i]}')" style="cursor:pointer;" title="View all ${syms[i]} calls">
          <span class="mkt-sym">${q.symbol}</span>
          <span class="mkt-px">$${(q.price||0).toFixed(2)}</span>
          <span class="mkt-chg" style="color:${up?'var(--green)':'var(--red)'};">${up?'▲':'▼'}${Math.abs(q.changePct||0).toFixed(2)}%</span>
        </div>`;
      }).join('');
    } catch (_) {}
  }
  updateMarket();
  setInterval(updateMarket, 30000);

  // ── Live price refresh every 30 seconds ──────────────────────
  async function refreshLivePrices() {
    const cards  = [...feedEl.querySelectorAll('[data-recid]')];
    const symMap = {};
    cards.forEach(c => {
      if (c.dataset.symbol && c.dataset.isopen !== 'false') {
        if (!symMap[c.dataset.symbol]) symMap[c.dataset.symbol] = [];
        symMap[c.dataset.symbol].push(c);
      }
    });
    for (const [sym, els] of Object.entries(symMap)) {
      try {
        const q = await API.quote(sym);
        els.forEach(card => {
          // Update live price
          const liveEl = card.querySelector('.live-price');
          if (liveEl) {
            const oldPrice = parseFloat(liveEl.textContent.replace(/[^0-9.]/g,''));
            const newPrice = q.price;
            liveEl.textContent = fmtPrice(newPrice);
            liveEl.style.color = (q.changePct||0)>=0?'var(--green2)':'var(--red2)';
            // Flash animation on price change
            if (oldPrice && oldPrice !== newPrice) {
              liveEl.style.transition = 'background 0.3s';
              liveEl.style.background = newPrice > oldPrice ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)';
              setTimeout(() => { liveEl.style.background = 'transparent'; }, 600);
            }
          }
          // Update change %
          const chgEl = card.querySelector('.live-change');
          if (chgEl && q.changePct !== undefined) {
            const pct = q.changePct || 0;
            chgEl.textContent = (pct>=0?'▲':'▼') + ' ' + Math.abs(pct).toFixed(2) + '%';
            chgEl.style.color = pct>=0?'var(--green2)':'var(--red2)';
          }
          // Update return %
          const retEl = card.querySelector('.live-return');
          if (retEl) {
            const entry = parseFloat(card.dataset.entry);
            const dir   = card.dataset.direction;
            if (entry && dir) {
              const ret = dir==='BUY'
                ? ((q.price - entry) / entry * 100)
                : ((entry - q.price) / entry * 100);
              retEl.textContent = (ret>=0?'+':'') + ret.toFixed(2) + '%';
              retEl.style.color = ret>=0?'var(--green)':'var(--red)';
              retEl.style.fontWeight = '700';
            }
          }
        });
      } catch (_) {}
    }
  }
  refreshLivePrices(); // run immediately on load
  setInterval(refreshLivePrices, 30000); // then every 30s

  loadFeed();
  window.updatePopular = updatePopular;
})();

// ── Symbol Modal ───────────────────────────────────────────────────
async function openSymbolModal(symbol) {
  let modal = document.getElementById('symbol-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'symbol-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeSymbolModal()"></div>
      <div class="modal-box">
        <div class="modal-header">
          <div>
            <div class="modal-sym" id="modal-sym-name"></div>
            <div class="modal-price" id="modal-sym-price"></div>
          </div>
          <button onclick="closeSymbolModal()" class="modal-close">✕</button>
        </div>
        <div id="modal-stats" class="modal-stats"></div>
        <div id="modal-chart" class="modal-chart"></div>
        <div id="modal-recs" class="modal-recs"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-sym-name').textContent = symbol;
  document.getElementById('modal-sym-price').textContent = 'Loading…';
  document.getElementById('modal-stats').innerHTML = '<div class="spinner"></div>';
  document.getElementById('modal-recs').innerHTML = '';

  try {
    const [data, quote] = await Promise.all([API.symbolRecs(symbol), API.quote(symbol).catch(() => null)]);
    const { stats, recommendations } = data;

    if (quote) {
      const up = (quote.changePct||0) >= 0;
      document.getElementById('modal-sym-price').innerHTML =
        `<span style="font-family:var(--font-mono);font-size:22px;">$${quote.price.toFixed(2)}</span>
         <span style="color:${up?'var(--green)':'var(--red)'};font-size:14px;margin-left:8px;">${up?'▲':'▼'}${Math.abs(quote.changePct||0).toFixed(2)}%</span>`;
    }

    const openRecsForSent = recommendations.filter(r => r.outcome === 'OPEN');
    const openBuysCt  = openRecsForSent.filter(r => r.direction === 'BUY').length;
    const openTotalCt = openRecsForSent.length;
    const buyPct  = openTotalCt > 0 ? Math.round((openBuysCt / openTotalCt) * 100) : 0;
    const sellPct = openTotalCt > 0 ? 100 - buyPct : 0;

    document.getElementById('modal-stats').innerHTML = `
      <div class="modal-stat-grid">
        <div class="modal-stat"><div class="ms-val">${stats.total}</div><div class="ms-lbl">Total Calls</div></div>
        <div class="modal-stat"><div class="ms-val c-green">${stats.buys}</div><div class="ms-lbl">BUY</div></div>
        <div class="modal-stat"><div class="ms-val c-red">${stats.sells}</div><div class="ms-lbl">SELL</div></div>
        <div class="modal-stat"><div class="ms-val">${stats.winRate}%</div><div class="ms-lbl">Win Rate</div></div>
      </div>
      <div style="margin:16px 0 8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;">Market Sentiment</div>
      <div class="sentiment-bar" style="height:28px;border-radius:8px;overflow:hidden;font-size:13px;">
        <div class="sentiment-buy"  style="width:${buyPct}%;height:100%;display:flex;align-items:center;justify-content:center;">${buyPct}% BUY</div>
        <div class="sentiment-sell" style="width:${sellPct}%;height:100%;display:flex;align-items:center;justify-content:center;">${sellPct}% SELL</div>
      </div>`;

    // Draw donut chart
    drawDonut(buyPct, sellPct);

    // Recommendations list with filters + totals
    window._modalRecs = recommendations;
    const openBuys  = recommendations.filter(r => r.outcome==='OPEN' && r.direction==='BUY').length;
    const openSells = recommendations.filter(r => r.outcome==='OPEN' && r.direction==='SELL').length;
    const closedTP  = recommendations.filter(r => r.outcome==='WIN').length;
    const closedSL  = recommendations.filter(r => r.outcome==='LOSS').length;
    document.getElementById('modal-recs').innerHTML =
      `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 12px;font-size:11.5px;font-weight:700;">
        <span style="background:#E3F8EC;color:#00893E;border-radius:10px;padding:4px 11px;">▲ ${openBuys} OPEN BUY</span>
        <span style="background:#FFEBEE;color:#C62828;border-radius:10px;padding:4px 11px;">▼ ${openSells} OPEN SELL</span>
        <span style="background:#E8F5E9;color:#2E7D32;border-radius:10px;padding:4px 11px;">🎯 ${closedTP} HIT TP</span>
        <span style="background:#FBE9E7;color:#BF360C;border-radius:10px;padding:4px 11px;">🛑 ${closedSL} HIT SL</span>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <button class="sr-mf" data-f="all" onclick="renderModalRecs('all')">All</button>
        <button class="sr-mf" data-f="open" onclick="renderModalRecs('open')">● Open</button>
        <button class="sr-mf" data-f="closed" onclick="renderModalRecs('closed')">✓ Closed</button>
      </div>
      <div id="modal-recs-list"></div>`;
    renderModalRecs('all');
  } catch (err) {
    document.getElementById('modal-stats').innerHTML = `<p style="color:var(--red);">${err.message}</p>`;
  }
}

function drawDonut(buyPct, sellPct) {
  const el = document.getElementById('modal-chart');
  if (!el) return;
  const r = 54, cx = 80, cy = 80, stroke = 16, w = 160, h = 160;
  const circ    = 2 * Math.PI * r;
  const buyDash  = (buyPct  / 100) * circ;
  const sellDash = (sellPct / 100) * circ;
  el.innerHTML = `
    <svg width="${w}" height="${h}" style="display:block;margin:0 auto;">
      <!-- Full red ring (SELL background) -->
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--red)" stroke-width="${stroke}" opacity="0.85"/>
      <!-- Green arc on top (BUY) -->
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--green)" stroke-width="${stroke}"
        stroke-dasharray="${buyDash} ${circ}"
        stroke-dashoffset="${circ/4}"
        stroke-linecap="butt"
        style="transition:stroke-dasharray 1.2s ease;"/>
      <!-- Center: BUY % -->
      <text x="${cx}" y="${cy-14}" text-anchor="middle"
        font-family="Bebas Neue,sans-serif" font-size="26"
        fill="var(--green)" font-weight="900">${buyPct}%</text>
      <text x="${cx}" y="${cy+2}" text-anchor="middle"
        font-family="DM Sans,sans-serif" font-size="10"
        fill="var(--green)">BUY</text>
      <!-- Divider -->
      <line x1="${cx-18}" y1="${cy+10}" x2="${cx+18}" y2="${cy+10}"
        stroke="var(--border)" stroke-width="1"/>
      <!-- Center: SELL % -->
      <text x="${cx}" y="${cy+24}" text-anchor="middle"
        font-family="Bebas Neue,sans-serif" font-size="20"
        fill="var(--red)" font-weight="900">${sellPct}%</text>
      <text x="${cx}" y="${cy+38}" text-anchor="middle"
        font-family="DM Sans,sans-serif" font-size="10"
        fill="var(--red)">SELL</text>
    </svg>`;
}

function closeSymbolModal() {
  const modal = document.getElementById('symbol-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Comment helpers ────────────────────────────────────────────────
function threadComments(comments) {
  const items = (comments || []).map(c => {
    const m = String(c.text || '').match(/^@([a-zA-Z0-9_.\-]+)\s+([\s\S]*)$/);
    return { c: c, mention: m ? m[1].toLowerCase() : null, children: [], depth: 0 };
  });
  const authorOf = it => String(it.c.user?.username || it.c.user?.fullName || '').toLowerCase();
  const roots = [];
  items.forEach((it, idx) => {
    let parent = null;
    if (it.mention) {
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
}

function renderCommentHtml(c, recId, depth) {
  const uname  = c.user?.username ? '@' + c.user.username : (c.user?.fullName || 'Trader');
  const dataU  = c.user?.username || c.user?.fullName || 'Trader';
  const text   = String(c.text || '');
  const m      = text.match(/^@([a-zA-Z0-9_.\-]+)\s+([\s\S]*)$/);
  const ind    = 22 * Math.min(Math.max(depth || (m ? 1 : 0), m ? 1 : 0), 2);
  const replyBtn = `<button class="comment-reply-btn" data-username="${dataU}" data-rec="${recId}" style="background:none;border:none;color:var(--accent2);font-size:11px;cursor:pointer;margin-left:8px;font-weight:700;">↩ Reply</button>`;
  const userLink = c.user?._id
    ? `<a href="/profile.html?id=${c.user._id}" style="color:var(--accent2);font-weight:700;font-size:13px;text-decoration:none;">${uname}</a>`
    : `<strong style="color:var(--accent2);font-size:13px;">${uname}</strong>`;
  if (m) {
    return `<div class="comment-item comment-reply" data-author="${dataU.toLowerCase()}" style="margin-left:${ind}px;border-left:2.5px solid var(--accent2);padding:6px 10px;background:rgba(21,101,192,0.05);border-radius:0 10px 10px 0;margin-top:4px;">
      <div style="font-size:10.5px;color:var(--muted);margin-bottom:2px;">↩ Reply to <span style="color:var(--accent2);font-weight:700;">@${m[1]}</span></div>
      ${userLink}
      <span style="font-size:13px;color:var(--text2);margin-left:8px;">${m[2]}</span>
      <span style="font-size:11px;color:var(--muted);margin-left:8px;">${timeAgo(c.createdAt||new Date())}</span>
      ${replyBtn}
    </div>`;
  }
  return `<div class="comment-item" data-author="${dataU.toLowerCase()}">
      ${userLink}
      <span style="font-size:13px;color:var(--text2);margin-left:8px;">${text}</span>
      <span style="font-size:11px;color:var(--muted);margin-left:8px;">${timeAgo(c.createdAt||new Date())}</span>
      ${replyBtn}
    </div>`;
}

function appendComment(section, comment, recId) {
  const list = section.querySelector('.comment-list');
  if (!list) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = renderCommentHtml(comment, recId);
  const div = wrap.firstElementChild;
  const mm = String(comment.text || '').match(/^@([a-zA-Z0-9_.\-]+)\s/);
  let placed = false;
  if (mm) {
    const kin = list.querySelectorAll('[data-author="' + mm[1].toLowerCase() + '"]');
    if (kin.length) { kin[kin.length - 1].insertAdjacentElement('afterend', div); placed = true; }
  }
  if (!placed) list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

// ── Pulse animation ────────────────────────────────────────────────
function pulseCard(card) {
  if (!card) return;
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'newCardPulse 1s ease';
}

// ── Win celebration ────────────────────────────────────────────────
function celebrateWin(card, symbol, returnPct) {
  card.classList.add('win-flash', 'closed');
  const badge = card.querySelector('.outcome-badge');
  if (badge) { badge.className = 'outcome-badge badge-win'; badge.textContent = '🏆 WIN'; }
  const retEl = card.querySelector('.rec-return');
  if (retEl && returnPct) { retEl.textContent = '+' + returnPct + '%'; retEl.style.color = 'var(--green)'; }
  const burst = document.createElement('div');
  burst.className = 'confetti-burst';
  const colors = ['#00e676','#69f0ae','#ffab00','#ffffff','#00c853','#ff1744'];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*50}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:${Math.random()*.6}s;animation-duration:${1+Math.random()*0.8}s;width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;`;
    burst.appendChild(p);
  }
  card.appendChild(burst);
  setTimeout(() => burst.remove(), 2800);
}

// ── Repost Modal ──────────────────────────────────────────────────
function showRepostModal(recId, btn) {
  // Remove existing modal if any
  document.getElementById('repost-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'repost-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:700;
    background:rgba(8,15,36,0.6);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px;width:100%;max-width:460px;
                box-shadow:0 24px 80px rgba(0,0,0,0.3);animation:modalIn .25s ease;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div style="font-family:var(--font-disp);font-size:20px;letter-spacing:1px;color:var(--accent);">↩ REPOST</div>
        <button onclick="document.getElementById('repost-modal').remove();document.body.style.overflow='';"
                style="width:28px;height:28px;border-radius:50%;border:none;background:var(--bg2);cursor:pointer;font-size:14px;color:var(--muted);">✕</button>
      </div>
      <p style="color:var(--muted);font-size:13px;margin-bottom:18px;">
        Add your comment or analysis on this recommendation. It will appear on your profile for others to see.
      </p>
      <textarea id="repost-comment" placeholder="Share your thoughts on this call… (optional)"
        style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:9px;
               font-family:var(--font-body);font-size:14px;resize:vertical;min-height:90px;
               outline:none;transition:border-color .2s;background:var(--bg2);"
        maxlength="280"
        onfocus="this.style.borderColor='var(--accent2)';this.style.background='#fff';"
        onblur="this.style.borderColor='var(--border)';"></textarea>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;text-align:right;" id="repost-char-count">0/280</div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button onclick="document.getElementById('repost-modal').remove();document.body.style.overflow='';"
                style="flex:1;padding:11px;border:1.5px solid var(--border);border-radius:8px;
                       background:transparent;cursor:pointer;font-family:var(--font-body);font-weight:700;color:var(--muted);">
          Cancel
        </button>
        <button id="repost-confirm-btn"
                style="flex:2;padding:11px;border:none;border-radius:8px;
                       background:var(--accent);color:#fff;cursor:pointer;
                       font-family:var(--font-body);font-weight:700;font-size:14px;">
          ↩ Repost to Profile
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  // Char counter
  const textarea = modal.querySelector('#repost-comment');
  const counter  = modal.querySelector('#repost-char-count');
  textarea.addEventListener('input', () => {
    counter.textContent = textarea.value.length + '/280';
  });
  textarea.focus();

  // Close on backdrop
  modal.addEventListener('click', e => {
    if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
  });

  // Confirm
  modal.querySelector('#repost-confirm-btn').addEventListener('click', async () => {
    const comment = textarea.value.trim();
    const confirmBtn = modal.querySelector('#repost-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Reposting…';
    try {
      await API.repost(recId, comment);
      modal.remove();
      document.body.style.overflow = '';
      // Update the button
      if (btn) {
        btn.dataset.reposted = 'true';
        btn.textContent = '✓ Undo Repost';
        btn.style.color = 'var(--green)';
        btn.style.borderColor = 'var(--green)';
      }
      toast('↩ Reposted to your profile!', 'success');
    } catch (err) {
      toast(err.message, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '↩ Repost to Profile';
    }
  });
}

// ── Asset type ─────────────────────────────────────────────────────
function getAssetType(symbol) {
  const s = symbol.toUpperCase();
  if (['GOLD','SILVER','OIL','NATGAS','PLATINUM','XAU','XAG','GC=F','CL=F','SI=F','NG=F','BRENT','WTI'].some(x => s.includes(x))) return 'commodity';
  if (['BTC','ETH','XRP','SOL','DOGE','BINANCE:','BNB'].some(x => s.includes(x))) return 'crypto';
  if (['SPY','QQQ','DIA','IWM','GLD','SLV','USO'].includes(s)) return 'etf';
  return 'stock';
}
function assetTag(symbol) {
  const type = getAssetType(symbol);
  const labels = { stock:'📈 Stock', commodity:'🥇 Commodity', crypto:'₿ Crypto', etf:'📊 ETF' };
  return `<span class="asset-tag asset-${type}">${labels[type]}</span>`;
}

// ── Card builder ───────────────────────────────────────────────────
// ── Floating particles in feed ─────────────────────────────────────
function spawnParticle(x, y, color) {
  const p = document.createElement('div');
  p.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:6px;height:6px;border-radius:50%;background:${color};left:${x}px;top:${y}px;animation:particleFly 1.2s ease-out forwards;`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1200);
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('.rec-card');
  if (!card) return;
  const isBuy = card.classList.contains('buy');
  const color = isBuy ? '#00e676' : '#ff1744';
  for (let i = 0; i < 5; i++) {
    setTimeout(() => spawnParticle(
      e.clientX + (Math.random()-0.5)*40,
      e.clientY + (Math.random()-0.5)*40,
      color
    ), i * 60);
  }
});

function buildCard(r) {
  const isBuy    = r.direction === 'BUY';
  const isClosed = !r.isOpen;
  const isWin    = r.outcome === 'WIN';
  const isLoss   = r.outcome === 'LOSS';
  const retColor = (r.returnPct||0) >= 0 ? 'var(--green)' : 'var(--red)';
  const outcomeBadge = isClosed
    ? (isWin ? '<span class="outcome-badge badge-win">🏆 WIN</span>' : '<span class="outcome-badge badge-loss">💸 LOSS</span>')
    : '<span class="outcome-badge badge-open">● OPEN</span>';

  const commentsHtml = threadComments(r.comments||[]).map(t => renderCommentHtml(t.c, r._id, t.depth)).join('');

  return `
  <div class="rec-card ${isBuy?'buy':'sell'} ${isClosed?'closed':''} ${isWin?'win-flash':''}"
       data-recid="${r._id}" data-symbol="${r.symbol}"
       data-tp="${r.takeProfit}" data-sl="${r.stopLoss||0}"
       data-entry="${r.entryPrice}" data-direction="${r.direction}"
       data-isopen="${r.isOpen?'true':'false'}">
    <div class="rec-header">
      <div>
        <div class="rec-symbol rec-symbol-link" data-symbol="${r.symbol}" style="cursor:pointer;" title="View all ${r.symbol} calls">${r.symbol}</div>
        ${r.companyName?`<div class="rec-company">${r.companyName}</div>`:''}
      </div>
      ${assetTag(r.symbol)}
      <span class="${isBuy?'badge-buy':'badge-sell'}">${isBuy?'▲':'▼'} ${r.direction}</span>
      ${outcomeBadge}
      ${r.source === 'engine' ? '<span style="font-size:10px;background:#e8f0fe;color:#1565c0;padding:2px 7px;border-radius:4px;font-weight:700;letter-spacing:.5px;">⚡ ENGINE</span>' : ''}
      ${r.source === 'repost' ? '<span style="font-size:10px;background:#f3e5f5;color:#7b1fa2;padding:2px 7px;border-radius:4px;font-weight:700;letter-spacing:.5px;">↩ REPOST</span>' : ''}
      <div class="rec-time">${timeAgo(r.createdAt)}</div>
    </div>
    <div class="rec-user" style="margin-bottom:12px;">
      by <strong><a href="/profile.html?id=${r.user?._id || r.user}" style="color:var(--accent2);text-decoration:none;">@${r.user?.username || r.user?.fullName || 'trader'}</a></strong>
    </div>
    <div class="rec-prices">
      <div class="price-block">
        <div class="price-val">${fmtPrice(r.entryPrice)}</div>
        <div class="price-lbl">Entry</div>
      </div>
      <div class="price-block">
        <div class="price-val tp-val">${fmtPrice(r.takeProfit)}</div>
        <div class="price-lbl">Take Profit</div>
      </div>
      <div class="price-block">
        <div class="price-val sl-val">${r.stopLoss?fmtPrice(r.stopLoss):'—'}</div>
        <div class="price-lbl">Stop Loss</div>
      </div>
    </div>
    <div class="rec-footer">
      ${r.isOpen ? `<span class="live-price-tag">Live: <span class="live-price" style="font-weight:700;font-family:var(--font-mono);border-radius:4px;padding:1px 4px;">${fmtPrice(r.currentPrice||r.entryPrice)}</span>
        <span class="live-change" style="font-size:11px;color:var(--muted);margin-left:4px;"></span>
      </span>` : `<span class="live-price-tag">${r.outcome==='WIN'?'🎯 Hit TP':'🛑 Hit SL'} @ <span style="font-weight:700;font-family:var(--font-mono);color:${r.outcome==='WIN'?'var(--green)':'var(--red)'};">${fmtPrice(r.outcome==='WIN'?r.takeProfit:(r.stopLoss||r.currentPrice))}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:4px;">${r.closedAt?new Date(r.closedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+' · '+new Date(r.closedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):''}</span>
      </span>`}
      <span class="live-return" style="color:${retColor};font-family:var(--font-mono);font-size:13px;font-weight:700;">${r.isOpen?(r.returnPct?fmtPct(r.returnPct):'—'):(r.returnPct?fmtPct(r.returnPct):'—')}</span>
      <button class="btn btn-sm btn-outline like-btn" data-id="${r._id}" style="margin-left:auto;">♥ <span class="like-count" title="See who liked" style="cursor:pointer;">${r.likes?.length||0}</span></button>
      <button class="btn btn-sm btn-ghost comment-toggle" data-id="${r._id}">💬 <span class="comment-count">${r.comments?.length||0}</span></button>
      <button class="share-rec-btn">↗ Share</button>
      ${(() => {
        const me = Auth.user();
        if (!me || r.user?._id === me.id) return '';
        const alreadyReposted = r.repostedBy && r.repostedBy.includes(me.id);
        const label = alreadyReposted ? '✓ Undo Repost' : '↩ Repost';
        const style = alreadyReposted ? 'color:var(--green);border-color:var(--green);' : '';
        return `<button class="repost-btn btn btn-sm btn-outline" data-id="${r._id}" data-reposted="${alreadyReposted}" style="font-size:12px;${style}">${label}</button>`;
      })()}
    </div>
    ${r.note?`<div class="rec-note">"${r.note}"</div>`:''}
    <div id="comments-${r._id}" class="comments-section" style="display:none;">
      <div class="comment-list">${commentsHtml}</div>
      <div class="comment-input-row">
        <input id="comment-input-${r._id}" type="text" class="comment-input" placeholder="Add a comment… (recommend, analyze, discuss)" maxlength="500"/>
        <button class="btn btn-primary btn-sm comment-submit" data-id="${r._id}">Post</button>
      </div>
    </div>
  </div>`;
}

window.buildCard          = buildCard;
window.celebrateWin       = celebrateWin;
window.assetTag           = assetTag;
window.openSymbolModal    = openSymbolModal;
window.closeSymbolModal   = closeSymbolModal;


// Auto-refresh Hot Stocks every 60s
setInterval(function() { try { updatePopular(); } catch(e) {} }, 60000);

// ── ⚡ Happening Now — live platform activity (left panel) ─────────
(function() {
  function boot() {
    // Find the Signal Engine card by its text - insert our cards ABOVE it, in the same column
    var all = document.body.getElementsByTagName('*');
    var host = document.querySelector('aside.sidebar-left');
    if (!host) return;
    var rail = document.createElement('div');
    rail.id = 'sr-left-rail';
    rail.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-bottom:14px;width:100%;';
    rail.innerHTML = '<style>' +
      '@keyframes srActIn{from{opacity:0;transform:translateX(-14px);}to{opacity:1;transform:translateX(0);}}' +
      '@keyframes srPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,0.5);}50%{box-shadow:0 0 0 5px rgba(0,230,118,0);}}' +
      '.sr-rail-card{background:#fff;border:1.5px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 18px rgba(13,71,161,0.07);max-height:300px;}' +
      '.sr-rail-head{background:#0D2244;padding:10px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;}' +
      '.sr-rail-body{overflow-y:auto;flex:1;}' +
      '.sr-act-item{display:flex;gap:9px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid #F0F5FC;cursor:pointer;font-size:12px;line-height:1.45;color:#1A2540;}' +
      '.sr-act-item:hover{background:#F5F9FF;}' +
      '.sr-act-item.fresh{animation:srActIn .45s ease;background:#F0FFF6;}' +
      '.sr-act-ic{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}' +
      '.sr-act-time{font-size:10px;color:#94A3B8;margin-top:1px;}' +
      '.sr-news-item{display:block;padding:9px 12px;border-bottom:1px solid #F0F5FC;cursor:pointer;text-decoration:none;}' +
      '.sr-news-item:hover{background:#F5F9FF;}' +
      '.sr-news-h{font-size:12px;color:#1A2540;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.sr-news-m{font-size:10px;color:#94A3B8;margin-top:3px;}' +
      '</style>' +
      '<div class="sr-rail-card">' +
        '<div class="sr-rail-head"><span style="width:8px;height:8px;border-radius:50%;background:#00E676;animation:srPulse 1.6s infinite;"></span>' +
        '<span style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#fff;">HAPPENING NOW</span>' +
        '<span style="margin-left:auto;font-size:9px;color:#00E676;font-weight:700;letter-spacing:1px;">LIVE</span></div>' +
        '<div class="sr-rail-body" id="sr-activity-list"></div></div>' +
      '<div class="sr-rail-card">' +
        '<div class="sr-rail-head" style="background:#123a2b;"><span style="font-size:12px;">\ud83d\udcf0</span>' +
        '<span style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#fff;">MARKET NEWS</span>' +
        '<span style="margin-left:auto;font-size:9px;color:#7EE2B0;font-weight:700;letter-spacing:1px;">US</span></div>' +
        '<div class="sr-rail-body" id="sr-news-list"></div></div>';
    host.insertBefore(rail, host.firstChild);

    var known = new Set(); var firstLoad = true;
    function icBg(k){return k==='new'?'#E3F2FD':k==='tp'?'#E3F8EC':k==='sl'?'#FFEBEE':k==='reply'?'#EDE7F6':'#FFF8E1';}
    function aIcon(k){return k==='new'?'\ud83d\udce1':k==='tp'?'\ud83c\udfaf':k==='sl'?'\ud83d\uded1':k==='reply'?'\u21a9\ufe0f':'\ud83d\udcac';}
    function ago(t){var s=Math.max(1,Math.floor((Date.now()-new Date(t).getTime())/1000));if(s<60)return s+'s ago';var m2=Math.floor(s/60);if(m2<60)return m2+'m ago';var h=Math.floor(m2/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago';}
    function aLabel(a){
      if(a.kind==='new')return '<b>@'+a.username+'</b> posted '+(a.direction==='BUY'?'\u25b2 BUY':'\u25bc SELL')+' $'+a.symbol;
      if(a.kind==='tp')return '<b>@'+a.username+'</b> $'+a.symbol+' hit TP \ud83c\udf89'+(a.returnPct?' <span style="color:var(--green);font-weight:700;">+'+a.returnPct+'%</span>':'');
      if(a.kind==='sl')return '<b>@'+a.username+'</b> $'+a.symbol+' hit SL'+(a.returnPct?' <span style="color:var(--red);font-weight:700;">'+a.returnPct+'%</span>':'');
      if(a.kind==='reply')return '<b>@'+a.username+'</b> replied on $'+a.symbol;
      return '<b>@'+a.username+'</b> commented on $'+a.symbol;
    }
    function keyOf(a){return a.kind+'|'+a.recId+'|'+(a.at||'')+'|'+(a.text||'');}
    async function loadActivity(){
      try{
        var res=await fetch('/api/recommendations/activity',{headers:{'Authorization':'Bearer '+(localStorage.getItem('sr_token')||'')}});
        if(!res.ok)return;
        var acts=await res.json();
        var list=document.getElementById('sr-activity-list');
        if(!list)return;
        list.innerHTML=acts.map(function(a){
          var fresh=!firstLoad&&!known.has(keyOf(a));
          known.add(keyOf(a));
          return '<div class="sr-act-item'+(fresh?' fresh':'')+'" onclick="location.href=\'/profile.html?id='+a.userId+'&rec='+a.recId+'\'">'+
            '<span class="sr-act-ic" style="background:'+icBg(a.kind)+';">'+aIcon(a.kind)+'</span>'+
            '<span style="flex:1;">'+aLabel(a)+
            (a.text?'<div style="color:#64748b;font-size:11px;font-style:italic;">&quot;'+a.text.replace(/</g,'&lt;')+'&quot;</div>':'')+
            '<div class="sr-act-time">'+(a.at?ago(a.at):'')+'</div></span></div>';
        }).join('')||'<div style="color:var(--muted);font-size:12px;padding:14px;">Nothing yet</div>';
        firstLoad=false;
      }catch(e){}
    }
    async function loadNews(){
      try{
        var res=await fetch('/api/stocks/news');
        if(!res.ok)return;
        var news=await res.json();
        var list=document.getElementById('sr-news-list');
        if(!list)return;
        list.innerHTML=news.map(function(n){
          return '<a class="sr-news-item" href="'+n.url+'" target="_blank" rel="noopener">'+
            '<div class="sr-news-h">'+String(n.headline||'').replace(/</g,'&lt;')+'</div>'+
            '<div class="sr-news-m">'+(n.source||'')+' \u00b7 '+(n.datetime?ago(n.datetime*1000):'')+'</div></a>';
        }).join('')||'<div style="color:var(--muted);font-size:12px;padding:14px;">No news</div>';
      }catch(e){}
    }
    loadActivity(); loadNews();
    setInterval(loadActivity,4000);
    setInterval(loadNews,5*60*1000);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot,400); });
  else setTimeout(boot,400);
})();


// ── Symbol modal v2: totals + [All|Open|Closed] filters ────────────
window.openSymbolModal = async function(symbol) {
  var modal = document.getElementById('symbol-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'symbol-modal';
    modal.innerHTML = '<div class="modal-backdrop" onclick="closeSymbolModal()"></div>' +
      '<div class="modal-box"><div class="modal-header"><div>' +
      '<div class="modal-sym" id="modal-sym-name"></div><div class="modal-price" id="modal-sym-price"></div></div>' +
      '<button onclick="closeSymbolModal()" class="modal-close">\u2715</button></div>' +
      '<div id="modal-stats" class="modal-stats"></div><div id="modal-chart" class="modal-chart"></div><div id="modal-recs" class="modal-recs"></div></div>';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('modal-sym-name').textContent = symbol;
  document.getElementById('modal-sym-price').textContent = 'Loading\u2026';
  document.getElementById('modal-stats').innerHTML = '<div class="spinner"></div>';
  document.getElementById('modal-recs').innerHTML = '';
  try {
    var results = await Promise.all([API.symbolRecs(symbol), API.quote(symbol).catch(function(){return null;})]);
    var data = results[0], quote = results[1];
    var stats = data.stats, recommendations = data.recommendations;
    if (quote) {
      var up = (quote.changePct||0) >= 0;
      document.getElementById('modal-sym-price').innerHTML =
        '<span style="font-family:var(--font-mono);font-size:22px;">$' + quote.price.toFixed(2) + '</span>' +
        '<span style="color:' + (up?'var(--green)':'var(--red)') + ';font-size:14px;margin-left:8px;">' + (up?'\u25b2':'\u25bc') + Math.abs(quote.changePct||0).toFixed(2) + '%</span>';
    }
    var openRecsForSent = recommendations.filter(function(r){return r.outcome==='OPEN';});
    var openBuysCt = openRecsForSent.filter(function(r){return r.direction==='BUY';}).length;
    var openTotalCt = openRecsForSent.length;
    var buyPct = openTotalCt > 0 ? Math.round((openBuysCt / openTotalCt) * 100) : 0;
    var sellPct = openTotalCt > 0 ? 100 - buyPct : 0;
    document.getElementById('modal-stats').innerHTML =
      '<div class="modal-stat-grid">' +
      '<div class="modal-stat"><div class="ms-val">' + stats.total + '</div><div class="ms-lbl">Total Calls</div></div>' +
      '<div class="modal-stat"><div class="ms-val c-green">' + stats.buys + '</div><div class="ms-lbl">BUY</div></div>' +
      '<div class="modal-stat"><div class="ms-val c-red">' + stats.sells + '</div><div class="ms-lbl">SELL</div></div>' +
      '<div class="modal-stat"><div class="ms-val">' + stats.winRate + '%</div><div class="ms-lbl">Win Rate</div></div></div>' +
      '<div style="margin:16px 0 8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;">Market Sentiment</div>' +
      '<div class="sentiment-bar" style="height:28px;border-radius:8px;overflow:hidden;font-size:13px;">' +
      '<div class="sentiment-buy" style="width:' + buyPct + '%;height:100%;display:flex;align-items:center;justify-content:center;">' + buyPct + '% BUY</div>' +
      '<div class="sentiment-sell" style="width:' + sellPct + '%;height:100%;display:flex;align-items:center;justify-content:center;">' + sellPct + '% SELL</div></div>';
    drawDonut(buyPct, sellPct);
    renderProEngineSection('modal-pro-section', 'modal-chart', symbol);
    window._modalRecs = recommendations;
    var oB = recommendations.filter(function(r){return r.outcome==='OPEN'&&r.direction==='BUY';}).length;
    var oS = recommendations.filter(function(r){return r.outcome==='OPEN'&&r.direction==='SELL';}).length;
    var cT = recommendations.filter(function(r){return r.outcome==='WIN';}).length;
    var cS = recommendations.filter(function(r){return r.outcome==='LOSS';}).length;
    document.getElementById('modal-recs').innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 12px;font-size:11.5px;font-weight:700;">' +
      '<span style="background:#E3F8EC;color:#00893E;border-radius:10px;padding:4px 11px;">\u25b2 ' + oB + ' OPEN BUY</span>' +
      '<span style="background:#FFEBEE;color:#C62828;border-radius:10px;padding:4px 11px;">\u25bc ' + oS + ' OPEN SELL</span>' +
      '<span style="background:#E8F5E9;color:#2E7D32;border-radius:10px;padding:4px 11px;">\ud83c\udfaf ' + cT + ' HIT TP</span>' +
      '<span style="background:#FBE9E7;color:#BF360C;border-radius:10px;padding:4px 11px;">\ud83d\uded1 ' + cS + ' HIT SL</span></div>' +
      '<div style="display:flex;gap:6px;margin-bottom:12px;">' +
      '<button class="sr-mf" data-f="all" onclick="renderModalRecs(\'all\')">All</button>' +
      '<button class="sr-mf" data-f="open" onclick="renderModalRecs(\'open\')">\u25cf Open</button>' +
      '<button class="sr-mf" data-f="closed" onclick="renderModalRecs(\'closed\')">\u2713 Closed</button></div>' +
      '<div id="modal-recs-list"></div>';
    renderModalRecs('all');
  } catch (err) {
    document.getElementById('modal-stats').innerHTML = '<p style="color:var(--red);">' + err.message + '</p>';
  }
};

window.renderModalRecs = function(filter) {
  var recs = window._modalRecs || [];
  var list = document.getElementById('modal-recs-list');
  if (!list) return;
  document.querySelectorAll('.sr-mf').forEach(function(b) {
    var on = b.dataset.f === filter;
    b.style.cssText = 'border:1.5px solid ' + (on?'var(--accent2)':'var(--border)') + ';background:' + (on?'#EAF2FF':'#fff') + ';color:' + (on?'var(--accent2)':'var(--muted)') + ';border-radius:10px;padding:5px 15px;font-size:12px;font-weight:700;cursor:pointer;';
  });
  var rows = recs.filter(function(r) {
    return filter==='all' ? true : filter==='open' ? r.outcome==='OPEN' : r.outcome!=='OPEN';
  });
  list.innerHTML =
    '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">' +
    (filter==='all'?'All':filter==='open'?'Open':'Closed') + ' Calls (' + rows.length + ')</div>' +
    (rows.slice(0,15).map(function(r) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bg3);flex-wrap:wrap;">' +
        '<span class="' + (r.direction==='BUY'?'badge-buy':'badge-sell') + '">' + (r.direction==='BUY'?'\u25b2':'\u25bc') + ' ' + r.direction + '</span>' +
        '<span style="font-size:13px;">Entry: <strong>' + fmtPrice(r.entryPrice) + '</strong></span>' +
        '<span style="font-size:13px;">TP: <strong class="flash-green">' + fmtPrice(r.takeProfit) + '</strong></span>' +
        '<span style="margin-left:auto;font-size:12px;color:var(--muted);">' + (r.user&&r.user.username?'@'+r.user.username:((r.user&&r.user.fullName)||'Trader')) + ' \u00b7 ' + timeAgo(r.createdAt) + '</span>' +
        (r.outcome!=='OPEN'?'<span class="' + (r.outcome==='WIN'?'badge-win':'badge-loss') + '">' + (r.outcome==='WIN'?'\ud83c\udfc6':'\ud83d\udcb8') + ' ' + r.outcome + '</span>':'') +
        '</div>';
    }).join('')||'<div style="color:var(--muted);font-size:13px;padding:12px 0;">No calls in this view</div>');
};


// ═══════════════════════════════════════════════════════════════════
// PRO AI ENGINE — UI (locked upsell for Free, live analysis for Pro)
// ═══════════════════════════════════════════════════════════════════

function ensureProContainer(containerId, afterElementId) {
  var existing = document.getElementById(containerId);
  if (existing) return existing;
  var after = document.getElementById(afterElementId);
  if (!after) return null;
  var div = document.createElement('div');
  div.id = containerId;
  div.style.cssText = 'margin-top:16px;';
  after.insertAdjacentElement('afterend', div);
  return div;
}

window.openProUpgradeModal = function() {
  var old = document.getElementById('sr-pro-upgrade-modal');
  if (old) old.remove();
  var m = document.createElement('div');
  m.id = 'sr-pro-upgrade-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:30000;background:rgba(8,15,36,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
  m.innerHTML = '<div style="background:#fff;border-radius:18px;padding:32px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.3);">' +
    '<div style="font-size:40px;margin-bottom:8px;">��</div>' +
    '<h3 style="font-size:20px;color:#0D2244;margin-bottom:10px;">AI Pro Analysis is a Pro feature</h3>' +
    '<p style="color:#475569;font-size:14px;line-height:1.6;margin-bottom:18px;">Unlock real Claude AI news analysis, catalysts, and risk detection combined with technical scoring.<br>To upgrade, contact us at:</p>' +
    '<a href="mailto:swingrush.admin@gmail.com?subject=SwingRush%20Pro%20Upgrade" style="display:inline-block;background:#EEF4FF;color:#0D2244;font-weight:700;padding:10px 18px;border-radius:10px;text-decoration:none;margin-bottom:18px;font-size:14px;">📧 swingrush.admin@gmail.com</a><br>' +
    '<button onclick="document.getElementById(\'sr-pro-upgrade-modal\').remove()" style="width:100%;background:#0D2244;color:#fff;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:14px;">Got it</button>' +
    '</div>';
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
};

window.renderProEngineSection = function(containerId, afterElementId, symbol) {
  var container = ensureProContainer(containerId, afterElementId);
  if (!container) return;

  var me = null;
  try { me = Auth.user(); } catch (e) {}
  var isPro = me && me.plan === 'pro';

  if (!isPro) {
    container.innerHTML =
      '<div style="background:linear-gradient(135deg,#0D2244,#1565C0);border-radius:14px;padding:18px 20px;color:#fff;display:flex;align-items:center;gap:14px;cursor:pointer;" onclick="openProUpgradeModal()">' +
      '<div style="font-size:28px;">🧠🔒</div>' +
      '<div style="flex:1;"><div style="font-weight:800;font-size:14px;">AI Pro Analysis</div>' +
      '<div style="font-size:12px;opacity:0.85;margin-top:2px;">Real Claude AI news reasoning, catalysts & risks — Pro members only</div></div>' +
      '<div style="background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:10px;font-size:12px;font-weight:700;">Unlock ⚡</div>' +
      '</div>';
    return;
  }

  container.innerHTML =
    '<div style="background:#fff;border:1.5px solid #D6E4F5;border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:14px;">' +
    '<div style="font-size:28px;">🧠</div>' +
    '<div style="flex:1;"><div style="font-weight:800;color:#0D2244;font-size:14px;">AI Pro Analysis</div>' +
    '<div style="font-size:12px;color:#64748b;margin-top:2px;">Run real Claude AI reasoning on ' + symbol + ' — news, catalysts, risks</div></div>' +
    '<button onclick="runProEngineAnalysis(\'' + containerId + '\', \'' + symbol + '\')" style="background:#0D2244;color:#fff;border:none;border-radius:10px;padding:9px 16px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap;">Analyze 🧠</button>' +
    '</div>';
};

window.runProEngineAnalysis = async function(containerId, symbol) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML =
    '<div style="background:#fff;border:1.5px solid #D6E4F5;border-radius:14px;padding:18px 20px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
    '<span style="font-size:18px;">🧠</span><span style="font-weight:800;color:#0D2244;font-size:14px;">AI Pro Analysis</span>' +
    '<span style="margin-left:auto;font-size:10px;background:#F5D061;color:#4A3B10;padding:2px 9px;border-radius:8px;font-weight:800;">PRO</span></div>' +
    '<div style="text-align:center;padding:16px;color:#94a3b8;font-size:13px;">Analyzing with Claude AI...</div></div>';

  try {
    var res = await fetch('/api/pro-engine/' + symbol, {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sr_token') || '') }
    });
    var d = await res.json();
    if (!res.ok) {
      container.querySelector('div > div:last-child').innerHTML =
        '<p style="color:#C62828;font-size:13px;text-align:center;">' + (d.message || 'Analysis unavailable') + '</p>';
      return;
    }
    if (d.insufficientData) {
      container.querySelector('div > div:last-child').innerHTML =
        '<p style="color:#94a3b8;font-size:13px;text-align:center;">Not enough price history for this symbol.</p>';
      return;
    }

    var dirColor = d.direction === 'BUY' ? '#00893E' : d.direction === 'SELL' ? '#C62828' : '#64748b';
    var dirBg = d.direction === 'BUY' ? '#E3F8EC' : d.direction === 'SELL' ? '#FFEBEE' : '#F1F5F9';

    var breakdownHtml = (d.technicalBreakdown || []).map(function(b) {
      var c = b.points > 0 ? '#00893E' : b.points < 0 ? '#C62828' : '#94a3b8';
      return '<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0;border-bottom:1px dashed #F0F5FC;"><span style="color:#475569;">' + b.indicator + '</span><span style="color:' + c + ';font-weight:700;">' + (b.points > 0 ? '+' : '') + b.points + '</span></div>';
    }).join('');

    var catalystsHtml = (d.catalysts || []).length
      ? '<div style="margin-top:10px;"><div style="font-size:11px;font-weight:800;color:#00893E;letter-spacing:0.5px;margin-bottom:4px;">📈 CATALYSTS</div>' +
        d.catalysts.map(function(c) { return '<div style="font-size:12px;color:#1A2540;padding:3px 0;">• ' + c + '</div>'; }).join('') + '</div>'
      : '';

    var risksHtml = (d.risks || []).length
      ? '<div style="margin-top:10px;"><div style="font-size:11px;font-weight:800;color:#C62828;letter-spacing:0.5px;margin-bottom:4px;">⚠️ RISKS</div>' +
        d.risks.map(function(r) { return '<div style="font-size:12px;color:#1A2540;padding:3px 0;">• ' + r + '</div>'; }).join('') + '</div>'
      : '';

    container.innerHTML =
      '<div style="background:#fff;border:1.5px solid #D6E4F5;border-radius:14px;padding:18px 20px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">' +
      '<span style="font-size:18px;">🧠</span><span style="font-weight:800;color:#0D2244;font-size:14px;">AI Pro Analysis</span>' +
      '<span style="margin-left:auto;font-size:10px;background:#F5D061;color:#4A3B10;padding:2px 9px;border-radius:8px;font-weight:800;">PRO</span></div>' +

      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
      '<span style="background:' + dirBg + ';color:' + dirColor + ';font-weight:800;padding:5px 14px;border-radius:10px;font-size:13px;">' + d.direction + '</span>' +
      '<span style="font-size:13px;color:#475569;">Score: <strong style="color:#0D2244;">' + d.score + '</strong> · ' + d.confidence + ' Confidence</span></div>' +

      (d.takeProfit ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">' +
        '<div style="background:#F8FAFF;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:#94a3b8;">Entry</div><div style="font-weight:700;font-size:13px;">$' + d.price + '</div></div>' +
        '<div style="background:#E3F8EC;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:#00893E;">TP</div><div style="font-weight:700;font-size:13px;color:#00893E;">$' + d.takeProfit + '</div></div>' +
        '<div style="background:#FFEBEE;border-radius:8px;padding:8px;text-align:center;"><div style="font-size:11px;color:#C62828;">SL</div><div style="font-weight:700;font-size:13px;color:#C62828;">$' + d.stopLoss + '</div></div>' +
        '</div>' : '') +

      '<div style="font-size:11px;font-weight:800;color:#7E9BC4;letter-spacing:1px;margin-bottom:6px;">TECHNICAL BREAKDOWN (' + d.technicalScore + ' pts)</div>' +
      breakdownHtml +

      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #F0F5FC;">' +
      '<div style="font-size:11px;font-weight:800;color:#7E9BC4;letter-spacing:1px;margin-bottom:6px;">NEWS ANALYSIS (' + (d.newsScore > 0 ? '+' : '') + d.newsScore + ' pts) — ' + d.newsLabel + '</div>' +
      '<p style="font-size:12.5px;color:#1A2540;line-height:1.5;margin:0;">' + (d.newsSummary || '') + '</p>' +
      (d.analystSummary ? '<p style="font-size:11.5px;color:#64748b;margin-top:6px;">' + d.analystSummary + '</p>' : '') +
      catalystsHtml + risksHtml +
      '</div>' +

      '<div style="margin-top:12px;text-align:center;font-size:10px;color:#B0BEC5;">🧠 Powered by Claude AI · ' + (d.articleCount || 0) + ' articles analyzed' + (d.newsFromCache ? ' · cached' : '') + '</div>' +
      '</div>';
  } catch (err) {
    container.innerHTML = '<p style="color:#C62828;font-size:13px;">AI Pro Analysis failed to load.</p>';
  }
};


// ═══════════════════════════════════════════════════════════════════
// AI PRO ENGINE — standalone modal, search ANY stock on demand
// ═══════════════════════════════════════════════════════════════════
window.openProEngineModal = function() {
  var old = document.getElementById('sr-pro-engine-modal');
  if (old) old.remove();

  var m = document.createElement('div');
  m.id = 'sr-pro-engine-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:29000;background:rgba(8,15,36,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';

  m.innerHTML =
    '<div style="background:#F5F9FF;border-radius:18px;max-width:640px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.35);">' +
    '<div style="background:#0D2244;border-radius:18px 18px 0 0;padding:18px 22px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:2;">' +
    '<span style="font-size:20px;">🧠</span>' +
    '<span style="color:#fff;font-weight:800;font-size:16px;">AI Pro Engine</span>' +
    '<span style="margin-left:auto;font-size:10px;background:#F5D061;color:#4A3B10;padding:3px 10px;border-radius:8px;font-weight:800;">PRO</span>' +
    '<button onclick="document.getElementById(\'sr-pro-engine-modal\').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;margin-left:8px;">✕</button>' +
    '</div>' +
    '<div style="padding:20px 22px;">' +
    '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
    '<input id="pe-modal-sym" type="text" placeholder="Enter any symbol (e.g. TSLA, NVDA, AAPL)..." style="flex:1;border:1.5px solid #D6E4F5;border-radius:10px;padding:11px 14px;font-size:14px;outline:none;" autocomplete="off"/>' +
    '<button onclick="runProEngineModal()" style="background:#0D2244;color:#fff;border:none;border-radius:10px;padding:0 20px;font-weight:700;cursor:pointer;font-size:14px;">Analyze 🧠</button>' +
    '</div>' +
    '<div id="pe-modal-result"><p style="color:#94a3b8;font-size:13px;text-align:center;padding:30px 0;">Enter a symbol above to run the AI Pro Engine.</p></div>' +
    '</div></div>';

  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
  document.body.appendChild(m);

  var input = document.getElementById('pe-modal-sym');
  input.focus();
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') runProEngineModal(); });
};

window.runProEngineModal = async function() {
  var sym = (document.getElementById('pe-modal-sym').value || '').trim().toUpperCase();
  var resultEl = document.getElementById('pe-modal-result');
  if (!sym) return;

  var me = null;
  try { me = Auth.user(); } catch (e) {}
  var isPro = me && me.plan === 'pro';

  if (!isPro) {
    resultEl.innerHTML =
      '<div style="background:linear-gradient(135deg,#0D2244,#1565C0);border-radius:14px;padding:20px;color:#fff;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:8px;">🧠🔒</div>' +
      '<div style="font-weight:800;font-size:15px;margin-bottom:6px;">AI Pro Engine is a Pro feature</div>' +
      '<div style="font-size:13px;opacity:0.85;margin-bottom:14px;">Analyze any stock with real Claude AI reasoning on news, catalysts, and risks — combined with 8 technical indicators.</div>' +
      '<a href="mailto:swingrush.admin@gmail.com?subject=SwingRush%20Pro%20Upgrade" style="display:inline-block;background:rgba(255,255,255,0.15);color:#fff;font-weight:700;padding:9px 18px;border-radius:10px;text-decoration:none;font-size:13px;">📧 Upgrade to Pro</a>' +
      '</div>';
    return;
  }

  resultEl.innerHTML = '<div style="text-align:center;padding:30px 0;color:#94a3b8;font-size:13px;">Analyzing ' + sym + ' with Claude AI...</div>';

  try {
    var res = await fetch('/api/pro-engine/' + sym, {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('sr_token') || '') }
    });
    var d = await res.json();
    if (!res.ok) {
      resultEl.innerHTML = '<p style="color:#C62828;font-size:13px;text-align:center;">' + (d.message || 'Analysis failed') + '</p>';
      return;
    }
    if (d.insufficientData) {
      resultEl.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;">Not enough price history for ' + sym + '.</p>';
      return;
    }

    var dirColor = d.direction === 'BUY' ? '#00893E' : d.direction === 'SELL' ? '#C62828' : '#64748b';
    var dirBg = d.direction === 'BUY' ? '#E3F8EC' : d.direction === 'SELL' ? '#FFEBEE' : '#F1F5F9';

    var breakdownHtml = (d.technicalBreakdown || []).map(function(b) {
      var c = b.points > 0 ? '#00893E' : b.points < 0 ? '#C62828' : '#94a3b8';
      return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed #E3EEFF;"><span style="color:#475569;">' + b.indicator + '</span><span style="color:' + c + ';font-weight:700;">' + (b.points > 0 ? '+' : '') + b.points + '</span></div>';
    }).join('');

    var catalystsHtml = (d.catalysts || []).length
      ? '<div style="margin-top:12px;"><div style="font-size:11.5px;font-weight:800;color:#00893E;letter-spacing:0.5px;margin-bottom:5px;">📈 CATALYSTS</div>' +
        d.catalysts.map(function(c) { return '<div style="font-size:13px;color:#1A2540;padding:3px 0;">• ' + c + '</div>'; }).join('') + '</div>'
      : '';

    var risksHtml = (d.risks || []).length
      ? '<div style="margin-top:12px;"><div style="font-size:11.5px;font-weight:800;color:#C62828;letter-spacing:0.5px;margin-bottom:5px;">⚠️ RISKS</div>' +
        d.risks.map(function(r) { return '<div style="font-size:13px;color:#1A2540;padding:3px 0;">• ' + r + '</div>'; }).join('') + '</div>'
      : '';

    resultEl.innerHTML =
      '<div style="background:#fff;border:1.5px solid #D6E4F5;border-radius:14px;padding:20px;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
      '<strong style="font-size:20px;color:#0D2244;">' + d.symbol + '</strong>' +
      '<span style="font-size:14px;color:#475569;">$' + d.price + '</span>' +
      '<span style="background:' + dirBg + ';color:' + dirColor + ';font-weight:800;padding:5px 14px;border-radius:10px;font-size:13px;margin-left:auto;">' + d.direction + '</span>' +
      '</div>' +

      '<div style="font-size:13px;color:#475569;margin-bottom:14px;">Combined Score: <strong style="color:#0D2244;">' + d.score + '</strong> · ' + d.confidence + ' Confidence</div>' +

      (d.takeProfit ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">' +
        '<div style="background:#F8FAFF;border-radius:8px;padding:9px;text-align:center;"><div style="font-size:11px;color:#94a3b8;">Entry</div><div style="font-weight:700;font-size:14px;">$' + d.price + '</div></div>' +
        '<div style="background:#E3F8EC;border-radius:8px;padding:9px;text-align:center;"><div style="font-size:11px;color:#00893E;">Take Profit</div><div style="font-weight:700;font-size:14px;color:#00893E;">$' + d.takeProfit + '</div></div>' +
        '<div style="background:#FFEBEE;border-radius:8px;padding:9px;text-align:center;"><div style="font-size:11px;color:#C62828;">Stop Loss</div><div style="font-weight:700;font-size:14px;color:#C62828;">$' + d.stopLoss + '</div></div>' +
        '</div>' : '<p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">No clear directional signal — score too low for a trade setup.</p>') +

      '<div style="font-size:11px;font-weight:800;color:#7E9BC4;letter-spacing:1px;margin-bottom:6px;">TECHNICAL BREAKDOWN (' + d.technicalScore + ' pts)</div>' +
      breakdownHtml +

      '<div style="margin-top:16px;padding-top:14px;border-top:1px solid #E3EEFF;">' +
      '<div style="font-size:11px;font-weight:800;color:#7E9BC4;letter-spacing:1px;margin-bottom:6px;">NEWS ANALYSIS (' + (d.newsScore > 0 ? '+' : '') + d.newsScore + ' pts) — ' + d.newsLabel + '</div>' +
      '<p style="font-size:13px;color:#1A2540;line-height:1.55;margin:0;">' + (d.newsSummary || '') + '</p>' +
      (d.analystSummary ? '<p style="font-size:12px;color:#64748b;margin-top:8px;">' + d.analystSummary + '</p>' : '') +
      catalystsHtml + risksHtml +
      '</div>' +

      '<div style="margin-top:14px;text-align:center;font-size:10.5px;color:#B0BEC5;">🧠 Powered by Claude AI · ' + (d.articleCount || 0) + ' articles analyzed' + (d.newsFromCache ? ' · cached' : '') + '</div>' +
      '</div>';
  } catch (err) {
    resultEl.innerHTML = '<p style="color:#C62828;font-size:13px;text-align:center;">Analysis failed to load.</p>';
  }
};
