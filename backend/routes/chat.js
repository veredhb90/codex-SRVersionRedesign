const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getQuote } = require('../services/proEngine');
const { getVerifiedStockHistory } = require('../services/stockHistory');
const { createOpenAIResponse, extractOutputText } = require('../services/openaiResponses');
const { generateProReport, getLatestProReports, toReportSnapshot } = require('../services/proReportService');
const { extractSymbols } = require('../services/symbolExtraction');
const ChatSession = require('../models/ChatSession');
const https      = require('https');

// ── Format a Pro Engine result into verified text for the AI ────────
const formatProEngineText = (e, sym) => {
  const breakdownText = (e.technicalBreakdown || []).map(b => `  ${b.indicator}: ${b.points > 0 ? '+' : ''}${b.points} (${b.note})`).join('\n');
  const catalystsText = (e.catalysts || []).length ? e.catalysts.map(c => `  \u2022 ${c}`).join('\n') : '  None identified';
  const risksText = (e.risks || []).length ? e.risks.map(r2 => `  \u2022 ${r2}`).join('\n') : '  None identified';
  const earnings = e.latestEarningsReport;
  const latestEarningsText = earnings
    ? `LATEST REPORTED EARNINGS (verified Finnhub data): reported ${earnings.reportedDate || 'date not supplied'}, ${earnings.quarter != null ? 'Q' + earnings.quarter : 'quarter not supplied'} FY${earnings.year || 'not supplied'}${earnings.fiscalPeriod ? ', fiscal period ' + earnings.fiscalPeriod : ''}; EPS actual ${earnings.epsActual ?? 'not supplied'} vs estimate ${earnings.epsEstimate ?? 'not supplied'}${earnings.epsSurprisePercent != null ? ' (' + (earnings.epsSurprisePercent > 0 ? '+' : '') + earnings.epsSurprisePercent + '% surprise)' : ''}; revenue actual ${earnings.revenueActual ?? 'not supplied'} vs estimate ${earnings.revenueEstimate ?? 'not supplied'}${earnings.revenueSurprisePercent != null ? ' (' + (earnings.revenueSurprisePercent > 0 ? '+' : '') + earnings.revenueSurprisePercent + '% surprise)' : ''}.`
    : 'LATEST REPORTED EARNINGS: no verified reported-quarter result was returned.';
  return `SWINGRUSH PRO ENGINE: ${sym}
Report generated: ${e.generatedAt || 'not supplied'} | Report fresh-until marker: ${e.freshUntil || 'not supplied'}
${e.marketState === 'Pre-Market' || e.marketState === 'After-Hours' ? 'Regular Session Close: $' + e.regularSessionPrice + ' | Current ' + e.marketState + ' Price: $' + e.price + ' (freshest, use this for analysis)' : 'Price: $' + e.price} | Change: ${e.changePct >= 0 ? '+' : ''}${e.changePct}% | Quote time: ${e.quoteTime || 'not supplied'}
SIGNAL: ${e.direction} | Combined Score: ${e.score > 0 ? '+' : ''}${e.score}/24 | ${e.confidence} Confidence
${e.takeProfit ? `Entry: $${e.price} | TP: $${e.takeProfit} | SL: $${e.stopLoss} | R:R 1:${e.riskReward}` : 'No trade setup \u2014 score below conviction threshold'}
PRECOMPUTED FIGURES (real math, already calculated correctly \u2014 state these numbers as-is, do NOT recompute them yourself from the raw price history or from anything found via web_search):
- 1 Week price change: ${e.change1w != null ? (e.change1w >= 0 ? '+' : '') + e.change1w + '%' : 'not enough history'}
- 1 Month price change: ${e.change1m != null ? (e.change1m >= 0 ? '+' : '') + e.change1m + '%' : 'not enough history'}
- Distance to Take Profit: ${e.tpPct != null ? (e.tpPct >= 0 ? '+' : '') + e.tpPct + '%' : 'no trade setup'}
- Distance to Stop Loss: ${e.slPct != null ? (e.slPct >= 0 ? '+' : '') + e.slPct + '%' : 'no trade setup'}
- Analyst price target: ${e.priceTarget ? `avg $${e.priceTarget.mean}, high $${e.priceTarget.high}, low $${e.priceTarget.low} (last updated ${e.priceTarget.lastUpdated}) \u2192 ${e.targetUpsidePct >= 0 ? '+' : ''}${e.targetUpsidePct}% ${e.targetUpsidePct >= 0 ? 'upside' : 'downside'} vs current price $${e.price}, calculated fresh just now against this exact price` : 'No analyst price-target data available \u2014 say so rather than searching for and quoting one yourself'}
TECHNICAL BREAKDOWN (${e.technicalScore} pts):
${breakdownText}
AI NEWS ANALYSIS (${e.newsScore > 0 ? '+' : ''}${e.newsScore} pts) \u2014 ${e.newsLabel} | Analyzed at: ${e.newsAnalyzedAt || 'not supplied'}:
${e.newsSummary}${e.newsReasoning ? '\nWHY THIS SCORE: ' + e.newsReasoning : ''}
CATALYSTS:
${catalystsText}
RISKS:
${risksText}
${e.analystSummary ? 'ANALYST CONSENSUS: ' + e.analystSummary : ''}
${e.holdingPeriod ? 'RECOMMENDED HOLDING PERIOD: ' + e.holdingPeriod : ''}
${latestEarningsText}
${e.upcomingEarnings && e.upcomingEarnings.length ? 'UPCOMING EARNINGS (confirmed dates - cite these exactly, never guess other dates): ' + e.upcomingEarnings.map(x => x.date + ' (Q' + x.quarter + ' FY' + x.year + ', ' + x.hour + ')').join('; ') : 'No confirmed upcoming earnings date in the calendar.'}
RAW DAILY PRICE HISTORY (last 30 trading days, oldest to newest \u2014 use this to answer ANY historical question yourself):
${(e.priceHistory || []).slice(-30).map(c => {
  const d = new Date(c.time * 1000);
  return d.toISOString().split('T')[0] + ': close $' + c.close.toFixed(2) + ' (open $' + c.open.toFixed(2) + ', high $' + c.high.toFixed(2) + ', low $' + c.low.toFixed(2) + ')';
}).join('\n')}`;
};

