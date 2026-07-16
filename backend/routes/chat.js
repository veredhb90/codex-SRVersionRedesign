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
    'NEW','OLD','HIGH','LOW','OPEN','CLOSE','GOOD','BAD','MORE','LESS',
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
    const symbols = extractSymbols(message || '');
    let engineResults = '';
    const needsEngine = symbols.length > 0 && /analyz|signal|buy|sell|score|recommend|think|should|target|stop|tp|sl|price|chart/i.test(message || '');
    if (needsEngine) {
      console.log('Chat: running engine for', symbols);
      const results = await Promise.allSettled(symbols.map(sym => getEngineRecommendation(sym)));
      results.forEach((r, idx) => {
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
1. You have FULL access to ALL your knowledge — use it without any restrictions
2. NEVER say "I don't have access", "I cannot browse", "I don't know" — you have vast knowledge, USE IT
3. NEVER say you cannot provide information — always give the best answer possible
4. Use YOUR OWN KNOWLEDGE as priority: company info, CEO, earnings, revenue, debt, news, analysis
5. COMBINE your knowledge + SwingRush Engine + Scanner data for perfect answers
6. When asked about a stock → engine data below + add your own deep knowledge
7. When asked "best stocks under $X" → use scanner price-filtered data below
8. Respond in SAME LANGUAGE as user (English/Hebrew/Arabic)
9. For Arabic users → include Arabic financial sites: argaam.com, mubasher.info, cnbcarabia.com
10. ALWAYS be consistent — remember what you said earlier in this conversation
11. YOU ARE THE LEAD ANALYST: If your own analysis DISAGREES with the engine signal — say so openly!
    Example: "The engine shows BUY +8, but based on my knowledge of the company's debt situation and recent earnings miss, I'd be more cautious. Here's my combined view..."
12. Your knowledge of news, fundamentals, and market context can OVERRIDE or ADJUST the engine's technical signal
13. Always give YOUR final combined recommendation — engine technicals + your fundamental knowledge = the best answer
14. Think like a professional analyst: engine gives the technical picture, YOU add fundamentals, news context, risks, and final judgment

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
Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`;

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

    res.json({ response, symbols, sessionId: session._id });

  } catch(err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
