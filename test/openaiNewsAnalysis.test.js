const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLatestEarningsReport } = require('../backend/services/openaiNewsAnalysis');

test('buildLatestEarningsReport merges the verified report date/revenue with EPS history', () => {
  const report = buildLatestEarningsReport({
    date: '2026-08-17', quarter: 2, year: 2027, hour: 'After Market Close',
    epsActual: 1.25, epsEstimate: 1.1,
    revenueActual: 30_000_000_000, revenueEstimate: 28_500_000_000,
  }, [{
    period: '2026-07-31', quarter: 2, year: 2027,
    epsActual: 1.25, epsEstimate: 1.1, surprisePercent: 13.64,
  }]);

  assert.deepEqual(report, {
    reportedDate: '2026-08-17',
    fiscalPeriod: '2026-07-31',
    quarter: 2,
    year: 2027,
    hour: 'After Market Close',
    epsActual: 1.25,
    epsEstimate: 1.1,
    epsSurprisePercent: 13.64,
    revenueActual: 30_000_000_000,
    revenueEstimate: 28_500_000_000,
    revenueSurprisePercent: 5.26,
    source: 'Finnhub earnings calendar/history',
  });
});

test('buildLatestEarningsReport falls back to latest EPS history when calendar data is absent', () => {
  const report = buildLatestEarningsReport(null, [{
    period: '2026-06-30', quarter: 2, year: 2026,
    epsActual: 0.8, epsEstimate: 0.75, surprisePercent: 6.67,
  }]);
  assert.equal(report.reportedDate, null);
  assert.equal(report.fiscalPeriod, '2026-06-30');
  assert.equal(report.epsActual, 0.8);
  assert.equal(report.revenueActual, null);
});