// ── Tool definitions — GPT-5.6 decides when they are useful ─────────
const SWINGRUSH_FUNCTION_TOOLS = [
  {
    name: 'calculate',
    description: 'A real calculator for ANY arithmetic in your answer — a percentage, a difference, a ratio, a sum, an average, a risk/reward calc, anything. Always call this instead of computing arithmetic yourself, even if it looks simple, since your own mental math is not reliable. Pass a plain arithmetic expression (numbers, + - * / ( ) . only) and it returns the exact real result — then state only that returned number.',
    input_schema: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'A plain arithmetic expression, e.g. "(40.90 - 36.75) / 36.75 * 100"' } },
      required: ['expression'],
    },
  },
  {
    name: 'get_stock_quote',
    description: 'Get the freshest available Yahoo Finance quote for one US stock, including regular-session price, current extended-hours price when available, percentage change, market state, and a retrieval timestamp. Use this for a simple current-price or current-change question; use get_stock_analysis instead when the user wants a full trade analysis.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'US stock ticker, e.g. AAPL or NVDA.' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_stock_history',
    description: 'Get verified Yahoo Finance daily OHLCV for any exact past US trading date or any historical period available for the ticker. It returns exact closes, open/high/low/volume, daily close-vs-prior-close and intraday percentages, plus server-calculated start-to-end gain/loss using split/dividend-adjusted closes for long periods. Use this whenever the user asks what a stock closed at on a date, what it did yesterday, or how much it gained/lost over any period. Do not use the live quote alone or guess. If Yahoo returns no usable session, use web_search as fallback and cite the source.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'US stock ticker, e.g. NVDA.' },
        startDate: { type: 'string', description: 'Exact first market date in YYYY-MM-DD format. Resolve words such as yesterday from the ground-truth dates in the system prompt.' },
        endDate: { type: 'string', description: 'Optional final date in YYYY-MM-DD format. May span any historical period available for the ticker.' },
      },
      required: ['symbol', 'startDate'],
    },
  },
  {
    name: 'get_stock_analysis',
    description: 'Get live SwingRush Pro Engine analysis for ONE specific stock: technical indicators, AI-powered news analysis with real catalysts and risks, the latest reported quarterly earnings result (EPS/revenue actual vs estimate), upcoming earnings dates, suggested holding period, and current price including extended hours. Use it for a full live trade analysis; it is not needed for a simple historical-price question.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'The stock ticker symbol, e.g. NVDA, AAPL, TSLA' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_latest_pro_report',
    description: 'Retrieve the latest immutable SAVED SwingRush Pro Engine report for one ticker without running a new paid analysis. Use this when the user asks about the previous/latest Pro signal, score, generated report, or wants to compare an older saved result. Do not use or mention it for a simple historical-price, news, earnings, or company-fact question unless the user explicitly connects that question to the Pro Engine report.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'US stock ticker, e.g. NVDA.' } },
      required: ['symbol'],
    },
  },
  {
    name: 'show_chart',
    description: 'Display a candlestick price chart for a specific stock to the user. Call this when the user explicitly asks to see a chart or graph, OR whenever you judge that a visual chart would genuinely help illustrate your point (e.g. discussing a specific price pattern, support/resistance levels, or a trend that\'s easier to see than describe). Use your own judgment \u2014 you don\'t need an explicit request every time, but don\'t show a chart for every single stock mention either; only when it adds real value.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'The stock ticker symbol to chart, e.g. NVDA' },
        timeframe: { type: 'string', enum: ['1d', '1h'], description: 'Candle timeframe: \'1d\' for daily candles (default, good for swing-trade overviews), \'1h\' for hourly candles (better for intraday/short-term detail). Use \'1h\' if the user asks for hourly, intraday, or short-term detail; otherwise default to \'1d\'.' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_market_scan',
    description: 'Get broad market-scan results across the full stock universe \u2014 all current BUY/SELL signals with price, TP, SL, confidence, grouped by price range. Each stock\'s total score COMBINES a technical score + a news score (the news is keyword/analyst-based sentiment, NOT the deep OpenAI news analysis the Pro Engine runs), and both sub-scores are shown per stock. Best for breadth questions like \'what are the best stocks today\', \'any good stocks under $50\', \'show me strong sell signals\'. For one specific stock, get_stock_analysis is higher quality (real AI news analysis) and takes priority over this scan for that symbol. Mechanics, if asked: the universe is a fixed pool of 2000 US stocks ranked by market cap; each run scans 500 of them (a fixed 300-stock core of the biggest names, always included, plus 200 randomly rotated from the remaining ~1700 so the long tail gets covered over time); it auto-runs every 6 hours on trading weekdays (not continuously, not every-few-minutes) and shows the latest completed run\'s results on weekends. If asked something about the scanner\'s mechanics not covered here, say you don\'t have that specific detail rather than guessing a number.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'filter_scanner',
    description: 'Filter, count, or average the scanner\'s signals by real criteria (direction, price range, minimum conviction score, confidence tier) — computed directly against the actual scan data, never by reading/counting the get_market_scan text yourself. ALWAYS use this instead of manually counting or filtering rows from get_market_scan for anything like "how many SELL signals under $50", "list BUY signals with High confidence", or "what\'s the average score of stocks above $100" — the scanner can hold hundreds of rows and manually tallying that many by eye is unreliable, the same way summing a long list of numbers in your head is.',
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['BUY', 'SELL'], description: 'Optional: restrict to only BUY or only SELL signals.' },
        minPrice: { type: 'number', description: 'Optional: only signals priced at or above this.' },
        maxPrice: { type: 'number', description: 'Optional: only signals priced below this (use for "under $X" questions).' },
        minAbsScore: { type: 'number', description: 'Optional: only signals with |combined score| at or above this (conviction strength, e.g. 8 for at least Medium confidence).' },
        confidence: { type: 'string', enum: ['Very High', 'High', 'Medium', 'Low'], description: 'Optional: restrict to one confidence tier.' },
        metric: { type: 'string', enum: ['count', 'list', 'avg_score'], description: 'What to return: a count, the actual matching list (capped at 30, sorted by strongest |score| first), or the average combined score of the matches.' },
      },
      required: ['metric'],
    },
  },
  {
    name: 'aggregate_my_trades',
    description: 'Compute a REAL aggregate statistic across this user\'s own trades — count, win rate, average return, or total return — calculated directly against the database, never by reading/counting the raw get_my_calls list yourself. ALWAYS use this for any question like "what\'s my win rate", "how am I doing", "what\'s my average return", or anything else that requires counting or summing across more than a couple of trades — manually tallying rows by eye is unreliable and must not be done, even if the list looks short enough to count. Optionally filter by status, direction, or one symbol.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'closed', 'win', 'loss', 'any'], description: 'Filter by trade status before computing. Default "any". win_rate/avg_return/sum_return only ever consider closed WIN/LOSS trades within whatever remains after this filter.' },
        direction: { type: 'string', enum: ['BUY', 'SELL'], description: 'Optional: restrict to only BUY or only SELL trades.' },
        symbol: { type: 'string', description: 'Optional: restrict to one ticker symbol.' },
        metric: { type: 'string', enum: ['count', 'win_rate', 'avg_return', 'sum_return'], description: 'What to compute.' },
      },
      required: ['metric'],
    },
  },
  {
    name: 'get_my_calls',
    description: 'Get the trade calls that THIS specific user (the one you are chatting with right now) has personally posted \u2014 their own open and closed positions, with entry price, TP/SL, and outcome (WIN/LOSS/OPEN). Genuinely useful any time you\'re about to give entry/sizing/timing advice on a specific stock \u2014 whether they already hold that exact symbol changes what good advice looks like (e.g. averaging into an existing position vs. a fresh entry, or a possible take-profit conversation vs. a new buy), so it\'s often worth a quick check even if they didn\'t explicitly ask "what do I already have". Also directly useful if they ask how they\'re doing, reference \'my calls\'/\'my trades\', or want advice that should factor in their existing holdings. This is different from get_market_scan or general community sentiment \u2014 it is specifically about this one user\'s own activity.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'closed', 'any'], description: 'Optional status filter. Default any.' },
        direction: { type: 'string', enum: ['BUY', 'SELL'], description: 'Optional direction filter.' },
        symbol: { type: 'string', description: 'Optional one-ticker filter.' },
        limit: { type: 'number', description: 'Maximum rows to return, default 50 and maximum 200.' },
      },
      required: [],
    },
  },
  {
    name: 'get_my_profile',
    description: 'Get the current user\'s safe SwingRush account and trader-profile facts: name, username, active plan, profile settings, watchlist, and follower/following counts. Use it when the user asks about their profile, preferences, membership, watchlist, or when those details materially improve personalization. Never infer missing profile fields.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_community_sentiment',
    description: 'Get live SwingRush community positioning for one ticker: counts and percentages of currently open BUY and SELL calls. Use for questions about what SwingRush traders or the community are doing. Community positioning is context, not proof that a trade is correct.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'US stock ticker, e.g. TSLA.' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_swingrush_knowledge',
    description: 'Get verified product knowledge about how SwingRush works. Use this for questions about the social network, Pro Engine, Scanner, portfolio/trade tracking, or the difference between platform engines instead of guessing from general knowledge.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['overview', 'social', 'pro_engine', 'scanner', 'portfolio', 'data_sources'],
          description: 'The SwingRush area the user is asking about.',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'get_open_positions_progress',
    description: 'For THIS user\'s own OPEN positions: real distance from the current live price to each position\'s ACTUAL recorded take-profit and stop-loss, computed directly in code, ranked closest-to-target first. ALWAYS use this for any question about how close an existing position is to its target/stop, which one is nearest, or similar ranking/progress questions \u2014 NEVER answer these by combining get_my_calls with get_stock_analysis yourself. get_stock_analysis returns a fresh, independent signal with its OWN take-profit/stop-loss for a brand-new hypothetical trade on that symbol today \u2014 that target has nothing to do with a position the user already holds, and substituting it for the user\'s real recorded TP/SL will give a completely wrong answer. This tool guarantees the TP/SL used is always the user\'s real one.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_market_movers',
    description: 'A live screener returning the biggest stock gainers or losers of the current/most recent trading session by % change, ranked, across the WHOLE US market \u2014 not limited to SwingRush\u2019s scanned universe (get_market_scan only covers stocks that cleared an actionable technical BUY/SELL score, so a stock that moved big on no clean technical setup won\u2019t appear there). Structured live data, not a web search.',
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['losers', 'gainers'], description: '\'losers\' for biggest % decliners, \'gainers\' for biggest % advancers' },
        count: { type: 'number', description: 'How many to return, default 10, max 25' },
      },
      required: ['direction'],
    },
  },
];

