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
  duration:     { type: Number, default: 0 },
  running:      { type: Boolean, default: false },
}, { timestamps: true });

const ScanResult = mongoose.models.ScanResult || mongoose.model('ScanResult', scanResultSchema);
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── PHASE 1: Technical scan (Yahoo Finance, no rate limit) ─────────
const scanTechnical = async (symbols) => {
  const results = [];
  const concurrency = 3;
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(sym => getEngineRecommendation(sym, { skipNews: true }))
    );
    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        const val = r.value;
        results.push({ symbol: batch[idx], ...val, score: val.score || 0 });
      }
    });
    const done = Math.min(i + concurrency, symbols.length);
    if (done % 50 === 0) console.log(`📊 Phase 1: ${done}/${symbols.length} scanned...`);
    if (i + concurrency < symbols.length) await delay(600);
  }
  return results;
};

// ── PHASE 2: Enrich top 50 with news + analysts ────────────────────
const enrichWithNews = async (topStocks) => {
  console.log(`📰 Phase 2: Fetching news for top ${topStocks.length} stocks...`);
  for (let i = 0; i < topStocks.length; i += 3) {
    const batch = topStocks.slice(i, i + 3);
    const newsResults = await Promise.allSettled(batch.map(s => getNewsSentiment(s.symbol)));
    newsResults.forEach((nr, idx) => {
      if (nr.status === 'fulfilled' && nr.value) {
        const stock = batch[idx];
        const news  = nr.value;
        stock.score       += news.score || 0;
        stock.newsLabel    = news.label;
        stock.newsScore    = news.score;
        stock.analystLabel = news.analystLabel;
        stock.news         = news.news;
        stock.confidence   = getConfidence(Math.abs(stock.score));
        stock.direction    = stock.score > 0 ? 'BUY' : stock.score < 0 ? 'SELL' : stock.direction;
        console.log(`  ✅ ${stock.symbol}: tech=${stock.score - (news.score||0)} + news=${news.score||0} = ${stock.score}`);
      }
    });
    if (i + 3 < topStocks.length) await delay(1000);
  }
  return topStocks;
};

const getConfidence = (abs) => {
  if (abs >= 17) return 'Very High';
  if (abs >= 12) return 'High';
  if (abs >= 8)  return 'Medium';
  if (abs >= 4)  return 'Low';
  return 'Very Low';
};

// ── Main scanner ───────────────────────────────────────────────────
let isScanning = false;

const runFullScan = async () => {
  if (isScanning) { console.log('⏳ Already scanning'); return; }
  isScanning = true;
  const start = Date.now();
  console.log(`\n🔍 Starting 2-phase scan of ${UNIVERSE.length} stocks...`);
  try {
    await ScanResult.findOneAndUpdate({ key: 'latest' }, { running: true }, { upsert: true });

    // Phase 1: Technical scan all stocks
    console.log('\n📊 PHASE 1: Technical scan...');
    const allResults = await scanTechnical(UNIVERSE);
    const withScores = allResults.filter(r => Math.abs(r.score || 0) >= 2)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    console.log(`\n✅ Phase 1 done: ${withScores.length} stocks with signals`);

    // Save phase 1 immediately so users see something
    await ScanResult.findOneAndUpdate({ key: 'latest' }, {
      results:      withScores.slice(0, 100),
      top5:         withScores.slice(0, 20),
      topBuys:      withScores.filter(r => r.direction === 'BUY').slice(0, 20),
      topSells:     withScores.filter(r => r.direction === 'SELL').slice(0, 20),
      scannedCount: allResults.length,
      running:      true,
    }, { upsert: true });

    // News already included in Phase 1 - no Phase 2 needed
    const finalResults = withScores;

    const duration = Math.round((Date.now() - start) / 1000);
    await ScanResult.findOneAndUpdate({ key: 'latest' }, {
      results:      finalResults,
      top5:         finalResults.slice(0, 20),
      topBuys:      finalResults.filter(r => r.direction === 'BUY').slice(0, 20),
      topSells:     finalResults.filter(r => r.direction === 'SELL').slice(0, 20),
      scannedAt:    new Date(),
      scannedCount: allResults.length,
      duration,
      running:      false,
    }, { upsert: true });

    console.log(`\n🏆 SCAN COMPLETE in ${duration}s | Scanned: ${allResults.length} | Top: ${finalResults[0]?.symbol}:${finalResults[0]?.score}`);
  } catch(err) {
    console.error('❌ Scan error:', err.message);
    await ScanResult.findOneAndUpdate({ key: 'latest' }, { running: false }).catch(() => {});
  } finally {
    isScanning = false;
  }
};

// ── Get results ────────────────────────────────────────────────────
const getTop5 = async (forceRefresh = false) => {
  const doc = await ScanResult.findOne({ key: 'latest' });
  if (forceRefresh || !doc || !doc.scannedAt) {
    runFullScan().catch(console.error);
    return { top5:[], topBuys:[], topSells:[], scanning:true, scannedCount:0, duration:0,
      message: `🔍 Scanning ${UNIVERSE.length} stocks (2-phase)... Phase 1: Technical, Phase 2: News. ~5-8 min.` };
  }
  const age       = Date.now() - new Date(doc.scannedAt).getTime();
  const day       = new Date().getUTCDay();
  const isWeekend = [0,6].includes(day);
  const maxAge    = isWeekend ? 48*60*60*1000 : 2*60*60*1000;
  if (age > maxAge && !doc.running && !isScanning) {
    console.log('🔄 Stale scan, refreshing...');
    runFullScan().catch(console.error);
  }
  return {
    top5:         doc.top5     || [],
    topBuys:      doc.topBuys  || [],
    topSells:     doc.topSells || [],
    scannedAt:    doc.scannedAt,
    scannedCount: doc.scannedCount,
    duration:     doc.duration,
    scanning:     doc.running || isScanning,
    universeSize: UNIVERSE.length,
  };
};

// ── Auto-start ─────────────────────────────────────────────────────
setTimeout(() => {
  ScanResult.findOne({ key: 'latest' }).then(doc => {
    if (!doc || !doc.scannedAt) {
      console.log('🚀 No scan data, running initial scan...');
      runFullScan().catch(console.error);
    } else {
      const age = Date.now() - new Date(doc.scannedAt).getTime();
      if (age > 2*60*60*1000) {
        console.log('🔄 Scan stale, refreshing...');
        runFullScan().catch(console.error);
      } else {
        console.log(`📦 Using existing scan data (${Math.round(age/60000)}min old)`);
      }
    }
  }).catch(() => runFullScan().catch(console.error));
}, 10000);

// Weekdays every 2 hours, Weekend: Saturday morning only
// Run every 2 hours
setInterval(() => {
  const day = new Date().getUTCDay();
  if (day !== 0 && day !== 6) {
    console.log('⏰ Scheduled scan...');
    runFullScan().catch(console.error);
  }
}, 2*60*60*1000);

module.exports = { getTop5, runFullScan, UNIVERSE };
