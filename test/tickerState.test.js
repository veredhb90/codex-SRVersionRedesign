const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../frontend/js/ticker.js'), 'utf8');

const createTicker = quote => {
  const classes = new Set(['ticker-wrap', 'is-loading']);
  const wrap = {
    classList: {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)),
    },
  };
  const inner = {
    dataset: {},
    innerHTML: '',
    closest: () => wrap,
  };
  let onReady;
  const document = {
    getElementById: id => id === 'ticker-inner' ? inner : null,
    addEventListener: (event, handler) => { if (event === 'DOMContentLoaded') onReady = handler; },
  };
  vm.runInNewContext(source, {
    API: { quote },
    document,
    setInterval: () => 0,
    Promise,
  });
  return { classes, inner, run: onReady };
};

test('ticker collapses instead of leaving an empty dark strip when no quote loads', async () => {
  const ticker = createTicker(async () => { throw new Error('unavailable'); });
  await ticker.run();
  assert.equal(ticker.classes.has('is-loading'), false);
  assert.equal(ticker.classes.has('is-unavailable'), true);
});

test('ticker becomes visible and keeps the latest populated quotes', async () => {
  const ticker = createTicker(async symbol => ({ symbol, price: 100, changePct: 1.25 }));
  await ticker.run();
  assert.equal(ticker.classes.has('is-loading'), false);
  assert.equal(ticker.classes.has('is-unavailable'), false);
  assert.equal(ticker.inner.dataset.loaded, 'true');
  assert.match(ticker.inner.innerHTML, /AAPL/);
  assert.match(ticker.inner.innerHTML, /\u25b21\.25%/);
});
