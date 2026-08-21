// Shared decision summary for every Pro Engine result surface.
(function () {
  function t(key, fallback) {
    return window.SRLang ? window.SRLang.t(key, fallback) : fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function finite(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function signed(value, decimals) {
    var number = finite(value);
    if (number === null) return '—';
    return (number > 0 ? '+' : '') + number.toFixed(decimals == null ? 0 : decimals);
  }

  function price(value) {
    var number = finite(value);
    if (number === null) return '—';
    return '$' + number.toLocaleString('en-US', {
      minimumFractionDigits: number < 1 ? 4 : 2,
      maximumFractionDigits: number < 1 ? 4 : 2,
    });
  }

  function installStyles() {
    if (typeof document === 'undefined' || document.getElementById('sr-pro-summary-styles')) return;
    var style = document.createElement('style');
    style.id = 'sr-pro-summary-styles';
    style.textContent =
      '.sr-pro-summary{--srp-text:#0D2244;--srp-muted:#64748b;--srp-surface:#F7FAFE;--srp-inner:#fff;--srp-border:#D6E4F5;container-type:inline-size;margin:0 0 14px;padding:13px;border:1px solid var(--srp-border);border-radius:11px;background:var(--srp-surface);box-shadow:0 3px 14px rgba(13,34,68,.045)}' +
      '.sr-pro-summary.dark{--srp-text:var(--text,#F2F6FC);--srp-muted:var(--muted,#9CABBF);--srp-surface:var(--bg2,#17253B);--srp-inner:rgba(255,255,255,.025);--srp-border:var(--border,#2A3A54);box-shadow:none}' +
      '.sr-pro-summary-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}' +
      '.sr-pro-quote{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}.sr-pro-symbol{font-size:19px;font-weight:850;color:var(--srp-text)}.sr-pro-price{font-size:14px;font-weight:750;color:var(--srp-text)}' +
      '.sr-pro-today{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:850;white-space:nowrap}.sr-pro-today.up{color:#00893E;background:rgba(0,137,62,.10)}.sr-pro-today.down{color:#C62828;background:rgba(198,40,40,.10)}.sr-pro-today.flat{color:var(--srp-muted);background:rgba(100,116,139,.10)}' +
      '.sr-pro-session{font-size:10.5px;color:var(--srp-muted);width:100%;line-height:1.35}.sr-pro-session strong{color:var(--srp-text)}' +
      '.sr-pro-decision{display:grid;grid-template-columns:auto minmax(145px,.65fr) minmax(220px,1fr);gap:9px;align-items:stretch}' +
      '.sr-pro-signal{min-width:104px;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid;border-radius:9px;padding:10px 13px;font-size:15px;font-weight:900;letter-spacing:.45px}.sr-pro-signal.buy{color:#00893E;background:rgba(0,137,62,.10);border-color:rgba(0,137,62,.35)}.sr-pro-signal.sell{color:#C62828;background:rgba(198,40,40,.10);border-color:rgba(198,40,40,.35)}.sr-pro-signal.neutral{color:var(--srp-muted);background:rgba(100,116,139,.08);border-color:var(--srp-border)}' +
      '.sr-pro-combined,.sr-pro-components{background:var(--srp-inner);border:1px solid var(--srp-border);border-radius:9px;padding:8px 10px}.sr-pro-combined{display:flex;align-items:center;gap:10px;min-width:0}.sr-pro-combined-copy{min-width:0}.sr-pro-label{display:block;font-size:9.5px;font-weight:800;letter-spacing:.45px;text-transform:uppercase;color:var(--srp-muted)}.sr-pro-score{display:block;font-size:23px;line-height:1.05;font-weight:900;color:var(--srp-text);white-space:nowrap}.sr-pro-score small{font-size:11px;color:var(--srp-muted);font-weight:750}.sr-pro-confidence{font-size:10px;color:var(--srp-muted);margin-top:2px;white-space:nowrap}' +
      '.sr-pro-components{display:grid;grid-template-columns:1fr 1fr;gap:7px}.sr-pro-component{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--srp-muted);font-size:11px}.sr-pro-component strong{font-size:14px;color:var(--srp-text);white-space:nowrap}' +
      '.sr-pro-summary.buy .sr-pro-score,.sr-pro-summary.buy .sr-pro-component.total strong{color:#00893E}.sr-pro-summary.sell .sr-pro-score,.sr-pro-summary.sell .sr-pro-component.total strong{color:#C62828}' +
      '@keyframes srProSignalPulse{0%,72%,100%{box-shadow:0 0 0 0 transparent;filter:brightness(1)}86%{box-shadow:0 0 12px -3px currentColor;filter:brightness(1.05)}}' +
      '@keyframes srProNumberFlash{0%,76%,100%{text-shadow:none;opacity:1}88%{text-shadow:0 0 9px currentColor;opacity:.88}}' +
      '.sr-pro-signal.buy,.sr-pro-signal.sell{animation:srProSignalPulse 4.8s ease-in-out infinite}.sr-pro-summary.buy .sr-pro-score,.sr-pro-summary.sell .sr-pro-score{animation:srProNumberFlash 5.2s ease-in-out infinite}.sr-pro-today.up,.sr-pro-today.down{animation:srProNumberFlash 5.8s ease-in-out infinite}' +
      '@container (max-width:480px){.sr-pro-decision{grid-template-columns:auto minmax(0,1fr)}.sr-pro-components{grid-column:1/-1}.sr-pro-signal{min-width:94px}.sr-pro-score{font-size:21px}}' +
      '@media(max-width:560px){.sr-pro-summary{padding:11px}.sr-pro-decision{grid-template-columns:auto minmax(0,1fr)}.sr-pro-components{grid-column:1/-1}.sr-pro-signal{min-width:94px}.sr-pro-score{font-size:21px}}' +
      '@media(prefers-reduced-motion:reduce){.sr-pro-signal,.sr-pro-score,.sr-pro-today{animation:none!important}}';
    document.head.appendChild(style);
  }

  window.srProResultSummaryHtml = function (data, options) {
    data = data || {};
    options = options || {};
    installStyles();
    var direction = ['BUY', 'SELL', 'NEUTRAL'].indexOf(data.direction) >= 0 ? data.direction : 'NEUTRAL';
    var directionClass = direction.toLowerCase();
    var change = finite(data.changePct);
    var changeClass = change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
    var changeArrow = change === null || change === 0 ? '•' : change > 0 ? '▲' : '▼';
    var directionArrow = direction === 'BUY' ? '▲' : direction === 'SELL' ? '▼' : '•';
    var special = data.marketState && data.marketState !== 'Regular Session';
    var todayTitle = t('home.eng_today_move', 'Today') + ': ' + changeArrow + ' ' + (change === null ? '—' : signed(change, 2) + '%');

    return '<div class="sr-pro-summary ' + (options.theme === 'dark' ? 'dark ' : '') + directionClass + '">' +
      '<div class="sr-pro-summary-top"><div class="sr-pro-quote">' +
        '<strong class="sr-pro-symbol">' + escapeHtml(data.symbol || '') + '</strong>' +
        '<span class="sr-pro-price">' + escapeHtml(price(data.price)) + '</span>' +
        '<span class="sr-pro-today ' + changeClass + '" title="Compared with the previous regular-session close">' + escapeHtml(todayTitle) + '</span>' +
        (special ? '<span class="sr-pro-session">' + escapeHtml(data.marketState) + ' · ' + escapeHtml(t('home.eng_regular_session_close', 'Regular Session Close')) + ': <strong>' + escapeHtml(price(data.regularSessionPrice)) + '</strong></span>' : '') +
      '</div></div>' +
      '<div class="sr-pro-decision">' +
        '<div class="sr-pro-signal ' + directionClass + '"><span>' + directionArrow + '</span><span>' + direction + '</span></div>' +
        '<div class="sr-pro-combined"><div class="sr-pro-combined-copy"><span class="sr-pro-label">' + escapeHtml(t('home.eng_combined_score', 'Combined Score')) + '</span><strong class="sr-pro-score">' + escapeHtml(signed(data.score, 0)) + '<small>/24</small></strong><div class="sr-pro-confidence">' + escapeHtml(data.confidence || '—') + ' ' + escapeHtml(t('home.eng_confidence', 'Confidence')) + '</div></div></div>' +
        '<div class="sr-pro-components">' +
          '<div class="sr-pro-component"><span>' + escapeHtml(t('home.eng_technical', 'Technical')) + '</span><strong>' + escapeHtml(signed(data.technicalScore, 0)) + '<small>/14</small></strong></div>' +
          '<div class="sr-pro-component"><span>' + escapeHtml(t('home.eng_news_ai', 'News (AI)')) + '</span><strong>' + escapeHtml(signed(data.newsScore, 0)) + '<small>/10</small></strong></div>' +
          '<div class="sr-pro-component total" style="grid-column:1/-1;border-top:1px solid var(--srp-border);padding-top:6px;"><span>' + escapeHtml(t('home.eng_total', 'Total')) + '</span><strong>' + escapeHtml(signed(data.score, 0)) + '<small>/24</small></strong></div>' +
        '</div>' +
      '</div></div>';
  };
})();
