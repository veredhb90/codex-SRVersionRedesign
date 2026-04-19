require('dotenv').config();
const { DefaultApi } = require('finnhub');
const https = require('https');

const client = new DefaultApi();
client.apiKey = process.env.FINNHUB_API_KEY;

// ── Cache ──────────────────────────────────────────────────────────
const cache = new Map();
const TTL   = 30000;
const fromCache = (k) => { const e = cache.get(k); if (!e) return null; if (Date.now()-e.ts > TTL) { cache.delete(k); return null; } return e.data; };
const toCache   = (k, d) => cache.set(k, { data: d, ts: Date.now() });

const fetchJSON = (url) => new Promise((resolve, reject) => {
  const opts = { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SwingRush/1.0)', 'Accept': 'application/json' } };
  https.get(url, opts, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) return fetchJSON(res.headers.location).then(resolve).catch(reject);
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
  }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
});

// ── Symbol maps ────────────────────────────────────────────────────
const SYMBOL_MAP = {
  'GOLD':'GLD','XAU':'GLD','XAU/USD':'GLD','XAUUSD':'GLD','GC=F':'GLD',
  'SILVER':'SLV','XAG':'SLV','XAG/USD':'SLV','XAGUSD':'SLV','SI=F':'SLV',
  'OIL':'USO','CL=F':'USO','BRENT':'USO','CRUDE':'USO','WTI':'USO',
  'NATGAS':'UNG','NG=F':'UNG','GAS':'UNG','PLATINUM':'PPLT','COPPER':'CPER',
  'BTC':'BINANCE:BTCUSDT','BTC-USD':'BINANCE:BTCUSDT','BITCOIN':'BINANCE:BTCUSDT',
  'ETH':'BINANCE:ETHUSDT','ETH-USD':'BINANCE:ETHUSDT','ETHEREUM':'BINANCE:ETHUSDT',
  'BNB':'BINANCE:BNBUSDT','SOL':'BINANCE:SOLUSDT',
  'XRP':'BINANCE:XRPUSDT','DOGE':'BINANCE:DOGEUSDT',
};
const DISPLAY_MAP = {
  'GLD':'GOLD (GLD)','SLV':'SILVER (SLV)','USO':'OIL (USO)',
  'UNG':'NAT.GAS (UNG)','PPLT':'PLATINUM','CPER':'COPPER',
  'BINANCE:BTCUSDT':'BTC-USD','BINANCE:ETHUSDT':'ETH-USD',
  'BINANCE:BNBUSDT':'BNB-USD','BINANCE:SOLUSDT':'SOL-USD',
  'BINANCE:XRPUSDT':'XRP-USD','BINANCE:DOGEUSDT':'DOGE-USD',
};
const REAL_NAMES = { 'GLD':'Gold','SLV':'Silver','USO':'Crude Oil','UNG':'Natural Gas','PPLT':'Platinum','CPER':'Copper' };
const resolveSymbol = (s) => SYMBOL_MAP[s.toUpperCase()] || s.toUpperCase();

// ── Quote ──────────────────────────────────────────────────────────
const getQuote = (symbol) => new Promise((resolve, reject) => {
  const resolved = resolveSymbol(symbol.toUpperCase());
  const cached   = fromCache(resolved);
  if (cached) return resolve(cached);
  client.quote(resolved, (err, data) => {
    if (err || !data || !data.c) return reject(new Error(`Symbol not found: ${symbol}. Try: GLD, SLV, USO, AAPL, NVDA`));
    const result = {
      symbol: DISPLAY_MAP[resolved] || resolved,
      shortName: REAL_NAMES[resolved] || DISPLAY_MAP[resolved] || resolved,
      price: data.c, change: data.d || 0, changePct: data.dp || 0,
      high: data.h || data.c, low: data.l || data.c,
      open: data.o || data.c, prevClose: data.pc || data.c,
    };
    toCache(resolved, result);
    resolve(result);
  });
});

