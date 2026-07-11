const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getEngineRecommendation } = require('../services/yahooFinance');
const https = require('https');

// Extract stock symbols from message
const extractSymbols = (text) => {
  const matches = text.toUpperCase().match(/\b[A-Z]{2,5}\b/g) || [];
  const SKIP = new Set([
    'THE','AND','FOR','BUY','SELL','NOW','TOP','GET','HOW','WHY','CAN','ARE',
    'YOU','WHAT','WHEN','WILL','DOES','HAS','ITS','SHOULD','WOULD','TELL',
    'ABOUT','STOCK','NEWS','PRICE','TODAY','MARKET','TRADE','SIGNAL','WHAT',
    'MOVING','AVERAGE','MEAN','RSI','MACD','ADX','EMA','SMA','WHO','CEO',
    'THIS','THAT','WITH','FROM','THEY','HAVE','LAST','WEEK','MONTH','YEAR',
    'GIVE','SHOW','LIST','BEST','MOST','SOME','ALSO','LIKE','JUST','VERY',
    'GOOD','MAKE','INTO','THEN','THAN','BEEN','WERE','SAID','EACH','WHICH',
  ]);
  return [...new Set(matches.filter(s => !SKIP.has(s) && s.length >= 2 && s.length <= 5))].slice(0, 3);
};

const callClaude = (messages, systemPrompt) => new Promise((resolve, reject) => {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
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

router.post('/', protect, async (req, res) => {
  try {
    const { message, history = [], stockContext } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });

    // Check chat limit for free users
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    if (!user.isPro() && user.chatUsed >= 2) {
      return res.status(403).json({
        message: 'You have used your 2 free AI chat messages. Subscribe to SwingRush Pro for unlimited AI trading assistant!',
        requireSubscription: true,
        chatUsed: user.chatUsed,
      });
    }

    // Increment chat usage for free users
    if (!user.isPro()) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { chatUsed: 1 } });
    }

    // Auto-detect stock symbols and run full engine
    const symbols = extractSymbols(message);
    let engineResults = '';

    if (symbols.length > 0) {
      console.log('Chat: analyzing symbols:', symbols);
      const results = await Promise.allSettled(
        symbols.map(sym => getEngineRecommendation(sym, { skipNews: false }))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          const e = r.value;
          const sym = symbols[idx];

          // Full news with headlines and links
          let newsSection = `News sentiment: ${e.newsLabel || 'N/A'}`;
          if (e.news && e.news.length > 0) {
            newsSection += '\nLatest news articles:\n' + e.news.map((n, i) =>
              `  ${i+1}. [${n.sentiment === 'positive' ? '▲ Positive' : n.sentiment === 'negative' ? '▼ Negative' : '● Neutral'}] ${n.headline}\n     Source: ${n.source || 'Unknown'} | Link: ${n.url || 'N/A'}`
            ).join('\n');
          }

          // All signals
          const allSignals = (e.signals || []).join('\n  - ');

          engineResults += `
═══════════════════════════════════
📊 ${sym} — FULL ENGINE ANALYSIS
═══════════════════════════════════
PRICE & SIGNAL:
- Current Price: $${e.price} (${e.change >= 0 ? '+' : ''}${e.changePct}% today)
- Signal: ${e.direction} | Score: ${e.score > 0 ? '+' : ''}${e.score}/24 | Confidence: ${e.confidence}
- Entry: $${e.price} | Take Profit: $${e.takeProfit} | Stop Loss: $${e.stopLoss}
- Risk/Reward: 1:${e.riskReward} | Est. time to TP: ${e.timeframe || 'N/A'}
- 52W position: ${e.rangePct}% | Trend: ${e.trend}
- Market: ${e.regime === 'bull' ? '✅ Bull market (SPY above 50MA)' : '⚠️ Bear market (SPY below 50MA)'}
${e.noSignal ? '⚠️ NO SIGNAL: ' + e.noSignalReason : ''}

TECHNICAL INDICATORS (all 12):
  - ${allSignals}

${e.analystLabel ? 'ANALYST CONSENSUS:\n- ' + e.analystLabel : ''}

${newsSection}
═══════════════════════════════════
`;
        }
      });
    }

    // Get scanner top results
    let scannerContext = '';
    try {
      const mongoose = require('mongoose');
      const ScanResult = mongoose.models.ScanResult ||
        mongoose.model('ScanResult', new mongoose.Schema({ top5: Array, scannedCount: Number }, { strict: false }));
      const doc = await ScanResult.findOne({ key: 'latest' });
      if (doc && doc.top5 && doc.top5.length > 0) {
        scannerContext = `\n🏆 SCANNER TOP STOCKS (${doc.scannedCount} stocks scanned):\n` +
          doc.top5.slice(0, 10).map((r, i) =>
            `${i+1}. ${r.symbol}: ${r.direction} | Score: ${r.score > 0 ? '+' : ''}${r.score} | $${r.price} | TP: $${r.takeProfit} | SL: $${r.stopLoss} | ${r.confidence}`
          ).join('\n');
      }
    } catch(e) {}

    const systemPrompt = `You are SwingRush AI — the expert trading assistant of SwingRush, a financial recommendation platform.

YOU HAVE TWO SOURCES OF KNOWLEDGE:
1. OUR ENGINE DATA — real-time analysis provided below (always use this for signals, scores, TP/SL)
2. YOUR OWN KNOWLEDGE — use freely for: company info, CEO, earnings history, sector analysis, indicator explanations, trading education, market context, anything not in engine data

SCORING SYSTEM (CRITICAL — never say the range is ±12):
- Total range: -24 to +24
- RSI: ±3 | EMA: ±2 | MACD: ±2 | Bollinger: ±2 | ADX: ±2 | Stochastic: ±2
- Williams %R: ±1 | ROC: ±1 | 50MA: ±1 | Volume: ±1 | Multi-TF: ±2
- News: ±3 | Analysts: ±2 | TOTAL: ±24
- Confidence: ±4-7=Low | ±8-11=Medium | ±12-16=High | ±17-24=Very High

RULES:
1. When user asks about a stock signal/score → use engine data below
2. When user asks for news → provide headlines AND clickable links from engine data
3. When user asks about CEO, earnings, company history → use your own knowledge freely
4. When user asks about indicators (RSI, MACD etc.) → explain clearly in simple terms
5. Respond in the SAME LANGUAGE as the user (Hebrew=Hebrew, Arabic=Arabic)
6. Be concise but complete — include links when available
7. Add ⚠️ Educational purposes only, not financial advice

${engineResults ? `\n${engineResults}` : ''}
${stockContext ? `\nCURRENT STOCK (user is viewing):\n${stockContext}` : ''}
${scannerContext}

Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`;

    const claudeMessages = [
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const response = await callClaude(claudeMessages, systemPrompt);
    res.json({ response, symbols });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
