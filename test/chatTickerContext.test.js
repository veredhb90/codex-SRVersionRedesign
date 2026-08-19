const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const chatRouteSource = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'routes', 'chat.js'),
  'utf8'
);

test('automatic Pro report context uses only tickers in the current message', () => {
  assert.match(chatRouteSource, /const symbols = extractSymbols\(message \|\| ''\);/);
  assert.doesNotMatch(chatRouteSource, /const prevSyms = extractSymbols/);
  assert.doesNotMatch(chatRouteSource, /sticky symbol memory reused/i);
});