// ── Candles via Yahoo Finance (daily) ──────────────────────────────
const getCandles = async (symbol, days = 120) => {
  const resolved = resolveSymbol(symbol);
  const ySym = resolved.startsWith('BINANCE:') ? resolved.replace('BINANCE:','').replace('USDT','-USD') : resolved;
  const now  = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&period1=${from}&period2=${now}`;
  const data = await fetchJSON(url);
  const result = data?.chart?.result?.[0];
  if (!result?.indicators?.quote?.[0]?.close) throw new Error('No candle data');
  const q = result.indicators.quote[0];
  const closes = q.close.filter(v => v != null);
  const highs  = q.high.filter(v => v != null);
  const lows   = q.low.filter(v => v != null);
  const vols   = (q.volume || []).filter(v => v != null);
  if (closes.length < 20) throw new Error('Not enough data');
  return { c: closes, h: highs, l: lows, v: vols };
};

// ── Weekly candles for multi-timeframe ────────────────────────────
const getWeeklyCandles = async (symbol) => {
  const resolved = resolveSymbol(symbol);
  const ySym = resolved.startsWith('BINANCE:') ? resolved.replace('BINANCE:','').replace('USDT','-USD') : resolved;
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 365 * 86400; // 1 year of weekly data
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1wk&period1=${from}&period2=${now}`;
  try {
    const data = await fetchJSON(url);
    const result = data?.chart?.result?.[0];
    if (!result?.indicators?.quote?.[0]?.close) return null;
    const q = result.indicators.quote[0];
    return {
      c: q.close.filter(v => v != null),
      h: q.high.filter(v => v != null),
      l: q.low.filter(v => v != null),
    };
  } catch { return null; }
};

// ── Market regime: is SPY in uptrend? ─────────────────────────────
const getMarketRegime = async () => {
  const cacheKey = 'market_regime';
  const cached   = fromCache(cacheKey);
  if (cached) return cached;
  try {
    const candles = await getCandles('SPY', 60);
    const closes  = candles.c;
    const sma50val = closes.slice(-50).reduce((a,b) => a+b, 0) / Math.min(50, closes.length);
    const lastClose = closes[closes.length - 1];
    const regime = lastClose > sma50val ? 'bull' : 'bear';
    const result = { regime, spyPrice: lastClose, spy50ma: +sma50val.toFixed(2) };
    toCache(cacheKey, result);
    return result;
  } catch { return { regime: 'unknown', spyPrice: 0, spy50ma: 0 }; }
};

