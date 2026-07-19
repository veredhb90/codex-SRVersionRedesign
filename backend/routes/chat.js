const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getEngineRecommendation } = require('../services/yahooFinance');
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

    // ── Check chat limit ─────────────────────────────────────────
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    if (user.plan !== 'pro' && (user.chatUsed || 0) >= 2) {
      return res.status(403).json({
        message: 'You have used your 2 free AI chat messages. Subscribe to SwingRush Pro for unlimited AI!',
        requireSubscription: true,
      });
    }
    if (user.plan !== 'pro') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { chatUsed: 1 } });
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
    const symbols = extractSymbols(message || '');
    let engineResults = '';
    const needsEngine = symbols.length > 0;
    let engineRunResults = []; // kept in outer scope for chart building later
    if (needsEngine) {
      console.log('Chat: running engine for', symbols);
      engineRunResults = await Promise.allSettled(symbols.map(sym => getEngineRecommendation(sym)));
      engineRunResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const e = r.value;
          const sym = symbols[idx];
          let newsSection = `News: ${e.newsLabel || 'N/A'}`;
          if (e.news && e.news.length > 0) {
            newsSection += '\nLinks:\n' + e.news.slice(0,3).map((n, i) =>
              `  ${i+1}. ${n.headline} — ${n.url}`
            ).join('\n');
          }
          engineResults += `
╔══════════════════════════════════════╗
  SWINGRUSH ENGINE: ${sym}
╚══════════════════════════════════════╝
Price: $${e.price} | Change: ${e.changePct >= 0 ? '+' : ''}${e.changePct}%
SIGNAL: ${e.direction} | Score: ${e.score > 0 ? '+' : ''}${e.score}/24 | ${e.confidence} Confidence
Entry: $${e.price} | TP: $${e.takeProfit} | SL: $${e.stopLoss} | R:R 1:${e.riskReward}
Trend: ${e.trend} | 52W position: ${e.rangePct}%
Market: ${e.regime === 'bull' ? '✅ Bull' : '⚠️ Bear'}

INDICATORS:
${(e.signals || []).join('\n')}

${e.analystLabel ? 'ANALYSTS: ' + e.analystLabel : ''}
${newsSection}
`;
        }
      });
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
1. You have FULL access to ALL your knowledge — use it without any restrictions
2. NEVER say "I don't have access", "I cannot browse", "I don't know" — you have vast knowledge, USE IT
3. NEVER say you cannot provide information — always give the best answer possible
4. Use YOUR OWN KNOWLEDGE as priority: company info, CEO, earnings, revenue, debt, news, analysis
5. COMBINE your knowledge + SwingRush Engine + Scanner data for perfect answers
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
- 12 technical indicators + news sentiment + analyst ratings
- Score range: -24 to +24

SCORING:
- ±17-24: Very High confidence
- ±12-16: High confidence  
- ±8-11: Medium confidence
- ±4-7: Low confidence
- 0-3: No clear signal

${stockContext ? `STOCK USER IS VIEWING:\n${stockContext}\n` : ''}
${engineResults ? `\nLIVE ENGINE ANALYSIS:\n${engineResults}` : ''}
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

module.exports = router;
