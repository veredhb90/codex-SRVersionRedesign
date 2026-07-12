const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getEngineRecommendation } = require('../services/yahooFinance');
const ChatSession = require('../models/ChatSession');
const https      = require('https');

// ── Extract stock symbols ──────────────────────────────────────────
const extractSymbols = (text) => {
  const matches = text.toUpperCase().match(/\b[A-Z]{2,5}\b/g) || [];
  const SKIP = new Set([
    'THE','AND','FOR','BUY','SELL','NOW','TOP','GET','HOW','WHY','CAN','ARE',
    'YOU','WHAT','WHEN','WILL','DOES','HAS','ITS','SHOULD','WOULD','TELL',
    'ABOUT','STOCK','NEWS','PRICE','TODAY','MARKET','TRADE','SIGNAL','ALL',
    'GIVE','SHOW','LIST','BEST','WITH','FROM','LAST','YEAR','WEEK','THIS',
    'THAT','HAVE','BEEN','THEY','WERE','SAID','EACH','WHICH','THEIR','THAN',
    'RSI','MACD','ADX','EMA','SMA','ATR','CEO','CFO','IPO','ETF','USD',
  ]);
  return [...new Set(matches.filter(s => !SKIP.has(s) && s.length >= 2 && s.length <= 5))].slice(0, 3);
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

// ── GET /api/chat/sessions ─────────────────────────────────────────
router.get('/sessions', protect, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user._id })
      .select('title createdAt updatedAt messages')
      .sort({ updatedAt: -1 })
      .limit(20);
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
    const { message, history = [], stockContext, sessionId } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });

    // ── Check chat limit ─────────────────────────────────────────
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    console.log('CHAT LIMIT CHECK - user:', user.email, 'plan:', user.plan, 'chatUsed:', user.chatUsed);
    console.log('CHAT LIMIT CHECK - user:', user.email, 'plan:', user.plan, 'chatUsed:', user.chatUsed);
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
    let session;
    if (sessionId) {
      try { session = await ChatSession.findOne({ _id: sessionId, user: req.user._id }); } catch(e) {}
    }
    if (!session) {
      const recent = await ChatSession.findOne({
        user: req.user._id,
        updatedAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
      }).sort({ updatedAt: -1 });
      session = recent || await ChatSession.create({ user: req.user._id, title: 'New Chat', messages: [] });
    }

    // ── Run engine on mentioned stocks ───────────────────────────
    const symbols = extractSymbols(message);
    let engineResults = '';
    if (symbols.length > 0) {
      console.log('Chat: analyzing', symbols);
      const results = await Promise.allSettled(symbols.map(sym => getEngineRecommendation(sym, { skipNews: false })));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const e = r.value;
          const sym = symbols[idx];
          let newsSection = `News sentiment: ${e.newsLabel || 'N/A'}`;
          if (e.news && e.news.length > 0) {
            newsSection += '\nRecent news:\n' + e.news.map((n, i) =>
              `  ${i+1}. [${n.sentiment === 'positive' ? '▲' : n.sentiment === 'negative' ? '▼' : '●'}] ${n.headline} — ${n.url}`
            ).join('\n');
          }
          engineResults += `
╔══════════════════════════════════════╗
  SWINGRUSH ENGINE: ${sym}
╚══════════════════════════════════════╝
Price: $${e.price} (${e.changePct >= 0 ? '+' : ''}${e.changePct}% today)
SIGNAL: ${e.direction} | Score: ${e.score > 0 ? '+' : ''}${e.score}/24 | Confidence: ${e.confidence}
Entry: $${e.price} | Take Profit: $${e.takeProfit} | Stop Loss: $${e.stopLoss}
Risk/Reward: 1:${e.riskReward} | Est. time to TP: ${e.timeframe || 'N/A'}
52W position: ${e.rangePct}% | Trend: ${e.trend}
Market: ${e.regime === 'bull' ? '✅ Bull (SPY above 50MA)' : '⚠️ Bear (SPY below 50MA)'}
${e.noSignal ? '⚠️ NO CLEAR SIGNAL: ' + e.noSignalReason : ''}

ALL 12 INDICATORS:
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
  FULL SWINGRUSH SCANNER DATA
  ${doc.scannedCount} stocks scanned | ${all.length} with signals
╚══════════════════════════════════════╝

ALL BUY SIGNALS (sorted by score):
${buys.map((r, i) => `${i+1}. ${r.symbol}: +${r.score} | $${r.price} | TP:$${r.takeProfit} | SL:$${r.stopLoss} | ${r.confidence}`).join('\n')}

ALL SELL SIGNALS:
${sells.map((r, i) => `${i+1}. ${r.symbol}: ${r.score} | $${r.price} | TP:$${r.takeProfit} | SL:$${r.stopLoss} | ${r.confidence}`).join('\n')}

BY PRICE RANGE (BUY signals):
UNDER $20: ${buys.filter(r => r.price < 20).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
$20-$50:   ${buys.filter(r => r.price >= 20 && r.price < 50).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
$50-$100:  ${buys.filter(r => r.price >= 50 && r.price < 100).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
OVER $100: ${buys.filter(r => r.price >= 100).map(r => `${r.symbol}:+${r.score}($${r.price})`).join(', ') || 'None'}
`;
      }
    } catch(e) { console.log('Scanner error:', e.message); }

    // ── Trader profile ───────────────────────────────────────────
    let profileContext = '';
    if (user.traderProfile && user.traderProfile.onboardingDone) {
      const p = user.traderProfile;
      profileContext = `
TRADER PROFILE — personalize ALL advice based on this:
- Age: ${p.age || 'N/A'} | Investment: ${p.investmentAmount || 'N/A'}
- Style: ${p.tradingStyle === 'day' ? 'Day Trader' : p.tradingStyle === 'swing' ? 'Swing Trader' : p.tradingStyle === 'longterm' ? 'Long-Term Investor' : 'N/A'}
- Experience: ${p.experience || 'N/A'} | Risk: ${p.riskTolerance || 'N/A'}
- Goals: ${p.goals || 'N/A'}
`;
    }

    // ── System prompt ────────────────────────────────────────────
    const systemPrompt = `You are SwingRush AI — a professional trading analyst and assistant for the SwingRush platform.

YOU ARE AN EXPERT WITH TWO POWERFUL SOURCES:
1. YOUR OWN VAST KNOWLEDGE (Claude) — use freely for EVERYTHING:
   - Full company analysis, business model, competitive position
   - Financial history: revenue, profit, debt, earnings reports, guidance
   - CEO, management team, major shareholders
   - Industry trends, macro factors, catalysts
   - News from any source, in any language
   - Arabic sources: argaam.com, mubasher.info, cnbcarabia.com, bloomberg.com/arabic
   - Technical analysis education, trading strategies
   - Risk factors, bear/bull case

2. SWINGRUSH ENGINE DATA (real-time, provided below)
   - Live price, signal, score, TP/SL for specific stocks
   - Full scanner results for ALL stocks

HOW TO ANSWER:
- When asked about a stock (e.g. "Tell me about MDB"):
  → Start with SwingRush signal (from engine data below)
  → Then add your knowledge: what the company does, last earnings, revenue trend, debt, key risks, catalysts, CEO
  → Give a COMPLETE professional analysis
  
- When asked "best stocks under $X" or "all stocks with score above X":
  → Use the scanner data below — it has ALL stocks with prices and scores
  → Filter and list them clearly
  
- When asked about news:
  → Provide links from engine data + add your own knowledge about recent events
  
- NEVER say "I cannot", "I don't have access", "I only see top 5"
  → You have COMPLETE scanner data below
  → You have your own knowledge for everything else

SCORING SYSTEM:
- Range: -24 to +24 (NOT -12 to +12)
- RSI:±3, EMA:±2, MACD:±2, Bollinger:±2, ADX:±2, Stoch:±2, Williams:±1, ROC:±1, 50MA:±1, Volume:±1, Multi-TF:±2, News:±3, Analysts:±2
- Confidence: ±4-7=Low, ±8-11=Medium, ±12-16=High, ±17-24=Very High

RESPONSE FORMAT:
- Be comprehensive and professional
- Use clear sections with headers
- Include both technical (engine) and fundamental (your knowledge)
- Always add risk disclaimer at end
- Respond in user's language (Arabic/Hebrew/English)
- For Arabic users: include Arabic financial site links

${stockContext ? `CURRENT STOCK USER IS VIEWING:\n${stockContext}\n` : ''}
${engineResults ? `\nLIVE ENGINE ANALYSIS:\n${engineResults}` : ''}
${scannerContext}
${profileContext}
Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`;

    // ── Build messages ───────────────────────────────────────────
    const claudeMessages = [
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const response = await callClaude(claudeMessages, systemPrompt);

    // ── Save to session ──────────────────────────────────────────
    session.messages.push({ role: 'user', content: message });
    session.messages.push({ role: 'ai', content: response });
    if (session.messages.length <= 2) {
      session.title = message.length > 45 ? message.substring(0, 45) + '...' : message;
    }
    await session.save();

    res.json({ response, symbols, sessionId: session._id });

  } catch(err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