// ── News + Analyst sentiment ───────────────────────────────────────
const getNewsSentiment = async (symbol) => {
  try {
    const resolved = resolveSymbol(symbol);
    if (resolved.startsWith('BINANCE:')) return { score: 0, news: [], label: 'No news data', analystScore: 0 };
    const now      = Math.floor(Date.now() / 1000);
    const fromDate = new Date((now - 7*86400)*1000).toISOString().split('T')[0];
    const toDate   = new Date(now*1000).toISOString().split('T')[0];
    const apiKey   = process.env.FINNHUB_API_KEY;

    // Fetch news and analyst recommendation in parallel
    const [newsData, recData] = await Promise.allSettled([
      fetchJSON(`https://finnhub.io/api/v1/company-news?symbol=${resolved}&from=${fromDate}&to=${toDate}&token=${apiKey}`),
      fetchJSON(`https://finnhub.io/api/v1/stock/recommendation?symbol=${resolved}&token=${apiKey}`),
    ]);

    // ── News keyword scoring ───────────────────────────────────────
    const POSITIVE = ['beat','exceed','record','growth','surge','rally','upgrade','buy','bullish',
      'profit','revenue','gain','strong','positive','outperform','breakthrough','deal','partnership',
      'win','launch','expan','increas','rise','soar','jump','higher','best','innovate','award',
      'approval','dividend','buyback','raised','boost','record','top','beat','crush','exceed'];
    const NEGATIVE = ['miss','loss','decline','fall','drop','downgrade','sell','bearish','weak',
      'disappoint','cut','layoff','lawsuit','debt','bankrupt','fraud','investig','recall','fine',
      'penalty','decreas','lower','worst','concern','risk','warn','uncertain','restructur',
      'resign','crash','plunge','slump','shortfall','miss','below','disappointing','shrink'];

    let sentimentScore = 0;
    const scoredNews = [];
    const articles = newsData.status === 'fulfilled' && Array.isArray(newsData.value)
      ? newsData.value.slice(0, 10) : [];

    articles.forEach(article => {
      const text = ((article.headline||'') + ' ' + (article.summary||'')).toLowerCase();
      let artScore = 0;
      POSITIVE.forEach(w => { if (text.includes(w)) artScore++; });
      NEGATIVE.forEach(w => { if (text.includes(w)) artScore--; });
      sentimentScore += artScore;
      scoredNews.push({
        headline: article.headline,
        url:      article.url,
        source:   article.source,
        datetime: article.datetime,
        sentiment: artScore > 0 ? 'positive' : artScore < 0 ? 'negative' : 'neutral',
        score:    artScore,
      });
    });

    const newsNormalized = articles.length > 0
      ? Math.max(-3, Math.min(3, Math.round(sentimentScore / articles.length * 3))) : 0;

    // ── Analyst recommendations ────────────────────────────────────
    let analystScore = 0;
    let analystLabel = '';
    if (recData.status === 'fulfilled' && Array.isArray(recData.value) && recData.value.length > 0) {
      const latest = recData.value[0];
      const strongBuy  = latest.strongBuy  || 0;
      const buy        = latest.buy        || 0;
      const hold       = latest.hold       || 0;
      const sell       = latest.sell       || 0;
      const strongSell = latest.strongSell || 0;
      const total = strongBuy + buy + hold + sell + strongSell;
      if (total > 0) {
        const bullishPct = (strongBuy + buy) / total;
        const bearishPct = (sell + strongSell) / total;
        if      (bullishPct > 0.7) { analystScore = 2;  analystLabel = `${Math.round(bullishPct*100)}% analysts BUY`; }
        else if (bullishPct > 0.5) { analystScore = 1;  analystLabel = `${Math.round(bullishPct*100)}% analysts BUY`; }
        else if (bearishPct > 0.3) { analystScore = -1; analystLabel = `${Math.round(bearishPct*100)}% analysts SELL`; }
        else                       {                    analystLabel = `Analysts mixed (${total} ratings)`; }
      }
    }

    const totalScore = newsNormalized + analystScore;
    let label;
    if      (totalScore >= 3)  label = 'Very Positive ✅✅';
    else if (totalScore === 2) label = 'Positive ✅';
    else if (totalScore === 1) label = 'Slightly Positive';
    else if (totalScore === 0) label = 'Neutral';
    else if (totalScore === -1)label = 'Slightly Negative';
    else if (totalScore === -2)label = 'Negative ⚠️';
    else                       label = 'Very Negative 🔴';

    return {
      score:        totalScore,
      newsScore:    newsNormalized,
      analystScore,
      analystLabel,
      news:         scoredNews.slice(0, 5),
      label,
      totalArticles: articles.length,
    };
  } catch (err) {
    console.log('News error:', err.message);
    return { score: 0, news: [], label: 'News unavailable', analystScore: 0 };
  }
};

