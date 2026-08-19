const test = require('node:test');
const assert = require('node:assert/strict');
const { combineProAnalysis, toReportSnapshot } = require('../backend/services/proReportService');

test('combineProAnalysis preserves SELL polarity and precomputes all price relationships', () => {
  const report = combineProAnalysis('nvda', {
    name: 'NVIDIA Corporation',
    price: 100,
    regularSessionPrice: 99,
    changePct: -1.25,
    marketState: 'Regular Session',
    priceTime: 1_700_000_000,
    score: -5,
    realAtr: 2,
    breakdown: [{ indicator: 'RSI', points: -2, note: 'Weak' }],
    signals: ['RSI weak'],
    change1w: -3,
    change1m: 4,
    candles: [{ time: 1, open: 101, high: 102, low: 99, close: 100 }],
  }, {
    score: -6,
    label: 'Bearish',
    summary: 'Risk increased.',
    catalysts: [],
    risks: ['Demand risk'],
    latestEarningsReport: { reportedDate: '2026-08-17', epsActual: 1.25, epsEstimate: 1.1 },
    priceTarget: { mean: 90, high: 110, low: 70, lastUpdated: '2026-08-19' },
    analyzedAt: '2026-08-19T05:00:00.000Z',
  }, new Date('2026-08-19T05:01:00.000Z'));

  assert.equal(report.symbol, 'NVDA');
  assert.equal(report.score, -11);
  assert.equal(report.direction, 'SELL');
  assert.equal(report.confidence, 'Medium');
  assert.equal(report.takeProfit, 93);
  assert.equal(report.stopLoss, 103);
  assert.equal(report.riskReward, 2.33);
  assert.equal(report.tpPct, -7);
  assert.equal(report.slPct, 3);
  assert.equal(report.targetUpsidePct, -10);
  assert.equal(report.latestEarningsReport.reportedDate, '2026-08-17');
});

test('toReportSnapshot removes chart history while preserving evidence and freshness', () => {
  const snapshot = toReportSnapshot({
    _id: 'report-1',
    generatedAt: new Date('2026-08-19T05:01:00.000Z'),
    freshUntil: new Date('2099-08-19T05:11:00.000Z'),
    report: {
      symbol: 'AAPL',
      score: 8,
      technicalBreakdown: [{ indicator: 'MACD', points: 2 }],
      priceHistory: [{ time: 1, close: 100 }],
      news: [{ headline: 'unused' }],
    },
  });

  assert.equal(snapshot.reportId, 'report-1');
  assert.equal(snapshot.symbol, 'AAPL');
  assert.equal(snapshot.isStale, false);
  assert.equal(snapshot.priceHistory, undefined);
  assert.equal(snapshot.news, undefined);
  assert.equal(snapshot.technicalBreakdown.length, 1);
});
