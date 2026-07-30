const { getEngineRecommendation, getNewsSentiment } = require('./yahooFinance');
const mongoose = require('mongoose');

// ── 1000 Stock Universe ────────────────────────────────────────────
const STOCK_UNIVERSE = [
  // ── Mega Cap Tech ─────────────────────────────────────────────
  'AAPL','MSFT','NVDA','GOOGL','GOOG','META','AMZN','TSLA','AVGO','ORCL',
  'AMD','ADBE','CRM','NOW','INTU','SNOW','DDOG','TEAM','MDB','NET',
  'WDAY','ZM','OKTA','DOCU','BILL','GTLB','CFLT','ESTC','PATH','AI',
  'SOUN','VRT','DELL','HPE','NTAP','SMCI','ANET','FTNT','PANW','CRWD',
  'S','ZS','CHKP','CYBR','TENB','QLYS','VRNS','SASE','ILLM','HUBS',
  
  // ── Semiconductors ────────────────────────────────────────────
  'INTC','QCOM','TXN','MU','AMAT','LRCX','KLAC','MRVL','ON','SWKS',
  'MPWR','ENTG','WOLF','AMBA','ARM','NXPI','SITM','RMBS','FORM','ACLS',
  'COHU','UCTT','VECO','AXTI','OLED','IMOS','CEVA','POWI','DIOD','IXYS',
  
  // ── Finance & Banks ───────────────────────────────────────────
  'JPM','BAC','WFC','GS','MS','BLK','C','AXP','SCHW','USB',
  'PNC','TFC','KEY','CFG','FITB','HBAN','MTB','RF','ZION','COF',
  'V','MA','PYPL','SQ','AFRM','SOFI','HOOD','COIN','NU','LC',
  'ALLY','SLM','CACC','OMF','ENOVA','UPST','OPRT','TREE','RATE','OPEN',
  'BX','KKR','APO','ARES','CG','TPG','OWL','BLUE','HLNE','STEP',
  
  // ── Healthcare & Biotech ──────────────────────────────────────
  'UNH','JNJ','LLY','ABBV','MRK','TMO','ABT','DHR','BMY','AMGN',
  'PFE','GILD','BIIB','REGN','VRTX','MRNA','BNTX','ISRG','IDXX','ALGN',
  'DXCM','HOLX','PODD','ACAD','EXAS','NTRA','RVMD','RXRX','ARWR','KRUS',
  'VERA','IMVT','CGEM','TGTX','ALDX','FOLD','PRAX','CRSP','BEAM','EDIT',
  'VERV','FATE','ARCT','NTLA','SANA','GRPH','BLUE','IONS','SRPT','RARE',
  'ALNY','MDGL','RDVT','KRYS','DAWN','IRON','KALA','CORT','ACMR','ESTA',
  
  // ── Consumer ──────────────────────────────────────────────────
  'WMT','HD','COST','MCD','SBUX','NKE','TGT','LOW','TJX','BKNG',
  'ABNB','UBER','DASH','DKNG','LULU','DECK','SKX','CROX','BOOT','ETSY',
  'CHWY','PRTS','XRAY','RCUS','COUR','BMBL','MTCH','IAC','ANGI','CARS',
  'CVNA','KMX','AN','PAG','LAD','ABG','SAH','GPI','RUNN','CDW',
  
  // ── Energy ────────────────────────────────────────────────────
  'XOM','CVX','COP','SLB','EOG','MPC','PSX','VLO','OXY','HAL',
  'DVN','MRO','APA','BKR','NOV','PTEN','HP','WHD','NE','RIG',
  'FANG','PXD','CTRA','SM','MTDR','CPE','ESTE','BATL','CRGY','VTLE',
  'AR','RRC','EQT','SWN','COG','CNX','CRK','GPOR','RICE','TELL',
  
  // ── Clean Energy & Solar ──────────────────────────────────────
  'FSLR','ENPH','SEDG','ARRY','CSIQ','JKS','SPWR','RUN','NOVA','SHLS',
  'STEM','FLUX','BLDP','PLUG','FCEL','BE','BLOOM','HYLN','HYZN','EVGO',
  'CHPT','BLNK','VLTA','SBE','RIDE','GOEV','NKLA','WKHS','XL','AYRO',
  
  // ── Industrials ───────────────────────────────────────────────
  'CAT','HON','UPS','BA','GE','RTX','LMT','DE','EMR','NOC',
  'GD','HEI','AXON','PLTR','KTOS','RCAT','DRS','CACI','SAIC','BAH',
  'LDOS','MANT','VSE','ACCO','DRS','TDG','HWM','TXT','HEICO','SPR',
  'MRCY','FLIR','CDNS','ANSYS','PTC','DASSTY','AZPN','ESLT','ESYS',
  
  // ── Communication & Media ─────────────────────────────────────
  'NFLX','DIS','CMCSA','T','VZ','TMUS','EA','TTWO','RBLX',
  'SPOT','SNAP','PINS','RDDT','BMBL','MTCH','IAC','MGNI','TTD','PUBM',
  'APPS','IAS','VIAD','SQSP','WIX','WEBS','GCI','NEW','PRGO',
  
  // ── Real Estate ───────────────────────────────────────────────
  'AMT','PLD','EQIX','CCI','SPG','O','WELL','DLR','PSA','EXR',
  'VICI','GLPI','MPW','OHI','SBAC','AMH','INVH','ELS','SUI','UDR',
  'EQR','AVB','MAA','NNN','WPC','STOR','ADC','NTST','EPRT','AGREE',
  
  // ── Auto & EV ────────────────────────────────────────────────
  'GM','F','RIVN','LCID','NIO','LI','XPEV','TSLA','FSR','GOEV',
  'NKLA','WKHS','RIDE','SOLO','AYRO','IDEX','MULN','FFIE','PEV',
  
  // ── Space & Defense Tech ──────────────────────────────────────
  'RKLB','LUNR','ASTS','ACHR','JOBY','LILM','EVEX','SPCE','ASTR','RDW',
  'SATL','MNTS','PL','BKSY','VORB','KORE','ORBC','GSAT','IRDM','VSAT',
  
  // ── Quantum & AI ──────────────────────────────────────────────
  'IONQ','QUBT','RGTI','QMCO','ARQQ','IQM','DFLI','BTBT','BBAI',
  'GFAI','AITX','POSH','ABST','MIND','INPX','IDAI','SMAR','APLD',
  
  // ── Crypto & Blockchain ───────────────────────────────────────
  'MSTR','RIOT','MARA','HUT','BITF','BTBT','CIFR','CLSK','IREN','WULF',
  'CORZ','BTCS','BTCM','SOS','EBON','BTMX','MGTI','DPRO','HIVE',
  
  // ── Materials & Mining ────────────────────────────────────────
  'NEM','FCX','ALB','MOS','CF','LIN','APD','ECL','PPG','SHW',
  'MP','UAMY','UUUU','USAR','POLA','REX','HL','CDE','PAAS','AG',
  'WPM','FNV','RGLD','OR','SILV','EXK','MAG','AEM','KGC','AU',
  
  // ── Biotech Small Cap ────────────────────────────────────────
  'OCGN','GOVX','NVAX','VXRT','SRNE','SIGA','MNMD','RXMD',
  'DRUG','MRIN','SHOT','ILUS','CIDM','KMPH','ALDX','ACCD','ACRS',
  'ACER','ACET','ACHL','ACNB','ACST','AGTC','AHPI','AINV','AIXI',
  
  // ── Small Caps Under $20 ─────────────────────────────────────
  'SNDL','GNUS','CLOV','WISH','BBIG','PROG','IMPP','CEI','ATER',
  'MEGL','NAKD','EXPR','GME','AMC','INDO','KOSS','FFIE','MULN',
  'WORX','CRKN','PHIL','NOK','VALE','ABEV','ITUB','PBR','SID','GGB',
  'FUTU','TIGR','QFIN','LKNCY','BABA','JD','PDD','BIDU','NTES','IQ',
  
  // ── Utilities ────────────────────────────────────────────────
  'NEE','DUK','SO','AEP','EXC','SRE','PEG','XEL','WEC','ES',
  'ETR','PPL','CMS','NI','AEE','POR','IDA','AVA','NWE','OTTR',
  
  // ── ETFs & Commodities ────────────────────────────────────────
  'GLD','SLV','USO','UNG','GDX','GDXJ','PPLT','CPER',
  'SPY','QQQ','IWM','DIA','XLF','XLK','XLE','XLV','XLI','XLU',
  'ARKK','ARKG','ARKW','ARKF','ARKI','PRNT','IZRL',
  
  // ── REITs & Mortgage ─────────────────────────────────────────
  'NLY','AGNC','TWO','MFA','RWT','CIM','IVR','PMT','NYMT','EFC',
  
  // ── Consumer Staples ─────────────────────────────────────────
  'PG','KO','PEP','UL','CL','GIS','K','CPB','MKC','HRL',
  'SJM','CAG','HSY','MDLZ','MNST','KDP','KHC','POST','SMPL',
  
  // ── Retail ───────────────────────────────────────────────────
  'AMZN','WMT','COST','TGT','HD','LOW','BBY','DG','DLTR','FIVE',
  'OLLI','BIG','PRTY','EXPR','ANF','AEO','URBN','PVH','RL','TPR',
  
  // ── Travel & Leisure ─────────────────────────────────────────
  'BKNG','EXPE','ABNB','TRIP','LYFT','UBER','CCL','RCL','NCLH','MAR',
  'HLT','H','IHG','CHH','STAY','SHO','PK','RHP','HST','APLE',
  
  // ── Insurance ────────────────────────────────────────────────
  'BRK.B','MET','PRU','AFL','ALL','TRV','CB','AIG','HIG','WR',
  'CNA','CINF','RLI','SKY','KMPR','ERIE','SIGI','STFC',
  
  // ── Pharma Large Cap ─────────────────────────────────────────
  'JNJ','PFE','MRK','ABBV','BMY','LLY','AMGN','GILD','BIIB','REGN',
  'VRTX','ALXN','SGEN','BMRN','EXEL','HALO','INVA','ITCI','JAZZ',
];

