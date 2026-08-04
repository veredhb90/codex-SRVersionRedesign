const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getEngineRecommendation } = require('../services/yahooFinance');
const { getProTechnicalScore, getCandles } = require('../services/proEngine');
const { getClaudeNewsAnalysis } = require('../services/claudeNewsAnalysis');
const ChatSession = require('../models/ChatSession');
const https      = require('https');

// ── Company name → ticker mapping ──────────────────────────────────
const NAME_TO_TICKER = {
  'APPLE':'AAPL', 'MICROSOFT':'MSFT', 'GOOGLE':'GOOGL', 'ALPHABET':'GOOGL',
  'AMAZON':'AMZN', 'TESLA':'TSLA', 'FACEBOOK':'META', 'NVIDIA':'NVDA',
  'NETFLIX':'NFLX', 'ORACLE':'ORCL', 'INTEL':'INTC', 'DISNEY':'DIS',
  'BOEING':'BA', 'PAYPAL':'PYPL', 'STARBUCKS':'SBUX', 'WALMART':'WMT',
  'COSTCO':'COST', 'MCDONALDS':'MCD', 'NIKE':'NKE', 'VISA':'V',
  'MASTERCARD':'MA', 'PEPSI':'PEP', 'ADOBE':'ADBE', 'SALESFORCE':'CRM',
  'AIRBNB':'ABNB', 'PALANTIR':'PLTR', 'COINBASE':'COIN', 'ROBINHOOD':'HOOD',
  'SNAPCHAT':'SNAP', 'SPOTIFY':'SPOT', 'MONGODB':'MDB', 'BROADCOM':'AVGO',
  'QUALCOMM':'QCOM', 'MICRON':'MU', 'FORD':'F', 'RIVIAN':'RIVN',
  'LUCID':'LCID', 'ALIBABA':'BABA', 'BAIDU':'BIDU', 'AMD':'AMD',
};

// ── Extract stock symbols ──────────────────────────────────────────
const extractSymbols = (text) => {
  const words = (text.toUpperCase().match(/\b[A-Z]{2,12}\b/g)) || [];
  const SKIP = new Set([
    'THE','AND','FOR','BUY','SELL','NOW','TOP','GET','HOW','WHY','CAN','ARE',
    'YOU','WHAT','WHEN','WILL','DOES','HAS','ITS','SHOULD','WOULD','TELL',
    'ABOUT','STOCK','NEWS','PRICE','TODAY','MARKET','TRADE','SIGNAL','ALL',
    'GIVE','SHOW','LIST','BEST','WITH','FROM','LAST','YEAR','WEEK','THIS',
    'THAT','HAVE','BEEN','THEY','WERE','SAID','EACH','WHICH','THEIR','THAN',
    'RSI','MACD','ADX','EMA','SMA','ATR','CEO','CFO','IPO','ETF','USD',
    'NEW','OLD','HIGH','LOW','OPEN','CLOSE','GOOD','BAD','MORE','LESS',
    'ME','MY','SO','IF','IS','IT','AT','ON','IN','TO','OF','OR','AN','AS',
    'BE','BY','DO','GO','HE','WE','UP','US','AM','PM','OK','NO','YES','ANY',
    'GRAPH','CHART','CHARTS','TREND','STOCKS','SCORE','GRAPHS',
    'SHE','WAS','HER','HIS','HIM','WHO','OUR','OUT','OFF','OVER',
    'INTO','HERE','WANT','NEED','TAKE','MAKE','LIKE','JUST','KNOW',
    'LOOK','FIND','KEEP','COME','LET','SAY','SAYS','TRY','HELP',
    'SOME','SUCH','MUCH','MANY','ONLY','VERY','EVEN','ALSO','BOTH',
    'MUST','COULD','ASKED','ASK','TELLS','FEEL','FEELS','SEEM','SEEMS',
    'LOOKS','MAYBE','STILL','EVER','NEVER','ALWAYS','OFTEN','SOON',
    'LATER','THEN','WHOM','WHILE','DURING','AFTER','BEFORE','SINCE',
    'UNTIL','THUS','MOVE','MOVES','HOLD','HOLDS','WAIT','WAITS',
    'WORK','WORKS','PLAN','PLANS','PLAY','PLAYS','LIVE','LIVES',
    'REAL','TRUE','FACT','FACTS','CASE','CASES','PART','PARTS',
    'SIDE','SIDES','WAYS','WAY','LINE','LINES','HALF','ROSE','FELL',
  ]);
  const found = [];
  for (const w of words) {
    if (NAME_TO_TICKER[w]) found.push(NAME_TO_TICKER[w]);
  }
  for (const w of words) {
    if (w.length >= 2 && w.length <= 5 && !SKIP.has(w) && !NAME_TO_TICKER[w]) found.push(w);
  }
  return [...new Set(found)].slice(0, 3);
};

