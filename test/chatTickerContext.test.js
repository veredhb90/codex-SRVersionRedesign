const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const chatRouteSource = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'routes', 'chat.js'),
  'utf8'
);

test('saved Pro reports are available on demand and never injected into every ticker question', () => {
  assert.match(chatRouteSource, /const symbols = extractSymbols\(message \|\| ''\);/);
  assert.match(chatRouteSource, /name: 'get_latest_pro_report'/);
  assert.match(chatRouteSource, /getLatestProReports\(\[sym\]\)/);
  assert.doesNotMatch(chatRouteSource, /const ambientReports = await getLatestProReports/);
  assert.doesNotMatch(chatRouteSource, /always acknowledge the latest saved report briefly/i);
});
