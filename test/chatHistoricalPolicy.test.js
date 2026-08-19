const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../backend/routes/chat.js'), 'utf8');

test('chat exposes a dedicated historical-price tool with Yahoo-first and web fallback policy', () => {
  assert.match(source, /name: 'get_stock_history'/);
  assert.match(source, /how much it gained\/lost over any period/);
  assert.match(source, /split\/dividend-adjusted closes/);
  assert.match(source, /If get_stock_history returns no usable session, use web_search as a fallback/);
  assert.match(source, /getVerifiedStockHistory/);
});
