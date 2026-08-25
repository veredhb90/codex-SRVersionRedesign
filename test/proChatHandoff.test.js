const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('Pro results offer an explicit Explore deeper button instead of an automatic chat prompt', () => {
  const chat = read('frontend/js/chat.js');
  assert.match(chat, /Explore deeper with AI chat/);
  assert.match(chat, /data-sr-pro-ai-explore/);
  assert.match(chat, /direction !== 'BUY' && direction !== 'SELL' && direction !== 'NEUTRAL'/);
  assert.match(chat, /dir === 'BUY' \? '▲' : dir === 'SELL' \? '▼' : '●'/);
  assert.match(chat, /showNewOrContinueChoice\(\)/);
  assert.doesNotMatch(chat, /showAskAiPrompt/);

  for (const file of ['frontend/js/engine.js', 'frontend/js/feed_v2.js', 'frontend/scanner.html']) {
    const source = read(file);
    assert.match(source, /srProAiExploreButtonHtml/);
    assert.match(source, /srAttachProAiExplore/);
    assert.doesNotMatch(source, /setChatStockContext\(d\)/);
  }
});

test('Pro modal handoff dismisses its source before opening either chat choice', () => {
  const chat = read('frontend/js/chat.js');
  assert.match(chat, /closest\('#sr-eng-pro-popup, #sr-pro-engine-modal, #symbol-modal'\)/);
  assert.match(chat, /function dismissPendingProSourceModal\(\)/);
  assert.match(chat, /sr-choice-new[\s\S]*?dismissPendingProSourceModal\(\);[\s\S]*?openChat\(\)/);
  assert.match(chat, /sr-choice-continue[\s\S]*?dismissPendingProSourceModal\(\);[\s\S]*?await openChat\(\)/);
});

test('Explore deeper is available for BUY, SELL, and NEUTRAL Pro results', () => {
  const chat = read('frontend/js/chat.js');
  const definition = chat.match(/window\.srProAiExploreButtonHtml = function\(stockData\) \{[\s\S]*?\n  \};/);
  assert.ok(definition, 'shared Pro explore-button renderer should be present');

  const context = {
    window: {},
    chatCopy: english => english,
  };
  vm.runInNewContext(definition[0], context);

  for (const direction of ['BUY', 'SELL', 'NEUTRAL']) {
    assert.match(context.window.srProAiExploreButtonHtml({ direction }), /data-sr-pro-ai-explore/);
  }
  assert.equal(context.window.srProAiExploreButtonHtml({ direction: 'UNKNOWN' }), '');
});