const UNIVERSE = [...new Set(STOCK_UNIVERSE)];
console.log(`📊 Stock universe: ${UNIVERSE.length} stocks`);

// ── Scan Result Schema ─────────────────────────────────────────────
const scanResultSchema = new mongoose.Schema({
  key:          { type: String, unique: true, default: 'latest' },
  results:      { type: Array,  default: [] },
  top5:         { type: Array,  default: [] },
  topBuys:      { type: Array,  default: [] },
  topSells:     { type: Array,  default: [] },
  scannedAt:    { type: Date,   default: Date.now },
  scannedCount: { type: Number, default: 0 },
  technicalResults: { type: Number, default: 0 },
  newsEnrichedCount: { type: Number, default: 0 },
  phase:        { type: String, default: 'idle' },
  resultStage:  { type: String, default: 'idle' },
  refreshStartedAt: { type: Date, default: null },
  lastCompletedAt: { type: Date, default: null },
  nextScheduledAt: { type: Date, default: null },
  technicalCandidates: { type: Array, default: [] },
  duration:     { type: Number, default: 0 },
  running:      { type: Boolean, default: false },
}, { timestamps: true });

const ScanResult = mongoose.models.ScanResult || mongoose.model('ScanResult', scanResultSchema);
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const withTimeout = (work, ms, label) => Promise.race([
  work,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
]);