const OPENAI_TOOLS = [
  { type: 'web_search' },
  ...SWINGRUSH_FUNCTION_TOOLS.map(tool => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
    strict: false,
  })),
];

// ── Execute a tool call server-side and return its result text ──────
// ── Fetch the market scanner data (500/run from a 2000-stock universe), formatted for the AI ──
// Returns null if no scan data is available yet.
const fetchScannerData = async () => {
  try {
    const mongoose = require('mongoose');
    const ScanResult = mongoose.models.ScanResult ||
      mongoose.model('ScanResult', new mongoose.Schema({ results: Array, top5: Array, scannedCount: Number }, { strict: false }));
    const doc = await ScanResult.findOne({ key: 'latest' });
    if (!doc || !doc.results || !doc.results.length) return null;
    const all = [...doc.results].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    const buys  = all.filter(r => r.direction === 'BUY');
    const sells = all.filter(r => r.direction === 'SELL');
    const split = (r) => `(tech ${r.technicalScore >= 0 ? '+' : ''}${r.technicalScore ?? '?'}, news ${r.newsScore > 0 ? '+' : ''}${r.newsScore ?? 0}${r.newsLabel ? ' ' + r.newsLabel : ''})`;
    return `SWINGRUSH MARKET SCANNER (${doc.scannedCount} stocks scanned, last updated: ${new Date(doc.scannedAt).toLocaleString()})
Each stock's total score combines a TECHNICAL score + a NEWS score (the news is keyword/analyst-based sentiment, not the deep OpenAI news analysis the Pro Engine runs). This is a broad multi-stock scan \u2014 NOT the same as a Pro Engine analysis for one symbol. If a symbol here also has a Pro Engine result, the Pro Engine number is authoritative, not this one.
ALL BUY SIGNALS (${buys.length} stocks):
${buys.map((r, i) => `${i+1}. ${r.symbol}${r.name ? ' ('+r.name+')' : ''}: +${r.score} ${split(r)} | \$${r.price} | TP:\$${r.takeProfit} | SL:\$${r.stopLoss} | ${r.confidence}`).join('\n')}
ALL SELL SIGNALS (${sells.length} stocks):
${sells.map((r, i) => `${i+1}. ${r.symbol}${r.name ? ' ('+r.name+')' : ''}: ${r.score} ${split(r)} | \$${r.price} | TP:\$${r.takeProfit} | SL:\$${r.stopLoss} | ${r.confidence}`).join('\n')}
BY PRICE (BUY signals):
UNDER \$20:  ${buys.filter(r => r.price < 20).map(r => `${r.symbol}:+${r.score}(\$${r.price})`).join(', ') || 'None'}
\$20-\$50:    ${buys.filter(r => r.price >= 20 && r.price < 50).map(r => `${r.symbol}:+${r.score}(\$${r.price})`).join(', ') || 'None'}
\$50-\$100:   ${buys.filter(r => r.price >= 50 && r.price < 100).map(r => `${r.symbol}:+${r.score}(\$${r.price})`).join(', ') || 'None'}
OVER \$100:  ${buys.filter(r => r.price >= 100).map(r => `${r.symbol}:+${r.score}(\$${r.price})`).join(', ') || 'None'}`;
  } catch (e) {
    console.log('Scanner fetch error:', e.message);
    return null;
  }
};

