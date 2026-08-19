const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildStockHistory,
  marketDateKey,
  validateHistoryRequest,
} = require('../backend/services/stockHistory');

test('marketDateKey maps Yahoo timestamps to the US trading-session date', () => {
  assert.equal(marketDateKey(Date.parse('2026-08-18T13:30:00.000Z') / 1000), '2026-08-18');
});

test('buildStockHistory returns exact OHLC and server-calculated daily changes', () => {
  const result = buildStockHistory('NVDA', {
    t: [
      Date.parse('2026-08-17T13:30:00.000Z') / 1000,
      Date.parse('2026-08-18T13:30:00.000Z') / 1000,
    ],
    o: [220, 218.5],
    h: [221, 222.1],
    l: [218, 217.9],
    c: [219.74, 221.5],
    a: [219.74, 221.5],
    v: [1000, 1200],
  }, '2026-08-18');

  assert.equal(result.noTradingSession, false);
  assert.deepEqual(result.sessions[0], {
    date: '2026-08-18',
    time: Date.parse('2026-08-18T13:30:00.000Z') / 1000,
    open: 218.5,
    high: 222.1,
    low: 217.9,
    close: 221.5,
    adjustedClose: 221.5,
    volume: 1200,
    priorClose: 219.74,
    changeFromPriorClose: 1.76,
    changeFromPriorClosePct: 0.8,
    intradayOpenToClosePct: 1.37,
  });
});

test('buildStockHistory reports a non-trading date without inventing a candle', () => {
  const result = buildStockHistory('NVDA', {
    t: [Date.parse('2026-08-17T13:30:00.000Z') / 1000],
    o: [220], h: [221], l: [218], c: [219.74], v: [1000],
  }, '2026-08-16');
  assert.equal(result.noTradingSession, true);
  assert.deepEqual(result.sessions, []);
});

test('validateHistoryRequest rejects malformed, reversed, and future ranges', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');
  assert.throws(() => validateHistoryRequest('08/18/2026', undefined, now), /YYYY-MM-DD/);
  assert.throws(() => validateHistoryRequest('2026-08-19', '2026-08-18', now), /on or before/);
  assert.throws(() => validateHistoryRequest('2026-08-20', undefined, now), /future/);
});

test('buildStockHistory precomputes long-period split-adjusted performance and trims output', () => {
  const count = 40;
  const times = Array.from({ length: count }, (_, index) => Date.parse('2020-01-02T14:30:00.000Z') / 1000 + index * 86400);
  const closes = Array.from({ length: count }, (_, index) => 100 + index);
  const adjusted = Array.from({ length: count }, (_, index) => 50 + index);
  const result = buildStockHistory('TEST', {
    t: times, o: closes, h: closes, l: closes, c: closes, a: adjusted, v: closes.map(() => 1000),
  }, '2020-01-02', '2020-02-10');

  assert.equal(result.sessionCount, 40);
  assert.equal(result.sessions.length, 2);
  assert.equal(result.sessionsTruncated, true);
  assert.equal(result.periodPerformance.startClose, 100);
  assert.equal(result.periodPerformance.endClose, 139);
  assert.equal(result.periodPerformance.changePct, 78);
  assert.equal(result.periodPerformance.basis, 'split/dividend-adjusted close');
});

test('validateHistoryRequest permits an exact date older than one year', () => {
  const request = validateHistoryRequest('2005-08-18', undefined, new Date('2026-08-19T12:00:00.000Z'));
  assert.equal(request.start.toISOString(), '2005-08-18T00:00:00.000Z');
});
