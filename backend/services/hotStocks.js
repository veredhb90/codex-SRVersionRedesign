const HOT_STOCKS_PREVIEW_LIMIT = 10;

const buildHotStocksPipeline = ({ showAll = false } = {}) => {
  const pipeline = [
    {
      $match: {
        isOpen: true,
        profileOnly: { $ne: true },
        source: { $ne: 'repost' },
      },
    },
    {
      $group: {
        _id: '$symbol',
        count: { $sum: 1 },
        buys: { $sum: { $cond: [{ $eq: ['$direction', 'BUY'] }, 1, 0] } },
        sells: { $sum: { $cond: [{ $eq: ['$direction', 'SELL'] }, 1, 0] } },
      },
    },
    { $sort: { count: -1, _id: 1 } },
  ];

  if (!showAll) pipeline.push({ $limit: HOT_STOCKS_PREVIEW_LIMIT });
  return pipeline;
};

module.exports = { HOT_STOCKS_PREVIEW_LIMIT, buildHotStocksPipeline };
