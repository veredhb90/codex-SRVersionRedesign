// ── Free Signal Engine ─────────────────────────────────────────────
(function () {
  function t(key, fallback) { return window.SRLang ? SRLang.t(key, fallback) : fallback; }
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
        <div style="color:var(--muted);font-size:13px;margin-top:12px;">${t('home.eng_analyzing', 'Analyzing') + ' ' + sym + ' — ' + t('home.eng_fetching', 'fetching data & news…')}</div>
      </div>`;
    if (shareBtn) shareBtn.style.display = 'none';
    try {
      const r = await API.engine(sym);
      lastRec = r;
      if (r.noSignal) {
        renderNoSignal(r);
      } else {
        renderResult(r);
        var me = (window.Auth && Auth.user && Auth.user()) || null;
        if (me && me.plan === 'pro') {
          // Pro users: offer a real Pro Engine deep-dive (more accurate) instead
          // of the generic "Ask AI" chat hand-off.
          showProEnginePopup(r);
        } else if (window.setChatStockContext) {
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
        <div style="font-family:var(--font-disp);font-size:20px;letter-spacing:1px;color:var(--muted);margin-bottom:8px;">${t('home.eng_no_signal', 'NO SIGNAL')}</div>
        <div style="font-size:13px;color:var(--text2);max-width:360px;margin:0 auto;">${r.noSignalReason}</div>
      </div>
      ${gatesHtml ? `<div class="eng-signals"><div class="eng-signals-title">⚡ ${t('home.eng_market_conditions', 'MARKET CONDITIONS')}</div>${gatesHtml}</div>` : ''}
      <div class="eng-signals" style="margin-top:12px;">
        <div class="eng-signals-title">📊 ${t('home.eng_indicator_analysis', 'INDICATOR ANALYSIS')}</div>
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
      : `<div style="font-size:12px;color:rgba(255,255,255,0.5);text-align:center;padding:12px;">${r.newsLabel || t('home.eng_no_news', 'No recent news found')}</div>`;

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
        <div class="eng-sig-label">${t('home.eng_signal_label', 'SIGNAL')}</div>
        <div class="eng-sig-dir flash-${isBuy?'green':'red'}">${isBuy?'▲':'▼'} ${r.direction}</div>
        <div class="eng-sig-conf">${t('home.eng_confidence', 'Confidence')}: <strong>${r.confidence}</strong> &nbsp;|&nbsp; ${t('home.eng_trend', 'Trend')}: <strong>${r.trend}</strong></div>
      </div>

      <!-- Levels -->
      <div class="eng-levels">
        <div class="eng-level">
          <div class="el-lbl">${t('home.eng_entry', 'ENTRY')}</div>
          <div class="el-val">$${Number(r.price).toFixed(2)}</div>
        </div>
        <div class="eng-level" style="border-color:var(--green);">
          <div class="el-lbl">${t('home.eng_take_profit', 'TAKE PROFIT')}</div>
          <div class="el-val flash-green">$${r.takeProfit}</div>
        </div>
        <div class="eng-level" style="border-color:var(--red);">
          <div class="el-lbl">${t('home.eng_stop_loss', 'STOP LOSS')}</div>
          <div class="el-val flash-red">$${r.stopLoss}</div>
        </div>
      </div>

      <!-- Score bar -->
      <div style="margin:12px 0;padding:10px 12px;background:var(--bg2);border-radius:9px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;color:var(--muted);letter-spacing:1px;">${t('home.eng_composite_score', 'COMPOSITE SCORE')}</span>
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
          <span><strong>${t('home.eng_time_to_target', 'Est. time to target')}:</strong> ${r.timeframe} (~${r.estDays} ${t('home.eng_trading_days', 'trading days')})</span>
        </div>` : ''}
      </div>

      <!-- Market conditions / gates -->
      ${gatesHtml ? `<div class="eng-signals" style="margin-bottom:8px;"><div class="eng-signals-title">⚡ ${t('home.eng_market_conditions', 'MARKET CONDITIONS')}</div>${gatesHtml}</div>` : ''}

      <!-- Indicator signals -->
      <div class="eng-signals">
        <div class="eng-signals-title">📊 ${t('home.eng_indicator_analysis', 'INDICATOR ANALYSIS')}</div>
        ${signalHtml}
      </div>

      <!-- News -->
      <div class="eng-signals" style="margin-top:12px;">
        <div class="eng-signals-title">📰 ${t('home.eng_news_sentiment', 'RECENT NEWS SENTIMENT')}
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
    if (!Auth.token()) { toast(t('home.eng_login_to_save', 'Login to save engine recommendations to your profile'), 'info'); return; }
    shareBtn.disabled = true;
    shareBtn.textContent = t('home.eng_saving', 'Saving…');
    try {
      await API.engineShare({
        symbol:     lastRec.symbol,
        entryPrice: lastRec.price,
        takeProfit: lastRec.takeProfit,
        stopLoss:   lastRec.stopLoss,
        direction:  lastRec.direction,
        note:       `⚡ Engine: ${lastRec.confidence} confidence · Score ${lastRec.score > 0 ? '+' : ''}${lastRec.score} · ${lastRec.newsLabel || ''}`,
      });
      toast('✅ ' + t('home.eng_saved_toast', 'Saved to your profile!'), 'success', 4000);
      shareBtn.textContent = '✓ ' + t('home.eng_saved_btn', 'Saved to Profile');
      shareBtn.style.background = 'var(--green)';
    } catch (err) {
      toast(err.message, 'error');
      shareBtn.disabled = false;
      shareBtn.textContent = '💾 ' + t('home.save_profile', 'Save to Profile');
    }
  });

  // ── Pro Engine upsell popup (Pro users only) ──────────────────────
  // Shown after a Free Signal Engine BUY/SELL result. Offers a real Pro
  // Engine deep-dive (Claude AI news + technicals). Runs on demand only —
  // never auto-fires, so it doesn't burn the shared Finnhub/Claude quota.
  function showProEnginePopup(r) {
    var sym = r.symbol;
    var dir = r.direction;
    var old = document.getElementById('sr-eng-pro-popup');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'sr-eng-pro-popup';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:30000;background:rgba(5,7,13,0.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML =
      '<div style="background:var(--surface);border:1.5px solid var(--border2);border-radius:18px;max-width:560px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.55);">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:2;">' +
          '<span style="font-size:20px;">🧠</span>' +
          '<span style="color:var(--text);font-weight:800;font-size:15px;">AI Pro Engine</span>' +
          '<span style="margin-left:auto;font-size:10px;background:linear-gradient(135deg,#F5D061,#E0A93B);color:#3a2e08;padding:3px 10px;border-radius:8px;font-weight:800;">PRO</span>' +
          '<button id="sr-eng-pro-close" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;margin-left:6px;">✕</button>' +
        '</div>' +
        '<div id="sr-eng-pro-body" style="padding:22px 20px;">' +
          '<div style="text-align:center;">' +
            '<div style="font-size:30px;margin-bottom:10px;color:' + (dir === 'BUY' ? 'var(--green)' : 'var(--red)') + ';">' + (dir === 'BUY' ? '▲' : '▼') + '</div>' +
            '<div style="font-family:var(--font-disp,inherit);font-size:20px;letter-spacing:.5px;color:var(--text);margin-bottom:8px;">' + t('home.eng_more_accurate', 'More accurate analysis for') + ' $' + sym + '</div>' +
            '<p style="color:var(--text2);font-size:13.5px;line-height:1.6;max-width:400px;margin:0 auto 20px;">' + t('home.eng_popup_pre', 'Your Free Signal Engine result is a') + ' <strong style="color:' + (dir === 'BUY' ? 'var(--green)' : 'var(--red)') + ';">' + dir + '</strong> ' + t('home.eng_popup_post', 'based on technicals only. Run the') + ' <strong>AI Pro Engine</strong> ' + t('home.eng_popup_post2', 'for real Claude AI news analysis, catalysts, risks and a combined score.') + '</p>' +
            '<button id="sr-eng-pro-run" style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;border-radius:12px;padding:12px 26px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(79,125,255,0.35);">' + t('home.eng_analyze_with_pro', 'Analyze with Pro Engine') + ' 🧠</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById('sr-eng-pro-close').addEventListener('click', function() { overlay.remove(); });
    document.getElementById('sr-eng-pro-run').addEventListener('click', function() { runProEngineInPopup(sym); });
  }

  async function runProEngineInPopup(sym) {
    var body = document.getElementById('sr-eng-pro-body');
    if (!body) return;
    body.innerHTML =
      '<div style="text-align:center;padding:34px 10px;">' +
        '<div class="spinner"></div>' +
        '<div style="color:var(--text2);font-size:13px;margin-top:14px;">' + t('home.eng_running_pro', 'Running AI Pro Engine for') + ' ' + sym + '…<br>' + t('home.eng_running_pro_sub', 'analyzing news, catalysts &amp; technicals') + '</div>' +
      '</div>';
    try {
      var token = (window.Auth && Auth.token && Auth.token()) || localStorage.getItem('sr_token') || '';
      var res = await fetch('/api/pro-engine/' + sym, { headers: { 'Authorization': 'Bearer ' + token } });
      var d = await res.json();
      if (!res.ok) {
        body.innerHTML = '<p style="color:var(--red);text-align:center;padding:24px;">' + (d.message || t('home.eng_analysis_failed', 'Analysis failed')) + '</p>';
        return;
      }
      if (d.insufficientData) {
        body.innerHTML = '<p style="color:var(--muted);text-align:center;padding:24px;">' + t('home.eng_insufficient_data', 'Not enough price history for') + ' ' + sym + '.</p>';
        return;
      }
      body.innerHTML = renderProEngineResult(d);
    } catch (err) {
      body.innerHTML = '<p style="color:var(--red);text-align:center;padding:24px;">' + t('home.eng_pro_failed', 'AI Pro Engine failed to load. Please try again.') + '</p>';
    }
  }

  function renderProEngineResult(d) {
    var dirColor = d.direction === 'BUY' ? 'var(--green)' : d.direction === 'SELL' ? 'var(--red)' : 'var(--muted)';
    var dirBg    = d.direction === 'BUY' ? 'var(--green-bg)' : d.direction === 'SELL' ? 'var(--red-bg)' : 'var(--bg3)';
    var special  = d.marketState && d.marketState !== 'Regular Session';
    var breakdown = (d.technicalBreakdown || []).map(function(b) {
      var c = b.points > 0 ? 'var(--green)' : b.points < 0 ? 'var(--red)' : 'var(--muted)';
      return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed var(--border);"><span style="color:var(--text2);">' + b.indicator + '</span><span style="color:' + c + ';font-weight:700;">' + (b.points > 0 ? '+' : '') + b.points + '</span></div>';
    }).join('');
    var catalysts = (d.catalysts || []).length
      ? '<div style="margin-top:12px;"><div style="font-size:11.5px;font-weight:800;color:var(--green);letter-spacing:0.5px;margin-bottom:5px;">📈 ' + t('home.eng_catalysts', 'CATALYSTS') + '</div>' +
        d.catalysts.map(function(c) { return '<div style="font-size:13px;color:var(--text);padding:3px 0;">• ' + c + '</div>'; }).join('') + '</div>'
      : '';
    var risks = (d.risks || []).length
      ? '<div style="margin-top:12px;"><div style="font-size:11.5px;font-weight:800;color:var(--red);letter-spacing:0.5px;margin-bottom:5px;">⚠️ ' + t('home.eng_risks', 'RISKS') + '</div>' +
        d.risks.map(function(x) { return '<div style="font-size:13px;color:var(--text);padding:3px 0;">• ' + x + '</div>'; }).join('') + '</div>'
      : '';
    return '' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
        '<strong style="font-size:20px;color:var(--text);">' + d.symbol + '</strong>' +
        '<span style="font-size:14px;color:var(--text2);">$' + d.price + '</span>' +
        (special ? '<span style="font-size:10.5px;color:#F5D061;font-weight:700;background:rgba(245,208,97,0.12);padding:2px 8px;border-radius:6px;">' + d.marketState + '</span>' : '') +
        '<span style="background:' + dirBg + ';color:' + dirColor + ';font-weight:800;padding:5px 14px;border-radius:10px;font-size:13px;margin-left:auto;">' + d.direction + '</span>' +
      '</div>' +
      (special ? '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px;">' + t('home.eng_regular_session_close', 'Regular Session Close') + ': $' + d.regularSessionPrice + '</div>' : '<div style="margin-bottom:10px;"></div>') +
      '<div style="font-size:13px;color:var(--text2);margin-bottom:6px;">' + t('home.eng_combined_score', 'Combined Score') + ': <strong style="color:var(--text);">' + d.score + '</strong> · ' + d.confidence + ' ' + t('home.eng_confidence', 'Confidence') + '</div>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--text2);margin-bottom:14px;padding:9px 12px;background:var(--bg2);border-radius:8px;"><span>' + t('home.eng_technical', 'Technical') + ': <strong style="color:var(--text);">' + (d.technicalScore > 0 ? '+' : '') + d.technicalScore + '</strong></span><span>+</span><span>' + t('home.eng_news_ai', 'News (AI)') + ': <strong style="color:var(--text);">' + (d.newsScore > 0 ? '+' : '') + d.newsScore + '</strong></span><span>=</span><span>' + t('home.eng_total', 'Total') + ': <strong style="color:var(--text);">' + (d.score > 0 ? '+' : '') + d.score + '</strong></span></div>' +
      (d.holdingPeriod ? '<div style="font-size:12px;color:var(--text);font-weight:700;margin-bottom:6px;">⏳ ' + t('home.eng_holding_period', 'Suggested holding period') + ': ' + d.holdingPeriod + '</div>' : '') +
      (d.upcomingEarnings && d.upcomingEarnings.length ? '<div style="font-size:12px;color:var(--text2);margin-bottom:10px;"><strong style="color:var(--text);">📅 ' + t('home.eng_next_earnings', 'Next earnings') + ':</strong> ' + d.upcomingEarnings.map(function(x) { return x.date; }).join(' · ') + '</div>' : '') +
      (d.takeProfit
        ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">' +
            '<div style="background:var(--bg2);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:11px;color:var(--muted);">' + t('home.eng_entry_label', 'Entry') + '</div><div style="font-weight:700;font-size:14px;color:var(--text);">$' + d.price + '</div></div>' +
            '<div style="background:var(--green-bg);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:11px;color:var(--green);">' + t('home.eng_take_profit_label', 'Take Profit') + '</div><div style="font-weight:700;font-size:14px;color:var(--green);">$' + d.takeProfit + '</div></div>' +
            '<div style="background:var(--red-bg);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:11px;color:var(--red);">' + t('home.eng_stop_loss_label', 'Stop Loss') + '</div><div style="font-weight:700;font-size:14px;color:var(--red);">$' + d.stopLoss + '</div></div>' +
          '</div>'
        : '<p style="color:var(--muted);font-size:13px;margin-bottom:16px;">' + t('home.eng_no_directional_signal', 'No clear directional signal — score too low for a trade setup.') + '</p>') +
      '<div style="font-size:11px;font-weight:800;color:var(--accent2);letter-spacing:1px;margin-bottom:6px;">' + t('home.eng_technical_breakdown', 'TECHNICAL BREAKDOWN') + ' (' + d.technicalScore + ' ' + t('home.eng_pts', 'pts') + ')</div>' +
      breakdown +
      '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">' +
        '<div style="font-size:11px;font-weight:800;color:var(--accent2);letter-spacing:1px;margin-bottom:6px;">' + t('home.eng_news_analysis', 'NEWS ANALYSIS') + ' (' + (d.newsScore > 0 ? '+' : '') + d.newsScore + ' ' + t('home.eng_pts', 'pts') + ') — ' + d.newsLabel + '</div>' +
        '<p style="font-size:13px;color:var(--text);line-height:1.55;margin:0;">' + (d.newsSummary || '') + '</p>' +
        (d.analystSummary ? '<p style="font-size:12px;color:var(--text2);margin-top:8px;">' + d.analystSummary + '</p>' : '') +
        catalysts + risks +
      '</div>' +
      '<div style="margin-top:14px;text-align:center;font-size:10.5px;color:var(--muted);">🧠 ' + t('home.eng_powered_by', 'Powered by Claude AI') + ' · ' + (d.articleCount || 0) + ' ' + t('home.eng_articles_analyzed', 'articles analyzed') + (d.newsFromCache ? ' · ' + t('home.eng_cached', 'cached') : '') + '</div>';
  }
})();
