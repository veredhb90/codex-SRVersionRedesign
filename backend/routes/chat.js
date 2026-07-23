const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getEngineRecommendation } = require('../services/yahooFinance');
const { getProTechnicalScore } = require('../services/proEngine');
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
const callClaude = (messages, systemPrompt) => new Promise((resolve, reject) => {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
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
        // Response may contain multiple blocks (text + tool_use + tool_result + more text)
        // when web_search was used. Join all text blocks into one final answer.
        const textBlocks = (parsed.content || []).filter(b => b.type === 'text').map(b => b.text);
        resolve(textBlocks.join('\n\n'));
      } catch(e) { reject(e); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

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
    const { message, history = [], stockContext, sessionId, imageBase64, imageMimeType } = req.body;
    if (!message && !imageBase64) return res.status(400).json({ message: 'Message required' });

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
    let engineResults = '';
    const needsEngine = symbols.length > 0;
    let engineRunResults = []; // kept in outer scope for chart building later
    if (needsEngine) {
      console.log('Chat: running PRO engine for', symbols);
      const proResults = await Promise.allSettled(symbols.map(async (sym) => {
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
          newsScore: newsA.score, newsLabel: newsA.label, newsSummary: newsA.summary,
          catalysts: newsA.catalysts || [], risks: newsA.risks || [],
          analystSummary: newsA.analystSummary || '',
          holdingPeriod: newsA.holdingPeriod || '',
          upcomingEarnings: newsA.upcomingEarnings || [],
          priceHistory: tech.candles || [],
          news: [],
        };
      }));

      engineRunResults = proResults.map(r => {
        if (r.status === 'fulfilled' && r.value) return { status: 'fulfilled', value: r.value };
        return { status: 'rejected' };
      });

      engineRunResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const e = r.value;
          const sym = symbols[idx];
          const breakdownText = (e.technicalBreakdown || []).map(b => `  ${b.indicator}: ${b.points > 0 ? '+' : ''}${b.points} (${b.note})`).join('\n');
          const catalystsText = (e.catalysts || []).length ? e.catalysts.map(c => `  \u2022 ${c}`).join('\n') : '  None identified';
          const risksText = (e.risks || []).length ? e.risks.map(r2 => `  \u2022 ${r2}`).join('\n') : '  None identified';
          engineResults += `
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
  SWINGRUSH PRO ENGINE: ${sym}
\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d
${e.marketState === 'Pre-Market' || e.marketState === 'After-Hours' ? 'Regular Session Close: $' + e.regularSessionPrice + ' | Current ' + e.marketState + ' Price: $' + e.price + ' (freshest, use this for analysis)' : 'Price: $' + e.price} | Change: ${e.changePct >= 0 ? '+' : ''}${e.changePct}%
SIGNAL: ${e.direction} | Combined Score: ${e.score > 0 ? '+' : ''}${e.score}/24 | ${e.confidence} Confidence
${e.takeProfit ? `Entry: $${e.price} | TP: $${e.takeProfit} | SL: $${e.stopLoss} | R:R 1:${e.riskReward}` : 'No trade setup \u2014 score below conviction threshold'}
TECHNICAL BREAKDOWN (${e.technicalScore} pts):
${breakdownText}
AI NEWS ANALYSIS (${e.newsScore > 0 ? '+' : ''}${e.newsScore} pts) \u2014 ${e.newsLabel}:
${e.newsSummary}
CATALYSTS:
${catalystsText}
RISKS:
${risksText}
${e.analystSummary ? 'ANALYST CONSENSUS: ' + e.analystSummary : ''}
${e.holdingPeriod ? 'RECOMMENDED HOLDING PERIOD: ' + e.holdingPeriod : ''}
${e.upcomingEarnings && e.upcomingEarnings.length ? 'UPCOMING EARNINGS (confirmed dates - cite these exactly, never guess other dates): ' + e.upcomingEarnings.map(x => x.date + ' (Q' + x.quarter + ' FY' + x.year + ', ' + x.hour + ')').join('; ') : 'No confirmed upcoming earnings date in the calendar.'}
RAW DAILY PRICE HISTORY (last 30 trading days, oldest to newest — use this to answer ANY historical question yourself: yesterday's change, N days ago, week-over-week, any date range, trend over any period, etc. Calculate percentages yourself from these real closes, never guess or estimate):
${(e.priceHistory || []).slice(-30).map(c => {
  const d = new Date(c.time * 1000);
  return d.toISOString().split('T')[0] + ': close $' + c.close.toFixed(2) + ' (open $' + c.open.toFixed(2) + ', high $' + c.high.toFixed(2) + ', low $' + c.low.toFixed(2) + ')';
}).join('\n')}
`;
        }
      });
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

    // ── Full scanner data ────────────────────────────────────────
    let scannerContext = '';
    try {
      const mongoose = require('mongoose');
      const ScanResult = mongoose.models.ScanResult ||
        mongoose.model('ScanResult', new mongoose.Schema({ results: Array, top5: Array, scannedCount: Number }, { strict: false }));
      const doc = await ScanResult.findOne({ key: 'latest' });
      if (doc && doc.results && doc.results.length > 0) {
        const all = [...doc.results].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
        const buys  = all.filter(r => r.direction === 'BUY');
        const sells = all.filter(r => r.direction === 'SELL');

        scannerContext = `
╔══════════════════════════════════════╗
  SWINGRUSH FULL SCANNER (${doc.scannedCount} stocks scanned)
  Last updated: ${new Date(doc.scannedAt).toLocaleString()}
╚══════════════════════════════════════╝

ALL BUY SIGNALS (${buys.length} stocks):
${buys.map((r, i) => `${i+1}. ${r.symbol}: +${r.score} | $${r.price} | TP:$${r.takeProfit} | SL:$${r.stopLoss} | ${r.confidence}`).join('\n')}

ALL SELL SIGNALS (${sells.length} stocks):
${sells.map((r, i) => `${i+1}. ${r.symbol}: ${r.score} | $${r.price} | TP:$${r.takeProfit} | SL:$${r.stopLoss} | ${r.confidence}`).join('\n')}

BY PRICE (BUY signals):
UNDER $20:  ${buys.filter(r => r.price < 20).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
$20-$50:    ${buys.filter(r => r.price >= 20 && r.price < 50).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
$50-$100:   ${buys.filter(r => r.price >= 50 && r.price < 100).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
OVER $100:  ${buys.filter(r => r.price >= 100).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
`;
      }
    } catch(e) { console.log('Scanner error:', e.message); }

    // ── Trader profile ───────────────────────────────────────────
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

    // ── Build full session history for Claude ────────────────────
    // Use ALL messages from DB session so Claude never forgets
    const sessionHistory = session.messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }));

    // ── System prompt ────────────────────────────────────────────
    const systemPrompt = `You are SwingRush AI — a professional trading analyst with COMPLETE access to SwingRush platform data.

CRITICAL RULES — NEVER BREAK THESE:
0. GOLDEN RULE — EVERY answer MUST combine BOTH sources: (a) YOUR OWN deep knowledge — macro trends, Fed policy, rates, earnings seasons, sector rotation, company fundamentals, market history — AND (b) engine/scanner data when available. NEVER answer from engine or scanner numbers alone. Example: "is the market bullish or bearish?" REQUIRES your own macro analysis (economy, rates, sentiment, catalysts, seasonality) layered ON TOP of scanner statistics. The scanner tells WHAT is moving — YOUR knowledge explains WHY and what it means for the trader. An answer that only recites engine/scanner data is a FAILED answer.
0.5. DATA PRIORITY — NEVER MIX SCORING SYSTEMS, NEVER SAY \"SIGNAL ENGINE\": You are the SwingRush Pro AI Analyst. Every user talking to you is a Pro member using the Pro Engine — NEVER use the phrase \"Signal Engine\" anywhere in your responses, even if referenced internally below. If a symbol has a LIVE ENGINE ANALYSIS block above, that block is the ONLY authoritative score/direction/confidence for that symbol — call it \"the Pro Engine\" or \"my analysis\", never anything else. The FULL SCANNER block below is broad market scan data covering many stocks (a DIFFERENT, general-purpose dataset) and may show a DIFFERENT number for the same symbol than your Pro Engine analysis — this is expected and NOT an error; refer to it only as \"the market scanner\" or \"broader scan data\", NEVER as \"Signal Engine\". If a symbol appears in both, ALWAYS use the LIVE ENGINE ANALYSIS (Pro Engine) number and NEVER mention or compare it to the scanner's number for that same symbol unless the user explicitly asks about the difference. Use the FULL SCANNER data only for broad questions like \"best stocks today\" or \"stocks under $X\" where no single symbol's Pro Engine data applies.
0.6. ALWAYS SHOW THE SCORE BREAKDOWN: Whenever a LIVE ENGINE ANALYSIS block is present for a symbol, your FIRST response about that symbol MUST explicitly state, in this exact order: (1) Technical score, (2) News/AI score, (3) Combined total score, (4) Confidence level. Never bury or omit this breakdown, and never make the user ask for it separately — show it automatically every time, formatted clearly (e.g. a small table or bolded line). This applies to every analysis response, not just when explicitly asked.
0.7. THE PRO ENGINE IS UNIVERSAL, NOT PERSONALIZED \u2014 NEVER CLAIM OTHERWISE: The Pro Engine's score, direction, confidence, TP, and SL for a symbol are OBJECTIVE and IDENTICAL for every user who asks \u2014 computed once from technical indicators and news, with zero awareness of any individual user's entry price, position size, or personal trade. NEVER say things like \"I gave SELL because I factored in your position at $X\" or \"the engine considered your situation\" \u2014 this is FALSE and misleads the user about how the system works. If the engine's direction conflicts with something the user mentioned (like high analyst BUY consensus, or their own entry price), explain the conflict using ONLY real engine logic (e.g. \"the engine is technical/news-driven and doesn't weigh analyst ratings as heavily as X and Y indicators\") \u2014 NEVER invent a personalization mechanism that does not exist. Structure every analysis in TWO CLEAR PARTS: FIRST give the general, objective Pro Engine result (same for any user) \u2014 direction, score breakdown, TP/SL, reasoning. THEN, and only if relevant, add a separate clearly-labeled section (e.g. \"For your specific position:\") using the user's trader profile and prior messages in this conversation to give personalized context \u2014 but always frame this as YOUR OWN added advice layered on top, never as something the engine itself calculated.
0.8. IDENTIFY THE TIME HORIZON BEFORE CHOOSING YOUR DATA SOURCE: The Pro Engine and market scanner are calibrated for SHORT-TO-MEDIUM-TERM swing trades (roughly 1-3 weeks) \u2014 they are NOT relevant to every question just because a stock or investing is mentioned. Before answering, identify what timeframe the user actually means: (a) SHORT-TERM (days to a few weeks, \"should I buy now\", \"what's a good swing trade\") \u2014 the Pro Engine/scanner IS the right primary basis, use it as usual. (b) LONGER-TERM (months, \"half a year\", \"a year\", \"long-term investment\", retirement, general portfolio questions) \u2014 the Pro Engine's short-term technical signal is NOT the right basis for this answer. In this case, answer primarily from YOUR OWN fundamental/macro knowledge (business quality, growth, sector trends, valuation, diversification, risk) exactly as a knowledgeable analyst would with no engine at all, and only mention the Pro Engine/scanner as a brief aside noting it's calibrated for a shorter timeframe and not directly applicable. NEVER present short-term technical scanner results as if they answer a long-term investment question \u2014 that misleads the user. When genuinely unsure of the user's intended timeframe, ask a brief clarifying question rather than assuming.
1. You have FULL access to ALL your knowledge — use it without any restrictions
2. NEVER say "I don't have access", "I cannot browse", "I don't know" — you have vast knowledge, USE IT
3. NEVER say you cannot provide information — always give the best answer possible
4. Use YOUR OWN KNOWLEDGE as priority: company info, CEO, earnings, revenue, debt, news, analysis
5. COMBINE your knowledge + Pro Engine data + market scanner data for perfect answers
6. When asked about a stock → run engine analysis + add your own deep knowledge
7. When asked "best stocks under $X" → use scanner price-filtered data below
8. Respond in SAME LANGUAGE as user (English/Hebrew/Arabic)
9. For Arabic users → include Arabic financial sites: argaam.com, mubasher.info, cnbcarabia.com
10. ALWAYS be consistent — remember what you said earlier in this conversation
11. YOU ARE THE LEAD ANALYST: If your own analysis DISAGREES with the engine signal — say so openly and explain why
12. Your knowledge of news, fundamentals, and market context can OVERRIDE or ADJUST the engine's technical signal
13. Always give YOUR final combined recommendation — engine technicals + your fundamental knowledge = the best answer
14. Think like a professional analyst: engine gives the technical picture, YOU add fundamentals, news context, risks, and final judgment

RESPONSE FORMAT for stock analysis (use clean markdown — it renders beautifully in the chat):
## 📊 Technical Picture
Brief summary + indicator table: | Indicator | Reading | Signal |
## 📰 Fundamentals & News
Your knowledge: business health, earnings, catalysts + latest news highlights
## 🎯 My Recommendation
Final combined judgment: **Entry** / **TP** / **SL**, key risks, confidence level
Keep sections concise and scannable. Bold the key numbers. For simple/casual questions answer naturally WITHOUT this structure.

YOUR KNOWLEDGE INCLUDES (use freely):
- Every company: business model, revenue, profit, debt, growth
- CEOs, management, major shareholders
- Earnings reports, guidance, analyst ratings
- Industry trends, competitors, market position
- Technical analysis: all indicators, patterns, strategies
- Macro economics, Fed policy, sector rotation
- News and events up to mid-2025

SWINGHRUSH ENGINE (real-time data below):
- Live prices, signals, scores for mentioned stocks
- Pro Engine: 8 technical indicators (up to 14 pts) + AI-powered news analysis by Claude (up to 10 pts) = combined score up to ±24
- Score range: -24 to +24

SCORING:
- ±17-24: Very High confidence
- ±12-16: High confidence  
- ±8-11: Medium confidence
- ±4-7: Low confidence
- 0-3: No clear signal

${stockContext ? `STOCK USER IS VIEWING:\n${stockContext}\n` : ''}
${engineResults ? `\nLIVE ENGINE ANALYSIS:\n${engineResults}` : ''}
${communityContext}
${scannerContext}
${profileContext}
Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
Current time right now: ${new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })} (server time)
CRITICAL: always use this exact date/time above as "now" — never guess, never use an old or cached date, never assume market hours without checking this timestamp.`;

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

    const response = await callClaude(claudeMessages, systemPrompt);

    // ── Save to session ──────────────────────────────────────────
    session.messages.push({ role: 'user', content: message || 'Image uploaded' });
    session.messages.push({ role: 'ai', content: response });
    if (session.messages.length <= 2) {
      session.title = (message || 'Image analysis').length > 45 
        ? (message || 'Image analysis').substring(0, 45) + '...' 
        : (message || 'Image analysis');
    }
    await session.save();

    // Build chart data for frontend — supports multiple stocks (comparisons)
    let stockDataList = [];
    if (needsEngine && symbols.length > 0) {
      for (let i = 0; i < symbols.length; i++) {
        const sym = symbols[i];
        const engineResult = engineRunResults[i] && engineRunResults[i].status === 'fulfilled' ? engineRunResults[i].value : null;
        if (!engineResult) continue;
        const candles = await fetchCandles(sym);
        if (candles && candles.length > 10) {
          stockDataList.push({
            symbol:     sym,
            price:      engineResult.price,
            direction:  engineResult.direction,
            score:      engineResult.score,
            confidence: engineResult.confidence,
            takeProfit: engineResult.takeProfit,
            stopLoss:   engineResult.stopLoss,
            news:       (engineResult.news || []).slice(0, 3),
            candles:    candles,
          });
        }
      }
    }

    res.json({ response, symbols, sessionId: session._id, stockData: stockDataList[0] || null, stockDataList });

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