// ── Technical Indicators ───────────────────────────────────────────
const sma = (arr, period) => {
  if (arr.length < period) return null;
  return arr.slice(-period).reduce((a,b) => a+b, 0) / period;
};
const ema = (arr, period) => {
  if (arr.length < period) return null;
  const k = 2 / (period+1);
  let val = arr.slice(0, period).reduce((a,b) => a+b, 0) / period;
  for (let i = period; i < arr.length; i++) val = arr[i]*k + val*(1-k);
  return val;
};
const rsi = (closes, period=14) => {
  if (closes.length < period+1) return 50;
  let gains=0, losses=0;
  for (let i=closes.length-period; i<closes.length; i++) {
    const diff = closes[i]-closes[i-1];
    if (diff>0) gains+=diff; else losses-=diff;
  }
  const avgGain=gains/period, avgLoss=losses/period;
  if (avgLoss===0) return 100;
  return 100-(100/(1+avgGain/avgLoss));
};
const macd = (closes) => {
  const ema12=ema(closes,12), ema26=ema(closes,26);
  if (!ema12||!ema26) return { macd:0, signal:0, histogram:0 };
  const macdLine = ema12-ema26;
  const macdVals = [];
  for (let i=26; i<=closes.length; i++) {
    const e12=ema(closes.slice(0,i),12), e26=ema(closes.slice(0,i),26);
    if (e12&&e26) macdVals.push(e12-e26);
  }
  const signalLine = ema(macdVals,9)||0;
  return { macd:macdLine, signal:signalLine, histogram:macdLine-signalLine };
};
const bollingerBands = (closes, period=20, mult=2) => {
  if (closes.length<period) return null;
  const slice=closes.slice(-period);
  const mean=slice.reduce((a,b)=>a+b,0)/period;
  const std=Math.sqrt(slice.reduce((a,b)=>a+Math.pow(b-mean,2),0)/period);
  return { upper:mean+mult*std, middle:mean, lower:mean-mult*std };
};
const atr = (highs, lows, closes, period=14) => {
  if (closes.length<period+1) return closes[closes.length-1]*0.02;
  const trs=[];
  for (let i=closes.length-period; i<closes.length; i++) {
    trs.push(Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1])));
  }
  return trs.reduce((a,b)=>a+b,0)/period;
};
const stochastic = (highs, lows, closes, period=14) => {
  if (closes.length<period) return { k:50, d:50 };
  const hh=Math.max(...highs.slice(-period)), ll=Math.min(...lows.slice(-period));
  const lc=closes[closes.length-1];
  const k=hh===ll?50:((lc-ll)/(hh-ll))*100;
  const kVals=[];
  for (let i=period; i<=closes.length; i++) {
    const h=Math.max(...highs.slice(i-period,i)), l=Math.min(...lows.slice(i-period,i)), c=closes[i-1];
    kVals.push(h===l?50:((c-l)/(h-l))*100);
  }
  return { k, d:sma(kVals,3)||k };
};
const williamsR = (highs, lows, closes, period=14) => {
  if (closes.length<period) return -50;
  const h=Math.max(...highs.slice(-period)), l=Math.min(...lows.slice(-period)), c=closes[closes.length-1];
  return h===l?-50:((h-c)/(h-l))*-100;
};
const roc = (closes, period=10) => {
  if (closes.length<period+1) return 0;
  return ((closes[closes.length-1]-closes[closes.length-1-period])/closes[closes.length-1-period])*100;
};

// ADX — Average Directional Index (trend strength)
const adx = (highs, lows, closes, period=14) => {
  if (closes.length < period+2) return { adx:0, plusDI:0, minusDI:0 };
  const trueRanges=[], plusDMs=[], minusDMs=[];
  for (let i=1; i<closes.length; i++) {
    const tr=Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]));
    const upMove=highs[i]-highs[i-1], downMove=lows[i-1]-lows[i];
    trueRanges.push(tr);
    plusDMs.push(upMove>downMove && upMove>0 ? upMove : 0);
    minusDMs.push(downMove>upMove && downMove>0 ? downMove : 0);
  }
  const slice=trueRanges.slice(-period);
  const atrVal=slice.reduce((a,b)=>a+b,0)/period;
  if (!atrVal) return { adx:0, plusDI:0, minusDI:0 };
  const plusDI=(plusDMs.slice(-period).reduce((a,b)=>a+b,0)/period/atrVal)*100;
  const minusDI=(minusDMs.slice(-period).reduce((a,b)=>a+b,0)/period/atrVal)*100;
  const dx=Math.abs(plusDI-minusDI)/(plusDI+minusDI||1)*100;
  return { adx:+dx.toFixed(1), plusDI:+plusDI.toFixed(1), minusDI:+minusDI.toFixed(1) };
};

