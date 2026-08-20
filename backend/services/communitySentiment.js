const DEFAULT_MIN_TRADERS = 5;
const DEFAULT_CLEAR_THRESHOLD_PCT = 70;

const normalizeDirection = value => String(value || '').toUpperCase() === 'BUY' ? 'BUY'
  : String(value || '').toUpperCase() === 'SELL' ? 'SELL'
  : null;

const buildCommunitySentiment = (symbol, traderDirections, options = {}) => {
  const sym = String(symbol || '').toUpperCase().trim();
  const minTraders = Math.max(1, Number(options.minTraders) || DEFAULT_MIN_TRADERS);
  const clearThresholdPct = Math.min(100, Math.max(50, Number(options.clearThresholdPct) || DEFAULT_CLEAR_THRESHOLD_PCT));
  const directions = (traderDirections || []).map(item => normalizeDirection(item?.direction ?? item)).filter(Boolean);
  const buyCalls = directions.filter(direction => direction === 'BUY').length;
  const sellCalls = directions.filter(direction => direction === 'SELL').length;
  const uniqueTraders = buyCalls + sellCalls;
  const buyPct = uniqueTraders ? +((buyCalls / uniqueTraders) * 100).toFixed(2) : 0;
  const sellPct = uniqueTraders ? +(100 - buyPct).toFixed(2) : 0;
  const majorityPct = Math.max(buyPct, sellPct);
  const reliableSample = uniqueTraders >= minTraders;
  const clear = reliableSample && majorityPct >= clearThresholdPct;
  const direction = clear ? (buyPct > sellPct ? 'BUY' : 'SELL') : 'NEUTRAL';

  return {
    source: 'SwingRush community database',
    symbol: sym,
    uniqueTraders,
    openCalls: uniqueTraders,
    buyCalls,
    sellCalls,
    buyPct,
    sellPct,
    minTraders,
    clearThresholdPct,
    reliableSample,
    clear,
    direction,
  };
};

const getCommunitySentiment = async (symbol, options = {}) => {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) throw new Error('A stock ticker is required.');
  const Recommendation = require('../models/Recommendation');
  // One current public opinion per trader. Reposts amplify distribution but
  // are not independent trade decisions, and profile-only engine saves are
  // private, so neither belongs in community sentiment.
  const rows = await Recommendation.aggregate([
    {
      $match: {
        symbol: sym,
        isOpen: true,
        profileOnly: { $ne: true },
        source: { $ne: 'repost' },
      },
    },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$user', direction: { $first: '$direction' } } },
  ]);
  return {
    ...buildCommunitySentiment(sym, rows, options),
    retrievedAt: new Date().toISOString(),
  };
};

module.exports = {
  DEFAULT_CLEAR_THRESHOLD_PCT,
  DEFAULT_MIN_TRADERS,
  buildCommunitySentiment,
  getCommunitySentiment,
};
