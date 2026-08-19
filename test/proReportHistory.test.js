const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../frontend/js/pro_report_history.js'), 'utf8');

const renderForLanguage = (lang, translations = {}) => {
  const window = {
    SRLang: {
      lang,
      t: (key, fallback) => translations[key] || fallback,
    },
  };
  vm.runInNewContext(source, { window, Date, Number });
  return window.srProReportHistoryHtml({
    generatedAt: '2026-08-19T15:00:00.000Z',
    direction: 'BUY',
    score: 8,
    previousReport: {
      generatedAt: '2026-08-18T15:00:00.000Z',
      direction: 'SELL',
      score: -11,
      entryPrice: 10,
      takeProfit: 9,
      stopLoss: 10.5,
      currentPrice: 8.8,
      performancePct: 12,
      status: 'TARGET_HIT',
      statusAt: '2026-08-19T13:30:00.000Z',
    },
  });
};

test('Pro report follow-up renders dated prior setup and verified result in English', () => {
  const html = renderForLanguage('en');
  assert.match(html, /PREVIOUS REPORT FOLLOW-UP/);
  assert.match(html, /SELL · -11/);
  assert.match(html, /Take profit reached/);
  assert.match(html, /\+12\.00%/);
  assert.match(html, /\$10\.00/);
});

test('Pro report follow-up uses Arabic and Hebrew labels without changing exact numbers', () => {
  const arabic = renderForLanguage('ar', {
    'home.eng_previous_follow_up': 'متابعة التقرير السابق',
    'home.eng_previous_target_hit': 'تم الوصول إلى هدف الربح',
  });
  const hebrew = renderForLanguage('he', {
    'home.eng_previous_follow_up': 'מעקב אחר הדוח הקודם',
    'home.eng_previous_target_hit': 'יעד הרווח הושג',
  });

  assert.match(arabic, /متابعة التقرير السابق/);
  assert.match(arabic, /تم الوصول إلى هدف الربح/);
  assert.match(hebrew, /מעקב אחר הדוח הקודם/);
  assert.match(hebrew, /יעד הרווח הושג/);
  assert.match(arabic, /SELL · -11/);
  assert.match(hebrew, /\+12\.00%/);
});