// ── MAIN ENGINE ────────────────────────────────────────────────────
const getEngineRecommendation = async (symbol) => {
  const quote = await getQuote(symbol);
  const { price, changePct } = quote;

  // Parallel fetch all data
  const [candleResult, weeklyCandleResult, newsResult, regimeResult] = await Promise.allSettled([
    getCandles(symbol, 120),
    getWeeklyCandles(symbol),
    getNewsSentiment(symbol),
    getMarketRegime(),
  ]);

  const candles       = candleResult.status       === 'fulfilled' ? candleResult.value       : null;
  const weeklyCandles = weeklyCandleResult.status === 'fulfilled' ? weeklyCandleResult.value : null;
  const news          = newsResult.status         === 'fulfilled' ? newsResult.value         : { score:0, news:[], label:'Unavailable', analystScore:0, analystLabel:'' };
  const regime        = regimeResult.status       === 'fulfilled' ? regimeResult.value       : { regime:'unknown' };

  if (!candles || candles.c.length < 20) return simpleFallback(quote, symbol, news, regime);

  const closes = candles.c, highs = candles.h, lows = candles.l, vols = candles.v||[];
  let score = 0;
  const signals = [];
  const gates   = []; // blocking conditions

  // ── GATE: Market regime ───────────────────────────────────────────
  let regimeMultiplier = 1;
  if (regime.regime === 'bear') {
    gates.push(`⚠️ Market in downtrend (SPY below 50MA $${regime.spy50ma}) — only SELL signals favored`);
    regimeMultiplier = 0.5; // reduce BUY signals in bear market
  } else if (regime.regime === 'bull') {
    gates.push(`✅ Market uptrend (SPY above 50MA $${regime.spy50ma})`);
  }

  // ── GATE: Liquidity check ─────────────────────────────────────────
  if (vols.length >= 5) {
    const avgVol = vols.slice(-5).reduce((a,b)=>a+b,0)/5;
    if (avgVol < 100000) {
      gates.push(`⚠️ Low liquidity warning (avg vol: ${(avgVol/1000).toFixed(0)}K) — signal less reliable`);
    }
  }

  // ── 1. RSI (±3) ───────────────────────────────────────────────────
  const rsiVal = rsi(closes);
  if      (rsiVal < 25) { score+=3; signals.push(`RSI ${rsiVal.toFixed(0)} — Extremely oversold 🔥`); }
  else if (rsiVal < 35) { score+=2; signals.push(`RSI ${rsiVal.toFixed(0)} — Oversold ✅`); }
  else if (rsiVal < 45) { score+=1; signals.push(`RSI ${rsiVal.toFixed(0)} — Below neutral`); }
  else if (rsiVal > 80) { score-=3; signals.push(`RSI ${rsiVal.toFixed(0)} — Extremely overbought 🔴`); }
  else if (rsiVal > 70) { score-=2; signals.push(`RSI ${rsiVal.toFixed(0)} — Overbought ⚠️`); }
  else if (rsiVal > 60) { score-=1; signals.push(`RSI ${rsiVal.toFixed(0)} — Elevated`); }
  else                  {           signals.push(`RSI ${rsiVal.toFixed(0)} — Neutral`); }

  // ── 2. EMA crossover 9/21 (±2) ───────────────────────────────────
  const ema9=ema(closes,9), ema21=ema(closes,21);
  if (ema9&&ema21) {
    if      (ema9>ema21*1.003) { score+=2; signals.push(`EMA 9>21 — Bullish trend ✅`); }
    else if (ema9<ema21*0.997) { score-=2; signals.push(`EMA 9<21 — Bearish trend ⚠️`); }
    else                       {           signals.push(`EMA 9≈21 — Neutral`); }
  }

  // ── 3. MACD (±2) ─────────────────────────────────────────────────
  const macdData=macd(closes);
  if      (macdData.histogram>0&&macdData.macd>0) { score+=2; signals.push(`MACD bullish crossover ✅`); }
  else if (macdData.histogram>0)                   { score+=1; signals.push(`MACD histogram turning positive`); }
  else if (macdData.histogram<0&&macdData.macd<0)  { score-=2; signals.push(`MACD bearish crossover ⚠️`); }
  else if (macdData.histogram<0)                   { score-=1; signals.push(`MACD histogram turning negative`); }

  // ── 4. Bollinger Bands (±2) ───────────────────────────────────────
  const bb=bollingerBands(closes);
  if (bb) {
    const bbPos=(price-bb.lower)/(bb.upper-bb.lower);
    if      (price<bb.lower)  { score+=2; signals.push(`Below lower Bollinger — oversold bounce ✅`); }
    else if (price>bb.upper)  { score-=2; signals.push(`Above upper Bollinger — overbought ⚠️`); }
    else if (bbPos<0.35)      { score+=1; signals.push(`Lower Bollinger zone — support`); }
    else if (bbPos>0.65)      { score-=1; signals.push(`Upper Bollinger zone — resistance`); }
    else                      {           signals.push(`Mid Bollinger — neutral range`); }
  }

  // ── 5. ADX — Trend strength (±2) ──────────────────────────────────
  const adxData=adx(highs,lows,closes);
  if (adxData.adx>=25) {
    // Strong trend — direction matters
    if      (adxData.plusDI>adxData.minusDI && adxData.adx>=30) { score+=2; signals.push(`ADX ${adxData.adx} — Strong uptrend (+DI>${adxData.plusDI}) ✅`); }
    else if (adxData.plusDI>adxData.minusDI)                    { score+=1; signals.push(`ADX ${adxData.adx} — Uptrend developing`); }
    else if (adxData.minusDI>adxData.plusDI && adxData.adx>=30) { score-=2; signals.push(`ADX ${adxData.adx} — Strong downtrend (-DI>${adxData.minusDI}) ⚠️`); }
    else                                                          { score-=1; signals.push(`ADX ${adxData.adx} — Downtrend developing`); }
  } else {
    signals.push(`ADX ${adxData.adx} — Weak trend, ranging market`);
  }

  // ── 6. Stochastic (±2) ────────────────────────────────────────────
  const stoch=stochastic(highs,lows,closes);
  if      (stoch.k<20&&stoch.d<20) { score+=2; signals.push(`Stoch ${stoch.k.toFixed(0)} — Oversold ✅`); }
  else if (stoch.k<30)              { score+=1; signals.push(`Stoch ${stoch.k.toFixed(0)} — Approaching oversold`); }
  else if (stoch.k>80&&stoch.d>80)  { score-=2; signals.push(`Stoch ${stoch.k.toFixed(0)} — Overbought ⚠️`); }
  else if (stoch.k>70)              { score-=1; signals.push(`Stoch ${stoch.k.toFixed(0)} — Approaching overbought`); }
  else                              {           signals.push(`Stoch ${stoch.k.toFixed(0)} — Neutral`); }

  // ── 7. Williams %R (±1) ───────────────────────────────────────────
  const wR=williamsR(highs,lows,closes);
  if      (wR<-80) { score+=1; signals.push(`Williams %R ${wR.toFixed(0)} — Oversold ✅`); }
  else if (wR>-20) { score-=1; signals.push(`Williams %R ${wR.toFixed(0)} — Overbought ⚠️`); }
  else             {           signals.push(`Williams %R ${wR.toFixed(0)} — Neutral`); }

  // ── 8. Rate of Change (±1) ────────────────────────────────────────
  const rocVal=roc(closes);
  if      (rocVal>5)  { score+=1; signals.push(`ROC +${rocVal.toFixed(1)}% — Strong momentum ✅`); }
  else if (rocVal<-5) { score-=1; signals.push(`ROC ${rocVal.toFixed(1)}% — Negative momentum ⚠️`); }
  else                {           signals.push(`ROC ${rocVal.toFixed(1)}% — Stable`); }

  // ── 9. 50-day MA trend (±1) ───────────────────────────────────────
  const sma50=sma(closes,50);
  if (sma50) {
    if      (price>sma50*1.03) { score+=1; signals.push(`${((price/sma50-1)*100).toFixed(1)}% above 50MA — uptrend ✅`); }
    else if (price<sma50*0.97) { score-=1; signals.push(`${((1-price/sma50)*100).toFixed(1)}% below 50MA — downtrend ⚠️`); }
    else                       {           signals.push(`Price near 50MA — consolidating`); }
  }

  // ── 10. Volume (±1) ───────────────────────────────────────────────
  if (vols.length>=10) {
    const avgVol=vols.slice(-10).reduce((a,b)=>a+b,0)/10;
    const volRatio=vols[vols.length-1]/avgVol;
    if      (volRatio>1.5&&changePct>0) { score+=1; signals.push(`High volume on up day — strong buying ✅`); }
    else if (volRatio>1.5&&changePct<0) { score-=1; signals.push(`High volume on down day — selling pressure ⚠️`); }
    else if (volRatio<0.5)              {           signals.push(`Low volume — weak conviction`); }
    else                                {           signals.push(`Normal volume`); }
  }

  // ── 11. Multi-timeframe confirmation (±2) ─────────────────────────
  if (weeklyCandles && weeklyCandles.c.length >= 10) {
    const wCloses = weeklyCandles.c, wHighs = weeklyCandles.h, wLows = weeklyCandles.l;
    const wRsi = rsi(wCloses);
    const wEma9=ema(wCloses,9), wEma21=ema(wCloses,21);
    const weeklyBullish = wEma9&&wEma21 ? (wEma9>wEma21 && wRsi<65) : null;
    const weeklyBearish = wEma9&&wEma21 ? (wEma9<wEma21 && wRsi>35) : null;
    if      (weeklyBullish) { score+=2; signals.push(`Weekly chart bullish (EMA+RSI) — multi-TF confirmed ✅`); }
    else if (weeklyBearish) { score-=2; signals.push(`Weekly chart bearish (EMA+RSI) — multi-TF confirmed ⚠️`); }
    else                    {           signals.push(`Weekly chart neutral — no TF confirmation`); }
  }

  // ── 12. News sentiment (±3) ───────────────────────────────────────
  score += news.score;
  if (news.score > 0)     signals.push(`News: ${news.label} (+${news.score})`);
  else if (news.score < 0) signals.push(`News: ${news.label} (${news.score})`);
  else                     signals.push(`News: ${news.label}`);

  // ── 13. Analyst consensus (already in news.score) ─────────────────
  if (news.analystLabel) signals.push(`Analysts: ${news.analystLabel}`);

  // ── Apply market regime adjustment for BUY in bear market ────────
  if (regime.regime === 'bear' && score > 0) {
    score = Math.floor(score * regimeMultiplier);
    signals.push(`Bear market filter applied — BUY signal strength reduced`);
  }

  // ── MINIMUM THRESHOLD — only signal if score strong enough ───────
  const absScore = Math.abs(score);
  const MIN_SCORE = 4; // must have at least 4 points of conviction

  if (absScore < MIN_SCORE) {
    return {
      symbol: quote.symbol, name: quote.shortName, price,
      direction: 'NEUTRAL', confidence: 'Insufficient',
      takeProfit: null, stopLoss: null, riskReward: null,
      score, signals, gates,
      news: news.news, newsLabel: news.label, newsScore: news.score,
      analystLabel: news.analystLabel,
      rangePct: 50, trend: 'Neutral', change: changePct,
      noSignal: true,
      noSignalReason: `Score ${score > 0 ? '+' : ''}${score} — below minimum threshold of ±${MIN_SCORE}. No high-conviction signal at this time.`,
    };
  }

  // ── Final direction & confidence ──────────────────────────────────
  const direction = score > 0 ? 'BUY' : 'SELL';
  let confidence;
  if      (absScore>=14) confidence='Very High';
  else if (absScore>=10) confidence='High';
  else if (absScore>=7)  confidence='Medium';
  else if (absScore>=4)  confidence='Low';
  else                   confidence='Very Low';

  // ── ATR-based TP & SL ────────────────────────────────────────────
  const realAtr  = atr(highs,lows,closes);
  const tpMult   = absScore>=12 ? 4.5 : absScore>=8 ? 3.5 : absScore>=5 ? 2.5 : 2.0;
  const slMult   = 1.5;
  const takeProfit = direction==='BUY' ? +(price+realAtr*tpMult).toFixed(2) : +(price-realAtr*tpMult).toFixed(2);
  const stopLoss   = direction==='BUY' ? +(price-realAtr*slMult).toFixed(2) : +(price+realAtr*slMult).toFixed(2);
  const riskReward = +((Math.abs(takeProfit-price)/Math.abs(stopLoss-price)).toFixed(2));

  const high52=Math.max(...highs), low52=Math.min(...lows);
  const rangePct=high52!==low52?((price-low52)/(high52-low52)*100):50;

  return {
    symbol: quote.symbol, name: quote.shortName, price,
    direction, confidence, takeProfit, stopLoss, riskReward,
    rangePct:   +rangePct.toFixed(1),
    trend:      score>0?'Bullish':score<0?'Bearish':'Neutral',
    change:     changePct, score, signals, gates,
    news:       news.news,
    newsLabel:  news.label,
    newsScore:  news.score,
    analystLabel: news.analystLabel,
    regime:     regime.regime,
    indicators: {
      rsi:   +rsiVal.toFixed(1),
      ema9:  ema9?.toFixed(2),
      ema21: ema21?.toFixed(2),
      macd:  +macdData.macd.toFixed(4),
      adx:   adxData.adx,
      stoch: +stoch.k.toFixed(1),
      wR:    +wR.toFixed(1),
      roc:   +rocVal.toFixed(2),
      bb:    bb?{ upper:+bb.upper.toFixed(2), lower:+bb.lower.toFixed(2) }:null,
    },
  };
};

