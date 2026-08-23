const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../frontend/js/pro_earnings_report.js'), 'utf8');
const secUrl = 'https://www.sec.gov/Archives/edgar/data/1234/0001/report.htm';

const render = (lang = 'en', translations = {}, overrides = {}) => {
  const window = { SRLang: { lang, t: (key, fallback) => translations[key] || fallback } };
  vm.runInNewContext(source, { window, Date, Number });
  return window.srProEarningsReportHtml({
    latestEarningsReport: {
      announcedDate: '2026-08-17', announcementSession: 'After Market Close',
      fiscalPeriod: '2026-07-31', quarter: 2, year: 2027,
      epsActual: 1.25, epsEstimate: 1.1, epsSurprisePercent: 13.64,
      revenueActual: 30_000_000_000, revenueEstimate: 28_500_000_000, revenueSurprisePercent: 5.26,
      earningsReleaseFiledDate: '2026-08-17', earningsReleaseSecUrl: secUrl,
      secForm: '10-Q', secFiledDate: '2026-08-18', secAccessionNumber: 'quarterly', secUrl,
    },
    latestSecFiling: { form: '10-Q', filedDate: '2026-08-18', accessionNumber: 'quarterly', url: secUrl },
    latestMaterialEvent: { form: '8-K', filedDate: '2026-08-17', accessionNumber: 'earnings', url: secUrl, title: 'Results of operations', duplicatesLatestEarnings: true },
    upcomingEarnings: [{ date: '2026-11-03', hour: 'Time TBD', scheduleStatus: 'Time TBD; date may be estimated' }],
    ...overrides,
  });
};

test('unified reports card clearly separates announcement, fiscal, filing, and next dates', () => {
  const html = render();
  assert.match(html, /COMPANY REPORTS &amp; EVENTS/);
  assert.match(html, /Announced/);
  assert.match(html, /Fiscal period ended/);
  assert.match(html, /Q2 FY2027/);
  assert.match(html, /EPS/);
  assert.match(html, /BEAT \+13\.64%/);
  assert.match(html, /\$30\.00B/);
  assert.match(html, /Filed/);
  assert.match(html, /Next earnings/);
  assert.match(html, /Time TBD/);
});

test('earnings-related material event is not rendered as a duplicate section', () => {
  const html = render();
  assert.doesNotMatch(html, /Latest material company event/);
  assert.equal((html.match(/Results of operations/g) || []).length, 0);
});

test('distinct material event is shown once', () => {
  const html = render('en', {}, {
    latestSecFiling: { form: '10-Q', filedDate: '2026-08-18', accessionNumber: 'quarterly', url: secUrl },
    latestMaterialEvent: { form: '8-K', filedDate: '2026-08-19', accessionNumber: 'event', url: secUrl + '?event=1', title: 'Director or executive change', duplicatesLatestEarnings: false },
  });
  assert.match(html, /Latest material company event/);
  assert.equal((html.match(/Director or executive change/g) || []).length, 1);
});

test('old snapshots suppress a fiscal period that occurs after the earnings filing', () => {
  const html = render('en', {}, {
    latestEarningsReport: {
      announcedDate: null,
      reportedDate: null,
      fiscalPeriod: '2026-06-30',
      quarter: 1,
      year: 2027,
      earningsReleaseFiledDate: '2026-05-27',
      earningsReleaseSecUrl: secUrl,
    },
  });
  assert.doesNotMatch(html, /Jun 30, 2026/);
  assert.match(html, /Fiscal period ended:<\/strong> Date unavailable/);
});

test('card uses translated Arabic and Hebrew headings', () => {
  const arabic = render('ar', { 'home.eng_company_reports_events': 'تقارير الشركة والأحداث' });
  const hebrew = render('he', { 'home.eng_company_reports_events': 'דוחות ואירועי חברה' });
  assert.match(arabic, /تقارير الشركة والأحداث/);
  assert.match(hebrew, /דוחות ואירועי חברה/);
  assert.match(arabic, /\$30\.00B/);
  assert.match(hebrew, /BEAT/);
});
