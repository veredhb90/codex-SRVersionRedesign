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
    resultEl.innerHTML = '<div class="spinner"></div>';
    if (shareBtn) shareBtn.style.display = 'none';
    try {
      const r = await API.engine(sym);
      lastRec = r;
      renderResult(r);
    } catch (err) {
      resultEl.innerHTML = `<p style="color:var(--red);text-align:center;padding:16px;">${err.message}</p>`;
    }
  });

  function renderResult(r) {
    const isBuy  = r.direction === 'BUY';
    const col    = isBuy ? 'var(--green)' : 'var(--red)';
    const dimCol = isBuy ? 'var(--green-bg)' : 'var(--red-bg)';
    const chgCol = (r.change||0) >= 0 ? 'var(--green2)' : 'var(--red2)';
    resultEl.innerHTML = `
    <div class="eng-result" style="animation:fadeUp 0.4s ease;">
      <div class="eng-top">
        <div>
          <div class="eng-sym">${r.symbol}</div>
          <div class="eng-name">${r.name||''}</div>
        </div>
        <div class="eng-price-block">
          <div class="eng-price">$${Number(r.price).toFixed(2)}</div>
          <div style="color:${chgCol};font-size:13px;text-align:right;">${(r.change||0)>=0?'▲':'▼'} ${Math.abs(r.change||0).toFixed(2)}%</div>
        </div>
      </div>
      <div class="eng-signal" style="border-color:${col};background:${dimCol};">
        <div class="eng-sig-label">SIGNAL</div>
        <div class="eng-sig-dir flash-${isBuy?'green':'red'}">${isBuy?'▲':'▼'} ${r.direction}</div>
        <div class="eng-sig-conf">Confidence: <strong>${r.confidence}</strong> &nbsp;|&nbsp; Trend: <strong>${r.trend}</strong></div>
      </div>
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
      <div class="eng-meta">
        <span>52W Position: <strong>${r.rangePct}%</strong></span>
        <span>R:R <strong>1:${r.riskReward}</strong></span>
        ${r.score !== undefined ? `<span>Score: <strong style="color:${r.score>=0?'var(--green)':'var(--red)'};">${r.score>0?'+':''}${r.score}</strong></span>` : ''}
      </div>
      ${r.signals && r.signals.length ? `
      <div class="eng-signals">
        <div class="eng-signals-title">📊 INDICATOR ANALYSIS</div>
        ${r.signals.map(s => `<div class="eng-signal-row">${s}</div>`).join('')}
      </div>` : ''}
    </div>`;
    if (shareBtn) shareBtn.style.display = 'inline-flex';
  }

  shareBtn?.addEventListener('click', async () => {
    if (!Auth.token()) { toast('Login to save engine recommendations to your profile', 'info'); return; }
    shareBtn.disabled = true;
    shareBtn.textContent = 'Saving…';
    try {
      // Saves to PROFILE ONLY — does NOT appear in main feed
      await API.engineShare({
        symbol:     lastRec.symbol,
        entryPrice: lastRec.price,
        takeProfit: lastRec.takeProfit,
        stopLoss:   lastRec.stopLoss,
        direction:  lastRec.direction,
        note:       `⚡ Engine signal — ${lastRec.confidence} confidence, R:R 1:${lastRec.riskReward}, trend: ${lastRec.trend}`,
      });
      toast('✅ Saved to your profile! (not posted to feed)', 'success', 4000);
      shareBtn.textContent = '✓ Saved to Profile';
      shareBtn.style.background = 'var(--green)';
    } catch (err) {
      toast(err.message, 'error');
      shareBtn.disabled = false;
      shareBtn.textContent = '💾 Save to Profile';
    }
  });
})();