// ── Fallback ───────────────────────────────────────────────────────
const simpleFallback = (quote, symbol, news={score:0,news:[],label:'N/A'}, regime={regime:'unknown'}) => {
  const { price, high, low, changePct } = quote;
  const rangePct=(price-low*0.9)/(high*1.1-low*0.9);
  let score=0;
  if (changePct>1) score++; if (changePct<-1) score--;
  score+=news.score||0;
  const direction=score>=0?'BUY':'SELL';
  const atrEst=price*0.025;
  return {
    symbol:quote.symbol, name:quote.shortName, price, direction,
    confidence:'Very Low',
    takeProfit: direction==='BUY'?+(price+atrEst*2).toFixed(2):+(price-atrEst*2).toFixed(2),
    stopLoss:   direction==='BUY'?+(price-atrEst*1.5).toFixed(2):+(price+atrEst*1.5).toFixed(2),
    riskReward:1.33, rangePct:+(rangePct*100).toFixed(1),
    trend:changePct>0?'Bullish':'Bearish', change:changePct, score,
    signals:['Limited data — basic analysis only', `News: ${news.label}`],
    gates:[], news:news.news, newsLabel:news.label, newsScore:news.score,
    analystLabel:news.analystLabel||'',
  };
};

module.exports = { getQuote, getEngineRecommendation };
