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

// ── HTTP fetch with headers ────────────────────────────────────────
const fetchJSON = (url) => new Promise((resolve, reject) => {
  const opts = {
    timeout: 8000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SwingRush/1.0)', 'Accept': 'application/json' }
  };
  https.get(url, opts, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302)
      return fetchJSON(res.headers.location).then(resolve).catch(reject);
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
  }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
});

// ── Symbol maps ─────────────────────────────────────────────────────
const SYMBOL_MAP = {
  'GOLD':'GLD','XAU':'GLD','XAU/USD':'GLD','XAUUSD':'GLD','GC=F':'GLD',
  'SILVER':'SLV','XAG':'SLV','XAG/USD':'SLV','XAGUSD':'SLV','SI=F':'SLV',
  'OIL':'USO','CL=F':'USO','BRENT':'USO','CRUDE':'USO','WTI':'USO',
  'NATGAS':'UNG','NG=F':'UNG','GAS':'UNG',
  'PLATINUM':'PPLT','XPT':'PPLT','COPPER':'CPER','HG=F':'CPER',
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
const REAL_NAMES = {
  'GLD':'Gold','SLV':'Silver','USO':'Crude Oil','UNG':'Natural Gas',
  'PPLT':'Platinum','CPER':'Copper',
};
const resolveSymbol = (s) => SYMBOL_MAP[s.toUpperCase()] || s.toUpperCase();

// ── Quote ──────────────────────────────────────────────────────────
const getQuote = (symbol) => new Promise((resolve, reject) => {
  const resolved = resolveSymbol(symbol.toUpperCase());
  const cached   = fromCache(resolved);
  if (cached) return resolve(cached);
  client.quote(resolved, (err, data) => {
    if (err || !data || !data.c)
      return reject(new Error(`Symbol not found: ${symbol}. Try: GLD, SLV, USO, AAPL, NVDA`));
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

// ── Candles via Yahoo Finance ──────────────────────────────────────
const getCandles = async (symbol, days = 90) => {
  const resolved = resolveSymbol(symbol);
  const ySym = resolved.startsWith('BINANCE:')
    ? resolved.replace('BINANCE:', '').replace('USDT', '-USD') : resolved;
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
  if (closes.length < 10) throw new Error('Not enough data');
  return { c: closes, h: highs, l: lows, v: vols };
};

// ── News Sentiment via Finnhub ─────────────────────────────────────
const getNewsSentiment = async (symbol) => {
  try {
    const resolved = resolveSymbol(symbol);
    // Skip Binance/crypto symbols for news
    if (resolved.startsWith('BINANCE:')) return { score: 0, news: [], label: 'No news data' };

    const now  = Math.floor(Date.now() / 1000);
    const from = now - 7 * 86400; // last 7 days
    const fromDate = new Date(from * 1000).toISOString().split('T')[0];
    const toDate   = new Date(now  * 1000).toISOString().split('T')[0];
    const apiKey   = process.env.FINNHUB_API_KEY;

    // Get company news
    const url  = `https://finnhub.io/api/v1/company-news?symbol=${resolved}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
    const data = await fetchJSON(url);

    if (!data || !Array.isArray(data) || data.length === 0) {
      return { score: 0, news: [], label: 'No recent news' };
    }

    // Take top 10 most recent articles
    const articles = data.slice(0, 10);

    // ── Keyword-based sentiment scoring ──────────────────────────
    const POSITIVE = [
      'beat', 'exceed', 'record', 'growth', 'surge', 'rally', 'upgrade',
      'buy', 'bullish', 'profit', 'revenue', 'gain', 'strong', 'positive',
      'outperform', 'breakthrough', 'deal', 'partnership', 'win', 'launch',
      'expan', 'increas', 'rise', 'soar', 'jump', 'higher', 'best',
      'innovate', 'award', 'approval', 'dividend', 'buyback', 'raised',
    ];
    const NEGATIVE = [
      'miss', 'loss', 'decline', 'fall', 'drop', 'downgrade', 'sell',
      'bearish', 'weak', 'disappoint', 'cut', 'layoff', 'lawsuit', 'debt',
      'bankrupt', 'fraud', 'investig', 'recall', 'fine', 'penalty',
      'decreas', 'lower', 'worst', 'concern', 'risk', 'warn', 'uncertain',
      'restructur', 'resign', 'crash', 'plunge', 'slump', 'shortfall',
    ];

    let sentimentScore = 0;
    const scoredNews = [];

    articles.forEach(article => {
      const text = ((article.headline || '') + ' ' + (article.summary || '')).toLowerCase();
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

    // Normalize: cap at ±3
    const normalized = Math.max(-3, Math.min(3, Math.round(sentimentScore / articles.length * 3)));

    let label;
    if      (normalized >= 2)  label = 'Very Positive News ✅✅';
    else if (normalized === 1) label = 'Positive News ✅';
    else if (normalized === 0) label = 'Neutral News';
    else if (normalized === -1)label = 'Negative News ⚠️';
    else                       label = 'Very Negative News 🔴';

    return {
      score: normalized,
      news:  scoredNews.slice(0, 5), // top 5 for display
      label,
      totalArticles: articles.length,
    };
  } catch (err) {
    console.log('News error:', err.message);
    return { score: 0, news: [], label: 'News unavailable' };
  }
};

// ── Technical Indicators ───────────────────────────────────────────
const sma = (arr, period) => {
  if (arr.length < period) return null;
  return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
};

const ema = (arr, period) => {
  if (arr.length < period) return null;
  const k = 2 / (period + 1);
  let val = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < arr.length; i++) val = arr[i] * k + val * (1 - k);
  return val;
};

const rsi = (closes, period = 14) => {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
};

const macd = (closes) => {
  const ema12 = ema(closes, 12), ema26 = ema(closes, 26);
  if (!ema12 || !ema26) return { macd: 0, signal: 0, histogram: 0 };
  const macdLine = ema12 - ema26;
  const macdValues = [];
  for (let i = 26; i <= closes.length; i++) {
    const e12 = ema(closes.slice(0, i), 12);
    const e26 = ema(closes.slice(0, i), 26);
    if (e12 && e26) macdValues.push(e12 - e26);
  }
  const signalLine = ema(macdValues, 9) || 0;
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
};

const bollingerBands = (closes, period = 20, mult = 2) => {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean  = slice.reduce((a, b) => a + b, 0) / period;
  const std   = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period);
  return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
};

const atr = (highs, lows, closes, period = 14) => {
  if (closes.length < period + 1) return closes[closes.length - 1] * 0.02;
  const trs = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i]  - closes[i - 1])
    ));
  }
  return trs.reduce((a, b) => a + b, 0) / period;
};

// Stochastic Oscillator (14,3)
const stochastic = (highs, lows, closes, period = 14) => {
  if (closes.length < period) return { k: 50, d: 50 };
  const recentHighs  = highs.slice(-period);
  const recentLows   = lows.slice(-period);
  const highestHigh  = Math.max(...recentHighs);
  const lowestLow    = Math.min(...recentLows);
  const lastClose    = closes[closes.length - 1];
  const k = highestHigh === lowestLow ? 50 : ((lastClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  // %D = 3-period SMA of %K (approximate)
  const kValues = [];
  for (let i = period; i <= closes.length; i++) {
    const h = Math.max(...highs.slice(i - period, i));
    const l = Math.min(...lows.slice(i - period, i));
    const c = closes[i - 1];
    kValues.push(h === l ? 50 : ((c - l) / (h - l)) * 100);
  }
  const d = sma(kValues, 3) || k;
  return { k, d };
};

// Williams %R (14)
const williamsR = (highs, lows, closes, period = 14) => {
  if (closes.length < period) return -50;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  const c = closes[closes.length - 1];
  return h === l ? -50 : ((h - c) / (h - l)) * -100;
};

// Price Rate of Change (10)
const roc = (closes, period = 10) => {
  if (closes.length < period + 1) return 0;
  const prev = closes[closes.length - 1 - period];
  const curr = closes[closes.length - 1];
  return ((curr - prev) / prev) * 100;
};

// ── MAIN ENGINE ────────────────────────────────────────────────────
const getEngineRecommendation = async (symbol) => {
  const quote = await getQuote(symbol);
  const { price, changePct } = quote;

  // Fetch candles and news in parallel
  const [candleResult, newsResult] = await Promise.allSettled([
    getCandles(symbol, 90),
    getNewsSentiment(symbol),
  ]);

  const candles = candleResult.status === 'fulfilled' ? candleResult.value : null;
  const news    = newsResult.status   === 'fulfilled' ? newsResult.value   : { score: 0, news: [], label: 'Unavailable' };

  // Fallback if no candle data
  if (!candles || candles.c.length < 20) {
    return simpleFallback(quote, symbol, news);
  }

  const closes = candles.c;
  const highs  = candles.h;
  const lows   = candles.l;
  const vols   = candles.v || [];

  let score = 0;
  const signals = [];

  // ── 1. RSI (weight: ±2) ─────────────────────────────────────────
  const rsiVal = rsi(closes);
  if      (rsiVal < 25) { score += 3; signals.push(`RSI ${rsiVal.toFixed(0)} — Extremely oversold 🔥`); }
  else if (rsiVal < 35) { score += 2; signals.push(`RSI ${rsiVal.toFixed(0)} — Oversold ✅`); }
  else if (rsiVal < 45) { score += 1; signals.push(`RSI ${rsiVal.toFixed(0)} — Below neutral`); }
  else if (rsiVal > 80) { score -= 3; signals.push(`RSI ${rsiVal.toFixed(0)} — Extremely overbought 🔴`); }
  else if (rsiVal > 70) { score -= 2; signals.push(`RSI ${rsiVal.toFixed(0)} — Overbought ⚠️`); }
  else if (rsiVal > 60) { score -= 1; signals.push(`RSI ${rsiVal.toFixed(0)} — Elevated`); }
  else                  {             signals.push(`RSI ${rsiVal.toFixed(0)} — Neutral`); }

  // ── 2. EMA Crossover 9/21 (weight: ±2) ──────────────────────────
  const ema9  = ema(closes, 9);
  const ema21 = ema(closes, 21);
  if (ema9 && ema21) {
    if      (ema9 > ema21 * 1.003) { score += 2; signals.push(`EMA 9 > EMA 21 — Bullish trend ✅`); }
    else if (ema9 < ema21 * 0.997) { score -= 2; signals.push(`EMA 9 < EMA 21 — Bearish trend ⚠️`); }
    else                           {             signals.push(`EMA 9 ≈ EMA 21 — Neutral`); }
  }

  // ── 3. MACD (weight: ±2) ────────────────────────────────────────
  const macdData = macd(closes);
  if      (macdData.histogram > 0 && macdData.macd > 0) { score += 2; signals.push(`MACD bullish crossover — strong momentum ✅`); }
  else if (macdData.histogram > 0)                       { score += 1; signals.push(`MACD histogram turning positive`); }
  else if (macdData.histogram < 0 && macdData.macd < 0) { score -= 2; signals.push(`MACD bearish crossover — negative momentum ⚠️`); }
  else if (macdData.histogram < 0)                       { score -= 1; signals.push(`MACD histogram turning negative`); }

  // ── 4. Bollinger Bands (weight: ±2) ─────────────────────────────
  const bb = bollingerBands(closes);
  if (bb) {
    const bbPos = (price - bb.lower) / (bb.upper - bb.lower); // 0=lower, 1=upper
    if      (price < bb.lower)          { score += 2; signals.push(`Below lower Bollinger Band — oversold bounce likely ✅`); }
    else if (price > bb.upper)          { score -= 2; signals.push(`Above upper Bollinger Band — overbought ⚠️`); }
    else if (bbPos < 0.35)              { score += 1; signals.push(`Lower half of Bollinger Bands — support zone`); }
    else if (bbPos > 0.65)              { score -= 1; signals.push(`Upper half of Bollinger Bands — resistance zone`); }
    else                                {             signals.push(`Mid Bollinger Bands — neutral range`); }
  }

  // ── 5. Stochastic (weight: ±2) ───────────────────────────────────
  const stoch = stochastic(highs, lows, closes);
  if      (stoch.k < 20 && stoch.d < 20) { score += 2; signals.push(`Stochastic ${stoch.k.toFixed(0)} — Oversold ✅`); }
  else if (stoch.k < 30)                  { score += 1; signals.push(`Stochastic ${stoch.k.toFixed(0)} — Approaching oversold`); }
  else if (stoch.k > 80 && stoch.d > 80) { score -= 2; signals.push(`Stochastic ${stoch.k.toFixed(0)} — Overbought ⚠️`); }
  else if (stoch.k > 70)                  { score -= 1; signals.push(`Stochastic ${stoch.k.toFixed(0)} — Approaching overbought`); }
  else                                    {             signals.push(`Stochastic ${stoch.k.toFixed(0)} — Neutral`); }

  // ── 6. Williams %R (weight: ±1) ──────────────────────────────────
  const wR = williamsR(highs, lows, closes);
  if      (wR < -80) { score += 1; signals.push(`Williams %R ${wR.toFixed(0)} — Oversold ✅`); }
  else if (wR > -20) { score -= 1; signals.push(`Williams %R ${wR.toFixed(0)} — Overbought ⚠️`); }
  else               {             signals.push(`Williams %R ${wR.toFixed(0)} — Neutral`); }

  // ── 7. Rate of Change (weight: ±1) ───────────────────────────────
  const rocVal = roc(closes);
  if      (rocVal > 5)  { score += 1; signals.push(`ROC +${rocVal.toFixed(1)}% — Strong upward momentum ✅`); }
  else if (rocVal < -5) { score -= 1; signals.push(`ROC ${rocVal.toFixed(1)}% — Strong downward momentum ⚠️`); }
  else                  {             signals.push(`ROC ${rocVal.toFixed(1)}% — Stable`); }

  // ── 8. 50-day MA trend (weight: ±1) ──────────────────────────────
  const sma50 = sma(closes, 50);
  if (sma50) {
    if      (price > sma50 * 1.03) { score += 1; signals.push(`Price ${((price/sma50-1)*100).toFixed(1)}% above 50MA — uptrend ✅`); }
    else if (price < sma50 * 0.97) { score -= 1; signals.push(`Price ${((1-price/sma50)*100).toFixed(1)}% below 50MA — downtrend ⚠️`); }
    else                           {             signals.push(`Price near 50MA — consolidating`); }
  }

  // ── 9. Volume confirmation (weight: ±1) ──────────────────────────
  if (vols.length >= 10) {
    const avgVol   = vols.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const lastVol  = vols[vols.length - 1];
    const volRatio = lastVol / avgVol;
    if      (volRatio > 1.5 && changePct > 0) { score += 1; signals.push(`High volume on up day — strong buying ✅`); }
    else if (volRatio > 1.5 && changePct < 0) { score -= 1; signals.push(`High volume on down day — selling pressure ⚠️`); }
    else if (volRatio < 0.5)                  {             signals.push(`Low volume — weak conviction`); }
    else                                      {             signals.push(`Normal volume`); }
  }

  // ── 10. NEWS SENTIMENT (weight: ±3, highest impact) ──────────────
  if (news.score !== 0) {
    score += news.score;
    signals.push(`News sentiment: ${news.label} (impact: ${news.score > 0 ? '+' : ''}${news.score})`);
  } else {
    signals.push(`News sentiment: ${news.label}`);
  }

  // ── Final Decision ─────────────────────────────────────────────────
  // Fix BUY bias: 0 = NEUTRAL, not BUY
  let direction;
  if      (score > 1)  direction = 'BUY';
  else if (score < -1) direction = 'SELL';
  else                 direction = score >= 0 ? 'BUY' : 'SELL'; // slight edge

  const absScore = Math.abs(score);
  let confidence;
  if      (absScore >= 10) confidence = 'Very High';
  else if (absScore >= 7)  confidence = 'High';
  else if (absScore >= 4)  confidence = 'Medium';
  else if (absScore >= 2)  confidence = 'Low';
  else                     confidence = 'Very Low';

  // ── TP & SL using real ATR ────────────────────────────────────────
  const realAtr    = atr(highs, lows, closes);
  const tpMult     = absScore >= 8 ? 4.0 : absScore >= 5 ? 3.0 : 2.0;
  const slMult     = 1.5;
  const takeProfit = direction === 'BUY'
    ? +(price + realAtr * tpMult).toFixed(2)
    : +(price - realAtr * tpMult).toFixed(2);
  const stopLoss   = direction === 'BUY'
    ? +(price - realAtr * slMult).toFixed(2)
    : +(price + realAtr * slMult).toFixed(2);
  const riskReward = +((Math.abs(takeProfit - price) / Math.abs(stopLoss - price)).toFixed(2));

  const high52  = Math.max(...highs);
  const low52   = Math.min(...lows);
  const rangePct = high52 !== low52 ? ((price - low52) / (high52 - low52) * 100) : 50;

  return {
    symbol:     quote.symbol,
    name:       quote.shortName,
    price,
    direction,
    confidence,
    takeProfit,
    stopLoss,
    riskReward,
    rangePct:   +rangePct.toFixed(1),
    trend:      score > 0 ? 'Bullish' : score < 0 ? 'Bearish' : 'Neutral',
    change:     changePct,
    score,
    signals,
    news:       news.news,       // top 5 news articles with sentiment
    newsLabel:  news.label,
    newsScore:  news.score,
    indicators: {
      rsi:   +rsiVal.toFixed(1),
      ema9:  ema9?.toFixed(2),
      ema21: ema21?.toFixed(2),
      macd:  +macdData.macd.toFixed(4),
      stoch: +stoch.k.toFixed(1),
      wR:    +wR.toFixed(1),
      roc:   +rocVal.toFixed(2),
      bb:    bb ? { upper: +bb.upper.toFixed(2), lower: +bb.lower.toFixed(2) } : null,
    },
  };
};

// ── Fallback ───────────────────────────────────────────────────────
const simpleFallback = (quote, symbol, news = { score: 0, news: [], label: 'N/A' }) => {
  const { price, high, low, changePct } = quote;
  const rangePct = (price - low * 0.9) / (high * 1.1 - low * 0.9);
  let score = 0;
  if (changePct > 1) score++; if (changePct < -1) score--;
  score += news.score;
  const direction = score >= 0 ? 'BUY' : 'SELL';
  const atrEst    = price * 0.025;
  return {
    symbol: quote.symbol, name: quote.shortName, price, direction,
    confidence: 'Low',
    takeProfit: direction==='BUY' ? +(price+atrEst*2).toFixed(2) : +(price-atrEst*2).toFixed(2),
    stopLoss:   direction==='BUY' ? +(price-atrEst*1.5).toFixed(2) : +(price+atrEst*1.5).toFixed(2),
    riskReward: 1.33, rangePct: +(rangePct*100).toFixed(1),
    trend: changePct > 0 ? 'Bullish' : 'Bearish', change: changePct, score,
    signals: ['Limited technical data — using basic analysis', `News: ${news.label}`],
    news: news.news, newsLabel: news.label, newsScore: news.score,
  };
};

module.exports = { getQuote, getEngineRecommendation };
