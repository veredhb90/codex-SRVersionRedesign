// Shared latest-quarter earnings card for every Pro Engine result surface.
(function () {
  function t(key, fallback) {
    return window.SRLang ? window.SRLang.t(key, fallback) : fallback;
  }

  function formatDate(value) {
    var date = value ? new Date(value + 'T12:00:00Z') : null;
    if (!date || isNaN(date.getTime())) return '—';
    var lang = window.SRLang && window.SRLang.lang;
    var locale = lang === 'ar' ? 'ar' : lang === 'he' ? 'he-IL' : 'en-US';
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function numberOrNull(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function formatEps(value) {
    var number = numberOrNull(value);
    if (number === null) return '—';
    return (number < 0 ? '-$' : '$') + Math.abs(number).toFixed(2);
  }

  function formatRevenue(value) {
    var number = numberOrNull(value);
    if (number === null) return '—';
    var abs = Math.abs(number);
    var sign = number < 0 ? '-$' : '$';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M';
    return sign + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function comparison(actualValue, estimateValue, surpriseValue) {
    var actual = numberOrNull(actualValue);
    var estimate = numberOrNull(estimateValue);
    if (actual === null || estimate === null) return '';
    var delta = actual - estimate;
    var key = Math.abs(delta) < 1e-9 ? 'home.eng_earnings_inline' : delta > 0 ? 'home.eng_earnings_beat' : 'home.eng_earnings_miss';
    var fallback = Math.abs(delta) < 1e-9 ? 'IN LINE' : delta > 0 ? 'BEAT' : 'MISS';
    var color = Math.abs(delta) < 1e-9 ? '#64748b' : delta > 0 ? '#00893E' : '#C62828';
    var surprise = numberOrNull(surpriseValue);
    return '<strong style="color:' + color + ';white-space:nowrap;">' + t(key, fallback) +
      (surprise === null ? '' : ' ' + (surprise > 0 ? '+' : '') + surprise.toFixed(2) + '%') + '</strong>';
  }

  window.srProEarningsReportHtml = function (result, options) {
    options = options || {};
    var dark = options.theme === 'dark';
    var report = result && result.latestEarningsReport;
    var background = dark ? 'var(--bg2)' : '#F5F9FF';
    var border = dark ? 'var(--border)' : '#D6E4F5';
    var labelColor = dark ? 'var(--muted)' : '#64748b';
    var textColor = dark ? 'var(--text)' : '#0D2244';
    var heading = '<div style="font-size:10.5px;font-weight:800;letter-spacing:.55px;color:' + labelColor + ';margin-bottom:7px;">📊 ' + t('home.eng_latest_earnings_report', 'LATEST EARNINGS REPORT') + '</div>';

    if (!report) {
      return '<div style="margin:0 0 14px;padding:11px 12px;background:' + background + ';border:1px solid ' + border + ';border-left:3px solid #7E9BC4;border-radius:8px;font-size:11.5px;">' +
        heading + '<div style="color:' + labelColor + ';">' + t('home.eng_earnings_unavailable', 'No verified reported-quarter data returned by Finnhub.') + '</div></div>';
    }

    var quarter = report.quarter != null ? 'Q' + report.quarter : '';
    var year = report.year != null ? ' FY' + report.year : '';
    var fiscal = report.fiscalPeriod ? ' · ' + t('home.eng_fiscal_period', 'Fiscal period') + ' ' + report.fiscalPeriod : '';
    var epsComparison = comparison(report.epsActual, report.epsEstimate, report.epsSurprisePercent);
    var revenueComparison = comparison(report.revenueActual, report.revenueEstimate, report.revenueSurprisePercent);
    var epsRow = numberOrNull(report.epsActual) !== null || numberOrNull(report.epsEstimate) !== null
      ? '<div style="display:grid;grid-template-columns:minmax(65px,.8fr) 1fr 1fr auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid ' + border + ';">' +
          '<strong style="color:' + textColor + ';">EPS</strong><span style="color:' + labelColor + ';">' + t('home.eng_actual', 'Actual') + ' <strong style="color:' + textColor + ';">' + formatEps(report.epsActual) + '</strong></span><span style="color:' + labelColor + ';">' + t('home.eng_estimate', 'Estimate') + ' <strong style="color:' + textColor + ';">' + formatEps(report.epsEstimate) + '</strong></span>' + epsComparison + '</div>'
      : '';
    var revenueRow = numberOrNull(report.revenueActual) !== null || numberOrNull(report.revenueEstimate) !== null
      ? '<div style="display:grid;grid-template-columns:minmax(65px,.8fr) 1fr 1fr auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid ' + border + ';">' +
          '<strong style="color:' + textColor + ';">' + t('home.eng_revenue', 'Revenue') + '</strong><span style="color:' + labelColor + ';">' + t('home.eng_actual', 'Actual') + ' <strong style="color:' + textColor + ';">' + formatRevenue(report.revenueActual) + '</strong></span><span style="color:' + labelColor + ';">' + t('home.eng_estimate', 'Estimate') + ' <strong style="color:' + textColor + ';">' + formatRevenue(report.revenueEstimate) + '</strong></span>' + revenueComparison + '</div>'
      : '';

    return '<div style="margin:0 0 14px;padding:11px 12px;background:' + background + ';border:1px solid ' + border + ';border-left:3px solid #7E9BC4;border-radius:8px;font-size:11.5px;line-height:1.5;">' +
      heading +
      '<div style="color:' + textColor + ';margin-bottom:6px;"><strong>' + (report.reportedDate ? t('home.eng_reported', 'Reported') + ' ' + formatDate(report.reportedDate) : t('home.eng_latest_quarter', 'Latest quarter')) + '</strong>' +
        (quarter || year ? ' · ' + quarter + year : '') + fiscal + '</div>' +
      epsRow + revenueRow +
      '<div style="color:' + labelColor + ';font-size:9.5px;margin-top:5px;">' + t('home.eng_verified_finnhub', 'Verified Finnhub earnings data') + '</div>' +
    '</div>';
  };
})();
