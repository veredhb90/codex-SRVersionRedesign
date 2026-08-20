const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../backend/routes/chat.js'), 'utf8');

test('watchlist remains available but is never treated as an owned position', () => {
  assert.match(source, /A watchlist contains research interests only; it is not proof that the user owns or plans to buy those stocks/);
  assert.match(source, /Watchlist \/ research interests only/);
  assert.match(source, /The watchlist is not the user's portfolio and does not prove ownership or intent to buy/);
});

test('broad account recommendations keep rejected research candidates out of the answer', () => {
  assert.match(source, /intermediate or rejected candidates are private research work and should normally stay out of the final answer/);
  assert.match(source, /give the strongest suitable choice and, only if helpful, one meaningful alternative/);
  assert.match(source, /Do not append unrelated Scanner warnings or a list of rejected watchlist stocks/);
});
