const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HOT_STOCKS_PREVIEW_LIMIT,
  buildHotStocksPipeline,
} = require('../backend/services/hotStocks');

test('Hot Stocks preview ranks open public trades high-to-low and returns ten symbols', () => {
  const pipeline = buildHotStocksPipeline();

  assert.deepEqual(pipeline[0], {
    $match: {
      isOpen: true,
      profileOnly: { $ne: true },
      source: { $ne: 'repost' },
    },
  });
  assert.deepEqual(pipeline.at(-2), { $sort: { count: -1, _id: 1 } });
  assert.deepEqual(pipeline.at(-1), { $limit: HOT_STOCKS_PREVIEW_LIMIT });
  assert.equal(HOT_STOCKS_PREVIEW_LIMIT, 10);
});

test('Hot Stocks full list keeps the ranking and removes the result limit', () => {
  const pipeline = buildHotStocksPipeline({ showAll: true });

  assert.deepEqual(pipeline.at(-1), { $sort: { count: -1, _id: 1 } });
  assert.equal(pipeline.some(stage => '$limit' in stage), false);
});