// ── Real market-wide top gainers/losers via Yahoo's free screener (no API key, no Finnhub quota) ──
const fetchMarketMovers = (direction, count) => new Promise((resolve) => {
  const scrId = direction === 'gainers' ? 'day_gainers' : 'day_losers';
  const n = Math.max(1, Math.min(count || 10, 25));
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&lang=en-US&region=US&scrIds=${scrId}&count=${n}`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const quotes = parsed.finance.result[0].quotes || [];
        resolve(quotes.map(q => ({
          symbol: q.symbol, name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice, changePct: q.regularMarketChangePercent,
        })));
      } catch (e) { resolve(null); }
    });
  }).on('error', () => resolve(null));
});

// Strict character whitelist BEFORE evaluating — only digits/operators/parens/
// decimal points can reach Function(), so there is no way to inject anything
// beyond plain arithmetic (no letters, no semicolons, no property access).
const SAFE_EXPR = /^[0-9+\-*/(). \s]+$/;
const addReportRequest = (reportRequests, report) => {
  const snapshot = toReportSnapshot(report);
  if (!snapshot || snapshot.insufficientData) return;
  const existingIndex = reportRequests.findIndex(item => item.symbol === snapshot.symbol);
  if (existingIndex === -1) reportRequests.push(snapshot);
  else if (new Date(snapshot.generatedAt) >= new Date(reportRequests[existingIndex].generatedAt)) reportRequests[existingIndex] = snapshot;
};

const executeTool = async (toolName, toolInput, chartRequests, reportRequests, userId) => {
  if (toolName === 'calculate') {
    const expr = String(toolInput.expression || '').trim();
    if (!expr || !SAFE_EXPR.test(expr)) {
      return 'Invalid expression — only numbers and + - * / ( ) . are allowed.';
    }
    try {
      const result = Function('"use strict"; return (' + expr + ')')();
      if (typeof result !== 'number' || !isFinite(result)) return 'Could not compute a valid number from that expression.';
      return `Result: ${result}`;
    } catch (e) {
      return `Invalid expression: could not evaluate.`;
    }
  }
  if (toolName === 'get_stock_quote') {
    const sym = String(toolInput.symbol || '').toUpperCase().trim();
    if (!sym) return 'A stock ticker is required.';
    try {
      const quote = await getQuote(sym, { fresh: true });
      const priceTime = quote.priceTime ? new Date(quote.priceTime * 1000).toISOString() : null;
      return JSON.stringify({
        source: 'Yahoo Finance',
        retrievedAt: new Date().toISOString(),
        quoteTime: priceTime,
        symbol: quote.symbol,
        companyName: quote.shortName || quote.symbol,
        price: quote.price,
        regularSessionPrice: quote.regularSessionPrice,
        changePct: +Number(quote.changePct || 0).toFixed(2),
        marketState: quote.marketState,
        fiftyTwoWeekHigh: quote.high52 ?? null,
        fiftyTwoWeekLow: quote.low52 ?? null,
      });
    } catch (e) {
      return `Could not fetch a verified live quote for ${sym}: ${e.message}. Do not guess the price.`;
    }
  }
  if (toolName === 'get_stock_history') {
    const sym = String(toolInput.symbol || '').toUpperCase().trim();
    try {
      const history = await getVerifiedStockHistory(sym, toolInput.startDate, toolInput.endDate || toolInput.startDate);
      return JSON.stringify(history);
    } catch (e) {
      return `Could not fetch verified historical prices for ${sym || 'that ticker'}: ${e.message}. Do not guess historical prices.`;
    }
  }
  if (toolName === 'get_stock_analysis') {
    const sym = (toolInput.symbol || '').toUpperCase().trim();
    try {
      const result = await generateProReport(sym);
      if (!result || result.insufficientData) return `No sufficient price history available for ${sym}.`;
      addReportRequest(reportRequests, result);
      return formatProEngineText(result, sym);
    } catch (e) {
      return `Failed to fetch analysis for ${sym}: ${e.message}`;
    }
  }
  if (toolName === 'get_latest_pro_report') {
    const sym = String(toolInput.symbol || '').toUpperCase().trim();
    try {
      const reports = await getLatestProReports([sym]);
      const report = reports[0];
      if (!report) return `No saved Pro Engine report exists for ${sym}.`;
      addReportRequest(reportRequests, report);
      return formatProEngineText(report, sym);
    } catch (e) {
      return `Could not retrieve the latest saved Pro Engine report for ${sym || 'that ticker'}: ${e.message}`;
    }
  }
  if (toolName === 'show_chart') {
    const sym = (toolInput.symbol || '').toUpperCase().trim();
    try {
      // Uses the exact same function as get_stock_analysis, so the chart's
      // score/direction ALWAYS matches the Pro Engine result exactly — no
      // separate recalculation, no possibility of the two numbers disagreeing.
      const result = await generateProReport(sym);
      if (!result || result.insufficientData || !result.priceHistory || !result.priceHistory.length) {
        return `No chart data available for ${sym}.`;
      }
      addReportRequest(reportRequests, result);
      chartRequests.push({
        symbol: sym, price: result.price, direction: result.direction,
        score: result.score, confidence: result.confidence,
        takeProfit: result.takeProfit, stopLoss: result.stopLoss,
        riskReward: result.riskReward, candles: result.priceHistory, news: [],
      });
      return `Chart for ${sym} is now displayed to the user. Score: ${result.score > 0 ? '+' : ''}${result.score}, direction: ${result.direction}.`;
    } catch (e) {
      console.log('[SHOW_CHART ERROR]', sym, '|', e.message, '|', e.stack);
      return `Failed to load chart for ${sym}: ${e.message}`;
    }
  }
  if (toolName === 'get_market_scan') {
    const data = await fetchScannerData();
    if (!data) return 'No scan data available yet \u2014 the scanner may not have completed its first run.';
    return data;
  }
  if (toolName === 'filter_scanner') {
    try {
      const mongoose = require('mongoose');
      const ScanResult = mongoose.models.ScanResult ||
        mongoose.model('ScanResult', new mongoose.Schema({ results: Array, top5: Array, scannedCount: Number }, { strict: false }));
      const doc = await ScanResult.findOne({ key: 'latest' });
      if (!doc || !doc.results || !doc.results.length) return 'No scan data available yet \u2014 the scanner may not have completed its first run.';

      let matched = doc.results;
      if (toolInput.direction === 'BUY' || toolInput.direction === 'SELL') matched = matched.filter(r => r.direction === toolInput.direction);
      if (toolInput.minPrice != null) matched = matched.filter(r => r.price >= toolInput.minPrice);
      if (toolInput.maxPrice != null) matched = matched.filter(r => r.price < toolInput.maxPrice);
      if (toolInput.minAbsScore != null) matched = matched.filter(r => Math.abs(r.score) >= toolInput.minAbsScore);
      if (toolInput.confidence) matched = matched.filter(r => r.confidence === toolInput.confidence);

      const metric = toolInput.metric || 'list';
      const filterParts = [];
      if (toolInput.direction) filterParts.push('direction=' + toolInput.direction);
      if (toolInput.minPrice != null) filterParts.push('minPrice=' + toolInput.minPrice);
      if (toolInput.maxPrice != null) filterParts.push('maxPrice=' + toolInput.maxPrice);
      if (toolInput.minAbsScore != null) filterParts.push('minAbsScore=' + toolInput.minAbsScore);
      if (toolInput.confidence) filterParts.push('confidence=' + toolInput.confidence);
      const filterDesc = filterParts.length ? filterParts.join(', ') : 'no filter (all signals)';

      if (metric === 'count') return `Count matching filter (${filterDesc}): ${matched.length} signals.`;
      if (metric === 'avg_score') {
        if (!matched.length) return `No signals match filter (${filterDesc}).`;
        const avg = +(matched.reduce((a, r) => a + r.score, 0) / matched.length).toFixed(2);
        return `Average combined score matching filter (${filterDesc}): ${avg}, across ${matched.length} signals.`;
      }
      if (!matched.length) return `No signals match filter (${filterDesc}).`;
      const sorted = [...matched].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
      const capped = sorted.slice(0, 30);
      const lines = capped.map(r => `${r.symbol}${r.name ? ' (' + r.name + ')' : ''}: ${r.direction} ${r.score > 0 ? '+' : ''}${r.score} | $${r.price} | ${r.confidence}`);
      return `${matched.length} signals match filter (${filterDesc})${matched.length > 30 ? ' \u2014 showing top 30 by |score|' : ''}:\n${lines.join('\n')}`;
    } catch (e) {
      return `Failed to filter scanner: ${e.message}`;
    }
  }
  if (toolName === 'aggregate_my_trades') {
    try {
      const mongoose = require('mongoose');
      const Recommendation = mongoose.models.Recommendation || require('../models/Recommendation');
      const query = { user: userId };
      if (toolInput.direction === 'BUY' || toolInput.direction === 'SELL') query.direction = toolInput.direction;
      if (toolInput.symbol) query.symbol = String(toolInput.symbol).toUpperCase().trim();
      const status = toolInput.status || 'any';
      if (status === 'open') query.isOpen = true;
      else if (status === 'closed') query.isOpen = false;
      else if (status === 'win') { query.isOpen = false; query.outcome = 'WIN'; }
      else if (status === 'loss') { query.isOpen = false; query.outcome = 'LOSS'; }

      const docs = await Recommendation.find(query).select('isOpen outcome returnPct').limit(2000);
      const metric = toolInput.metric;
      const filterDesc = `status=${status}${toolInput.direction ? ', direction=' + toolInput.direction : ''}${toolInput.symbol ? ', symbol=' + toolInput.symbol : ''}`;

      if (metric === 'count') return `Count matching filter (${filterDesc}): ${docs.length} trades.`;

      const closed = docs.filter(d => !d.isOpen && (d.outcome === 'WIN' || d.outcome === 'LOSS'));
      if (metric === 'win_rate') {
        if (!closed.length) return `No closed trades match filter (${filterDesc}) — cannot compute a win rate.`;
        const wins = closed.filter(d => d.outcome === 'WIN').length;
        const pct = +((wins / closed.length) * 100).toFixed(2);
        return `Win rate matching filter (${filterDesc}): ${wins} WIN out of ${closed.length} closed trades = ${pct}%.`;
      }
      if (metric === 'avg_return' || metric === 'sum_return') {
        const withReturn = closed.filter(d => typeof d.returnPct === 'number');
        if (!withReturn.length) return `No closed trades with a recorded return% match filter (${filterDesc}).`;
        const sum = +withReturn.reduce((a, d) => a + d.returnPct, 0).toFixed(2);
        if (metric === 'sum_return') return `Sum of returnPct across ${withReturn.length} closed trades matching filter (${filterDesc}): ${sum}%.`;
        const avg = +(sum / withReturn.length).toFixed(2);
        return `Average return matching filter (${filterDesc}): ${avg}% across ${withReturn.length} closed trades (individual returns: ${withReturn.map(d => (d.returnPct >= 0 ? '+' : '') + d.returnPct + '%').join(', ')}).`;
      }
      return 'Unknown metric — use one of: count, win_rate, avg_return, sum_return.';
    } catch (e) {
      return `Failed to aggregate trades: ${e.message}`;
    }
  }
  if (toolName === 'get_my_calls') {
    try {
      const mongoose = require('mongoose');
      const Recommendation = mongoose.models.Recommendation || require('../models/Recommendation');
      const query = { user: userId };
      if (toolInput.status === 'open') query.isOpen = true;
      else if (toolInput.status === 'closed') query.isOpen = false;
      if (toolInput.direction === 'BUY' || toolInput.direction === 'SELL') query.direction = toolInput.direction;
      if (toolInput.symbol) query.symbol = String(toolInput.symbol).toUpperCase().trim();
      const limit = Math.max(1, Math.min(Number(toolInput.limit) || 50, 200));
      const [recs, total] = await Promise.all([
        Recommendation.find(query).sort({ createdAt: -1 }).limit(limit),
        Recommendation.countDocuments(query),
      ]);
      if (!recs.length) return 'This user has not posted any trade calls yet.';
      const lines2 = recs.map(r => {
        const status = r.isOpen ? 'OPEN' : (r.outcome === 'WIN' ? 'WIN' : r.outcome === 'LOSS' ? 'LOSS' : 'CLOSED');
        const ret = !r.isOpen && r.returnPct ? ` (${r.returnPct > 0 ? '+' : ''}${r.returnPct}%)` : '';
        const opened = r.openedAt || r.createdAt;
        return `${r.symbol} | ${r.direction} | Entry: $${r.entryPrice} | TP: $${r.takeProfit}${r.stopLoss ? ' | SL: $' + r.stopLoss : ''} | ${status}${ret} | Opened: ${opened.toISOString().split('T')[0]}`;
      });
      return `This user's own posted trade calls (most recent first; showing ${recs.length} of ${total} matching records):\n${lines2.join('\n')}` +
        (total > recs.length ? '\nMore matching records exist. Apply symbol/status/direction filters or request another focused view; use aggregate_my_trades for statistics across all matches.' : '');
    } catch (e) {
      return `Failed to fetch user's calls: ${e.message}`;
    }
  }
  if (toolName === 'get_my_profile') {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId)
        .select('fullName username plan subscriptionEnd cancelledAt billingCycle traderProfile watchlist followers following')
        .lean();
      if (!user) return 'The current SwingRush user profile was not found.';
      const subscriptionActive = user.plan === 'pro' && user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date();
      return JSON.stringify({
        source: 'SwingRush user database',
        retrievedAt: new Date().toISOString(),
        fullName: user.fullName,
        username: user.username,
        plan: subscriptionActive ? 'pro' : 'free',
        subscriptionEnd: user.subscriptionEnd || null,
        subscriptionCancelled: Boolean(user.cancelledAt),
        billingCycle: user.billingCycle || null,
        traderProfile: user.traderProfile || { onboardingDone: false },
        watchlist: user.watchlist || [],
        followerCount: user.followers?.length || 0,
        followingCount: user.following?.length || 0,
      });
    } catch (e) {
      return `Failed to fetch the user's SwingRush profile: ${e.message}`;
    }
  }
  if (toolName === 'get_community_sentiment') {
    const sym = String(toolInput.symbol || '').toUpperCase().trim();
    if (!sym) return 'A stock ticker is required.';
    try {
      const Recommendation = require('../models/Recommendation');
      const [buyCount, sellCount] = await Promise.all([
        Recommendation.countDocuments({ symbol: sym, isOpen: true, direction: 'BUY', profileOnly: { $ne: true } }),
        Recommendation.countDocuments({ symbol: sym, isOpen: true, direction: 'SELL', profileOnly: { $ne: true } }),
      ]);
      const total = buyCount + sellCount;
      const buyPct = total ? +((buyCount / total) * 100).toFixed(2) : 0;
      return JSON.stringify({
        source: 'SwingRush community database',
        retrievedAt: new Date().toISOString(),
        symbol: sym,
        openCalls: total,
        buyCalls: buyCount,
        sellCalls: sellCount,
        buyPct,
        sellPct: total ? +(100 - buyPct).toFixed(2) : 0,
      });
    } catch (e) {
      return `Failed to fetch SwingRush community sentiment for ${sym}: ${e.message}`;
    }
  }
  if (toolName === 'get_swingrush_knowledge') {
    const facts = {
      overview: 'SwingRush is a social trading network with a community feed, transparent trade calls, profiles and leaderboard, a Free Signal Engine, a Pro Engine, a Market Scanner, and an AI research desk. MongoDB is authoritative for accounts, trades, social activity, chat history, notifications, and stored scanner results.',
      social: 'Users can publish BUY or SELL trade calls with entry, take-profit, and stop-loss; close trades with realized outcomes; follow traders; like, comment, and repost; receive notifications; review trader profiles and leaderboard performance. Open community BUY/SELL positioning for a ticker is contextual sentiment, not a guarantee.',
      pro_engine: 'The Pro Engine is the highest-quality SwingRush source for one symbol. It combines 8 technical indicators worth up to ±14 points with GPT-5.6 Sol analysis of recent Finnhub news worth up to ±10 points, producing a combined score from -24 to +24. It includes live/extended-hours Yahoo pricing, catalysts, risks, analyst consensus and targets, confirmed earnings dates, and ATR-based entry/TP/SL. It is calibrated for roughly 1–3 week swing trades and is objective, identical for every user.',
      scanner: 'The Market Scanner is a breadth/discovery tool, not the Pro Engine. Its universe is 2,000 US stocks ranked by market cap. Each run scans 500: the largest 300 always, plus 200 rotated from the remaining roughly 1,700. On trading weekdays it refreshes every 6 hours and retains the last completed run. It uses the Free Signal Engine technical logic plus Finnhub keyword/analyst news scoring; it does not run deep GPT-5.6 news analysis for every scanned ticker. If Scanner and Pro Engine disagree for one symbol, the Pro Engine is authoritative.',
      portfolio: 'SwingRush stores each user\'s posted calls, including direction, entry, target, stop, open/closed state, WIN/LOSS outcome, and recorded return. Portfolio aggregate tools calculate counts, win rate, average return and total return directly from stored records. Open-position progress uses each position\'s actual recorded TP/SL with a fresh quote; it must never substitute a new Pro Engine hypothetical target.',
      data_sources: 'Yahoo Finance supplies quotes and candles. Finnhub supplies recent company news, analyst recommendations, earnings calendars/history, and analyst price targets. The SwingRush database supplies user, portfolio, social, community and scanner state. OpenAI GPT-5.6 Sol provides language reasoning and deep news interpretation; it is not itself the source of live prices or private user data.',
    };
    return facts[toolInput.topic] || facts.overview;
  }
  if (toolName === 'get_open_positions_progress') {
    try {
      const mongoose = require('mongoose');
      const Recommendation = mongoose.models.Recommendation || require('../models/Recommendation');
      const open = await Recommendation.find({ user: userId, isOpen: true }).select('symbol direction entryPrice takeProfit stopLoss');
      if (!open.length) return 'This user has no open positions.';

      const rows = [];
      for (const r of open) {
        let price = null;
        try { price = (await getQuote(r.symbol)).price; } catch (e) { /* leave null, reported below */ }
        if (price == null) { rows.push({ symbol: r.symbol, error: true }); continue; }
        const distToTPPct = r.takeProfit != null ? +(((r.takeProfit - price) / price) * 100).toFixed(2) : null;
        const distToSLPct = r.stopLoss != null ? +(((r.stopLoss - price) / price) * 100).toFixed(2) : null;
        rows.push({ symbol: r.symbol, direction: r.direction, entryPrice: r.entryPrice, currentPrice: price, takeProfit: r.takeProfit, stopLoss: r.stopLoss, distToTPPct, distToSLPct });
      }

      const withDist = rows.filter(r => r.distToTPPct != null).sort((a, b) => Math.abs(a.distToTPPct) - Math.abs(b.distToTPPct));
      const lines = withDist.map(r =>
        `${r.symbol} (${r.direction}): entry $${r.entryPrice} | current live price $${r.currentPrice} | REAL take-profit $${r.takeProfit} → ${r.distToTPPct >= 0 ? '+' : ''}${r.distToTPPct}% away` +
        (r.stopLoss != null ? ` | REAL stop-loss $${r.stopLoss} → ${r.distToSLPct >= 0 ? '+' : ''}${r.distToSLPct}% away` : ' | no stop-loss set on this position')
      );
      const errored = rows.filter(r => r.error).map(r => r.symbol);
      return `This user's OPEN positions, ranked closest-to-target first (these are the REAL entry/TP/SL this user actually recorded for each position, with a fresh live current price — do not replace these TP/SL numbers with a fresh get_stock_analysis signal's own target):\n${lines.join('\n')}` +
        (errored.length ? `\n(Could not fetch a live price for: ${errored.join(', ')} — say so rather than guessing.)` : '');
    } catch (e) {
      return `Failed to compute open position progress: ${e.message}`;
    }
  }
  if (toolName === 'get_market_movers') {
    const direction = toolInput.direction === 'gainers' ? 'gainers' : 'losers';
    const movers = await fetchMarketMovers(direction, toolInput.count);
    if (!movers) return `Failed to fetch market ${direction} right now — try again shortly.`;
    if (!movers.length) return `No ${direction} data available right now.`;
    const label = direction === 'gainers' ? 'GAINERS' : 'LOSERS';
    return `TOP ${label} — LIVE, current trading session (real market-wide data, not limited to SwingRush's scanned universe):\n` +
      movers.map((m, i) => `${i+1}. ${m.symbol} (${m.name}): ${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(2)}% | $${m.price}`).join('\n');
  }
  return `Unknown tool: ${toolName}`;
};