const MIN_ACTIONABLE_SCORE = 4;
const WEEKDAY_SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000;

const getNextWeekdayScanAt = (from = new Date()) => {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours((Math.floor(next.getUTCHours() / 4) + 1) * 4);
  while ([0, 6].includes(next.getUTCDay())) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
  }
  return next;
};

// ── PHASE 1: Technical scan (Yahoo Finance only) ───────────────────
const scanTechnical = async (symbols, onProgress) => {
  const results = [];
  let failures = 0;
  const concurrency = 6;
  const marketRegime = await getEngineRecommendation('SPY', { skipNews: true, skipWeekly: true })
    .then(result => ({ regime: result.regime || 'unknown' }))
    .catch(() => ({ regime: 'unknown' }));
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(sym => withTimeout(
        getEngineRecommendation(sym, { skipNews: true, skipWeekly: true, regime: marketRegime }),
        15000,
        `Technical scan for ${sym}`
      ))
    );
    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        const val = r.value;
        results.push({ symbol: batch[idx], ...val, score: val.score || 0 });
      } else {
        failures++;
      }
    });
    const done = Math.min(i + concurrency, symbols.length);
    if (done % 50 === 0) console.log(`📊 Phase 1: ${done}/${symbols.length} scanned...`);
    if (onProgress && (done % 30 === 0 || done === symbols.length)) await onProgress(done);
    if (i + concurrency < symbols.length) await delay(250);
  }
  console.log(`📊 Phase 1 complete: ${results.length}/${symbols.length} technical results (${failures} unavailable)`);
  return results;
};

