const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../frontend/js/pro_social_sentiment.js'), 'utf8');

const render = communitySentiment => {
  const window = { SRLang: { t: (key, fallback) => fallback } };
  vm.runInNewContext(source, { window, Number });
  return window.srProSocialSentimentHtml({ communitySentiment });
};

test('social card shows a clear unique-trader majority as non-scoring context', () => {
  const html = render({
    buyCalls: 4,
    sellCalls: 1,
    buyPct: 80,
    sellPct: 20,
    uniqueTraders: 5,
    minTraders: 5,
    reliableSample: true,
    clear: true,
    direction: 'BUY',
  });

  assert.match(html, /SWINGRUSH SOCIAL SENTIMENT/);
  assert.match(html, /80% BUY/);
  assert.match(html, /5 unique traders/);
  assert.match(html, /Context only — not included in Pro score/);
  assert.doesNotMatch(html, /Score adjustment|\+1/);
});

test('social card shows undersized samples without presenting them as clear', () => {
  const html = render({
    buyCalls: 2,
    sellCalls: 0,
    buyPct: 100,
    sellPct: 0,
    uniqueTraders: 2,
    minTraders: 5,
    reliableSample: false,
    clear: false,
    direction: 'NEUTRAL',
  });

  assert.match(html, /Not enough community data/);
  assert.match(html, /2\/5 unique traders required/);
  assert.match(html, /not included in Pro score/);
});