// ── Full Responses API tool loop. Every output item is replayed so GPT-5.6
// keeps its reasoning state across function calls while store:false protects
// private SwingRush/user context from provider-side response storage.
const callOpenAI = async (messages, systemPrompt, userId) => {
  const chartRequests = [];
  const reportRequests = [];
  let convo = [...messages];
  const MAX_TOOL_ROUNDS = 5;
  // A long, multi-symbol answer can still hit the token ceiling even after
  // raising it \u2014 a real bug found in testing: a 7-position breakdown got cut
  // off mid-sentence with the last position missing entirely, and the
  // truncated text was silently returned as if it were the complete answer.
  // Bounded separately from tool rounds so a heavy tool-use question doesn't
  // eat into the continuation budget, or vice versa.
  const MAX_CONTINUATIONS = 3;
  let toolRounds = 0;
  let continuations = 0;
  let accumulatedText = '';

  while (true) {
    const parsed = await createOpenAIResponse({
      input: convo,
      instructions: systemPrompt,
      tools: toolRounds >= MAX_TOOL_ROUNDS ? [] : OPENAI_TOOLS,
      maxOutputTokens: 16000,
      verbosity: 'medium',
    });
    const output = Array.isArray(parsed.output) ? parsed.output : [];
    const functionCalls = output.filter(item => item.type === 'function_call');

    if (functionCalls.length) {
      toolRounds++;
      convo.push(...output);

      const toolResults = await Promise.all(functionCalls.map(async (call) => {
        let args = {};
        try {
          args = JSON.parse(call.arguments || '{}');
        } catch (e) {
          return {
            type: 'function_call_output',
            call_id: call.call_id,
            output: `Invalid JSON arguments for ${call.name}. Call the tool again with valid JSON.`,
          };
        }
        const resultText = await executeTool(call.name, args, chartRequests, reportRequests, userId);
        return {
          type: 'function_call_output',
          call_id: call.call_id,
          output: String(resultText),
        };
      }));
      convo.push(...toolResults);
      continue;
    }

    const responseText = extractOutputText(parsed);
    if (responseText) accumulatedText += (accumulatedText ? '\n\n' : '') + responseText;

    if (parsed.status === 'incomplete' && parsed.incomplete_details?.reason === 'max_output_tokens' && continuations < MAX_CONTINUATIONS) {
      continuations++;
      convo.push(...output);
      convo.push({ role: 'user', content: 'Continue exactly where you left off \u2014 do not repeat or restart anything you already said, just keep writing from the exact point you stopped.' });
      continue;
    }

    return {
      text: accumulatedText || 'I had trouble completing that analysis \u2014 please try again.',
      charts: chartRequests,
      reports: reportRequests,
    };
  }
};

