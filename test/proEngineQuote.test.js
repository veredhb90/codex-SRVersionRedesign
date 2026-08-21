const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateExtendedSessionChangePct } = require('../backend/services/proEngine');

test('extended-session move uses the displayed official regular close', () => {
  const result = calculateExtendedSessionChangePct(217.57, 216.85, 217.56);
  assert.equal(+result.toFixed(4), 0.3320);
});

test('extended-session move only falls back when the regular close is unavailable', () => {
  const result = calculateExtendedSessionChangePct(101, null, 100);
  assert.equal(+result.toFixed(2), 1);
});

test('extended-session move safely handles unusable values', () => {
  assert.equal(calculateExtendedSessionChangePct('bad', 100, 99), 0);
  assert.equal(calculateExtendedSessionChangePct(100, 0, 0), 0);
});
