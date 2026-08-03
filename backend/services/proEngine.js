// ═══════════════════════════════════════════════════════════════════
// PRO ENGINE — Standalone technical scoring for Pro users
// This file is 100% independent from yahooFinance.js / stockScanner.js.
// It does NOT modify, import internals from, or affect the existing
// Signal Engine or Scanner in any way. Safe to edit freely.
// ═══════════════════════════════════════════════════════════════════

const https = require('https');

// ── Simple in-memory cache (separate from the main engine's cache) ──
const proCache = new Map();
const PRO_TTL = 30000; // 30s, same convention as main engine's quote cache
const fromProCache = (k) => {
  const e = proCache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > PRO_TTL) { proCache.delete(k); return null; }
  return e.data;
};
const toProCache = (k, d) => proCache.set(k, { data: d, ts: Date.now() });

// ── Yahoo fetch helper (standalone, mirrors main engine's approach) ──
// A `timeout` on the request options only bounds the connect phase; a stalled
// response after connecting can still hang forever, so a `timeout` event
// listener + req.destroy() is required to actually cap total wait time.
const fetchJSON = (url, retries = 3) => new Promise((resolve, reject) => {
  const attempt = (n) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) {
          if (n > 0) setTimeout(() => attempt(n - 1), 600);
          else reject(e);
        }
      });
    }).on('error', (err) => {
      if (n > 0) setTimeout(() => attempt(n - 1), 600);
      else reject(err);
    });
    req.on('timeout', () => req.destroy(new Error('Yahoo request timed out')));
  };
  attempt(retries);
});

const resolveSymbol = (symbol) => symbol.toUpperCase().trim();

// Instant local check (no API call) - is it currently pre-market or after-hours
// for US markets? Only in THOSE windows do we need the heavier intraday fetch;
// during regular hours or fully-closed periods the light daily fetch is already correct.
// Are we CURRENTLY inside regular NYSE trading hours (9:30am-4:00pm ET, weekdays)?
// This is the ONLY state where a single live price is sufficient (Google-Finance-style).
// Every other state (pre-market, after-hours, or the dead overnight/weekend period)
// needs the dual-price treatment: freshest last-traded price + the regular close.
const isRegularSessionNow = () => {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short' });
  const parts = fmt.formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type).value;
  const weekday = get('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const mins = hour * 60 + minute;
  const regularStart = 9 * 60 + 30, regularEnd = 16 * 60;
  return mins >= regularStart && mins < regularEnd;
};

const getQuote = async (symbol, opts = {}) => {
  const resolved = resolveSymbol(symbol);
  const cached = opts.fresh ? null : fromProCache('quote_' + resolved);
  if (cached) return cached;

  const regular = isRegularSessionNow();
  let quote;

  if (!regular) {
    // Anytime we're NOT in regular trading hours (pre-market, after-hours, or
    // the dead overnight/weekend period) - Google-Finance style: always show
    // BOTH the freshest last-traded price AND the official regular-session close.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved)}?interval=1m&range=1d&includePrePost=true`;
    const json = await fetchJSON(url);
    const result = json.chart.result[0];
    const meta = result.meta;
    const ts = result.timestamp || [];
    const intradayCloses = (result.indicators.quote[0].close || []);

    let freshPrice = meta.regularMarketPrice;
    let priceTime = meta.regularMarketTime;
    for (let i = intradayCloses.length - 1; i >= 0; i--) {
      if (intradayCloses[i] != null) { freshPrice = intradayCloses[i]; priceTime = ts[i]; break; }
    }

    const regularSessionPrice = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || regularSessionPrice;
    const changePct = prevClose ? ((freshPrice - prevClose) / prevClose) * 100 : 0;

    const nowSec = Math.floor(Date.now() / 1000);
    const ctp = meta.currentTradingPeriod || {};
    // Only the narrow pre-market window gets that specific label; everything
    // else outside regular hours (post-close, dead of night, weekend) is
    // labeled After-Hours, matching how Google persists that label overnight.
    const marketState = (ctp.pre && nowSec < ctp.pre.end) ? 'Pre-Market' : 'After-Hours';

    quote = {
      symbol: resolved,
      price: freshPrice,
      regularSessionPrice,
      changePct, marketState, priceTime,
      shortName: meta.shortName || meta.symbol,
      high52: meta.fiftyTwoWeekHigh, low52: meta.fiftyTwoWeekLow,
    };
  } else {
    // Regular trading hours right now - a single live price is correct and sufficient.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved)}?interval=1d&range=5d`;
    const json = await fetchJSON(url);
    const result = json.chart.result[0];
    const meta = result.meta;
    const closes = result.indicators.quote[0].close.filter(c => c != null);
    const price = meta.regularMarketPrice;
    // Yahoo's meta.chartPreviousClose is the close BEFORE the first bar of the
    // requested range (here 5d) — i.e. ~5 trading days ago, NOT yesterday's
    // close — so trusting it first produced wildly wrong % changes (e.g. ORCL
    // showed +16% when the real move was +7%). The true prior close is the
    // second-to-last daily bar; use that first and only fall back to meta.
    const prevClose = (closes.length >= 2 ? closes[closes.length - 2] : null) || meta.chartPreviousClose || price;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    quote = {
      symbol: resolved,
      price,
      regularSessionPrice: price,
      changePct,
      marketState: 'Regular Session',
      priceTime: meta.regularMarketTime,
      shortName: meta.shortName || meta.symbol,
      high52: meta.fiftyTwoWeekHigh, low52: meta.fiftyTwoWeekLow,
    };
  }

  toProCache('quote_' + resolved, quote);
  return quote;
};