const confidenceForScore = (abs) => {
  if (abs >= 14) return 'Very High';
  if (abs >= 10) return 'High';
  if (abs >= 7)  return 'Medium';
  return 'Low';
};

const applyTradePlan = (stock) => {
  const absScore = Math.abs(stock.score || 0);
  if (absScore < MIN_ACTIONABLE_SCORE) {
    stock.direction = 'NEUTRAL';
    stock.confidence = 'Insufficient';
    stock.takeProfit = null;
    stock.stopLoss = null;
    stock.riskReward = null;
    stock.noSignal = true;
    stock.noSignalReason = `Score ${stock.score > 0 ? '+' : ''}${stock.score} — below minimum threshold of ±${MIN_ACTIONABLE_SCORE}.`;
    return stock;
  }

  const direction = stock.score > 0 ? 'BUY' : 'SELL';
  const atrValue = Number(stock.atrValue) > 0 ? Number(stock.atrValue) : stock.price * 0.025;
  const tpMult = absScore >= 12 ? 4.5 : absScore >= 8 ? 3.5 : absScore >= 5 ? 2.5 : 2.0;
  const slMult = 1.5;
  const pricePrecision = stock.price < 0.01 ? 6 : stock.price < 1 ? 4 : 2;
  const roundPrice = (value) => +value.toFixed(pricePrecision);
  const takeProfit = direction === 'BUY'
    ? roundPrice(stock.price + atrValue * tpMult)
    : roundPrice(stock.price - atrValue * tpMult);
  const stopLoss = direction === 'BUY'
    ? roundPrice(stock.price - atrValue * slMult)
    : roundPrice(stock.price + atrValue * slMult);

  stock.direction = direction;
  stock.confidence = confidenceForScore(absScore);
  stock.takeProfit = takeProfit;
  stock.stopLoss = stopLoss;
  stock.riskReward = +(Math.abs(takeProfit - stock.price) / Math.abs(stopLoss - stock.price)).toFixed(2);
  stock.noSignal = false;
  delete stock.noSignalReason;
  return stock;
};

// ── PHASE 2: Full-universe news enrichment, then rank the combined score ──
const enrichWithNews = async (stocks, onProgress, startAt = 0) => {
  console.log(`📰 Phase 2: Fetching news for all ${stocks.length} technical results...`);
  stocks.forEach(stock => {
    if (stock.newsEnriched) return;
    stock.technicalScore = Number(stock.score || 0);
    stock.newsScore = 0;
    stock.newsLabel = 'Neutral';
    stock.analystScore = 0;
    stock.newsArticleCount = 0;
  });
  for (let i = startAt; i < stocks.length; i += 2) {
    const batch = stocks.slice(i, i + 2);
    // A vendor request must never hold the entire full-universe run indefinitely.
    const newsResults = await Promise.allSettled(
      batch.map(s => withTimeout(getNewsSentiment(s.symbol), 20000, `News for ${s.symbol}`))
    );
    newsResults.forEach((nr, idx) => {
      const stock = batch[idx];
      stock.newsEnriched = true;
      if (nr.status === 'fulfilled' && nr.value) {
        const news  = nr.value;
        stock.score       += news.score || 0;
        stock.newsLabel    = news.label;
        stock.newsScore    = news.score;
        stock.analystScore = news.analystScore || 0;
        stock.newsArticleCount = news.totalArticles || 0;
        stock.analystLabel = news.analystLabel;
        stock.news         = news.news;
        console.log(`  ✅ ${stock.symbol}: tech=${stock.score - (news.score||0)} + news=${news.score||0} = ${stock.score}`);
      }
    });
    const done = Math.min(i + 2, stocks.length);
    if (onProgress) await onProgress(done, i, batch);
    // Two Finnhub calls per symbol. Keep the shared production quota below 30 req/min.
    if (i + 2 < stocks.length) await delay(8000);
  }
  return stocks.map(applyTradePlan);
};

