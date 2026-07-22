// ═══════════════════════════════════════════════════════════════════
// CLAUDE NEWS ANALYSIS — Pro-only, real AI reasoning about fresh news
// Fetches raw headlines from Finnhub (fast/cheap), then sends them to
// Claude for genuine understanding — not keyword counting like the
// free engine's news score. Cached 3 hours per symbol to control cost.
// Fully standalone — does not touch yahooFinance.js or chat.js.
// ═══════════════════════════════════════════════════════════════════

const https = require('https');

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
  https.get(url, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
          console.log('⚠️ Finnhub news non-array response for ' + symbol + ':', JSON.stringify(parsed).slice(0, 300));
          return resolve([]);
        }
        resolve(parsed.slice(0, 12));
      } catch (e) {
        console.log('⚠️ Finnhub news parse error for ' + symbol + ':', e.message, '| raw:', data.slice(0, 200));
        resolve([]);
      }
    });
  }).on('error', (err) => {
    console.log('⚠️ Finnhub news request error for ' + symbol + ':', err.message);
    resolve([]);
  });
});

// ── Fetch analyst recommendations (same source as free engine) ──────
const fetchAnalystRatings = (symbol) => new Promise((resolve) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${apiKey}`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve(Array.isArray(parsed) && parsed.length ? parsed[0] : null);
      } catch (e) { resolve(null); }
    });
  }).on('error', () => resolve(null));
});

// ── Call Claude (mirrors the exact pattern used in chat.js) ─────────
const callClaude = (systemPrompt, userMessage) => new Promise((resolve, reject) => {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const req = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
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
        resolve(parsed.content[0].text);
      } catch (e) { reject(e); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const SYSTEM_PROMPT = `You are a professional equity research analyst. You will be given recent news headlines/summaries and analyst rating data for a stock. Your job is to REASON about them like a real analyst would — not count keywords.

Do this:
1. Read the headlines and understand what actually happened (product launch, earnings, guidance change, lawsuit, macro event, management change, etc.)
2. Use your own knowledge of the company, sector, and market context to judge how significant each item really is
3. Identify concrete catalysts (upcoming earnings, product launches, regulatory decisions, etc.) if mentioned or implied
4. Note real risks or red flags if present
5. Weigh analyst consensus data as one input, not the whole picture
6. Give a final sentiment score from -10 (very bearish) to +10 (very bullish). Use the full range with real judgment — a genuinely major catalyst (e.g. blowout earnings beat + raised guidance, or a severe fraud/regulatory crisis) should score near the extremes (±8 to ±10). Routine or mixed news should stay closer to the middle (±1 to ±4).

7. Based on the nature of the catalysts and news cycle, estimate a realistic HOLDING PERIOD for this trade idea (e.g. "3-5 days", "1-2 weeks", "2-4 weeks") — base this on how long it typically takes for the identified catalysts to play out, not a generic guess. Rely on professional technical/fundamental reasoning, not vague timeframes.

Respond ONLY with valid JSON in this exact format, nothing else, no markdown fences:
{"score": <integer -10 to 10>, "label": "<Very Positive|Positive|Slightly Positive|Neutral|Slightly Negative|Negative|Very Negative>", "summary": "<2-3 sentence plain-English summary of what's driving sentiment>", "catalysts": ["<upcoming event 1>", "<upcoming event 2>"], "risks": ["<risk 1>", "<risk 2>"], "holdingPeriod": "<e.g. '3-5 days' or '1-2 weeks' or '2-4 weeks'>"}

If there is no meaningful news, return score 0, label "Neutral", summary explaining there's no significant recent news, and empty catalysts/risks arrays.`;

// ── MAIN: Real Claude-powered news analysis (Pro only) ───────────────
// ── Fetch REAL upcoming earnings dates from Finnhub (not guessed) ─────
const fetchUpcomingEarnings = (symbol) => new Promise((resolve) => {
  const now = new Date();
  const from = now.toISOString().split('T')[0];
  const to = new Date(now.getTime() + 270 * 86400000).toISOString().split('T')[0]; // next ~9 months
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${apiKey}`;
  require('https').get(url, (res) => {
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
});

// ── Fetch past earnings history (last 4 quarters, actual vs estimate) ─────
const fetchEarningsHistory = (symbol) => new Promise((resolve) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${apiKey}`;
  require('https').get(url, (res) => {
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
});

const getClaudeNewsAnalysis = async (symbol, companyName) => {
  const cacheKey = 'news_' + symbol.toUpperCase();
  const cached = fromNewsCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  try {
    const [articles, ratings, upcomingEarnings, earningsHistory] = await Promise.all([
      fetchFinnhubNews(symbol),
      fetchAnalystRatings(symbol),
      fetchUpcomingEarnings(symbol),
      fetchEarningsHistory(symbol),
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
ANALYST CONSENSUS:
${analystSummary}
CONFIRMED UPCOMING EARNINGS DATES (real calendar data \u2014 use these EXACT dates, do not estimate or guess other dates):
${earningsText}
Analyze this and respond with the JSON format specified. If you mention earnings as a catalyst, cite the EXACT date(s) given above.`;

    const raw = await callClaude(SYSTEM_PROMPT, userMessage);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const result = {
      score: Math.max(-10, Math.min(10, parseInt(parsed.score) || 0)),
      label: parsed.label || 'Neutral',
      summary: parsed.summary || '',
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
      catalysts: [], risks: [], articleCount: 0, analystSummary: '', fromCache: false, error: true,
    };
  }
};

module.exports = { getClaudeNewsAnalysis };
