// ═══════════════════════════════════════════════════════════════════
// CLAUDE NEWS ANALYSIS — Pro-only, real AI reasoning about fresh news
// Fetches raw headlines from Finnhub (fast/cheap), then sends them to
// Claude for genuine understanding — not keyword counting like the
// free engine's news score. Cached 3 hours per symbol to control cost.
// Fully standalone — does not touch yahooFinance.js or chat.js.
// ═══════════════════════════════════════════════════════════════════

const https = require('https');
const { enqueueFinnhubCall } = require('./finnhubQueue');

// ── 3-hour cache (per symbol) ────────────────────────────────────────
const newsCache = new Map();
const NEWS_TTL = 3 * 60 * 60 * 1000; // 3 hours
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
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
          console.log('⚠️ Finnhub news non-array response for ' + symbol + ':', JSON.stringify(parsed).slice(0, 300));
          return resolve([]);
        }
        resolve(parsed.slice(0, 10));
      } catch (e) {
        console.log('⚠️ Finnhub news parse error for ' + symbol + ':', e.message, '| raw:', data.slice(0, 200));
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
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve(Array.isArray(parsed) && parsed.length ? parsed[0] : null);
      } catch (e) { resolve(null); }
    });
  }).on('error', () => resolve(null));
  req.on('timeout', () => req.destroy(new Error('timed out')));
});

// ── Call Claude (mirrors the exact pattern used in chat.js) ─────────
const callClaude = (systemPrompt, userMessage, tools) => new Promise((resolve, reject) => {
  const bodyObj = {
    model: 'claude-sonnet-5',
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };
  if (tools) bodyObj.tools = tools;
  const body = JSON.stringify(bodyObj);
  const req = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    timeout: 25000, // no web_search anymore — this is a plain, fast reasoning call
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) return reject(new Error(parsed.error.message));
        resolve(parsed);
      } catch (e) { reject(e); }
    });
  });
  req.on('error', reject);
  req.on('timeout', () => req.destroy(new Error('Claude API call timed out after 25s')));
  req.write(body);
  req.end();
});

const SYSTEM_PROMPT = `You are an equity research analyst. You will be given this stock's recent news headlines. Read them, analyze what they actually mean, and give the stock a sentiment score from -10 (very bearish) to +10 (very bullish). The score is entirely your own call - analyze it however you see fit, with full freedom. No rules, no thresholds. Also explain, in a few clear sentences, WHY you landed on that exact score.

You are also given analyst-consensus data and confirmed upcoming-earnings dates for reference; if you mention an earnings date, use the exact one provided. If there is no meaningful news, say so and score it 0.

Return ONLY this JSON, nothing else, no markdown fences:
{"score": <integer -10 to 10>, "label": "<your sentiment label, e.g. Positive / Neutral / Negative>", "summary": "<2-3 sentences on what is driving your view>", "reasoning": "<a few sentences explaining WHY you chose this exact score - the key factors that pushed it up or down>", "catalysts": ["<catalyst>", "..."], "risks": ["<risk>", "..."], "holdingPeriod": "<e.g. '1-2 weeks'>"}`;

// ── MAIN: Real Claude-powered news analysis (Pro only) ───────────────
// ── Fetch REAL upcoming earnings dates from Finnhub (not guessed) ─────
const fetchUpcomingEarnings = (symbol) => new Promise((resolve) => {
  const now = new Date();
  const from = now.toISOString().split('T')[0];
  const to = new Date(now.getTime() + 270 * 86400000).toISOString().split('T')[0]; // next ~9 months
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${apiKey}`;
  const req = require('https').get(url, { timeout: 15000 }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
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
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
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

const getClaudeNewsAnalysis = async (symbol, companyName) => {
  const cacheKey = 'news_' + symbol.toUpperCase();
  const cached = fromNewsCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  try {
    const [articles, ratings, upcomingEarnings, earningsHistory] = await Promise.all([
      enqueueFinnhubCall(() => fetchFinnhubNews(symbol), { priority: true }),
      enqueueFinnhubCall(() => fetchAnalystRatings(symbol), { priority: true }),
      enqueueFinnhubCall(() => fetchUpcomingEarnings(symbol), { priority: true }),
      enqueueFinnhubCall(() => fetchEarningsHistory(symbol), { priority: true }),
    ]);

    let analystSummary = 'No analyst rating data available.';
    if (ratings) {
      const total = (ratings.strongBuy || 0) + (ratings.buy || 0) + (ratings.hold || 0) + (ratings.sell || 0) + (ratings.strongSell || 0);
      if (total > 0) {
        const bullishPct = Math.round(((ratings.strongBuy || 0) + (ratings.buy || 0)) / total * 100);
        analystSummary = `${total} analysts covering: ${bullishPct}% rate BUY/STRONG BUY, ${ratings.hold || 0} HOLD, ${ratings.sell || 0} SELL, ${ratings.strongSell || 0} STRONG SELL.`;
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

    const response = await callClaude(SYSTEM_PROMPT, userMessage);
    const blocks = Array.isArray(response.content) ? response.content : [];
    const raw = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const jsonMatch = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in news analysis response');
    const parsed = JSON.parse(jsonMatch[0]);

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
      fromCache: false,
    };

    toNewsCache(cacheKey, result);
    return result;
  } catch (err) {
    console.log('Claude news analysis error:', err.message);
    return {
      score: 0, label: 'Unavailable',
      summary: 'AI news analysis temporarily unavailable — technical score only.',
      reasoning: '',
      catalysts: [], risks: [], articleCount: 0, analystSummary: '', fromCache: false, error: true,
    };
  }
};

module.exports = { getClaudeNewsAnalysis };
