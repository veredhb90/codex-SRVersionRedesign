const { getEngineRecommendation } = require('./yahooFinance');
const mongoose = require('mongoose');

// ── S&P 500 + NASDAQ 100 universe (500 stocks) ─────────────────────
const STOCK_UNIVERSE = [
  // Mega cap tech
  'AAPL','MSFT','NVDA','GOOGL','GOOG','META','AMZN','TSLA','AVGO','ORCL',
  'AMD','ADBE','CRM','NOW','INTU','SNOW','DDOG','TEAM','MDB','NET',
  // Finance
  'JPM','BAC','WFC','GS','MS','BLK','C','AXP','SCHW','USB',
  'PNC','TFC','KEY','CFG','FITB','HBAN','MTB','RF','ZION','COF',
  'V','MA','PYPL','SQ','AFRM','SOFI','HOOD','COIN','NU','LC',
  // Healthcare
  'UNH','JNJ','LLY','ABBV','MRK','TMO','ABT','DHR','BMY','AMGN',
  'PFE','GILD','BIIB','REGN','VRTX','MRNA','BNTX','ISRG','IDXX','ALGN',
  'DXCM','HOLX','PODD','ACAD','EXAS','NTRA','RVMD','RXRX','ARWR','KRUS',
  // Consumer Discretionary
  'WMT','HD','COST','MCD','SBUX','NKE','TGT','LOW','TJX','BKNG',
  'ABNB','UBER','LYFT','DASH','DKNG','PENN','MGM','LVS','WYNN','CZR',
  'AMZN','ETSY','EBAY','W','RVLV','LULU','DECK','SKX','CROX','BOOT',
  // Energy
  'XOM','CVX','COP','SLB','EOG','MPC','PSX','VLO','OXY','HAL',
  'DVN','FANG','MRO','APA','BKR','NOV','HP','WHD','PTEN','NE',
  // Industrials
  'CAT','HON','UPS','BA','GE','MMM','RTX','LMT','DE','EMR',
  'NOC','GD','L3H','TXT','HEI','AXON','TASER','KTOS','RCAT','PLTR',
  'UBER','LYFT','GRAB','DIDI','ZIM','SBLK','GOGL','EGLE','GNK','SFL',
  // Communication
  'NFLX','DIS','CMCSA','T','VZ','TMUS','ATVI','EA','TTWO','RBLX',
  'SPOT','SNAP','PINS','RDDT','BMBL','MTCH','IAC','ZD','ANGI','YELP',
  // Semiconductors
  'INTC','QCOM','TXN','MU','AMAT','LRCX','KLAC','MRVL','ON','SWKS',
  'QRVO','MPWR','ENTG','MKSI','UCTT','ONTO','FORM','ACLS','WOLF','AMBA',
  'ARM','SMCI','NVMI','AEHR','SLAB','DIOD','IOSP','ALGM','SITM','NXPI',
  // Cloud/Software
  'WDAY','ZM','OKTA','DOCU','BILL','GTLB','CFLT','ESTC','DOMO','APPN',
  'PATH','AI','BBAI','SOUN','IREN','SMCI','VRT','DELL','HPE','NTAP',
  // Biotech
  'RXRX','CRSP','BEAM','EDIT','NTLA','VERV','BLUE','FATE','ACMR','ARCT',
  'SGEN','RCUS','FOLD','PRAX','KALV','VERA','IMVT','ALDX','CGEM','TGTX',
  // Real Estate REITs
  'AMT','PLD','EQIX','CCI','SPG','O','WELL','DLR','PSA','EXR',
  // Retail/E-comm
  'SHOP','MELI','SE','GLOB','PAGS','STNE','VTEX','OZON','CPNG','GRAB',
  // Auto / EV
  'TSLA','GM','F','STLA','RIVN','LCID','FSR','GOEV','NKLA','WKHS',
  'NIO','LI','XPEV','BYD','BIDU','PDD','JD','BABA','TCOM','VNET',
  // Materials
  'LIN','APD','ECL','NEM','FCX','NUE','ALB','MOS','CF','IFF',
  'MP','LITE','IIVI','CREE','FSLR','ENPH','SEDG','ARRY','CSIQ','JKS',
  // Utilities
  'NEE','DUK','SO','D','AEP','EXC','SRE','PEG','XEL','WEC',
  // ETFs/Commodities
  'GLD','SLV','USO','UNG','GDX','GDXJ','SIL','PPLT','CPER','PALL',
  'SPY','QQQ','IWM','DIA','XLF','XLK','XLE','XLV','XLI','XLU',
  // Growth/Speculative
  'RKLB','LUNR','RDW','ASTS','SATL','HIMS','ACHR','JOBY','LILM','EVTL',
  'IONQ','QUBT','RGTI','QMCO','IQM','BTBT','MSTR','RIOT','MARA','HUT',
];

