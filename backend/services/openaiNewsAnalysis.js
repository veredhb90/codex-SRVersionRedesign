// ═══════════════════════════════════════════════════════════════════
// OPENAI NEWS ANALYSIS — Pro-only, real AI reasoning about fresh news
// Fetches raw headlines from Finnhub (fast/cheap), then sends them to
// GPT-5.6 Sol for genuine understanding — not keyword counting like the
// free engine's news score. Cached briefly per symbol to balance freshness
// with external API usage.
// Fully standalone — does not touch yahooFinance.js or chat.js.
// ═══════════════════════════════════════════════════════════════════

const https = require('https');
const { enqueueFinnhubCall } = require('./finnhubQueue');
const { createOpenAIResponse, extractOutputText } = require('./openaiResponses');

// ── Freshness-aware cache (per symbol) ──────────────────────────────
const newsCache = new Map();
const configuredNewsTtl = Number(process.env.OPENAI_NEWS_CACHE_MS);
const NEWS_TTL = configuredNewsTtl > 0 ? configuredNewsTtl : 30 * 60 * 1000;
const fromNewsCache = (k) => {
  const e = newsCache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > NEWS_TTL) { newsCache.delete(k); return null; }
  return e.data;
};
const toNewsCache = (k, d) => newsCache.set(k, { data: d, ts: Date.now() });

// ── Fetch raw headlines from Finnhub (same source as free engine) ───
const fetchFinnhubNews = (symbol) => new Promise((resolve) => {
  const now = Math.floor(Date.now() / 1000);
  const fromDate = new Date((now - 7 * 86400) * 1000).toISOString().split('T')[0];
  const toDate = new Date(now * 1000).toISOString().split('T')[0];
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
  const req = https.get(url, { timeout: 15000 }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          console.log('⚠️ Finnhub news non-array response for ' + symbol + ':', JSON.stringify(parsed).slice(0, 300));
          return resolve([]);
        }
        const uniqueRecent = parsed
          .filter(article => article && article.headline)
          .sort((a, b) => Number(b.datetime || 0) - Number(a.datetime || 0))
          .filter((article, index, all) => all.findIndex(other => other.headline === article.headline) === index)
          .slice(0, 10);
        resolve(uniqueRecent);
      } catch (e) {
        console.log('⚠️ Finnhub news parse error for ' + symbol + ':', e.message, '| raw:', raw.slice(0, 200));
        resolve([]);
      }
    });
  }).on('error', (err) => {
    console.log('⚠️ Finnhub news request error for ' + symbol + ':', err.message);
    resolve([]);
  });
  req.on('timeout', () => req.destroy(new Error('Finnhub news timed out')));
});

