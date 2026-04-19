const { getEngineRecommendation } = require('./yahooFinance');

// ── 200 US Stocks Universe ─────────────────────────────────────────
const STOCK_UNIVERSE = [
  // Mega cap tech
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AVGO','ORCL','AMD',
  // Finance
  'JPM','BAC','WFC','GS','MS','BLK','C','AXP','SCHW','USB',
  // Healthcare
  'UNH','JNJ','LLY','ABBV','MRK','TMO','ABT','DHR','BMY','AMGN',
  // Consumer
  'WMT','HD','COST','MCD','SBUX','NKE','TGT','LOW','TJX','BKNG',
  // Energy
  'XOM','CVX','COP','SLB','EOG','MPC','PSX','VLO','OXY','HAL',
  // Industrials
  'CAT','HON','UPS','BA','GE','MMM','RTX','LMT','DE','EMR',
  // Communication
  'NFLX','DIS','CMCSA','T','VZ','TMUS','ATVI','EA','TTWO','WBD',
  // Semiconductors
  'INTC','QCOM','TXN','MU','AMAT','LRCX','KLAC','MRVL','ON','SWKS',
  // Cloud/Software
  'CRM','ADBE','NOW','INTU','SNOW','DDOG','TEAM','ZM','OKTA','DOCU',
  // ETFs/Indices
  'SPY','QQQ','IWM','DIA','GLD','SLV','USO','UNG',
  // Growth
  'PLTR','RBLX','COIN','HOOD','SOFI','AFRM','UPST','LCID','RIVN','NIO',
  // Biotech
  'MRNA','BNTX','REGN','VRTX','BIIB','ILMN','IDXX','ALGN','DXCM','ISRG',
  // Real Estate
  'AMT','PLD','EQIX','CCI','SPG','O','WELL','DLR','PSA','EXR',
  // Retail/E-comm
  'EBAY','ETSY','SHOP','W','RVLV','APRN','FIGS','LULU','DECK','SKX',
  // Auto
  'GM','F','STLA','TM','HMC','RACE','PAG','AN','KMX','LAD',
  // Banks regional
  'PNC','TFC','KEY','CFG','FITB','HBAN','MTB','RF','ZION','CMA',
  // Utilities
  'NEE','DUK','SO','D','AEP','EXC','SRE','PEG','XEL','WEC',
  // Materials
  'LIN','APD','ECL','NEM','FCX','NUE','ALB','MOS','CF','IFF',
  // Media/Ent
  'PARA','FOXA','NYT','IAC','MATCH','BMBL','SNAP','PINS','TWTR','ZI',
  // Misc growth
  'UBER','LYFT','ABNB','DASH','RDFN','OPEN','OFLD','HIMS','ACHR','JOBY',
];

// ── Cache: store results for 30 minutes ───────────────────────────
const scanCache = new Map();
const SCAN_TTL  = 30 * 60 * 1000; // 30 minutes

// ── Scan with concurrency control ─────────────────────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const scanWithLimit = async (symbols, concurrency = 5) => {
  const results = [];
  const errors  = [];

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(sym => getEngineRecommendation(sym))
    );

    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        results.push({ symbol: batch[idx], ...r.value });
      } else {
        errors.push(batch[idx]);
      }
    });

    // Rate limit: wait 300ms between batches
    if (i + concurrency < symbols.length) await delay(300);

    // Log progress
    const done = Math.min(i + concurrency, symbols.length);
    console.log(`📊 Scanned ${done}/${symbols.length} stocks...`);
  }

  console.log(`✅ Scan complete. Success: ${results.length}, Failed: ${errors.length}`);
  return results;
};

// ── Main scanner ───────────────────────────────────────────────────
const getTop5 = async (forceRefresh = false) => {
  const cacheKey = 'top5scan';
  const cached   = scanCache.get(cacheKey);

  // Return cached if fresh
  if (!forceRefresh && cached && Date.now() - cached.ts < SCAN_TTL) {
    console.log('📦 Returning cached Top 5 scan');
    return { ...cached.data, cached: true, cachedAt: cached.ts };
  }

  console.log('🔍 Starting Top 5 stock scan...');
  const startTime = Date.now();

  // Scan all stocks
  const allResults = await scanWithLimit(STOCK_UNIVERSE, 5);

  // Score and rank
  const ranked = allResults
    .filter(r => r.score !== undefined && Math.abs(r.score) >= 2) // min score threshold
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));      // highest abs score first

  // Top 5 BUY and top 5 SELL
  const topBuys  = ranked.filter(r => r.direction === 'BUY').slice(0, 5);
  const topSells = ranked.filter(r => r.direction === 'SELL').slice(0, 5);
  const top5     = ranked.slice(0, 5); // overall top 5 regardless of direction

  const result = {
    top5,
    topBuys,
    topSells,
    scannedAt:   new Date(),
    scannedCount: allResults.length,
    duration:    Math.round((Date.now() - startTime) / 1000),
    cached:      false,
  };

  // Cache the result
  scanCache.set(cacheKey, { data: result, ts: Date.now() });

  return result;
};

// ── Quick scan: only scan 50 most liquid stocks (faster) ──────────
const QUICK_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AVGO','JPM','BAC',
  'UNH','LLY','XOM','WMT','HD','NFLX','AMD','QCOM','ORCL','ABBV',
  'MRK','TMO','CRM','COST','MCD','INTC','TXN','COP','NEE','HON',
  'AMGN','SBUX','GS','MS','NKE','ADBE','NOW','INTU','PLTR','COIN',
  'GLD','SLV','USO','QQQ','SPY','MRNA','REGN','VRTX','BIIB','ISRG',
];

const getTop5Quick = async (forceRefresh = false) => {
  const cacheKey = 'top5quick';
  const cached   = scanCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.ts < SCAN_TTL) {
    return { ...cached.data, cached: true, cachedAt: cached.ts };
  }

  console.log('⚡ Starting Quick Top 5 scan (50 stocks)...');
  const startTime = Date.now();

  const allResults = await scanWithLimit(QUICK_UNIVERSE, 5);

  const ranked = allResults
    .filter(r => r.score !== undefined)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const topBuys  = ranked.filter(r => r.direction === 'BUY').slice(0, 5);
  const topSells = ranked.filter(r => r.direction === 'SELL').slice(0, 5);
  const top5     = ranked.slice(0, 5);

  const result = {
    top5, topBuys, topSells,
    scannedAt:    new Date(),
    scannedCount: allResults.length,
    duration:     Math.round((Date.now() - startTime) / 1000),
    cached:       false,
  };

  scanCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
};

module.exports = { getTop5, getTop5Quick, STOCK_UNIVERSE };