const getCandles = async (symbol, days = 120, interval = '1d') => {
  const resolved = resolveSymbol(symbol);
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved)}?interval=${interval}&period1=${from}&period2=${now}`;
  const json = await fetchJSON(url);
  const result = json.chart.result[0];
  const q = result.indicators.quote[0];
  const ts = result.timestamp || [];
  // Filter to indices where close is valid, keeping all fields aligned to the same indices
  const validIdx = [];
  for (let i = 0; i < q.close.length; i++) { if (q.close[i] != null) validIdx.push(i); }
  const closes = validIdx.map(i => q.close[i]);
  const highs  = validIdx.map(i => q.high[i]);
  const lows   = validIdx.map(i => q.low[i]);
  const opens  = validIdx.map(i => q.open[i]);
  const times  = validIdx.map(i => ts[i]);
  const vols   = validIdx.map(i => (q.volume || [])[i] || 0);
  return { c: closes, h: highs, l: lows, v: vols, o: opens, t: times };
};

// ── Technical indicator math (standard formulas) ────────────────────
const sma = (arr, period) => {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

const ema = (arr, period) => {
  if (arr.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < arr.length; i++) emaVal = arr[i] * k + emaVal * (1 - k);
  return emaVal;
};

const rsi = (closes, period = 14) => {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

const macd = (closes) => {
  const ema12 = ema(closes, 12), ema26 = ema(closes, 26);
  if (!ema12 || !ema26) return { macd: 0, signal: 0, histogram: 0 };
  const macdLine = ema12 - ema26;
  const signalLine = macdLine * 0.9; // simplified signal approximation, consistent with main engine style
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
};

const bollinger = (closes, period = 20, mult = 2) => {
  const meanVal = sma(closes, period);
  if (!meanVal) return null;
  const slice = closes.slice(-period);
  const variance = slice.reduce((a, b) => a + Math.pow(b - meanVal, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: meanVal + mult * std, middle: meanVal, lower: meanVal - mult * std };
};

const stochastic = (closes, highs, lows, period = 14) => {
  if (closes.length < period) return { k: 50, d: 50 };
  const recentHigh = Math.max(...highs.slice(-period));
  const recentLow  = Math.min(...lows.slice(-period));
  const k = recentHigh === recentLow ? 50 : ((closes[closes.length - 1] - recentLow) / (recentHigh - recentLow)) * 100;
  return { k, d: k }; // simplified, consistent style
};

const williamsR = (closes, highs, lows, period = 14) => {
  if (closes.length < period) return 0;
  const recentHigh = Math.max(...highs.slice(-period));
  const recentLow  = Math.min(...lows.slice(-period));
  if (recentHigh === recentLow) return 0;
  return ((recentHigh - closes[closes.length - 1]) / (recentHigh - recentLow)) * -100;
};

const roc = (closes, period = 10) => {
  if (closes.length < period + 1) return 0;
  const past = closes[closes.length - 1 - period];
  const now  = closes[closes.length - 1];
  return past ? ((now - past) / past) * 100 : 0;
};

const atr = (highs, lows, closes, period = 14) => {
  if (closes.length < period + 1) return 0;
  const trs = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
};

const adx = (highs, lows, closes, period = 14) => {
  if (closes.length < period + 2) return { adx: 0, plusDI: 0, minusDI: 0 };
  let plusDM = 0, minusDM = 0, trSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    if (upMove > downMove && upMove > 0) plusDM += upMove;
    if (downMove > upMove && downMove > 0) minusDM += downMove;
    trSum += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  if (!trSum) return { adx: 0, plusDI: 0, minusDI: 0 };
  const plusDI = (plusDM / trSum) * 100;
  const minusDI = (minusDM / trSum) * 100;
  const dx = (plusDI + minusDI) ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0;
  return { adx: +dx.toFixed(1), plusDI: +plusDI.toFixed(1), minusDI: +minusDI.toFixed(1) };
};

// ── MAIN: Technical-only scoring (NO news — Claude handles that separately) ──
const getProTechnicalScore = async (symbol) => {
  // Quote and candles are independent Yahoo calls — fetch them in parallel
  // instead of sequentially (saves a full round-trip on every Pro Engine run).
  const [quote, candles] = await Promise.all([getQuote(symbol), getCandles(symbol, 120)]);
  const { price, changePct, regularSessionPrice, marketState } = quote;

  if (!candles || candles.c.length < 20) {
    return {
      symbol: quote.symbol, price, score: 0, signals: [],
      insufficientData: true,
    };
  }

  const closes = candles.c, highs = candles.h, lows = candles.l, vols = candles.v || [];
  let score = 0;
  const signals = [];
  const breakdown = [];
  const add = (indicator, pts, msg) => {
    score += pts;
    signals.push(msg);
    breakdown.push({ indicator, points: pts, note: msg });
  };

  // 1. RSI ±3
  const rsiVal = rsi(closes);
  if      (rsiVal < 25) { add('RSI', 3, `RSI ${rsiVal.toFixed(0)} — Extremely oversold 🔥`); }
  else if (rsiVal < 35) { add('RSI', 2, `RSI ${rsiVal.toFixed(0)} — Oversold ✅`); }
  else if (rsiVal < 45) { add('RSI', 1, `RSI ${rsiVal.toFixed(0)} — Below neutral`); }
  else if (rsiVal > 80) { add('RSI', -3, `RSI ${rsiVal.toFixed(0)} — Extremely overbought 🔴`); }
  else if (rsiVal > 70) { add('RSI', -2, `RSI ${rsiVal.toFixed(0)} — Overbought ⚠️`); }
  else if (rsiVal > 60) { add('RSI', -1, `RSI ${rsiVal.toFixed(0)} — Elevated`); }
  else                  { add('RSI', 0, `RSI ${rsiVal.toFixed(0)} — Neutral`); }

  // 2. EMA 9/21 ±2
  const ema9 = ema(closes, 9), ema21 = ema(closes, 21);
  if (ema9 && ema21) {
    if      (ema9 > ema21 * 1.003) { add('EMA', 2, `EMA 9>21 — Bullish trend ✅`); }
    else if (ema9 < ema21 * 0.997) { add('EMA', -2, `EMA 9<21 — Bearish trend ⚠️`); }
    else                           { add('EMA', 0, `EMA 9≈21 — Neutral`); }
  }

  // 3. MACD ±2
  const macdData = macd(closes);
  if      (macdData.histogram > 0 && macdData.macd > 0) { add('MACD', 2, `MACD bullish crossover ✅`); }
  else if (macdData.histogram > 0)                       { add('MACD', 1, `MACD histogram turning positive`); }
  else if (macdData.histogram < 0 && macdData.macd < 0)  { add('MACD', -2, `MACD bearish crossover ⚠️`); }
  else if (macdData.histogram < 0)                       { add('MACD', -1, `MACD histogram turning negative`); }
  else                                                    { add('MACD', 0, `MACD neutral`); }

  // 4. Bollinger Bands ±2
  const bb = bollinger(closes);
  if (bb) {
    const bbPos = (price - bb.lower) / (bb.upper - bb.lower);
    if      (price < bb.lower) { add('Bollinger', 2, `Below lower Bollinger — oversold bounce ✅`); }
    else if (price > bb.upper) { add('Bollinger', -2, `Above upper Bollinger — overbought ⚠️`); }
    else if (bbPos < 0.35)     { add('Bollinger', 1, `Lower Bollinger zone — support`); }
    else if (bbPos > 0.65)     { add('Bollinger', -1, `Upper Bollinger zone — resistance`); }
    else                       { add('Bollinger', 0, `Mid Bollinger — neutral range`); }
  }

  // 5. ADX ±2
  const adxData = adx(highs, lows, closes);
  if (adxData.adx > 0) {
    if      (adxData.plusDI > adxData.minusDI && adxData.adx >= 30) { add('ADX', 2, `ADX ${adxData.adx} — Strong uptrend ✅`); }
    else if (adxData.plusDI > adxData.minusDI)                       { add('ADX', 1, `ADX ${adxData.adx} — Uptrend developing`); }
    else if (adxData.minusDI > adxData.plusDI && adxData.adx >= 30)  { add('ADX', -2, `ADX ${adxData.adx} — Strong downtrend ⚠️`); }
    else                                                              { add('ADX', -1, `ADX ${adxData.adx} — Downtrend developing`); }
  } else { add('ADX', 0, `ADX — Weak trend, ranging`); }

  // 6. Stochastic ±1 (reduced — overlaps conceptually with RSI)
  const stoch = stochastic(closes, highs, lows);
  if      (stoch.k < 20 && stoch.d < 20) { add('Stochastic', 1, `Stoch ${stoch.k.toFixed(0)} — Oversold ✅`); }
  else if (stoch.k < 30)                 { add('Stochastic', 0, `Stoch ${stoch.k.toFixed(0)} — Approaching oversold`); }
  else if (stoch.k > 80 && stoch.d > 80) { add('Stochastic', -1, `Stoch ${stoch.k.toFixed(0)} — Overbought ⚠️`); }
  else if (stoch.k > 70)                 { add('Stochastic', 0, `Stoch ${stoch.k.toFixed(0)} — Approaching overbought`); }
  else                                    { add('Stochastic', 0, `Stoch ${stoch.k.toFixed(0)} — Neutral`); }

  // 7. Williams %R ±1
  const wR = williamsR(closes, highs, lows);
  if      (wR < -80) { add('Williams %R', 1, `Williams %R ${wR.toFixed(0)} — Oversold ✅`); }
  else if (wR > -20) { add('Williams %R', -1, `Williams %R ${wR.toFixed(0)} — Overbought ⚠️`); }
  else                { add('Williams %R', 0, `Williams %R ${wR.toFixed(0)} — Neutral`); }

  // 8. ROC ±1
  const rocVal = roc(closes);
  if      (rocVal > 5)  { add('ROC', 1, `ROC +${rocVal.toFixed(1)}% — Strong momentum ✅`); }
  else if (rocVal < -5) { add('ROC', -1, `ROC ${rocVal.toFixed(1)}% — Negative momentum ⚠️`); }
  else                  { add('ROC', 0, `ROC ${rocVal.toFixed(1)}% — Stable`); }

  // 9. Distance from SMA50 — informational only, no score impact (overlaps with EMA trend)
  const sma50 = sma(closes, 50);
  if (sma50) {
    if      (price > sma50 * 1.03) { signals.push(`${((price / sma50 - 1) * 100).toFixed(1)}% above 50MA (info)`); }
    else if (price < sma50 * 0.97) { signals.push(`${((1 - price / sma50) * 100).toFixed(1)}% below 50MA (info)`); }
    else                            { signals.push(`Price near 50MA — consolidating`); }
  }

  // 10. Volume — informational only, no score impact
  if (vols.length >= 5) {
    const avgVol = vols.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
    const vr = avgVol ? vols[vols.length - 1] / avgVol : 1;
    if      (vr > 1.5 && changePct > 0) { signals.push(`High volume on up day (info)`); }
    else if (vr > 1.5 && changePct < 0) { signals.push(`High volume on down day (info)`); }
    else                                 { signals.push(`Normal volume`); }
  }

  const realAtr = atr(highs, lows, closes) || (price * 0.02);
  const direction = score > 0 ? 'BUY' : score < 0 ? 'SELL' : 'NEUTRAL';

  const rowCandles = closes.map((close, i) => ({
    time: candles.t[i], open: candles.o[i], high: highs[i], low: lows[i], close,
  }));

  return {
    symbol: quote.symbol, name: quote.shortName, price, changePct, regularSessionPrice, marketState,
    breakdown,
    score, signals, direction, realAtr,
    candles: rowCandles,
  };
};

module.exports = { getProTechnicalScore, getQuote, getCandles };
