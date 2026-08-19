const test = require('node:test');
const assert = require('node:assert/strict');
const {
  combineProAnalysis,
  evaluatePreviousReport,
  toReportHistorySummary,
  toReportSnapshot,
} = require('../backend/services/proReportService');

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

test('toReportHistorySummary returns only the dated prior outcome', () => {
  const summary = toReportHistorySummary({
    _id: 'report-2',
    generatedAt: new Date('2026-08-18T14:30:00.000Z'),
    freshUntil: new Date('2026-08-18T14:40:00.000Z'),
    report: {
      symbol: 'ARWR',
      direction: 'SELL',
      score: -11,
      technicalScore: -5,
      newsScore: -6,
      newsSummary: 'This large field must not be copied into the comparison.',
      priceHistory: [{ time: 1, close: 10 }],
    },
  });

  assert.deepEqual(summary, {
    reportId: 'report-2',
    symbol: 'ARWR',
    generatedAt: '2026-08-18T14:30:00.000Z',
    direction: 'SELL',
    score: -11,
    technicalScore: -5,
    newsScore: -6,
    entryPrice: null,
    takeProfit: null,
    stopLoss: null,
  });
});

test('evaluatePreviousReport calculates SELL performance and proves a later target hit', () => {
  const result = evaluatePreviousReport({
    reportId: 'old-report',
    symbol: 'ARWR',
    generatedAt: '2026-08-18T14:30:00.000Z',
    direction: 'SELL',
    score: -11,
    entryPrice: 10,
    takeProfit: 9,
    stopLoss: 10.5,
  }, {
    price: 8.8,
    priceHistory: [
      // Same-day candle is excluded because part of it predates the report.
      { time: Date.parse('2026-08-18T13:30:00.000Z') / 1000, high: 10.6, low: 8.9 },
      { time: Date.parse('2026-08-19T13:30:00.000Z') / 1000, high: 10.2, low: 8.8 },
    ],
  });

  assert.equal(result.status, 'TARGET_HIT');
  assert.equal(result.statusAt, '2026-08-19T13:30:00.000Z');
  assert.equal(result.currentPrice, 8.8);
  assert.equal(result.performancePct, 12);
});

test('evaluatePreviousReport marks an unknowable same-candle TP/SL order as ambiguous', () => {
  const result = evaluatePreviousReport({
    generatedAt: '2026-08-18T14:30:00.000Z',
    direction: 'BUY',
    entryPrice: 100,
    takeProfit: 110,
    stopLoss: 95,
  }, {
    price: 102,
    priceHistory: [
      { time: Date.parse('2026-08-19T13:30:00.000Z') / 1000, high: 111, low: 94 },
    ],
  });

  assert.equal(result.status, 'AMBIGUOUS');
  assert.equal(result.performancePct, 2);
});
