// Shared dated Pro Engine history strip. Every Pro result surface uses this
// renderer so the latest and previous saved outcomes cannot drift by page.
(function () {
  function t(key, fallback) {
    return window.SRLang ? window.SRLang.t(key, fallback) : fallback;
  }

  function formatDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return '—';
    var lang = window.SRLang && window.SRLang.lang;
    var locale = lang === 'ar' ? 'ar' : lang === 'he' ? 'he-IL' : 'en-US';
    return date.toLocaleString(locale, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function outcomeHtml(report) {
    var direction = ['BUY', 'SELL', 'NEUTRAL'].includes(report && report.direction)
      ? report.direction
      : 'NEUTRAL';
    var score = Number(report && report.score);
    if (!Number.isFinite(score)) score = 0;
    var color = direction === 'BUY' ? '#00893E' : direction === 'SELL' ? '#C62828' : '#64748b';
    var signedScore = score > 0 ? '+' + score : String(score);
    return '<strong style="color:' + color + ';white-space:nowrap;">' + direction + ' · ' + signedScore + '</strong>';
  }

  function money(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? '$' + number.toFixed(2) : '—';
  }

  function followUpStatus(previous) {
    var statuses = {
      TARGET_HIT: ['home.eng_previous_target_hit', 'Take profit reached', '#00893E'],
      STOP_HIT: ['home.eng_previous_stop_hit', 'Stop loss reached', '#C62828'],
      AMBIGUOUS: ['home.eng_previous_ambiguous', 'TP and SL crossed in the same daily candle — order unknown', '#F59E0B'],
      CURRENTLY_AT_TARGET: ['home.eng_previous_at_target', 'Currently at or beyond take profit', '#00893E'],
      CURRENTLY_AT_STOP: ['home.eng_previous_at_stop', 'Currently at or beyond stop loss', '#C62828'],
      NO_SIGNAL: ['home.eng_previous_no_signal', 'No directional trade signal', '#64748b'],
      OPEN: ['home.eng_previous_open', 'Neither target nor stop reached', '#1565C0']
    };
    return statuses[previous && previous.status] || statuses.OPEN;
  }

  window.srProReportHistoryHtml = function (report, options) {
    options = options || {};
    var dark = options.theme === 'dark';
    var previous = report && report.previousReport;
    var background = dark ? 'var(--bg2)' : '#F5F9FF';
    var border = dark ? 'var(--border)' : '#D6E4F5';
    var labelColor = dark ? 'var(--muted)' : '#64748b';
    var textColor = dark ? 'var(--text)' : '#0D2244';

    var previousPanel;
    if (!previous) {
      previousPanel = '<div style="color:' + labelColor + ';">' + t('home.eng_no_previous_report', 'No earlier saved report') + '</div>';
    } else {
      var status = followUpStatus(previous);
      var performance = Number(previous.performancePct);
      var performanceHtml = Number.isFinite(performance)
        ? '<div style="margin-top:4px;color:' + labelColor + ';">' + t('home.eng_previous_performance', 'Current trade performance') + ': <strong style="color:' + (performance >= 0 ? '#00893E' : '#C62828') + ';">' + (performance > 0 ? '+' : '') + performance.toFixed(2) + '%</strong> <span style="color:' + labelColor + ';">(' + t('home.eng_previous_now', 'now') + ' ' + money(previous.currentPrice) + ')</span></div>'
        : '';
      previousPanel =
        '<div style="display:flex;gap:6px;flex-wrap:wrap;color:' + textColor + ';">' +
          '<span>' + formatDate(previous.generatedAt) + '</span> · ' + outcomeHtml(previous) +
        '</div>' +
        '<div style="margin-top:4px;color:' + labelColor + ';">' +
          t('home.eng_entry_label', 'Entry') + ' <strong style="color:' + textColor + ';">' + money(previous.entryPrice) + '</strong> · ' +
          t('home.eng_take_profit_label', 'Take Profit') + ' <strong style="color:#00893E;">' + money(previous.takeProfit) + '</strong> · ' +
          t('home.eng_stop_loss_label', 'Stop Loss') + ' <strong style="color:#C62828;">' + money(previous.stopLoss) + '</strong>' +
        '</div>' +
        '<div style="margin-top:4px;color:' + labelColor + ';">' + t('home.eng_previous_result', 'What happened') + ': <strong style="color:' + status[2] + ';">' + t(status[0], status[1]) + '</strong>' + (previous.statusAt ? ' · ' + formatDate(previous.statusAt) : '') + '</div>' +
        performanceHtml;
    }

    return '<div style="margin:0 0 12px;font-size:11.5px;line-height:1.55;">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px;color:' + labelColor + ';">🕒 ' + t('home.eng_latest_report', 'Latest report') + ': <span style="color:' + textColor + ';">' + formatDate(report && report.generatedAt) + '</span> · ' + outcomeHtml(report) + '</div>' +
      '<div style="padding:10px 11px;background:' + background + ';border:1px solid ' + border + ';border-left:3px solid #7E9BC4;border-radius:8px;">' +
        '<div style="font-size:10.5px;font-weight:800;letter-spacing:.55px;color:' + labelColor + ';margin-bottom:5px;">📜 ' + t('home.eng_previous_follow_up', 'PREVIOUS REPORT FOLLOW-UP') + '</div>' +
        previousPanel +
      '</div>' +
    '</div>';
  };
})();
