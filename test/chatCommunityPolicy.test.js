const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../backend/routes/chat.js'), 'utf8');

test('ticker chat automatically checks unique-trader community sentiment', () => {
  assert.match(source, /for \(const sym of symbols\)[\s\S]*?getCommunitySentiment\(sym\)/);
  assert.match(source, /Always mention this clear community positioning briefly/);
  assert.match(source, /Do not introduce it into the answer unless the user specifically asks/);
});

test('Pro Engine prompt keeps social context outside the score', () => {
  assert.match(source, /SWINGRUSH SOCIAL SENTIMENT \(context only; never included in the Pro score\)/);
  assert.match(source, /Social sentiment is separate context only and NEVER changes the technical score, AI-news score, combined score, direction, or confidence/);
});