// ── Call Claude ────────────────────────────────────────────────────
// ── Run the Pro Engine (technical + AI news) for one symbol ─────────
// Returns null if there's insufficient data. Used by the get_stock_analysis tool.
const runProEngineFor = async (sym) => {
  const [tech, newsA] = await Promise.all([
    getProTechnicalScore(sym),
    getClaudeNewsAnalysis(sym),
  ]);
  if (tech.insufficientData) return null;
  const combinedScore = tech.score + newsA.score;
  const absScore = Math.abs(combinedScore);
  const MIN_SCORE = 4;
  const hasSignal = absScore >= MIN_SCORE;
  const direction = !hasSignal ? 'NEUTRAL' : (combinedScore > 0 ? 'BUY' : 'SELL');
  let confidence = 'Insufficient';
  if (hasSignal) {
    if (absScore >= 17) confidence = 'Very High';
    else if (absScore >= 12) confidence = 'High';
    else if (absScore >= 8) confidence = 'Medium';
    else confidence = 'Low';
  }
  const tpMult = absScore >= 12 ? 4.5 : absScore >= 8 ? 3.5 : absScore >= 5 ? 2.5 : 2.0;
  const slMult = 1.5;
  const realAtr = tech.realAtr || (tech.price * 0.02);
  let takeProfit = null, stopLoss = null, riskReward = null;
  if (direction !== 'NEUTRAL') {
    takeProfit = direction === 'BUY' ? +(tech.price + realAtr * tpMult).toFixed(2) : +(tech.price - realAtr * tpMult).toFixed(2);
    stopLoss   = direction === 'BUY' ? +(tech.price - realAtr * slMult).toFixed(2) : +(tech.price + realAtr * slMult).toFixed(2);
    riskReward = +((Math.abs(takeProfit - tech.price) / Math.abs(stopLoss - tech.price)).toFixed(2));
  }
  return {
    symbol: sym, price: tech.price, regularSessionPrice: tech.regularSessionPrice || tech.price, changePct: tech.changePct, marketState: tech.marketState || 'Regular Session',
    direction, score: combinedScore, confidence,
    takeProfit, stopLoss, riskReward,
    technicalScore: tech.score, technicalBreakdown: tech.breakdown || [],
    newsScore: newsA.score, newsLabel: newsA.label, newsSummary: newsA.summary, newsReasoning: newsA.reasoning || '',
    catalysts: newsA.catalysts || [], risks: newsA.risks || [],
    analystSummary: newsA.analystSummary || '',
    holdingPeriod: newsA.holdingPeriod || '',
    upcomingEarnings: newsA.upcomingEarnings || [],
    priceHistory: tech.candles || [],
    news: [],
  };
};

// ── Format a Pro Engine result into readable text for Claude ────────
const formatProEngineText = (e, sym) => {
  const breakdownText = (e.technicalBreakdown || []).map(b => `  ${b.indicator}: ${b.points > 0 ? '+' : ''}${b.points} (${b.note})`).join('\n');
  const catalystsText = (e.catalysts || []).length ? e.catalysts.map(c => `  \u2022 ${c}`).join('\n') : '  None identified';
  const risksText = (e.risks || []).length ? e.risks.map(r2 => `  \u2022 ${r2}`).join('\n') : '  None identified';
  return `SWINGRUSH PRO ENGINE: ${sym}
${e.marketState === 'Pre-Market' || e.marketState === 'After-Hours' ? 'Regular Session Close: $' + e.regularSessionPrice + ' | Current ' + e.marketState + ' Price: $' + e.price + ' (freshest, use this for analysis)' : 'Price: $' + e.price} | Change: ${e.changePct >= 0 ? '+' : ''}${e.changePct}%
SIGNAL: ${e.direction} | Combined Score: ${e.score > 0 ? '+' : ''}${e.score}/24 | ${e.confidence} Confidence
${e.takeProfit ? `Entry: $${e.price} | TP: $${e.takeProfit} | SL: $${e.stopLoss} | R:R 1:${e.riskReward}` : 'No trade setup \u2014 score below conviction threshold'}
TECHNICAL BREAKDOWN (${e.technicalScore} pts):
${breakdownText}
AI NEWS ANALYSIS (${e.newsScore > 0 ? '+' : ''}${e.newsScore} pts) \u2014 ${e.newsLabel}:
${e.newsSummary}${e.newsReasoning ? '\nWHY THIS SCORE: ' + e.newsReasoning : ''}
CATALYSTS:
${catalystsText}
RISKS:
${risksText}
${e.analystSummary ? 'ANALYST CONSENSUS: ' + e.analystSummary : ''}
${e.holdingPeriod ? 'RECOMMENDED HOLDING PERIOD: ' + e.holdingPeriod : ''}
${e.upcomingEarnings && e.upcomingEarnings.length ? 'UPCOMING EARNINGS (confirmed dates - cite these exactly, never guess other dates): ' + e.upcomingEarnings.map(x => x.date + ' (Q' + x.quarter + ' FY' + x.year + ', ' + x.hour + ')').join('; ') : 'No confirmed upcoming earnings date in the calendar.'}
RAW DAILY PRICE HISTORY (last 30 trading days, oldest to newest \u2014 use this to answer ANY historical question yourself):
${(e.priceHistory || []).slice(-30).map(c => {
  const d = new Date(c.time * 1000);
  return d.toISOString().split('T')[0] + ': close $' + c.close.toFixed(2) + ' (open $' + c.open.toFixed(2) + ', high $' + c.high.toFixed(2) + ', low $' + c.low.toFixed(2) + ')';
}).join('\n')}`;
};

