const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../frontend/js/feed_v2.js'), 'utf8');
const start = source.indexOf('window.runProEngineModal = async function()');
const end = source.indexOf('// ── Mobile floating AI Pro Engine button', start);
const modalSource = source.slice(start, end);

test('only the standalone Pro Engine result popup requests the old dark result theme', () => {
  assert.ok(start >= 0 && end > start);
  assert.match(modalSource, /background:var\(--surface\);border:1px solid var\(--border2\);color:var\(--text\)/);
  assert.match(modalSource, /srProResultSummaryHtml\(d, \{ theme: 'dark' \}\)/);
  assert.match(modalSource, /srProEarningsReportHtml\(d, \{ theme: 'dark' \}\)/);
  assert.match(modalSource, /srProSocialSentimentHtml\(d, \{ theme: 'dark' \}\)/);
});