// ── Fetch candles for chart display ────────────────────────────────
const fetchCandles = (symbol) => new Promise((resolve) => {
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 120 * 24 * 60 * 60;
  const url  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?period1=' + from + '&period2=' + now + '&interval=1d';
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
    const chunks = [];
    res.on('data', d => chunks.push(d));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const result = parsed.chart.result[0];
        const ts = result.timestamp || [];
        const q  = result.indicators.quote[0];
        const candles = ts.map((t, i) => ({
          time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i]
        })).filter(c => c.open != null && c.close != null);
        resolve(candles);
      } catch(e) { resolve(null); }
    });
  }).on('error', () => resolve(null));
});

// ── GET /api/chat/sessions ─────────────────────────────────────────
router.get('/sessions', protect, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user._id })
      .select('title createdAt updatedAt messages')
      .sort({ updatedAt: -1 })
      .limit(30);
    res.json(sessions);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/chat/sessions/:id ─────────────────────────────────────
router.get('/sessions/:id', protect, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/chat/sessions ────────────────────────────────────────
router.post('/sessions', protect, async (req, res) => {
  try {
    const session = await ChatSession.create({ user: req.user._id, title: 'New Chat', messages: [] });
    res.json(session);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/chat/sessions/:id ─────────────────────────────────
router.delete('/sessions/:id', protect, async (req, res) => {
  try {
    await ChatSession.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Deleted' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/chat ─────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { message, history = [], stockContext, sessionId, imageBase64, imageMimeType, language } = req.body;
    if (!message && !imageBase64) return res.status(400).json({ message: 'Message required' });
    const preferredLanguage = language === 'ar' ? 'Arabic' : language === 'he' ? 'Hebrew' : 'English';

    // ── Chat is Pro-only ───────────────────────────────────────
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    const isPro = typeof user.isPro === 'function' ? user.isPro() : (user.plan === 'pro' && user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date());
    if (!isPro) {
      return res.status(403).json({
        message: 'AI Chat is a SwingRush Pro feature. Upgrade to Pro for unlimited access to the AI analyst.',
        requireSubscription: true,
      });
    }

    // ── Session management ───────────────────────────────────────
    // sessionId = specific ID → continue that session
    // sessionId = 'NEW' → always create new session
    // sessionId = null/undefined → find most recent session OR create new
    let session;
    if (sessionId && sessionId !== 'NEW') {
      try { session = await ChatSession.findOne({ _id: sessionId, user: req.user._id }); } catch(e) {}
    }
    if (!session && sessionId !== 'NEW') {
      // Find most recent session from last 24 hours to continue
      session = await ChatSession.findOne({
        user: req.user._id,
        updatedAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
      }).sort({ updatedAt: -1 });
    }
    if (!session) {
      // Create new session (either NEW requested or no recent session)
      session = await ChatSession.create({ user: req.user._id, title: 'New Chat', messages: [] });
    }

    // Only the CURRENT message may activate automatic ticker context. The
    // previous implementation reused the last session ticker for every later
    // no-ticker question, which leaked an old Pro report into unrelated chats.
    // Conversation history still lets the model understand natural follow-ups,
    // but the backend will not attach a structured report unless this message
    // explicitly names the ticker/company.
    const symbols = extractSymbols(message || '');
    const needsEngine = symbols.length > 0; // used by community context below; engine data comes through the AI's tool calls

    // ── This user's own open position(s) in whatever symbol(s) are in play ──
    // Ambient fact, not a tool call — same pattern as trader profile / community
    // sentiment below. Whether the user already holds a symbol is always
    // relevant to any conversation about that symbol, so it shouldn't depend
    // on the model deciding to look it up; it is handed over up front, the
    // same way the user's name always is.
    let ownPositionsContext = '';
    if (symbols.length > 0) {
      try {
        const mongoose = require('mongoose');
        const Recommendation = mongoose.models.Recommendation || require('../models/Recommendation');
        const own = await Recommendation.find({
          user: req.user._id, symbol: { $in: symbols }, isOpen: true, profileOnly: { $ne: true },
        }).select('symbol direction entryPrice takeProfit stopLoss openedAt createdAt');
        if (own.length) {
          const lines = own.map(r => `${r.symbol}: you have an open ${r.direction} at $${r.entryPrice}` +
            (r.takeProfit ? `, TP $${r.takeProfit}` : '') + (r.stopLoss ? `, SL $${r.stopLoss}` : '') +
            `, opened ${new Date(r.openedAt || r.createdAt).toLocaleDateString('en-US')}.`);
          ownPositionsContext = `
╔══════════════════════════════════════╗
  THE USER'S OWN OPEN POSITION(S) IN SYMBOL(S) THEY'RE ASKING ABOUT
╚══════════════════════════════════════╝
${lines.join('\n')}
This is real, factual data about their own portfolio. Use it when it changes the answer (for example, hold/add/trim considerations instead of generic fresh-entry advice), and use your own judgment about whether it needs to be mentioned explicitly.
`;
        }
      } catch (e) { console.log('Own positions context error:', e.message); }
    }

    // ── Community sentiment: what SwingRush traders are doing (open calls only) ──
    let communityContext = '';
    if (needsEngine && symbols.length > 0) {
      try {
        const mongoose = require('mongoose');
        const Recommendation = mongoose.models.Recommendation || require('../models/Recommendation');
        const sentimentParts = [];
        for (const sym of symbols) {
          const [buyCount, sellCount] = await Promise.all([
            Recommendation.countDocuments({ symbol: sym, isOpen: true, direction: 'BUY', profileOnly: { $ne: true } }),
            Recommendation.countDocuments({ symbol: sym, isOpen: true, direction: 'SELL', profileOnly: { $ne: true } }),
          ]);
          const total = buyCount + sellCount;
          if (total === 0) {
            sentimentParts.push(`${sym}: No open community calls yet.`);
            continue;
          }
          const buyPct = Math.round((buyCount / total) * 100);
          const sellPct = 100 - buyPct;
          let line = `${sym}: ${buyCount} open BUY (${buyPct}%) vs ${sellCount} open SELL (${sellPct}%) — ${total} total open calls on SwingRush.`;
          if (total >= 5 && (buyPct >= 90 || sellPct >= 90)) {
            line += ` ⚠️ LOPSIDED: ${Math.max(buyPct, sellPct)}% of open calls are on one side — this may be a relevant crowded-trade consideration. Use your judgment about whether it materially helps answer the user's question.`;
          }
          sentimentParts.push(line);
        }
        if (sentimentParts.length) {
          communityContext = `
╔══════════════════════════════════════╗
  SWINGRUSH COMMUNITY SENTIMENT (open calls only, live)
╚══════════════════════════════════════╝
${sentimentParts.join('\n')}
`;
        }
      } catch (e) { console.log('Community sentiment error:', e.message); }
    }


    // ── Trader profile ───────────────────────────────────────────
    const firstName = (user.fullName || '').split(' ')[0] || '';
    const nameContext = firstName ? '\nThe user\'s first name is ' + firstName + '. Use their name whenever you judge it fits naturally \u2014 greetings, acknowledging a point they made, wrapping up a recommendation, etc. Use your own judgment on frequency, but don\'t go silent on it either.\n' : '';
    let profileContext = '';
    if (user.traderProfile && user.traderProfile.onboardingDone) {
      const p = user.traderProfile;
      profileContext = `
TRADER PROFILE (use for decisions where personal suitability matters):
- Age: ${p.age || 'N/A'} | Investment budget: ${p.investmentAmount || 'N/A'}
- Style: ${p.tradingStyle === 'day' ? 'Day Trader' : p.tradingStyle === 'swing' ? 'Swing Trader' : p.tradingStyle === 'longterm' ? 'Long-Term Investor' : 'N/A'}
- Experience: ${p.experience || 'N/A'} | Risk tolerance: ${p.riskTolerance || 'N/A'}
- Goals: ${p.goals || 'N/A'}
`;
    } else {
      profileContext = `
TRADER PROFILE: NOT FILLED IN. This user has not completed their trader profile (age, budget, risk tolerance, experience, goals).
If the user asks a general investment/recommendation question that would genuinely benefit from knowing their risk tolerance, budget, or investing style (e.g. "what's the best stock for me", "what should I invest in"), politely mention early in your answer that filling out their trader profile (in their Profile page settings) would let you give more personalized advice — then still give your best general answer regardless. Do NOT nag about this on every message, only when it's genuinely relevant to the specific question asked.
`;
    }

    let accountContext = '';
    try {
      const mongoose = require('mongoose');
      const Recommendation = mongoose.models.Recommendation || require('../models/Recommendation');
      const openPositionCount = await Recommendation.countDocuments({
        user: req.user._id,
        isOpen: true,
        profileOnly: { $ne: true },
      });
      const watchlist = Array.isArray(user.watchlist) ? user.watchlist : [];
      accountContext = `
SWINGRUSH ACCOUNT CONTEXT (verified locally):
- Plan: ${user.plan || 'free'}
- Open posted positions: ${openPositionCount}
- Watchlist (${watchlist.length}): ${watchlist.length ? watchlist.join(', ') : 'empty'}
This context is available for relevance and personalization; it is not a requirement to mention account details in every answer.
`;
    } catch (e) { console.log('Account context error:', e.message); }

    // ── Build session history for OpenAI (BEFORE adding this message) ──
    // Snapshot the prior turns from the in-memory session; the current user
    // message is appended to the Responses API payload separately below.
    const sessionHistory = session.messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }));

    // ── Persist the user's message IMMEDIATELY (resume support) ──────
    // Save the question before the AI call so that if the client
    // navigates away / reloads before the answer is ready, the question is
    // never lost and the frontend can reopen and poll this session for the
    // reply once generation finishes server-side.
    //
    // Use an ATOMIC $push (not load-modify-save): a single session can have
    // more than one request in flight at once (e.g. the user sends, navigates,
    // then sends again while the first is still generating server-side).
    // Full-document .save() calls would clobber each other and drop/mis-attach
    // messages; $push appends safely regardless of concurrency.
    const userDbContent = message || 'Image uploaded';
    const isNewSession = session.messages.length === 0;
    const userUpdate = { $push: { messages: { role: 'user', content: userDbContent, time: new Date() } } };
    if (isNewSession) {
      userUpdate.$set = {
        title: userDbContent.length > 45 ? userDbContent.substring(0, 45) + '...' : userDbContent
      };
    }
    await ChatSession.updateOne({ _id: session._id }, userUpdate);

    // ── System prompt ────────────────────────────────────────────
    const systemPrompt = `You are SwingRush AI, a professional trading analyst helping the SwingRush user.
${nameContext}
You are a careful, evidence-driven US equities analyst with broad financial knowledge and strong reasoning. Use your own knowledge for stable concepts, education, interpretation, and analysis. Choose tools automatically only when they materially improve the answer. Do not call a tool merely because one exists.

ACCURACY POLICY (non-negotiable):
- Never use memory for a live price, current percentage move, fresh news, today's market movers, a future earnings date, current scanner/engine output, SwingRush product behavior, or this user's private account/portfolio state. Verify those with the matching tool.
- Treat tool output as the factual source. Never change a returned number, direction, date, ticker, TP, SL, score, or user fact. Clearly distinguish verified facts from your interpretation.
- If data is missing, stale, conflicting, or a tool fails, say exactly what could not be verified. Never fill the gap with a plausible guess.
- For current news or public facts, use web_search and include source citations/links. Check publication date and event date; prefer primary sources and recent reporting.
- For an exact current stock quote, prefer get_stock_quote over web results. For a full one-stock trade view, prefer get_stock_analysis. For market breadth, use the Scanner tools. For private user facts, use SwingRush database tools.
- For an exact past session or any historical period—including "yesterday"—use get_stock_history. It supplies verified closes and precomputed daily/period gain-loss percentages. A current quote and its prior-close field are not enough.
- If get_stock_history returns no usable session, use web_search as a fallback and cite the historical-data source. If the user asks WHY the stock moved, use web_search for dated news/catalysts after obtaining the exact price move.
- When two sources conflict for the same stock, do not blend the numbers. State the conflict and timestamp/source. For the SwingRush signal, Pro Engine is authoritative over Scanner.
- Do not promise certainty or guaranteed outcomes. Give the strongest supportable conclusion and identify material uncertainty.

Your tools:
- web_search — for fresh news, current public/company facts, filings, macro developments and other time-sensitive information. Do not use it instead of a structured SwingRush tool when that tool directly answers the question.
- calculate — a real calculator. Any time your answer involves arithmetic on numbers you already have in front of you (a percentage, a difference, a ratio, a sum of a few known values — anything), call this instead of computing it yourself, no matter how simple it looks, and state only the number it returns. Your own mental math is not reliable enough to trust for anything you tell the user. (If the math requires first counting or summing across a LIST of the user's own trades, use aggregate_my_trades instead — see below — since the risk there is miscounting the list, not just the final arithmetic.)
- get_stock_quote — freshest structured quote for a simple exact price/change question, including market state and timestamp.
- get_stock_history — verified Yahoo daily candles for any exact past date or historical period, with exact OHLCV plus server-calculated daily and start-to-end gain/loss percentages. Long-period returns use split/dividend-adjusted closes. Use it for "what did NVDA close at yesterday?" and "how much did NVDA gain from date A to date B?"; it does not run Pro news analysis or consume those credits. If Yahoo has no usable data, fall back to web_search with citations.
- get_stock_analysis — the SwingRush "Pro Engine": an objective, quantified swing-trade signal for ONE stock. It runs 8 technical indicators (up to ±14 pts) plus real GPT-5.6 Sol analysis of that stock's supplied recent news (up to ±10 pts) for a combined score from -24 to +24, and returns direction, confidence, entry/TP/SL, catalysts, risks, the latest reported quarterly EPS/revenue actual-vs-estimate result, confirmed upcoming earnings dates, and precomputed 1-week/1-month price % change, distance to TP, distance to SL, and real analyst price-target upside/downside — every price relationship is already calculated against the same live price, so use those numbers exactly and never recalculate them from history or web results. Confidence by |score|: 17-24 Very High, 12-16 High, 8-11 Medium, 4-7 Low, 0-3 no clear signal. It is calibrated for short-to-medium-term swing trades (~1-3 weeks) and is identical for every user. Its entry/TP/SL describe a FRESH hypothetical trade today; if the user already has a position, use get_open_positions_progress for that position's actual target and stop.
- get_latest_pro_report — latest immutable SAVED Pro Engine report for one ticker, retrieved without rerunning paid analysis. Use only when a saved/previous Pro signal or score is relevant; do not inject an old engine report into an unrelated price-history, company, earnings, or news answer.
- get_market_scan — the SwingRush "Scanner": current signals across the scanned universe, with technical + keyword/analyst news sub-scores. Use for breadth and discovery, not as a substitute for one-stock Pro Engine analysis.
- filter_scanner — a real calculator over the scanner's signals: count, list, or average score, filtered by direction/price range/score/confidence, computed directly from the data. ANY question that requires counting or filtering scanner signals by a specific condition ("how many SELL signals under $50", "list BUY signals with High confidence") MUST go through this tool, not get_market_scan's raw text — the scanner can have hundreds of rows and manually counting/filtering that many yourself is unreliable, exactly like tallying a long trade list by hand.
- get_my_calls — this user's own portfolio: the raw list of trades they personally posted, with entry, TP/SL and outcome (WIN/LOSS/OPEN). Use this to look up or describe individual trades, NOT to compute any statistic across them.
- aggregate_my_trades — a real calculator over this user's own trades: count, win rate, average return, or total return, computed directly from the database. ANY question requiring you to count or sum across more than a couple of trades (win rate, "how am I doing", average return, performance on BUYs vs SELLs, etc.) MUST go through this tool. Do not tally or sum rows from get_my_calls by reading them yourself — that step is exactly as unreliable as doing arithmetic in your head, even though it looks like "just counting."
- get_my_profile — verified account, trader-profile, watchlist and social-count facts for this user.
- get_community_sentiment — live open BUY/SELL call counts and percentages from the SwingRush community for one ticker.
- get_swingrush_knowledge — verified information about the SwingRush social system, engines, scanner, portfolio behavior and data sources. Use it for platform questions instead of guessing.
- get_open_positions_progress — real distance from the current live price to each of this user's OPEN positions' ACTUAL recorded take-profit/stop-loss, ranked closest-to-target first, computed server-side. ALWAYS use this for "how close is my position to target", "which of my positions is closest to TP", or similar — NEVER build this answer yourself by combining get_my_calls with get_stock_analysis, since get_stock_analysis's TP/SL belongs to a fresh hypothetical trade, not the user's real position, and mixing the two gives a wrong answer even though the arithmetic on the wrong numbers would look fine.
- get_market_movers — structured live top US-market gainers or losers for the current or most recent trading session.
- show_chart — render a price chart for a symbol (optional timeframe 1d or 1h).

Language: always reply in the SAME language the user just wrote their message in — Arabic, Hebrew, English, or any other language — match them exactly, even if it's different from your previous reply or from the site's UI language. Only fall back to the site's UI language (${preferredLanguage}) when the user's message itself gives no language signal (e.g. it's just a ticker symbol like "NVDA" or a number).

Tone: use occasional relevant emojis naturally to make the conversation warmer (usually 0-2 in an answer). Keep them subtle, never decorate every paragraph or bullet, and skip them where they would reduce clarity in dense numbers, risk warnings, or serious loss discussions.

Directional words matter as much as numbers — BUY vs SELL, bullish vs bearish, upside vs downside, oversold vs overbought. A polarity word in the wrong direction is worse than a wrong number: it flips the entire meaning of the fact into its opposite. This risk is highest in more complex sentence structures — especially concessive ones ("despite X% rating BUY, the news is quiet", "على الرغم من", "למרות ש") — where you're holding a fact steady while also building a contrast around it. Before writing any sentence that states a direction in a non-English language, re-read it against the source data and confirm the direction word you used still matches; if in doubt, state the fact in a simpler, more direct sentence rather than a complex contrastive one.
${stockContext ? `\nStock the user is currently viewing:\n${stockContext}\n` : ''}
${ownPositionsContext}
${communityContext}
${profileContext}
${accountContext}
Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
Yesterday was: ${new Date(Date.now() - 86400000).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
Current time right now: ${new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })} (server time) — treat these exact dates as ground truth, do not recompute them yourself.`;

    // ── Build messages — use FULL session history ────────────────
    let openAIMessages;
    if (imageBase64) {
      // Message with image
      openAIMessages = [
        ...sessionHistory,
        {
          role: 'user',
          content: [
            { type: 'input_text', text: message || 'Please analyze this chart/image' },
            { type: 'input_image', image_url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`, detail: 'auto' },
          ]
        }
      ];
    } else {
      openAIMessages = [
        ...sessionHistory,
        { role: 'user', content: message }
      ];
    }

    const openAIResult = await callOpenAI(openAIMessages, systemPrompt, req.user._id);
    const responseText = openAIResult.text;
    const stockDataList = openAIResult.charts || [];
    const latestReports = [];
    (openAIResult.reports || []).forEach(report => addReportRequest(latestReports, report));
    // ── Save AI reply to session ──────────────────
    // (User message was already saved above, before the OpenAI call.)
    // Atomic $push again, so a concurrent request on the same session can't
    // clobber this reply (or vice-versa).
    await ChatSession.updateOne(
      { _id: session._id },
      { $push: { messages: { role: 'ai', content: responseText, time: new Date(), reports: latestReports } } }
    );
    res.json({
      response: responseText,
      symbols,
      sessionId: session._id,
      stockData: stockDataList[0] || null,
      stockDataList,
      latestReports,
    });

  } catch(err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── Save a system-generated AI message directly to a session ──────
// Used when the frontend injects a Pro Engine analysis summary into the
// chat window without an actual OpenAI round-trip, so it still persists.
router.post('/save-message', protect, async (req, res) => {
  try {
    const { sessionId, content, reportIds = [] } = req.body;
    if (!content) return res.status(400).json({ message: 'content required' });

    let savedReports = [];
    if (Array.isArray(reportIds) && reportIds.length) {
      try {
        const ProReport = require('../models/ProReport');
        const docs = await ProReport.find({ _id: { $in: reportIds.slice(0, 3) } }).lean();
        savedReports = docs.map(toReportSnapshot);
      } catch (e) { console.log('save-message report lookup error:', e.message); }
    }

    let session;
    if (sessionId && sessionId !== 'NEW') {
      try { session = await ChatSession.findOne({ _id: sessionId, user: req.user._id }); } catch (e) {}
    }
    if (!session && sessionId !== 'NEW') {
      session = await ChatSession.findOne({
        user: req.user._id,
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).sort({ updatedAt: -1 });
    }
    if (!session) {
      session = await ChatSession.create({ user: req.user._id, title: 'New Chat', messages: [] });
    }

    session.messages.push({ role: 'ai', content, reports: savedReports });
    if (session.messages.length === 1) {
      session.title = content.length > 45 ? content.substring(0, 45) + '...' : content;
    }
    await session.save();

    res.json({ sessionId: session._id, latestReports: savedReports });
  } catch (err) {
    console.error('save-message error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
