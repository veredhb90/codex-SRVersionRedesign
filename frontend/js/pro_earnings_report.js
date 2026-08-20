// One shared Company Reports & Events card for every Pro Engine surface.
(function () {
  function t(key, fallback) {
    return window.SRLang ? window.SRLang.t(key, fallback) : fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    var match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
    var date = match ? new Date(match[0] + 'T12:00:00Z') : null;
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
    return '<strong style="color:' + color + ';white-space:nowrap;font-size:10.5px;">' + escapeHtml(t(key, fallback)) +
      (surprise === null ? '' : ' ' + (surprise > 0 ? '+' : '') + surprise.toFixed(2) + '%') + '</strong>';
  }

  function sessionLabel(value) {
    if (value === 'Before Market Open') return t('home.eng_before_market_open', 'Before market open');
    if (value === 'After Market Close') return t('home.eng_after_market_close', 'After market close');
    return t('home.eng_time_tbd', 'Time TBD');
  }

  function safeSecLink(url, label, color) {
    var value = String(url || '');
    if (!/^https:\/\/www\.sec\.gov\/Archives\/edgar\//i.test(value)) return '';
    return '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener noreferrer" style="color:' + color + ';font-weight:750;text-decoration:none;white-space:nowrap;">' + escapeHtml(label) + ' ↗</a>';
  }

  function sameFiling(a, b) {
    if (!a || !b) return false;
    var accessionA = a.accessionNumber || a.secAccessionNumber;
    var accessionB = b.accessionNumber || b.secAccessionNumber;
    var urlA = a.url || a.secUrl;
    var urlB = b.url || b.secUrl;
    if (accessionA && accessionB) return accessionA === accessionB;
    return Boolean(urlA && urlB && urlA === urlB);
  }

  function daysUntil(value) {
    var match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
    if (!match) return null;
    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var target = new Date(match[0] + 'T00:00:00');
    return Math.round((target - today) / 86400000);
  }

  window.srProEarningsReportHtml = function (result, options) {
    options = options || {};
    result = result || {};
    var dark = options.theme === 'dark';
    var report = result.latestEarningsReport;
    var filing = result.latestSecFiling;
    var material = result.latestMaterialEvent;
    var next = (result.upcomingEarnings || [])[0];
    var background = dark ? 'var(--bg2)' : '#F7FAFE';
    var sectionBg = dark ? 'rgba(255,255,255,.025)' : '#FFFFFF';
    var border = dark ? 'var(--border)' : '#D8E3F0';
    var labelColor = dark ? 'var(--muted)' : '#607089';
    var textColor = dark ? 'var(--text)' : '#102442';
    var accent = dark ? '#8DB9FF' : '#215DA8';
    var hasAny = Boolean(report || filing || material || next);
    var html = '<div style="margin:0 0 14px;padding:12px;background:' + background + ';border:1px solid ' + border + ';border-radius:11px;font-size:11.5px;line-height:1.5;box-shadow:0 2px 10px rgba(13,34,68,.035);">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
        '<span style="width:27px;height:27px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:' + (dark ? 'rgba(141,185,255,.12)' : '#E8F1FC') + ';">🏢</span>' +
        '<div style="font-size:11px;font-weight:850;letter-spacing:.52px;color:' + textColor + ';">' + escapeHtml(t('home.eng_company_reports_events', 'COMPANY REPORTS & EVENTS')) + '</div>' +
        '<span style="margin-inline-start:auto;font-size:9.5px;color:' + labelColor + ';">Finnhub + SEC EDGAR</span>' +
      '</div>';

    if (!hasAny) {
      return html + '<div style="color:' + labelColor + ';padding:4px 1px;">' + escapeHtml(t('home.eng_reports_unavailable', 'No verified company report or event data was returned.')) + '</div></div>';
    }

    if (report) {
      var quarter = report.quarter != null ? 'Q' + report.quarter : '';
      var year = report.year != null ? 'FY' + report.year : '';
      var period = [quarter, year].filter(Boolean).join(' ');
      var announced = report.announcedDate || report.reportedDate;
      var epsComparison = comparison(report.epsActual, report.epsEstimate, report.epsSurprisePercent);
      var revenueComparison = comparison(report.revenueActual, report.revenueEstimate, report.revenueSurprisePercent);
      html += '<div style="background:' + sectionBg + ';border:1px solid ' + border + ';border-radius:9px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:7px;">' +
          '<strong style="font-size:11.5px;color:' + textColor + ';">' + escapeHtml(t('home.eng_latest_earnings_report', 'Latest earnings report')) + '</strong>' +
          (period ? '<span style="font-size:9.5px;font-weight:800;color:' + accent + ';background:' + (dark ? 'rgba(141,185,255,.1)' : '#EDF5FF') + ';padding:2px 7px;border-radius:999px;">' + escapeHtml(period) + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:7px 16px;flex-wrap:wrap;color:' + labelColor + ';margin-bottom:8px;">' +
          '<span><strong style="color:' + textColor + ';">' + escapeHtml(t('home.eng_announced', 'Announced')) + ':</strong> ' + (announced ? escapeHtml(formatDate(announced)) : escapeHtml(t('home.eng_announcement_unavailable', 'Date unavailable'))) + (announced && report.announcementSession ? ' · ' + escapeHtml(sessionLabel(report.announcementSession)) : '') + '</span>' +
          '<span><strong style="color:' + textColor + ';">' + escapeHtml(t('home.eng_fiscal_period_ended', 'Fiscal period ended')) + ':</strong> ' + escapeHtml(formatDate(report.fiscalPeriod)) + '</span>' +
        '</div>';

      if (report.earningsReleaseFiledDate) {
        html += '<div style="font-size:10.5px;color:' + labelColor + ';padding:6px 8px;background:' + background + ';border-radius:7px;margin-bottom:7px;">' +
          escapeHtml(t('home.eng_earnings_release_filed', 'Earnings-related 8-K filed')) + ' <strong style="color:' + textColor + ';">' + escapeHtml(formatDate(report.earningsReleaseFiledDate)) + '</strong>' +
          (!announced ? ' · ' + escapeHtml(t('home.eng_not_announcement_date', 'shown as a filing date, not an announcement date')) : '') +
          (safeSecLink(report.earningsReleaseSecUrl, t('home.eng_view_sec', 'View SEC'), accent) ? ' · ' + safeSecLink(report.earningsReleaseSecUrl, t('home.eng_view_sec', 'View SEC'), accent) : '') + '</div>';
      }

      if (numberOrNull(report.epsActual) !== null || numberOrNull(report.epsEstimate) !== null) {
        html += '<div style="display:grid;grid-template-columns:minmax(54px,.7fr) minmax(90px,1fr) minmax(90px,1fr) auto;gap:7px;align-items:center;padding:7px 0;border-top:1px solid ' + border + ';">' +
          '<strong style="color:' + textColor + ';">EPS</strong><span style="color:' + labelColor + ';">' + escapeHtml(t('home.eng_actual', 'Actual')) + ' <strong style="color:' + textColor + ';">' + formatEps(report.epsActual) + '</strong></span><span style="color:' + labelColor + ';">' + escapeHtml(t('home.eng_estimate', 'Estimate')) + ' <strong style="color:' + textColor + ';">' + formatEps(report.epsEstimate) + '</strong></span>' + epsComparison + '</div>';
      }
      if (numberOrNull(report.revenueActual) !== null || numberOrNull(report.revenueEstimate) !== null) {
        html += '<div style="display:grid;grid-template-columns:minmax(54px,.7fr) minmax(90px,1fr) minmax(90px,1fr) auto;gap:7px;align-items:center;padding:7px 0;border-top:1px solid ' + border + ';">' +
          '<strong style="color:' + textColor + ';">' + escapeHtml(t('home.eng_revenue', 'Revenue')) + '</strong><span style="color:' + labelColor + ';">' + escapeHtml(t('home.eng_actual', 'Actual')) + ' <strong style="color:' + textColor + ';">' + formatRevenue(report.revenueActual) + '</strong></span><span style="color:' + labelColor + ';">' + escapeHtml(t('home.eng_estimate', 'Estimate')) + ' <strong style="color:' + textColor + ';">' + formatRevenue(report.revenueEstimate) + '</strong></span>' + revenueComparison + '</div>';
      }
      if (report.secFiledDate) {
        html += '<div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding-top:7px;border-top:1px solid ' + border + ';color:' + labelColor + ';">' +
          '<strong style="color:' + textColor + ';">' + escapeHtml(report.secForm || 'SEC') + '</strong> · ' + escapeHtml(t('home.eng_sec_filed', 'Filed')) + ' ' + escapeHtml(formatDate(report.secFiledDate)) +
          (safeSecLink(report.secUrl, t('home.eng_view_sec', 'View SEC'), accent) ? ' · ' + safeSecLink(report.secUrl, t('home.eng_view_sec', 'View SEC'), accent) : '') + '</div>';
      }
      html += '</div>';
    } else {
      html += '<div style="color:' + labelColor + ';padding:8px 10px;background:' + sectionBg + ';border:1px solid ' + border + ';border-radius:9px;margin-bottom:8px;">' + escapeHtml(t('home.eng_earnings_unavailable', 'No verified reported-quarter data was returned.')) + '</div>';
    }

    var filingAlreadyShown = Boolean((report && report.secFiledDate && sameFiling(report, filing)) ||
      (material && material.duplicatesLatestEarnings && sameFiling(material, filing)));
    if (filing && !filingAlreadyShown) {
      var filingTitle = sameFiling(filing, material) && material.title ? material.title : t('home.eng_latest_sec_filing', 'Latest important SEC filing');
      html += '<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 2px;border-bottom:' + ((next || (material && !sameFiling(filing, material) && !material.duplicatesLatestEarnings)) ? '1px solid ' + border : '0') + ';">' +
        '<span style="font-size:14px;line-height:1.2;">📄</span><div style="min-width:0;flex:1;"><strong style="display:block;color:' + textColor + ';">' + escapeHtml(filingTitle) + '</strong>' +
        '<span style="color:' + labelColor + ';">' + escapeHtml(filing.form || 'SEC') + ' · ' + escapeHtml(t('home.eng_sec_filed', 'Filed')) + ' ' + escapeHtml(formatDate(filing.filedDate)) + '</span>' +
        (safeSecLink(filing.url, t('home.eng_view_sec', 'View SEC'), accent) ? '<span style="margin-inline-start:8px;">' + safeSecLink(filing.url, t('home.eng_view_sec', 'View SEC'), accent) + '</span>' : '') +
        (sameFiling(filing, material) && material.summary ? '<div style="color:' + labelColor + ';font-size:10.5px;margin-top:4px;line-height:1.45;">' + escapeHtml(material.summary) + '</div>' : '') + '</div></div>';
    }

    var materialIsDistinct = material && !material.duplicatesLatestEarnings && !sameFiling(material, filing) && !(report && sameFiling(material, report));
    if (materialIsDistinct) {
      html += '<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 2px;border-bottom:' + (next ? '1px solid ' + border : '0') + ';">' +
        '<span style="font-size:14px;line-height:1.2;">⚡</span><div style="min-width:0;flex:1;"><strong style="display:block;color:' + textColor + ';">' + escapeHtml(t('home.eng_latest_material_event', 'Latest material company event')) + '</strong>' +
        '<span style="color:' + labelColor + ';">' + escapeHtml(material.title || material.form || 'SEC event') + ' · ' + escapeHtml(formatDate(material.filedDate)) + '</span>' +
        (safeSecLink(material.url, t('home.eng_view_sec', 'View SEC'), accent) ? '<span style="margin-inline-start:8px;">' + safeSecLink(material.url, t('home.eng_view_sec', 'View SEC'), accent) + '</span>' : '') +
        (material.summary ? '<div style="color:' + labelColor + ';font-size:10.5px;margin-top:4px;line-height:1.45;">' + escapeHtml(material.summary) + '</div>' : '') + '</div></div>';
    }

    if (next) {
      var days = daysUntil(next.date);
      var urgent = days !== null && days >= 0 && days <= 3;
      var timing = sessionLabel(next.hour);
      html += '<div style="display:flex;gap:8px;align-items:flex-start;padding:9px 2px 1px;">' +
        '<span style="font-size:14px;line-height:1.2;">📅</span><div style="min-width:0;flex:1;"><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;"><strong style="color:' + textColor + ';">' + escapeHtml(t('home.eng_next_earnings', 'Next earnings')) + '</strong>' +
        (urgent ? '<span style="font-size:9px;font-weight:850;color:#fff;background:#C62828;padding:2px 7px;border-radius:999px;">' + escapeHtml(days === 0 ? t('feed.pe_today', 'TODAY') : days === 1 ? t('feed.pe_tomorrow', 'TOMORROW') : t('feed.pe_in_days', 'IN') + ' ' + days + ' ' + t('feed.pe_days', 'DAYS')) + '</span>' : '') + '</div>' +
        '<span style="color:' + labelColor + ';">' + escapeHtml(formatDate(next.date)) + ' · ' + escapeHtml(timing) + '</span>' +
        (next.scheduleStatus && /estimated/i.test(next.scheduleStatus) ? '<div style="color:' + labelColor + ';font-size:9.5px;margin-top:2px;">' + escapeHtml(t('home.eng_date_may_be_estimated', 'Calendar date may be estimated')) + '</div>' : '') + '</div></div>';
    }

    html += '<div style="color:' + labelColor + ';font-size:9px;margin-top:8px;opacity:.86;">' + escapeHtml(t('home.eng_reports_source', 'Earnings: Finnhub · Filings and events: SEC EDGAR')) + '</div></div>';
    return html;
  };
})();
