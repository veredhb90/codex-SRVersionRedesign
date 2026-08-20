const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommunitySentiment } = require('../backend/services/communitySentiment');

test('community sentiment requires five unique traders before it is considered clear', () => {
  const sentiment = buildCommunitySentiment('NVDA', ['BUY', 'BUY', 'BUY', 'BUY']);
  assert.equal(sentiment.buyPct, 100);
  assert.equal(sentiment.reliableSample, false);
  assert.equal(sentiment.clear, false);
  assert.equal(sentiment.direction, 'NEUTRAL');
});

test('community sentiment identifies a reliable clear BUY majority', () => {
  const sentiment = buildCommunitySentiment('NVDA', ['BUY', 'BUY', 'BUY', 'BUY', 'SELL']);
  assert.equal(sentiment.buyPct, 80);
  assert.equal(sentiment.clear, true);
  assert.equal(sentiment.direction, 'BUY');
});

test('community sentiment identifies a reliable clear SELL majority', () => {
  const sentiment = buildCommunitySentiment('TSLA', ['SELL', 'SELL', 'SELL', 'SELL', 'BUY']);
  assert.equal(sentiment.sellPct, 80);
  assert.equal(sentiment.clear, true);
  assert.equal(sentiment.direction, 'SELL');
});

test('a reliable but mixed community has no clear direction', () => {
  const sentiment = buildCommunitySentiment('AAPL', ['BUY', 'BUY', 'BUY', 'SELL', 'SELL']);
  assert.equal(sentiment.buyPct, 60);
  assert.equal(sentiment.reliableSample, true);
  assert.equal(sentiment.clear, false);
  assert.equal(sentiment.direction, 'NEUTRAL');
});