// ── Fetch analyst recommendations (same source as free engine) ──────
const fetchAnalystRatings = (symbol) => new Promise((resolve) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${apiKey}`;
  const req = https.get(url, { timeout: 15000 }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(Array.isArray(parsed) && parsed.length ? parsed[0] : null);
      } catch (e) { resolve(null); }
    });
  }).on('error', () => resolve(null));
  req.on('timeout', () => req.destroy(new Error('timed out')));
});

const SYSTEM_PROMPT = `You are an equity research analyst. You will be given this stock's recent news headlines. Read them, analyze what they actually mean, and give the stock a sentiment score from -10 (very bearish) to +10 (very bullish). The score is entirely your own call - analyze it however you see fit, with full freedom. No rules, no thresholds. Also explain, in a few clear sentences, WHY you landed on that exact score.

You are also given analyst-consensus data and confirmed upcoming-earnings dates for reference; if you mention an earnings date, use the exact one provided. Never invent a headline, date, analyst figure, or event that is not present in the supplied data. If there is no meaningful news, say so and score it 0. Distinguish facts in the supplied data from your interpretation.`;

const NEWS_ANALYSIS_FORMAT = {
  type: 'json_schema',
  name: 'stock_news_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      score: { type: 'integer', minimum: -10, maximum: 10 },
      label: { type: 'string' },
      summary: { type: 'string' },
      reasoning: { type: 'string' },
      catalysts: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      risks: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      holdingPeriod: { type: 'string' },
    },
    required: ['score', 'label', 'summary', 'reasoning', 'catalysts', 'risks', 'holdingPeriod'],
  },
};

// ── MAIN: Real OpenAI-powered news analysis (Pro only) ───────────────
// ── Fetch REAL upcoming earnings dates from Finnhub (not guessed) ─────
const fetchUpcomingEarnings = (symbol) => new Promise((resolve) => {
  const now = new Date();
  const from = now.toISOString().split('T')[0];
  const to = new Date(now.getTime() + 270 * 86400000).toISOString().split('T')[0]; // next ~9 months
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${apiKey}`;
  const req = require('https').get(url, { timeout: 15000 }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const list = (parsed.earningsCalendar || [])
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3)
          .map(e => ({
            date: e.date,
            quarter: e.quarter,
            year: e.year,
            hour: e.hour === 'bmo' ? 'Before Market Open' : e.hour === 'amc' ? 'After Market Close' : 'Time TBD',
            epsEstimate: e.epsEstimate,
            revenueEstimate: e.revenueEstimate,
          }));
        resolve(list);
      } catch (e) { resolve([]); }
    });
  }).on('error', () => resolve([]));
  req.on('timeout', () => req.destroy(new Error('timed out')));
});

// ── Fetch past earnings history (last 4 quarters, actual vs estimate) ─────
const fetchEarningsHistory = (symbol) => new Promise((resolve) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${apiKey}`;
  const req = require('https').get(url, { timeout: 15000 }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const list = Array.isArray(parsed) ? parsed.slice(0, 4).map(e => ({
          period: e.period, quarter: e.quarter, year: e.year,
          epsActual: e.actual, epsEstimate: e.estimate,
          surprisePercent: e.surprisePercent,
        })) : [];
        resolve(list);
      } catch (e) { resolve([]); }
    });
  }).on('error', () => resolve([]));
  req.on('timeout', () => req.destroy(new Error('timed out')));
});

// ── Fetch REAL analyst price targets from Finnhub — structured numbers,
// not something the model has to read off a random webpage via web search.
// The upside/downside % against the live price is computed later in
// chat.js, using the exact same live price already used for everything
// else in that result, so the two numbers can never come from different
// moments in time (the bug this was built to fix).
const fetchPriceTarget = (symbol) => new Promise((resolve) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${apiKey}`;
  const req = require('https').get(url, { timeout: 15000 }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || !parsed.targetMean) return resolve(null);
        resolve({
          high: parsed.targetHigh, low: parsed.targetLow,
          mean: parsed.targetMean, median: parsed.targetMedian,
          lastUpdated: parsed.lastUpdated,
        });
      } catch (e) { resolve(null); }
    });
  }).on('error', () => resolve(null));
  req.on('timeout', () => req.destroy(new Error('timed out')));
});

