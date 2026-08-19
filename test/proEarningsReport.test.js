const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../frontend/js/pro_earnings_report.js'), 'utf8');

const render = (lang = 'en', translations = {}) => {
  const window = { SRLang: { lang, t: (key, fallback) => translations[key] || fallback } };
  vm.runInNewContext(source, { window, Date, Number });
  return window.srProEarningsReportHtml({
    latestEarningsReport: {
      reportedDate: '2026-08-17', fiscalPeriod: '2026-07-31', quarter: 2, year: 2027,
      epsActual: 1.25, epsEstimate: 1.1, epsSurprisePercent: 13.64,
      revenueActual: 30_000_000_000, revenueEstimate: 28_500_000_000, revenueSurprisePercent: 5.26,
    },
  });
};

test('latest earnings card renders date, quarter, EPS and revenue results', () => {
  const html = render();
  assert.match(html, /LATEST EARNINGS REPORT/);
  assert.match(html, /Q2 FY2027/);
  assert.match(html, /\$1\.25/);
  assert.match(html, /\$1\.10/);
  assert.match(html, /BEAT \+13\.64%/);
  assert.match(html, /\$30\.00B/);
  assert.match(html, /\$28\.50B/);
});

test('latest earnings card uses translated Arabic and Hebrew headings', () => {
  const arabic = render('ar', { 'home.eng_latest_earnings_report': 'أحدث تقرير أرباح' });
  const hebrew = render('he', { 'home.eng_latest_earnings_report': 'דוח הרווחים האחרון' });
  assert.match(arabic, /أحدث تقرير أرباح/);
  assert.match(hebrew, /דוח הרווחים האחרון/);
  assert.match(arabic, /\$30\.00B/);
  assert.match(hebrew, /BEAT/);
});
