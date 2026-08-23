const test = require('node:test');
const assert = require('node:assert/strict');
const { enrichReports, extractEarningsEventFacts, extractMaterialEventSummary, normalizeSecFilings } = require('../backend/services/companyReports');

const secPayload = {
  filings: {
    recent: {
      form: ['8-K', '10-Q'],
      filingDate: ['2026-08-05', '2026-08-06'],
      acceptanceDateTime: ['20260805163000', '20260806121500'],
      reportDate: ['', '2026-06-30'],
      accessionNumber: ['0000000000-26-000001', '0000000000-26-000002'],
      primaryDocument: ['earnings.htm', 'quarterly.htm'],
      items: ['2.02,9.01', ''],
    },
  },
};

test('SEC filings preserve filed/accepted/report dates, item meaning, and official links', () => {
  const filings = normalizeSecFilings(secPayload, 1234);
  assert.equal(filings.length, 2);
  assert.equal(filings[0].filedDate, '2026-08-05');
  assert.equal(filings[0].acceptedAt, '20260805163000');
  assert.deepEqual(filings[0].itemLabels, [
    'Results of operations and financial condition',
    'Financial statements and exhibits',
  ]);
  assert.equal(filings[1].reportDate, '2026-06-30');
  assert.match(filings[1].url, /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1234\//);
});

test('earnings announcement, fiscal period, and SEC filing dates remain separate', () => {
  const filings = normalizeSecFilings(secPayload, 1234);
  const data = enrichReports('TEST', {
    reportedDate: null,
    fiscalPeriod: '2026-06-30',
    quarter: 2,
    year: 2026,
    epsActual: 1.2,
    epsEstimate: 1.1,
  }, [], { companyName: 'Test Inc.', filings });

  assert.equal(data.latestEarningsReport.announcedDate, null);
  assert.equal(data.latestEarningsReport.earningsReleaseFiledDate, '2026-08-05');
  assert.equal(data.latestEarningsReport.fiscalPeriod, '2026-06-30');
  assert.equal(data.latestEarningsReport.secFiledDate, '2026-08-06');
  assert.equal(data.latestEarningsReport.secForm, '10-Q');
  assert.equal(data.latestMaterialEvent.duplicatesLatestEarnings, true);
});

test('earnings 8-K text and nearby 10-Q correct a conflicting provider period', () => {
  const payload = {
    filings: {
      recent: {
        form: ['8-K', '10-Q'],
        filingDate: ['2026-05-27', '2026-05-28'],
        acceptanceDateTime: ['20260527160607', '20260528160932'],
        reportDate: ['2026-05-27', '2026-05-02'],
        accessionNumber: ['0001835632-26-000014', '0001835632-26-000019'],
        primaryDocument: ['mrvl-20260527.htm', 'mrvl-20260502.htm'],
        items: ['2.02,9.01', ''],
      },
    },
  };
  const filings = normalizeSecFilings(payload, 1835632);
  const facts = extractEarningsEventFacts('<p>On May 27, 2026, Marvell Technology, Inc. issued a press release reporting its financial results for the first quarter of fiscal year 2027 ended May 2, 2026.</p>');
  const data = enrichReports('MRVL', {
    reportedDate: null,
    fiscalPeriod: '2026-06-30',
    quarter: 1,
    year: 2027,
    epsActual: 0.8,
    epsEstimate: 0.8076,
  }, [], { companyName: 'Marvell Technology, Inc.', filings }, facts);

  assert.deepEqual(facts, { announcedDate: '2026-05-27', fiscalPeriod: '2026-05-02' });
  assert.equal(data.latestEarningsReport.announcedDate, '2026-05-27');
  assert.equal(data.latestEarningsReport.fiscalPeriod, '2026-05-02');
  assert.equal(data.latestEarningsReport.providerFiscalPeriod, '2026-06-30');
  assert.equal(data.latestEarningsReport.secForm, '10-Q');
  assert.equal(data.latestEarningsReport.secFiledDate, '2026-05-28');
  assert.equal(data.latestEarningsReport.dateValidation, 'verified');
});

test('SEC evidence still supplies verified report dates when Finnhub returns no latest result', () => {
  const filings = normalizeSecFilings({
    filings: {
      recent: {
        form: ['8-K', '10-Q'],
        filingDate: ['2026-05-27', '2026-05-28'],
        acceptanceDateTime: ['20260527160607', '20260528160932'],
        reportDate: ['2026-05-27', '2026-05-02'],
        accessionNumber: ['0001835632-26-000014', '0001835632-26-000019'],
        primaryDocument: ['mrvl-20260527.htm', 'mrvl-20260502.htm'],
        items: ['2.02,9.01', ''],
      },
    },
  }, 1835632);
  const data = enrichReports('MRVL', null, [], { filings }, {
    announcedDate: '2026-05-27',
    fiscalPeriod: '2026-05-02',
  });

  assert.equal(data.latestEarningsReport.announcedDate, '2026-05-27');
  assert.equal(data.latestEarningsReport.fiscalPeriod, '2026-05-02');
  assert.equal(data.latestEarningsReport.secFiledDate, '2026-05-28');
  assert.equal(data.latestEarningsReport.dateValidation, 'verified');
});

test('a newer non-earnings 8-K remains a distinct material event', () => {
  const payload = JSON.parse(JSON.stringify(secPayload));
  payload.filings.recent.form.unshift('8-K');
  payload.filings.recent.filingDate.unshift('2026-08-12');
  payload.filings.recent.acceptanceDateTime.unshift('20260812170000');
  payload.filings.recent.reportDate.unshift('');
  payload.filings.recent.accessionNumber.unshift('0000000000-26-000003');
  payload.filings.recent.primaryDocument.unshift('leadership.htm');
  payload.filings.recent.items.unshift('5.02');
  const filings = normalizeSecFilings(payload, 1234);
  const data = enrichReports('TEST', {
    reportedDate: '2026-08-05', fiscalPeriod: '2026-06-30', quarter: 2, year: 2026,
  }, [], { filings });

  assert.equal(data.latestMaterialEvent.filedDate, '2026-08-12');
  assert.match(data.latestMaterialEvent.title, /Director or executive change/);
  assert.equal(data.latestMaterialEvent.duplicatesLatestEarnings, false);
});

test('material event text is extracted from the matching SEC item without exhibit noise', () => {
  const html = '<html><body><b>Item 8.01 Other Events.</b> On August 17, Test Inc. declared a quarterly dividend. <b>Item 9.01 Financial Statements and Exhibits.</b> Exhibit list</body></html>';
  assert.equal(extractMaterialEventSummary(html, ['8.01', '9.01']), 'On August 17, Test Inc. declared a quarterly dividend.');
});
