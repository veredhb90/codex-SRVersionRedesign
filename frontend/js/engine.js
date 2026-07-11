// ── Free Signal Engine ─────────────────────────────────────────────
(function () {
  const form     = document.getElementById('engine-form');
  const symInput = document.getElementById('engine-symbol');
  const resultEl = document.getElementById('engine-result');
  const shareBtn = document.getElementById('engine-share');

  let lastRec = null;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sym = symInput.value.trim().toUpperCase();
    if (!sym) return;

    // Check auth first
    if (!Auth.token()) {
      if (window.Paywall) Paywall.showRegisterPrompt();
      return;
    }

    resultEl.innerHTML = `
      <div style="text-align:center;padding:32px;">
        <div class="spinner"></div>
        <div style="color:var(--muted);font-size:13px;margin-top:12px;">Analyzing ${sym} — fetching data & news…</div>
      </div>`;
    if (shareBtn) shareBtn.style.display = 'none';
    try {
      const r = await API.engine(sym);
      lastRec = r;
      if (r.noSignal) {
        renderNoSignal(r);
      } else {
        renderResult(r);
        if (window.setChatStockContext) {
          window.setChatStockContext(r);
        }
      }
    } catch (err) {
      // Handle paywall errors
      if (err.message && err.message.includes('Subscribe')) {
        if (window.Paywall) Paywall.showSubscribePaywall('engine');
        resultEl.innerHTML = '';
      } else if (err.message && err.message.includes('register')) {
        if (window.Paywall) Paywall.showRegisterPrompt();
        resultEl.innerHTML = '';
      } else {
        resultEl.innerHTML = `<p style="color:var(--red);text-align:center;padding:16px;">${err.message}</p>`;
      }
    }
  });

  function renderNoSignal(r) {
    const gatesHtml = (r.gates||[]).map(g => `<div class="eng-signal-row">${g}</div>`).join('');
    const signalHtml = (r.signals||[]).map(s => {
      const col = s.includes('✅') ? 'var(--green)' : s.includes('⚠️')||s.includes('🔴') ? 'var(--red)' : 'var(--text2)';
      return `<div class="eng-signal-row" style="color:${col};">${s}</div>`;
    }).join('');
    resultEl.innerHTML = `
    <div class="eng-result" style="animation:fadeUp 0.4s ease;">
      <div class="eng-top">
        <div><div class="eng-sym">${r.symbol}</div><div class="eng-name">${r.name||''}</div></div>
        <div class="eng-price-block">
          <div class="eng-price">$${Number(r.price).toFixed(2)}</div>
          <div style="color:${(r.change||0)>=0?'var(--green2)':'var(--red2)'};font-size:13px;">${(r.change||0)>=0?'▲':'▼'} ${Math.abs(r.change||0).toFixed(2)}%</div>
        </div>
      </div>
      <div style="background:var(--bg2);border:2px solid var(--border);border-radius:12px;padding:20px;text-align:center;margin:12px 0;">
        <div style="font-size:32px;margin-bottom:8px;">⏸</div>
        <div style="font-family:var(--font-disp);font-size:20px;letter-spacing:1px;color:var(--muted);margin-bottom:8px;">NO SIGNAL</div>
        <div style="font-size:13px;color:var(--text2);max-width:360px;margin:0 auto;">${r.noSignalReason}</div>
      </div>
      ${gatesHtml ? `<div class="eng-signals"><div class="eng-signals-title">⚡ MARKET CONDITIONS</div>${gatesHtml}</div>` : ''}
      <div class="eng-signals" style="margin-top:12px;">
        <div class="eng-signals-title">📊 INDICATOR ANALYSIS</div>
        ${signalHtml}
      </div>
    </div>`;
    if (shareBtn) shareBtn.style.display = 'none';
  }

  function renderResult(r) {
    const isBuy  = r.direction === 'BUY';
    const col    = isBuy ? 'var(--green)' : 'var(--red)';
    const dimCol = isBuy ? 'var(--green-bg)' : 'var(--red-bg)';
    const chgCol = (r.change || 0) >= 0 ? 'var(--green2)' : 'var(--red2)';

    // Score bar
    const maxScore   = 18;
    const scoreColor = r.score > 0 ? 'var(--green)' : r.score < 0 ? 'var(--red)' : 'var(--muted)';
    const scoreLabel = r.score > 0 ? `+${r.score}` : `${r.score}`;

    // Gates (market conditions)
    const gatesHtml = (r.gates||[]).map(g => `<div class="eng-signal-row">${g}</div>`).join('');

    // Analyst label
    const analystHtml = r.analystLabel ? `<div class="eng-signal-row" style="color:var(--accent2);">📊 ${r.analystLabel}</div>` : '';

    // Signals list
    const signalHtml = (r.signals || []).map(s => {
      const isPos = s.includes('✅') || s.includes('🔥');
      const isNeg = s.includes('⚠️') || s.includes('🔴');
      const color = isPos ? 'var(--green)' : isNeg ? 'var(--red)' : 'var(--text2)';
      return `<div class="eng-signal-row" style="color:${color};">${s}</div>`;
    }).join('');

    // News list
    const newsHtml = (r.news || []).length > 0
      ? (r.news || []).map(n => {
          const sentColor = n.sentiment === 'positive' ? 'var(--green)' :
                            n.sentiment === 'negative' ? 'var(--red)' : 'var(--muted)';
          const sentIcon  = n.sentiment === 'positive' ? '▲' :
                            n.sentiment === 'negative' ? '▼' : '●';
          return `<a href="${n.url}" target="_blank" rel="noopener"
            style="display:block;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);text-decoration:none;color:inherit;">
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <span style="color:${sentColor};font-size:11px;margin-top:2px;flex-shrink:0;">${sentIcon}</span>
              <div>
                <div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.4;">${n.headline}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:3px;">${n.source || ''}</div>
              </div>
            </div>
          </a>`;
        }).join('')
      : `<div style="font-size:12px;color:rgba(255,255,255,0.5);text-align:center;padding:12px;">${r.newsLabel || 'No recent news found'}</div>`;

    resultEl.innerHTML = `
    <div class="eng-result" style="animation:fadeUp 0.4s ease;">
      <!-- Header -->
      <div class="eng-top">
        <div>
          <div class="eng-sym">${r.symbol}</div>
          <div class="eng-name">${r.name || ''}</div>
        </div>
        <div class="eng-price-block">
          <div class="eng-price">$${Number(r.price).toFixed(2)}</div>
          <div style="color:${chgCol};font-size:13px;text-align:right;">${(r.change||0)>=0?'▲':'▼'} ${Math.abs(r.change||0).toFixed(2)}%</div>
        </div>
      </div>

      <!-- Signal -->
      <div class="eng-signal" style="border-color:${col};background:${dimCol};">
        <div class="eng-sig-label">SIGNAL</div>
        <div class="eng-sig-dir flash-${isBuy?'green':'red'}">${isBuy?'▲':'▼'} ${r.direction}</div>
        <div class="eng-sig-conf">Confidence: <strong>${r.confidence}</strong> &nbsp;|&nbsp; Trend: <strong>${r.trend}</strong></div>
      </div>

      <!-- Levels -->
      <div class="eng-levels">
        <div class="eng-level">
          <div class="el-lbl">ENTRY</div>
          <div class="el-val">$${Number(r.price).toFixed(2)}</div>
        </div>
        <div class="eng-level" style="border-color:var(--green);">
          <div class="el-lbl">TAKE PROFIT</div>
          <div class="el-val flash-green">$${r.takeProfit}</div>
        </div>
        <div class="eng-level" style="border-color:var(--red);">
          <div class="el-lbl">STOP LOSS</div>
          <div class="el-val flash-red">$${r.stopLoss}</div>
        </div>
      </div>

      <!-- Score bar -->
      <div style="margin:12px 0;padding:10px 12px;background:var(--bg2);border-radius:9px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;color:var(--muted);letter-spacing:1px;">COMPOSITE SCORE</span>
          <span style="font-family:var(--font-mono);font-size:18px;font-weight:900;color:${scoreColor};">${scoreLabel}</span>
        </div>
        <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(100,Math.abs(r.score)/maxScore*100)}%;background:${scoreColor};border-radius:3px;transition:width 1s ease;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px;">
          <span>52W: ${r.rangePct}%</span>
          <span>R:R 1:${r.riskReward}</span>
        </div>
        ${r.timeframe ? `<div style="margin-top:8px;padding:6px 10px;background:var(--bg3);border-radius:6px;font-size:12px;color:var(--text2);display:flex;align-items:center;gap:6px;">
          <span>⏱</span>
          <span><strong>Est. time to target:</strong> ${r.timeframe} (~${r.estDays} trading days)</span>
        </div>` : ''}
      </div>

      <!-- Market conditions / gates -->
      ${gatesHtml ? `<div class="eng-signals" style="margin-bottom:8px;"><div class="eng-signals-title">⚡ MARKET CONDITIONS</div>${gatesHtml}</div>` : ''}

      <!-- Indicator signals -->
      <div class="eng-signals">
        <div class="eng-signals-title">📊 INDICATOR ANALYSIS</div>
        ${signalHtml}
      </div>

      <!-- News -->
      <div class="eng-signals" style="margin-top:12px;">
        <div class="eng-signals-title">📰 RECENT NEWS SENTIMENT
          <span style="margin-left:8px;font-size:11px;font-weight:400;color:${
            r.newsScore > 0 ? 'var(--green)' : r.newsScore < 0 ? 'var(--red)' : 'var(--muted)'
          };">${r.newsLabel || ''}</span>
        </div>
        ${newsHtml}
      </div>
    </div>`;

    if (shareBtn) shareBtn.style.display = 'inline-flex';
  }

  shareBtn?.addEventListener('click', async () => {
    if (!Auth.token()) { toast('Login to save engine recommendations to your profile', 'info'); return; }
    shareBtn.disabled = true;
    shareBtn.textContent = 'Saving…';
    try {
      await API.engineShare({
        symbol:     lastRec.symbol,
        entryPrice: lastRec.price,
        takeProfit: lastRec.takeProfit,
        stopLoss:   lastRec.stopLoss,
        direction:  lastRec.direction,
        note:       `⚡ Engine: ${lastRec.confidence} confidence · Score ${lastRec.score > 0 ? '+' : ''}${lastRec.score} · ${lastRec.newsLabel || ''}`,
      });
      toast('✅ Saved to your profile!', 'success', 4000);
      shareBtn.textContent = '✓ Saved to Profile';
      shareBtn.style.background = 'var(--green)';
    } catch (err) {
      toast(err.message, 'error');
      shareBtn.disabled = false;
      shareBtn.textContent = '💾 Save to Profile';
    }
  });
})();
