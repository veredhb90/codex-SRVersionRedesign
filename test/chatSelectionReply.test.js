const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../frontend/js/chat.js'), 'utf8');

test('reply popup accepts short words and long selected answers', () => {
  assert.match(source, /if \(text && sel\.rangeCount\)/);
  assert.doesNotMatch(source, /text\.length > 3/);
  assert.doesNotMatch(source, /text\.length < 300/);
  assert.match(source, /MAX_QUOTED_TEXT_LENGTH = 4000/);
});

test('reply popup uses fixed viewport coordinates and Safari text selection', () => {
  assert.match(source, /-webkit-user-select:text; user-select:text/);
  assert.match(source, /window\.visualViewport/);
  assert.match(source, /messages\.contains\(startBubble\)/);
  assert.match(source, /messages\.contains\(endBubble\)/);
  assert.doesNotMatch(source, /rect\.top[^\n]+window\.scrollY/);
});

test('reply popup remains visible for a short selection on a scrolled page', () => {
  const block = source.match(/var MAX_QUOTED_TEXT_LENGTH = 4000;[\s\S]*?\n  document\.addEventListener\('mouseup'/);
  assert.ok(block, 'selection helper block should be present');

  const bubble = {};
  const textNode = { nodeType: 3, parentElement: { closest: () => bubble } };
  const range = {
    startContainer: textNode,
    endContainer: textNode,
    getBoundingClientRect: () => ({ left: 100, top: 100, right: 140, bottom: 120, width: 40, height: 20 }),
  };
  const selection = { rangeCount: 1, toString: () => 'AI', getRangeAt: () => range };
  const popup = { style: {}, dataset: {}, offsetWidth: 160, offsetHeight: 32 };
  const context = {
    messages: { contains: node => node === bubble },
    selPopup: popup,
    window: { getSelection: () => selection, innerWidth: 800, innerHeight: 600, scrollY: 5000 },
  };

  const definitions = block[0].replace(/\n  document\.addEventListener\('mouseup'[\s\S]*$/, '');
  vm.runInNewContext(definitions, context);
  context.updateSelectionPopup();

  assert.equal(popup.style.display, 'flex');
  assert.equal(popup.style.top, '60px');
  assert.equal(popup.dataset.text, 'AI');
});

test('a long selected answer still offers reply and safely bounds the copied quote', () => {
  const block = source.match(/var MAX_QUOTED_TEXT_LENGTH = 4000;[\s\S]*?\n  document\.addEventListener\('mouseup'/);
  const bubble = {};
  const textNode = { nodeType: 3, parentElement: { closest: () => bubble } };
  const range = {
    startContainer: textNode,
    endContainer: textNode,
    getBoundingClientRect: () => ({ left: 50, top: 80, right: 250, bottom: 160, width: 200, height: 80 }),
  };
  const selection = { rangeCount: 1, toString: () => 'x'.repeat(5000), getRangeAt: () => range };
  const popup = { style: {}, dataset: {}, offsetWidth: 160, offsetHeight: 32 };
  const context = {
    messages: { contains: node => node === bubble },
    selPopup: popup,
    window: { getSelection: () => selection, innerWidth: 390, innerHeight: 844, scrollY: 0 },
  };

  const definitions = block[0].replace(/\n  document\.addEventListener\('mouseup'[\s\S]*$/, '');
  vm.runInNewContext(definitions, context);
  context.updateSelectionPopup();

  assert.equal(popup.style.display, 'flex');
  assert.equal(popup.dataset.text.length, 4000);
  assert.equal(popup.dataset.truncated, 'true');
});