const getOpenAINewsAnalysis = async (symbol, companyName) => {
  const cacheKey = 'news_' + symbol.toUpperCase();
  const cached = fromNewsCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  try {
    const [articles, ratings, upcomingEarnings, earningsHistory, priceTarget] = await Promise.all([
      enqueueFinnhubCall(() => fetchFinnhubNews(symbol), { priority: true }),
      enqueueFinnhubCall(() => fetchAnalystRatings(symbol), { priority: true }),
      enqueueFinnhubCall(() => fetchUpcomingEarnings(symbol), { priority: true }),
      enqueueFinnhubCall(() => fetchEarningsHistory(symbol), { priority: true }),
      enqueueFinnhubCall(() => fetchPriceTarget(symbol), { priority: true }),
    ]);

    let analystSummary = 'No analyst rating data available.';
    if (ratings) {
      const total = (ratings.strongBuy || 0) + (ratings.buy || 0) + (ratings.hold || 0) + (ratings.sell || 0) + (ratings.strongSell || 0);
      if (total > 0) {
        const bullishPct = Math.round(((ratings.strongBuy || 0) + (ratings.buy || 0)) / total * 100);
        // Lead with a single, unambiguous BULLISH/BEARISH/MIXED word — a clean
        // one-word fact to translate — before the granular breakdown. The old
        // format packed BUY/STRONG BUY/HOLD/SELL/STRONG SELL right next to each
        // other in one dense clause, which is exactly the kind of proximity
        // that caused a real bug: translating this into Arabic sometimes swapped
        // the polarity word (94% BUY became 94% "SELL") mid-sentence, especially
        // inside more complex contrastive sentence structures. Never make the
        // model synthesize the overall direction itself from four adjacent labels.
        const overall = bullishPct >= 60 ? 'BULLISH' : bullishPct <= 40 ? 'BEARISH' : 'MIXED/NEUTRAL';
        analystSummary = `${total} analysts covering — overall ${overall} (${bullishPct}% rate BUY or STRONG BUY). Full breakdown: ${ratings.buy || 0} BUY, ${ratings.strongBuy || 0} STRONG BUY, ${ratings.hold || 0} HOLD, ${ratings.sell || 0} SELL, ${ratings.strongSell || 0} STRONG SELL.`;
      }
    }

    const headlinesText = articles.length
      ? articles.map((a, i) => `${i + 1}. [${a.source || 'Unknown'}, ${a.datetime ? new Date(a.datetime * 1000).toLocaleDateString() : 'recent'}] ${a.headline}${a.summary ? ' — ' + a.summary.slice(0, 200) : ''}`).join('\n')
      : 'No recent news articles found in the last 7 days.';

    const earningsText = upcomingEarnings.length
      ? upcomingEarnings.map(e => `${e.date} (${e.quarter} ${e.year}, ${e.hour})${e.epsEstimate ? ' - EPS est: ' + e.epsEstimate : ''}`).join('\n')
      : 'No confirmed upcoming earnings date found in the calendar.';
    const userMessage = `Stock: ${symbol}${companyName ? ' (' + companyName + ')' : ''}
RECENT HEADLINES (last 7 days):
${headlinesText}
ANALYST CONSENSUS (reference): ${analystSummary}
CONFIRMED UPCOMING EARNINGS DATES (real calendar data - if you cite earnings, use these EXACT dates, do not guess others):
${earningsText}
Respond with the JSON format specified.`;

    const response = await createOpenAIResponse({
      input: [{ role: 'user', content: userMessage }],
      instructions: SYSTEM_PROMPT,
      maxOutputTokens: 4000,
      reasoningEffort: process.env.OPENAI_NEWS_REASONING_EFFORT || undefined,
      textFormat: NEWS_ANALYSIS_FORMAT,
      verbosity: 'low',
    });
    const raw = extractOutputText(response);
    if (!raw) throw new Error('OpenAI news analysis returned no text');
    const parsed = JSON.parse(raw);

    const result = {
      score: Math.max(-10, Math.min(10, parseInt(parsed.score) || 0)),
      label: parsed.label || 'Neutral',
      summary: parsed.summary || '',
      reasoning: parsed.reasoning || '',
      catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts.slice(0, 5) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
      articleCount: articles.length,
      holdingPeriod: parsed.holdingPeriod || '',
      upcomingEarnings: upcomingEarnings,
      earningsHistory: earningsHistory,
      analystSummary,
      priceTarget,
      analyzedAt: new Date().toISOString(),
      fromCache: false,
    };

    toNewsCache(cacheKey, result);
    return result;
  } catch (err) {
    console.log('OpenAI news analysis error:', err.message);
    return {
      score: 0, label: 'Unavailable',
      summary: 'AI news analysis temporarily unavailable — technical score only.',
      reasoning: '',
      catalysts: [], risks: [], articleCount: 0, analystSummary: '', priceTarget: null, fromCache: false, error: true,
    };
  }
};

module.exports = { getOpenAINewsAnalysis };