// ── Main scanner ───────────────────────────────────────────────────
let isScanning = false;

const rankedResults = (stocks) => stocks
  .map(stock => applyTradePlan({ ...stock }))
  .filter(stock => !stock.noSignal && Number.isFinite(stock.takeProfit) && Number.isFinite(stock.stopLoss))
  .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

const resultLists = (results) => ({
  results,
  top5: results.slice(0, 20),
  topBuys: results.filter(result => result.direction === 'BUY').slice(0, 20),
  topSells: results.filter(result => result.direction === 'SELL').slice(0, 20),
});

const finishNewsPhase = async (allResults, start, startAt = 0) => {
  const enriched = await enrichWithNews(allResults, (done, batchStart, batch) => {
    const checkpoint = { newsEnrichedCount: done, phase: 'news' };
    batch.forEach((stock, index) => {
      checkpoint[`technicalCandidates.${batchStart + index}`] = stock;
    });
    return ScanResult.findOneAndUpdate({ key: 'latest' }, checkpoint);
  }, startAt);
  const finalResults = rankedResults(enriched);
  const duration = Math.round((Date.now() - start) / 1000);
  await ScanResult.findOneAndUpdate({ key: 'latest' }, {
    ...resultLists(finalResults),
    scannedAt: new Date(),
    lastCompletedAt: new Date(),
    scannedCount: UNIVERSE.length,
    technicalResults: allResults.length,
    newsEnrichedCount: allResults.length,
    technicalCandidates: [],
    phase: 'complete',
    resultStage: 'complete',
    duration,
    running: false,
  }, { upsert: true });
  console.log(`\n🏆 SCAN COMPLETE in ${duration}s | Scanned: ${allResults.length} | Top: ${finalResults[0]?.symbol}:${finalResults[0]?.score}`);
};

const runFullScan = async () => {
  if (isScanning) { console.log('⏳ Already scanning'); return; }
  isScanning = true;
  const start = Date.now();
  console.log(`\n🔍 Starting 2-phase scan of ${UNIVERSE.length} stocks...`);
  try {
    const existing = await ScanResult.findOne({ key: 'latest' }).lean();
    const hasCompletedCache = existing?.resultStage === 'complete' && Boolean(existing.top5?.length);
    const scanStartUpdate = {
      running: true, phase: 'technical', scannedCount: 0, technicalResults: 0,
      newsEnrichedCount: 0, refreshStartedAt: new Date(), nextScheduledAt: getNextWeekdayScanAt(),
      resultStage: hasCompletedCache ? (existing.resultStage || 'complete') : 'building',
    };
    // A partial technical result is never user-facing. Keep only a previously
    // completed Technical + News cache while the next scheduled run refreshes.
    Object.assign(scanStartUpdate, { technicalCandidates: [] });
    if (!hasCompletedCache) Object.assign(scanStartUpdate, resultLists([]));
    await ScanResult.findOneAndUpdate({ key: 'latest' }, scanStartUpdate, { upsert: true });

    // Phase 1: Technical scan all stocks
    console.log('\n📊 PHASE 1: Technical scan...');
    const allResults = await scanTechnical(UNIVERSE, (done) =>
      ScanResult.findOneAndUpdate({ key: 'latest' }, { scannedCount: done, phase: 'technical' })
    );
    console.log(`\n✅ Phase 1 done: ${allResults.length}/${UNIVERSE.length} technical results. Starting full news enrichment.`);

    // Keep a completed cache visible during scheduled refreshes, but never
    // publish a technical-only ranking. The scanner surface is final combined
    // Technical + News scoring only.
    await ScanResult.findOneAndUpdate({ key: 'latest' }, {
      scannedCount: UNIVERSE.length,
      technicalResults: allResults.length,
      newsEnrichedCount: 0,
      technicalCandidates: allResults,
      phase: 'news',
      running:      true,
    }, { upsert: true });

    // Every ticker with valid technical data receives news and analyst context
    // before the final composite ranking is created.
    await finishNewsPhase(allResults, start);
  } catch(err) {
    console.error('❌ Scan error:', err.message);
    await ScanResult.findOneAndUpdate({ key: 'latest' }, { running: false, phase: 'failed' }).catch(() => {});
  } finally {
    isScanning = false;
  }
};