// Remove duplicates
const UNIVERSE = [...new Set(STOCK_UNIVERSE)];
console.log(`📊 Stock universe: ${UNIVERSE.length} stocks`);

// ── Scan result schema ─────────────────────────────────────────────
const scanResultSchema = new mongoose.Schema({
  key:       { type: String, unique: true, default: 'latest' },
  results:   { type: Array,  default: [] },
  top5:      { type: Array,  default: [] },
  topBuys:   { type: Array,  default: [] },
  topSells:  { type: Array,  default: [] },
  scannedAt: { type: Date,   default: Date.now },
  scannedCount: { type: Number, default: 0 },
  duration:  { type: Number, default: 0 },
  running:   { type: Boolean, default: false },
}, { timestamps: true });

const ScanResult = mongoose.models.ScanResult || mongoose.model('ScanResult', scanResultSchema);

// ── Concurrency-limited scan ───────────────────────────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const scanBatch = async (symbols, concurrency = 5, onProgress) => {
  const results = [];
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(sym => getEngineRecommendation(sym)));
    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        const val = r.value;
        // Include ALL stocks with their scores, even noSignal
        results.push({ symbol: batch[idx], ...val, score: val.score || 0 });
      }
    });
    const done = Math.min(i + concurrency, symbols.length);
    if (done % 25 === 0) {
      console.log(`📊 Scanned ${done}/${symbols.length}...`);
      // Save partial results every 25 stocks so progress is not lost
      if (onProgress) await onProgress(results, done);
    }
    if (i + concurrency < symbols.length) await delay(600); // 400ms = ~12 batches/min = 60 calls/min safe
  }
  return results;
};

// ── Run full background scan ───────────────────────────────────────
let isScanning = false;

