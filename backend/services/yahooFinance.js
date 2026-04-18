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
  const opts = {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SwingRush/1.0)',
      'Accept': 'application/json',
    }
  };
  https.get(url, opts, (res) => {
    // Follow redirects
    if (res.statusCode === 301 || res.statusCode === 302) {
      return fetchJSON(res.headers.location).then(resolve).catch(reject);
    }
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
  }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
});

// ── Symbol map ─────────────────────────────────────────────────────
const SYMBOL_MAP = {
  'GOLD':'GLD','XAU':'GLD','XAU/USD':'GLD','XAUUSD':'GLD','GC=F':'GLD',
  'SILVER':'SLV','XAG':'SLV','XAG/USD':'SLV','XAGUSD':'SLV','SI=F':'SLV',
  'OIL':'USO','CL=F':'USO','BRENT':'USO','CRUDE':'USO','WTI':'USO',
  'NATGAS':'UNG','NG=F':'UNG','GAS':'UNG',
  'PLATINUM':'PPLT','XPT':'PPLT',
  'COPPER':'CPER','HG=F':'CPER',
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

// ── Core quote ─────────────────────────────────────────────────────
const getQuote = (symbol) => new Promise((resolve, reject) => {
  const upper    = symbol.toUpperCase();
  const resolved = resolveSymbol(upper);
  const cached   = fromCache(resolved);
  if (cached) return resolve(cached);
  client.quote(resolved, (err, data) => {
    if (err || !data || !data.c) {
      return reject(new Error(`Symbol not found: ${symbol}. Try: GLD, SLV, USO, UNG, AAPL, NVDA`));
    }
    const result = {
      symbol:    DISPLAY_MAP[resolved] || resolved,
      shortName: REAL_NAMES[resolved]  || DISPLAY_MAP[resolved] || resolved,
      price:     data.c,
      change:    data.d   || 0,
      changePct: data.dp  || 0,
      high:      data.h   || data.c,
      low:       data.l   || data.c,
      open:      data.o   || data.c,
      prevClose: data.pc  || data.c,
    };
    toCache(resolved, result);
    resolve(result);
  });
});

// ── Get daily candles via Yahoo Finance (free, no key needed) ──────
const getCandles = async (symbol, days = 90) => {
  const resolved = resolveSymbol(symbol);
  // Strip BINANCE: prefix for Yahoo
  const ySym = resolved.startsWith('BINANCE:')
    ? resolved.replace('BINANCE:', '').replace('USDT', '-USD')
    : resolved;

  const now  = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&period1=${from}&period2=${now}`;

  const data = await fetchJSON(url);
  const result = data?.chart?.result?.[0];
  if (!result || !result.indicators?.quote?.[0]?.close) {
    throw new Error('Not enough candle data');
  }

  const q      = result.indicators.quote[0];
  const closes = q.close.filter(v => v != null);
  const highs  = q.high.filter(v => v != null);
  const lows   = q.low.filter(v => v != null);
  const vols   = q.volume.filter(v => v != null);

  if (closes.length < 10) throw new Error('Not enough candle data');

  return { c: closes, h: highs, l: lows, v: vols, s: 'ok' };
};

// ── Technical Indicators ───────────────────────────────────────────

// Simple Moving Average
const sma = (arr, period) => {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

// Exponential Moving Average
const ema = (arr, period) => {
  if (arr.length < period) return null;
  const k = 2 / (period + 1);
  let val = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < arr.length; i++) {
    val = arr[i] * k + val * (1 - k);
  }
  return val;
};

// RSI (14)
const rsi = (closes, period = 14) => {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains  += diff;
    else          losses -= diff;
  }
  const avgGain = gains  / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

// MACD (12, 26, 9)
const macd = (closes) => {
  const ema12  = ema(closes, 12);
  const ema26  = ema(closes, 26);
  if (!ema12 || !ema26) return { macd: 0, signal: 0, histogram: 0 };
  const macdLine = ema12 - ema26;
  // Signal = 9-period EMA of macd - we approximate with last 9 values
  const macdValues = [];
  for (let i = 26; i <= closes.length; i++) {
    const e12 = ema(closes.slice(0, i), 12);
    const e26 = ema(closes.slice(0, i), 26);
    if (e12 && e26) macdValues.push(e12 - e26);
  }
  const signalLine = ema(macdValues, 9) || 0;
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
};

// Bollinger Bands (20, 2)
const bollingerBands = (closes, period = 20, mult = 2) => {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean  = slice.reduce((a, b) => a + b, 0) / period;
  const std   = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period);
  return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
};

// ATR (14) — real volatility
const atr = (highs, lows, closes, period = 14) => {
  if (closes.length < period + 1) return closes[closes.length-1] * 0.02;
  const trs = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    const tr = Math.max(
      highs[i]  - lows[i],
      Math.abs(highs[i]  - closes[i-1]),
      Math.abs(lows[i]   - closes[i-1])
    );
    trs.push(tr);
  }
  return trs.reduce((a, b) => a + b, 0) / period;
};

// ── Scoring Engine ─────────────────────────────────────────────────
// Each indicator votes BUY (+1), SELL (-1) or NEUTRAL (0)
// Final score determines direction and confidence

const getEngineRecommendation = async (symbol) => {
  const quote = await getQuote(symbol);
  const { price, high, low, changePct } = quote;

  let candles;
  try {
    candles = await getCandles(symbol, 90);
  } catch (_) {
    candles = null;
  }

  // If no candle data, fall back to simple logic
  if (!candles || candles.c.length < 20) {
    return simpleFallback(quote, symbol);
  }

  const closes = candles.c;
  const highs  = candles.h;
  const lows   = candles.l;
  const vols   = candles.v || [];

  let score = 0; // positive = BUY, negative = SELL
  const signals = [];

  // ── 1. RSI ──────────────────────────────────────────────────────
  const rsiVal = rsi(closes);
  if (rsiVal < 30) {
    score += 2; signals.push(`RSI ${rsiVal.toFixed(0)} — Oversold ✅`);
  } else if (rsiVal < 45) {
    score += 1; signals.push(`RSI ${rsiVal.toFixed(0)} — Approaching oversold`);
  } else if (rsiVal > 70) {
    score -= 2; signals.push(`RSI ${rsiVal.toFixed(0)} — Overbought ⚠️`);
  } else if (rsiVal > 58) {
    score -= 1; signals.push(`RSI ${rsiVal.toFixed(0)} — Elevated`);
  } else {
    signals.push(`RSI ${rsiVal.toFixed(0)} — Neutral`);
  }

  // ── 2. EMA Crossover (9 vs 21) ───────────────────────────────────
  const ema9  = ema(closes, 9);
  const ema21 = ema(closes, 21);
  if (ema9 && ema21) {
    if (ema9 > ema21 * 1.002) {
      score += 2; signals.push(`EMA 9 > EMA 21 — Bullish crossover ✅`);
    } else if (ema9 < ema21 * 0.998) {
      score -= 2; signals.push(`EMA 9 < EMA 21 — Bearish crossover ⚠️`);
    } else {
      signals.push(`EMA 9 ≈ EMA 21 — Neutral`);
    }
  }

  // ── 3. MACD ──────────────────────────────────────────────────────
  const macdData = macd(closes);
  if (macdData.histogram > 0 && macdData.macd > 0) {
    score += 2; signals.push(`MACD bullish — momentum positive ✅`);
  } else if (macdData.histogram > 0 && macdData.macd < 0) {
    score += 1; signals.push(`MACD histogram turning positive`);
  } else if (macdData.histogram < 0 && macdData.macd < 0) {
    score -= 2; signals.push(`MACD bearish — momentum negative ⚠️`);
  } else if (macdData.histogram < 0) {
    score -= 1; signals.push(`MACD histogram turning negative`);
  }

  // ── 4. Bollinger Bands ───────────────────────────────────────────
  const bb = bollingerBands(closes);
  if (bb) {
    if (price < bb.lower) {
      score += 2; signals.push(`Price below lower Bollinger Band — oversold ✅`);
    } else if (price > bb.upper) {
      score -= 2; signals.push(`Price above upper Bollinger Band — overbought ⚠️`);
    } else if (price < bb.middle) {
      score += 1; signals.push(`Price below Bollinger midline`);
    } else {
      score -= 1; signals.push(`Price above Bollinger midline`);
    }
  }

  // ── 5. 50-day trend ──────────────────────────────────────────────
  const sma50 = sma(closes, 50);
  if (sma50) {
    if (price > sma50 * 1.02) {
      score += 1; signals.push(`Price above 50-day MA — uptrend ✅`);
    } else if (price < sma50 * 0.98) {
      score -= 1; signals.push(`Price below 50-day MA — downtrend ⚠️`);
    }
  }

  // ── 6. Volume confirmation ───────────────────────────────────────
  if (vols.length >= 10) {
    const avgVol    = vols.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const lastVol   = vols[vols.length - 1];
    const volRatio  = lastVol / avgVol;
    if (volRatio > 1.5 && changePct > 0) {
      score += 1; signals.push(`High volume on up day — strong momentum ✅`);
    } else if (volRatio > 1.5 && changePct < 0) {
      score -= 1; signals.push(`High volume on down day — selling pressure ⚠️`);
    }
  }

  // ── Final Decision ───────────────────────────────────────────────
  const direction = score >= 0 ? 'BUY' : 'SELL';
  const absScore  = Math.abs(score);
  let confidence;
  if      (absScore >= 7)  confidence = 'Very High';
  else if (absScore >= 5)  confidence = 'High';
  else if (absScore >= 3)  confidence = 'Medium';
  else if (absScore >= 1)  confidence = 'Low';
  else                     confidence = 'Neutral';

  // ── TP & SL using real ATR ───────────────────────────────────────
  const realAtr    = atr(highs, lows, closes);
  const tpMult     = absScore >= 5 ? 3.5 : absScore >= 3 ? 2.5 : 2.0;
  const slMult     = 1.5;
  const takeProfit = direction === 'BUY'
    ? +(price + realAtr * tpMult).toFixed(2)
    : +(price - realAtr * tpMult).toFixed(2);
  const stopLoss   = direction === 'BUY'
    ? +(price - realAtr * slMult).toFixed(2)
    : +(price + realAtr * slMult).toFixed(2);
  const riskReward = +((Math.abs(takeProfit - price) / Math.abs(stopLoss - price)).toFixed(2));

  // 52w range approximation from candle data
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
    signals,    // The individual indicator votes
    indicators: { rsi: +rsiVal.toFixed(1), ema9: ema9?.toFixed(2), ema21: ema21?.toFixed(2), macd: +macdData.macd.toFixed(4), bb: bb ? { upper: +bb.upper.toFixed(2), lower: +bb.lower.toFixed(2) } : null },
  };
};

// ── Simple fallback when no candle data ───────────────────────────
const simpleFallback = (quote, symbol) => {
  const { price, high, low, changePct } = quote;
  const rangePct = (price - low * 0.9) / (high * 1.1 - low * 0.9);
  const direction = (rangePct < 0.4 || changePct < -1) ? 'SELL' :
                    (rangePct > 0.6 || changePct > 1)  ? 'BUY'  : 'BUY';
  const atrEst    = price * 0.025;
  return {
    symbol: quote.symbol, name: quote.shortName, price,
    direction, confidence: 'Low',
    takeProfit: direction==='BUY' ? +(price+atrEst*2.5).toFixed(2) : +(price-atrEst*2.5).toFixed(2),
    stopLoss:   direction==='BUY' ? +(price-atrEst*1.5).toFixed(2) : +(price+atrEst*1.5).toFixed(2),
    riskReward: 1.67, rangePct: +(rangePct*100).toFixed(1),
    trend: changePct > 0 ? 'Bullish' : 'Bearish', change: changePct, score: 0, signals: ['Insufficient data for full analysis'],
  };
};

module.exports = { getQuote, getEngineRecommendation };