const resumeNewsScan = async (doc) => {
  if (isScanning) return;
  const candidates = Array.isArray(doc.technicalCandidates) ? doc.technicalCandidates : [];
  if (!candidates.length) return runFullScan();
  isScanning = true;
  const start = doc.refreshStartedAt ? new Date(doc.refreshStartedAt).getTime() : Date.now();
  console.log(`🔄 Resuming news enrichment for ${candidates.length} technical candidates...`);
  try {
    await ScanResult.findOneAndUpdate({ key: 'latest' }, {
      running: true, phase: 'news', scannedCount: UNIVERSE.length,
      technicalResults: candidates.length,
    });
    await finishNewsPhase(candidates, start, Number(doc.newsEnrichedCount || 0));
  } catch (err) {
    console.error('❌ News resume error:', err.message);
    await ScanResult.findOneAndUpdate({ key: 'latest' }, { running: false, phase: 'failed' }).catch(() => {});
  } finally {
    isScanning = false;
  }
};

// ── Get results ────────────────────────────────────────────────────
const getTop5 = async () => {
  const doc = await ScanResult.findOne({ key: 'latest' });
  if (!doc || !doc.scannedAt) {
    return { top5:[], topBuys:[], topSells:[], scanning:isScanning, scannedCount:0, technicalResults:0,
      newsEnrichedCount:0, phase:'technical', universeSize:UNIVERSE.length, duration:0,
      resultStage:'building',
      nextScheduledAt: getNextWeekdayScanAt(),
      message: `🔍 Building the first ${UNIVERSE.length}-ticker technical ranking.` };
  }
  return {
    top5:         doc.top5     || [],
    topBuys:      doc.topBuys  || [],
    topSells:     doc.topSells || [],
    scannedAt:    doc.scannedAt,
    scannedCount: doc.scannedCount,
    technicalResults: doc.technicalResults,
    newsEnrichedCount: doc.newsEnrichedCount,
    phase:        doc.phase,
    resultStage:  doc.resultStage || (doc.top5?.length ? 'complete' : 'building'),
    duration:     doc.duration,
    scanning:     doc.running || isScanning,
    cached:       doc.resultStage === 'complete' && Boolean(doc.top5?.length),
    cachedAt:     doc.lastCompletedAt || doc.scannedAt,
    nextScheduledAt: doc.nextScheduledAt || getNextWeekdayScanAt(),
    universeSize: UNIVERSE.length,
  };
};

// ── Auto-start ─────────────────────────────────────────────────────
// Local UI previews can opt out so they never consume the shared market-data quota.
if (process.env.DISABLE_SCANNER_AUTOSTART !== 'true') {
  setTimeout(() => {
    ScanResult.findOne({ key: 'latest' }).then(doc => {
      if (!doc || !doc.scannedAt) {
        console.log('🚀 No scan data, running initial scan...');
        runFullScan().catch(console.error);
      } else if (doc.running) {
        console.log('🔄 Recovering interrupted scanner run after restart...');
        resumeNewsScan(doc).catch(console.error);
      } else {
        const age = Date.now() - new Date(doc.scannedAt).getTime();
        const day = new Date().getUTCDay();
        const maxAge = [0, 6].includes(day) ? 48*60*60*1000 : WEEKDAY_SCAN_INTERVAL_MS;
        if (age > maxAge) {
          console.log('🔄 Scan stale, refreshing...');
          runFullScan().catch(console.error);
        } else {
          console.log(`📦 Using existing scan data (${Math.round(age/60000)}min old)`);
        }
      }
    }).catch(() => runFullScan().catch(console.error));
  }, 10000);

  // Weekdays on each four-hour UTC boundary. Weekends keep the latest final cache.
  const scheduleNextAutomaticScan = () => {
    const next = getNextWeekdayScanAt();
    ScanResult.updateOne({ key: 'latest' }, { nextScheduledAt: next }).catch(() => {});
    setTimeout(() => {
      console.log('⏰ Scheduled scan...');
      runFullScan().catch(console.error);
      scheduleNextAutomaticScan();
    }, Math.max(1000, next.getTime() - Date.now()));
  };
  scheduleNextAutomaticScan();
} else {
  console.log('⏸️ Scanner auto-start disabled for this local preview.');
}

module.exports = { getTop5, runFullScan, UNIVERSE };
