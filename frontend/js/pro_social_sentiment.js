(function() {
  function t(key, fallback) {
    return window.SRLang ? window.SRLang.t(key, fallback) : fallback;
  }

  window.srProSocialSentimentHtml = function(data, options) {
    data = data || {};
    options = options || {};
    var sentiment = data.communitySentiment;
    var dark = options.theme === 'dark';
    var background = dark ? 'var(--bg2)' : '#F8FAFF';
    var border = dark ? 'var(--border)' : '#D6E4F5';
    var text = dark ? 'var(--text)' : '#0D2244';
    var muted = dark ? 'var(--text2)' : '#64748b';
    var status;
    var detail;
    var statusColor = muted;

    if (!sentiment) {
      status = t('home.eng_social_unavailable', 'Community data unavailable');
      detail = t('home.eng_social_unavailable_detail', 'No current public trader calls were available');
    } else if (sentiment.clear) {
      var isBuy = sentiment.direction === 'BUY';
      var pct = isBuy ? sentiment.buyPct : sentiment.sellPct;
      statusColor = isBuy ? '#00893E' : '#C62828';
      status = pct + '% ' + sentiment.direction;
      detail = sentiment.buyCalls + ' ' + t('home.eng_social_buy_calls', 'BUY') + ' · ' +
        sentiment.sellCalls + ' ' + t('home.eng_social_sell_calls', 'SELL') + ' · ' +
        sentiment.uniqueTraders + ' ' + t('home.eng_social_unique_traders', 'unique traders');
    } else if (!sentiment.reliableSample) {
      status = t('home.eng_social_not_enough', 'Not enough community data');
      detail = sentiment.uniqueTraders + '/' + sentiment.minTraders + ' ' +
        t('home.eng_social_unique_required', 'unique traders required');
    } else {
      status = t('home.eng_social_no_clear', 'No clear community majority');
      detail = sentiment.buyPct + '% ' + t('home.eng_social_buy_calls', 'BUY') + ' · ' +
        sentiment.sellPct + '% ' + t('home.eng_social_sell_calls', 'SELL');
    }

    return '<div class="sr-pro-social" style="margin:10px 0 12px;padding:10px 12px;border:1px solid ' + border + ';border-radius:9px;background:' + background + ';">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-size:14px;" aria-hidden="true">👥</span>' +
        '<strong style="font-size:11px;letter-spacing:.7px;color:' + text + ';">' + t('home.eng_social_sentiment', 'SWINGRUSH SOCIAL SENTIMENT') + '</strong>' +
        '<span style="margin-left:auto;font-size:12px;font-weight:800;color:' + statusColor + ';">' + status + '</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:' + muted + ';">' +
        '<span>' + detail + '</span>' +
        '<span style="font-weight:800;color:' + muted + ';">' +
          t('home.eng_social_context_only', 'Context only — not included in Pro score') +
        '</span>' +
      '</div>' +
    '</div>';
  };
})();
