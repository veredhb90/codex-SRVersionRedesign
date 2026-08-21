const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../frontend/js/pro_result_summary.js'), 'utf8');

const render = (data, translations = {}) => {
  const window = { SRLang: { t: (key, fallback) => translations[key] || fallback } };
  vm.runInNewContext(source, { window, Number });
  return window.srProResultSummaryHtml(data);
};

test('Pro summary makes SELL, combined score, and today loss prominent', () => {
  const html = render({
    symbol: 'NVDA', price: 178.42, changePct: -2.37, direction: 'SELL', score: -11,
    confidence: 'Medium', technicalScore: -6, newsScore: -5, marketState: 'Regular Session',
  });
  assert.match(html, /sr-pro-summary sell/);
  assert.match(html, /▼<\/span><span>SELL/);
  assert.match(html, /Today: ▼ -2\.37%/);
  assert.match(html, /-11<small>\/24/);
  assert.match(html, /-6<small>\/14/);
  assert.match(html, /-5<small>\/10/);
});

test('Pro summary shows a signed BUY score and extended-session context', () => {
  const html = render({
    symbol: 'MET', price: 94.66, regularSessionPrice: 94.31, changePct: 1.25,
    direction: 'BUY', score: 13, confidence: 'High', technicalScore: 8, newsScore: 5,
    marketState: 'After-Hours',
  }, { 'home.eng_today_move': 'Today move' });
  assert.match(html, /Today move: ▲ \+1\.25%/);
  assert.match(html, /\+13<small>\/24/);
  assert.match(html, /After-Hours/);
  assert.match(html, /Regular Session Close/);
  assert.match(html, /\$94\.31/);
});

test('Pro summary animations are soft and respect reduced-motion preference', () => {
  assert.match(source, /srProSignalPulse 4\.8s ease-in-out infinite/);
  assert.match(source, /srProNumberFlash 5\.8s ease-in-out infinite/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /@container \(max-width:480px\)/);
});