// ── Raw single API call to Claude, returns the full parsed response ──
const callClaudeRaw = (messages, systemPrompt, tools) => new Promise((resolve, reject) => {
  const body = JSON.stringify({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    system: systemPrompt,
    messages,
    tools,
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
        resolve(parsed);
      } catch(e) { reject(e); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

// ── Tool definitions - Claude decides for himself when to use these ──
const CLAUDE_TOOLS = [
  { type: 'web_search_20250305', name: 'web_search' },
  {
    name: 'get_stock_analysis',
    description: 'Get live SwingRush Pro Engine analysis for ONE specific stock: technical indicators (RSI, EMA, MACD, ADX, etc), AI-powered news analysis with real catalysts and risks, upcoming earnings dates, suggested holding period, and current price (including pre-market/after-hours if applicable). Call this ONLY when the user is asking about a specific stock in a way that genuinely benefits from live technical/news data (e.g. "should I buy X", "what\'s the signal on X", "analyze X") \u2014 do NOT call this for general knowledge questions about a company (like "who is the CEO"), for questions your own knowledge already answers well, or just because a ticker is mentioned in passing.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'The stock ticker symbol, e.g. NVDA, AAPL, TSLA' } },
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
    description: 'Get broad market-scan results across the full stock universe \u2014 all current BUY/SELL signals with price, TP, SL, confidence, grouped by price range. Each stock\'s total score COMBINES a technical score + a news score (the news is keyword/analyst-based sentiment, NOT the deep Claude AI news analysis the Pro Engine runs), and both sub-scores are shown per stock. Best for breadth questions like \'what are the best stocks today\', \'any good stocks under $50\', \'show me strong sell signals\'. For one specific stock, get_stock_analysis is higher quality (real AI news analysis) and takes priority over this scan for that symbol.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_my_calls',
    description: 'Get the trade calls that THIS specific user (the one you are chatting with right now) has personally posted \u2014 their own open and closed positions, with entry price, TP/SL, and outcome (WIN/LOSS/OPEN). Use this when it would genuinely help to know the user\'s own trading history or current positions \u2014 for example if they ask how they are doing, ask for advice that should consider what they already hold, or reference \'my calls\'/\'my trades\'. This is different from get_market_scan or general community sentiment \u2014 it is specifically about this one user\'s own activity.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

// ── Execute a tool call server-side and return its result text ──────
// ── Fetch the full market scanner data (682 stocks), formatted for Claude ──
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
Each stock's total score combines a TECHNICAL score + a NEWS score (the news is keyword/analyst-based sentiment, not the deep Claude AI news analysis the Pro Engine runs). This is a broad multi-stock scan \u2014 NOT the same as a Pro Engine analysis for one symbol. If a symbol here also has a Pro Engine result, the Pro Engine number is authoritative, not this one.
ALL BUY SIGNALS (${buys.length} stocks):
${buys.map((r, i) => `${i+1}. ${r.symbol}: +${r.score} ${split(r)} | \$${r.price} | TP:\$${r.takeProfit} | SL:\$${r.stopLoss} | ${r.confidence}`).join('\n')}
ALL SELL SIGNALS (${sells.length} stocks):
${sells.map((r, i) => `${i+1}. ${r.symbol}: ${r.score} ${split(r)} | \$${r.price} | TP:\$${r.takeProfit} | SL:\$${r.stopLoss} | ${r.confidence}`).join('\n')}
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

const executeTool = async (toolName, toolInput, chartRequests, userId) => {
  if (toolName === 'get_stock_analysis') {
    const sym = (toolInput.symbol || '').toUpperCase().trim();
    try {
      const result = await runProEngineFor(sym);
      if (!result) return `No sufficient price history available for ${sym}.`;
      return formatProEngineText(result, sym);
    } catch (e) {
      return `Failed to fetch analysis for ${sym}: ${e.message}`;
    }
  }
  if (toolName === 'show_chart') {
    const sym = (toolInput.symbol || '').toUpperCase().trim();
    try {
      // Uses the exact same function as get_stock_analysis, so the chart's
      // score/direction ALWAYS matches the Pro Engine result exactly — no
      // separate recalculation, no possibility of the two numbers disagreeing.
      const result = await runProEngineFor(sym);
      if (!result || !result.priceHistory || !result.priceHistory.length) {
        return `No chart data available for ${sym}.`;
      }
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
  if (toolName === 'get_my_calls') {
    try {
      const mongoose = require('mongoose');
      const Recommendation = mongoose.models.Recommendation || require('../models/Recommendation');
      const recs = await Recommendation.find({ user: userId }).sort({ createdAt: -1 }).limit(20);
      if (!recs.length) return 'This user has not posted any trade calls yet.';
      const lines2 = recs.map(r => {
        const status = r.isOpen ? 'OPEN' : (r.outcome === 'WIN' ? 'WIN' : r.outcome === 'LOSS' ? 'LOSS' : 'CLOSED');
        const ret = !r.isOpen && r.returnPct ? ` (${r.returnPct > 0 ? '+' : ''}${r.returnPct}%)` : '';
        return `${r.symbol} | ${r.direction} | Entry: $${r.entryPrice} | TP: $${r.takeProfit}${r.stopLoss ? ' | SL: $' + r.stopLoss : ''} | ${status}${ret} | Posted: ${r.createdAt.toISOString().split('T')[0]}`;
      });
      return `This user's own posted trade calls (most recent first):\n${lines2.join('\n')}`;
    } catch (e) {
      return `Failed to fetch user's calls: ${e.message}`;
    }
  }
  return `Unknown tool: ${toolName}`;
};

// ── Full tool-use loop: Claude decides if/when to call tools, we execute
// them server-side, feed results back, and repeat until he gives a final answer.
const callClaude = async (messages, systemPrompt, userId) => {
  const chartRequests = [];
  let convo = [...messages];
  const MAX_ROUNDS = 5;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const parsed = await callClaudeRaw(convo, systemPrompt, CLAUDE_TOOLS);

    if (parsed.stop_reason === 'tool_use') {
      const toolUseBlocks = (parsed.content || []).filter(b => b.type === 'tool_use');
      const textSoFar = (parsed.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n\n');

      convo.push({ role: 'assistant', content: parsed.content });

      const toolResults = [];
      for (const block of toolUseBlocks) {
        const resultText = await executeTool(block.name, block.input || {}, chartRequests, userId);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
      }
      convo.push({ role: 'user', content: toolResults });
      continue;
    }

    const textBlocks = (parsed.content || []).filter(b => b.type === 'text').map(b => b.text);
    return { text: textBlocks.join('\n\n'), charts: chartRequests };
  }

  return { text: 'I had trouble completing that analysis \u2014 please try again.', charts: chartRequests };
};

// ── Fetch candles for chart display ────────────────────────────────
const fetchCandles = (symbol) => new Promise((resolve) => {
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 120 * 24 * 60 * 60;
  const url  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?period1=' + from + '&period2=' + now + '&interval=1d';
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
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
    const preferredLanguage = language === 'ar' ? 'Arabic' : 'English';

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

    // ── Run engine on mentioned stocks ───────────────────────────
    // Always run when a stock symbol is mentioned — regardless of wording
    let symbols = extractSymbols(message || '');
    // Sticky memory: if this message has no ticker, reuse the most recently
    // discussed symbol(s) from earlier in THIS session, so follow-up
    // questions ("what's the news score?") keep working without forcing
    // the user to repeat the ticker every time.
    if (symbols.length === 0 && session.messages && session.messages.length > 0) {
      for (let i = session.messages.length - 1; i >= 0; i--) {
        const m = session.messages[i];
        if (m.role === 'user') {
          const prevSyms = extractSymbols(m.content || '');
          if (prevSyms.length > 0) { symbols = prevSyms; console.log('Chat: sticky symbol memory reused', symbols); break; }
        }
      }
    }
    const needsEngine = symbols.length > 0; // used by community sentiment context below; actual engine data now comes via Claude's own tool calls
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
            line += ` ⚠️ LOPSIDED: ${Math.max(buyPct, sellPct)}% of open calls are on one side — this can indicate a crowded trade. You MUST mention this explicitly and neutrally in your answer as a contrarian consideration, without telling the user what to do about it.`;
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
TRADER PROFILE (personalize ALL advice for this user):
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

    // ── Build session history for Claude (BEFORE adding this message) ──
    // Snapshot the prior turns from the in-memory session; the current user
    // message is appended to the Claude payload separately below.
    const sessionHistory = session.messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }));

    // ── Persist the user's message IMMEDIATELY (resume support) ──────
    // Save the question before the (slow) Claude call so that if the client
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
You are a world-class analyst — think and answer with your own knowledge and reasoning. You also have tools available, and you have COMPLETE freedom to decide if and when any of them help the question in front of you. Use them, combine them, or ignore them — it is entirely your judgment. When you do use one, work its result into your own analysis rather than just repeating it back.

Your tools:
- web_search — for live data and anything current: prices, % changes, breaking news, catalysts, dates.
- get_stock_analysis — the SwingRush "Pro Engine": an objective, quantified swing-trade signal for ONE stock. It runs 8 technical indicators (up to ±14 pts) plus a real Claude AI analysis of that stock's recent news (up to ±10 pts) for a combined score from -24 to +24, and returns direction, confidence, entry/TP/SL, catalysts, risks and confirmed earnings dates. Confidence by |score|: 17-24 Very High, 12-16 High, 8-11 Medium, 4-7 Low, 0-3 no clear signal. It is calibrated for short-to-medium-term swing trades (~1-3 weeks) and is identical for every user (it has no knowledge of anyone's personal position).
- get_market_scan — the SwingRush "Scanner": signals across the whole stock universe, each with a combined score = a technical score + a news score (news is keyword/analyst-based sentiment, not the deep Claude AI news analysis the Pro Engine runs); both sub-scores are shown. For breadth questions (e.g. best setups today, ideas under a given price, strongest buys/sells).
- get_my_calls — this user's own portfolio: the trades they personally posted, with entry, TP/SL and outcome (WIN/LOSS/OPEN).
- show_chart — render a price chart for a symbol (optional timeframe 1d or 1h).

Preferred language: ${preferredLanguage} — reply in it unless the user asks to switch.
${stockContext ? `\nStock the user is currently viewing:\n${stockContext}\n` : ''}
${communityContext}
${profileContext}
Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
Current time right now: ${new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })} (server time) — treat this exact timestamp as "now".`;

    // ── Build messages — use FULL session history ────────────────
    let claudeMessages;
    if (imageBase64) {
      // Message with image
      claudeMessages = [
        ...sessionHistory,
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMimeType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: message || 'Please analyze this chart/image' }
          ]
        }
      ];
    } else {
      claudeMessages = [
        ...sessionHistory,
        { role: 'user', content: message }
      ];
    }

    const claudeResult = await callClaude(claudeMessages, systemPrompt, req.user._id);
    const responseText = claudeResult.text;
    const stockDataList = claudeResult.charts || [];
    // ── Save AI reply to session ──────────────────
    // (User message was already saved above, before the Claude call.)
    // Atomic $push again, so a concurrent request on the same session can't
    // clobber this reply (or vice-versa).
    await ChatSession.updateOne(
      { _id: session._id },
      { $push: { messages: { role: 'ai', content: responseText, time: new Date() } } }
    );
    res.json({ response: responseText, symbols, sessionId: session._id, stockData: stockDataList[0] || null, stockDataList });

  } catch(err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── Save a system-generated AI message directly to a session ──────
// Used when the frontend injects a Pro Engine analysis summary into the
// chat window without an actual Claude round-trip, so it still persists.
router.post('/save-message', protect, async (req, res) => {
  try {
    const { sessionId, content } = req.body;
    if (!content) return res.status(400).json({ message: 'content required' });

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

    session.messages.push({ role: 'ai', content });
    if (session.messages.length === 1) {
      session.title = content.length > 45 ? content.substring(0, 45) + '...' : content;
    }
    await session.save();

    res.json({ sessionId: session._id });
  } catch (err) {
    console.error('save-message error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
