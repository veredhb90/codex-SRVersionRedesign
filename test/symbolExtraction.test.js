const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSymbols } = require('../backend/services/symbolExtraction');

test('extractSymbols recognizes tickers, cashtags, and company names', () => {
  assert.deepEqual(extractSymbols('What is the latest verified NVDA news today?'), ['NVDA']);
  assert.deepEqual(extractSymbols('Compare Apple with Tesla'), ['AAPL', 'TSLA']);
  assert.deepEqual(extractSymbols('Analyze $XYZ and $AAPL'), ['XYZ', 'AAPL']);
  assert.deepEqual(extractSymbols('F'), ['F']);
});

test('extractSymbols does not treat platform prose as stock symbols', () => {
  assert.deepEqual(extractSymbols('Explain the Pro Engine data, report results, and event dates.'), []);
  assert.deepEqual(extractSymbols('How does the scanner work and when does it update?'), []);
  assert.deepEqual(extractSymbols('I want accurate answers, not guesses.'), []);
});

test('extractSymbols does not mistake OHLC vocabulary for tickers', () => {
  assert.deepEqual(
    extractSymbols("What was NVDA's exact open, high, low, close, and percentage move?"),
    ['NVDA']
  );
  assert.deepEqual(extractSymbols('Show $LOW versus NVDA'), ['LOW', 'NVDA']);
});

test('extractSymbols works when Arabic or Hebrew text surrounds a ticker', () => {
  assert.deepEqual(extractSymbols('ما هو السعر الحالي لسهم NVDA؟'), ['NVDA']);
  assert.deepEqual(extractSymbols('מה הדוח האחרון של TSLA?'), ['TSLA']);
});