const runFullScan = async () => {
  if (isScanning) {
    console.log('⏳ Scan already running, skipping');
    return;
  }
  isScanning = true;
  const start = Date.now();
  console.log(`🔍 Starting full scan of ${UNIVERSE.length} stocks...`);
  // Clear yahooFinance memory cache so all stocks get fresh data
  const yf = require("./yahooFinance");
  if (yf.clearCache) yf.clearCache();

  try {
    // Mark as running in DB
    await ScanResult.findOneAndUpdate(
      { key: 'latest' },
      { running: true },
      { upsert: true }
    );

    const allResults = await scanBatch(UNIVERSE, 5, async (partial, done) => {
      // Save partial results to DB so users see progress even if scan interrupted
      const ranked = partial
        .filter(r => Math.abs(r.score||0) >= 4)
        .sort((a,b) => Math.abs(b.score)-Math.abs(a.score));
      await ScanResult.findOneAndUpdate(
        { key: 'latest' },
        {
          results:      ranked.slice(0,50),
          top5:         ranked.slice(0,5),
          topBuys:      ranked.filter(r=>r.direction==='BUY').slice(0,10),
          topSells:     ranked.filter(r=>r.direction==='SELL').slice(0,10),
          scannedCount: done,
          running:      true,
        },
        { upsert: true }
      );
    });

    // Sort by absolute score
    const ranked = allResults
      .filter(r => Math.abs(r.score||0) >= 4)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    const top5     = ranked.slice(0, 5);
    const topBuys  = ranked.filter(r => r.direction==='BUY').slice(0, 10);
    const topSells = ranked.filter(r => r.direction==='SELL').slice(0, 10);
    const duration = Math.round((Date.now()-start)/1000);

    // Save to MongoDB
    await ScanResult.findOneAndUpdate(
      { key: 'latest' },
      {
        results: ranked.slice(0, 50), // top 50 overall
        top5, topBuys, topSells,
        scannedAt:    new Date(),
        scannedCount: UNIVERSE.length,
        duration,
        running:      false,
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Scan complete: ${allResults.length} stocks in ${duration}s. Top score: ${top5[0]?.score || 0}`);
  } catch (err) {
    console.error('❌ Scan error:', err.message);
    await ScanResult.findOneAndUpdate({ key:'latest' }, { running:false }).catch(()=>{});
  } finally {
    isScanning = false;
  }
};

// ── Get latest results (instant from DB) ──────────────────────────
const getTop5 = async (forceRefresh = false) => {
  const doc = await ScanResult.findOne({ key: 'latest' });

  if (forceRefresh || !doc || !doc.scannedAt) {
    // Trigger background scan and return empty for now
    runFullScan().catch(console.error);
    return {
      top5: [], topBuys: [], topSells: [],
      scannedAt: null, scannedCount: 0, duration: 0,
      scanning: true,
      message: `🔍 Scanning ${UNIVERSE.length} stocks in background… Results ready in ~3-5 minutes. Refresh to check.`
    };
  }

  // Check if data is stale (> 6 hours on weekends, > 1 hour on weekdays)
  const now      = new Date();
  const age      = Date.now() - new Date(doc.scannedAt).getTime();
  const isWeekend = [0,6].includes(now.getUTCDay());
  const maxAge   = isWeekend ? 6*60*60*1000 : 60*60*1000;
  const isStale  = age > maxAge;

  // If stale and not currently scanning, trigger background rescan
  if (isStale && !doc.running && !isScanning) {
    console.log('📊 Scan stale, triggering background rescan...');
    runFullScan().catch(console.error);
  }

  return {
    top5:         doc.top5 || [],
    topBuys:      doc.topBuys || [],
    topSells:     doc.topSells || [],
    scannedAt:    doc.scannedAt,
    scannedCount: doc.scannedCount,
    duration:     doc.duration,
    scanning:     doc.running || isScanning,
    stale:        isStale,
    cached:       true,
    universeSize: UNIVERSE.length,
  };
};

// ── Schedule automatic scans ──────────────────────────────────────
// Run scan on startup (after 10 seconds to let server initialize)
setTimeout(() => {
  ScanResult.findOne({ key:'latest' }).then(doc => {
    if (!doc || !doc.scannedAt) {
      console.log('🚀 No scan data found, running initial scan...');
      runFullScan().catch(console.error);
    } else {
      const age = Date.now() - new Date(doc.scannedAt).getTime();
      if (age > 2*60*60*1000) { // older than 2 hours
        console.log('🔄 Scan data is old, refreshing...');
        runFullScan().catch(console.error);
      } else {
        console.log(`📦 Using existing scan data (${Math.round(age/60000)}min old)`);
      }
    }
  }).catch(() => {
    runFullScan().catch(console.error);
  });
}, 10000);

// Run every 2 hours on weekdays, every 6 hours on weekends
setInterval(() => {
  const now = new Date();
  const isWeekend = [0,6].includes(now.getUTCDay());
  if (!isWeekend || now.getUTCHours() % 6 === 0) {
    console.log('⏰ Scheduled scan starting...');
    runFullScan().catch(console.error);
  }
}, 2 * 60 * 60 * 1000); // check every 2 hours

module.exports = { getTop5, runFullScan, UNIVERSE };
