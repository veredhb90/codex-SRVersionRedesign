// ═══════════════════════════════════════════════════════════════════
// PRO ENGINE ROUTE — GET /api/pro-engine/:symbol
// Combines standalone technical score + real Claude news analysis.
// Protected + Pro-only. Does not touch the existing Signal Engine
// or Scanner routes/services in any way.
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePro } = require('../middleware/requirePro');
const { getProTechnicalScore } = require('../services/proEngine');
const { getClaudeNewsAnalysis } = require('../services/claudeNewsAnalysis');

const getConfidence = (absScore) => {
  if (absScore >= 17) return 'Very High';
  if (absScore >= 12) return 'High';
  if (absScore >= 8)  return 'Medium';
  if (absScore >= 4)  return 'Low';
  return 'Very Low';
};

// GET /api/pro-engine/:symbol
router.get('/:symbol', protect, requirePro, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();

    const [technical, newsAnalysis] = await Promise.all([
      getProTechnicalScore(symbol),
      getClaudeNewsAnalysis(symbol),
    ]);

    if (technical.insufficientData) {
      return res.status(200).json({
        symbol, insufficientData: true,
        message: 'Not enough price history for this symbol yet.',
      });
    }

    // Combine: technical score + Claude's news score (news is -5 to +5, separate scale, added directly)
    const combinedScore = technical.score + newsAnalysis.score;
    const absScore = Math.abs(combinedScore);

    // Same rule as the free Signal Engine: need at least 4 points of conviction to call a direction
    const MIN_SCORE = 4;
    const hasSignal = absScore >= MIN_SCORE;
    const direction = !hasSignal ? 'NEUTRAL' : (combinedScore > 0 ? 'BUY' : 'SELL');
    const confidence = hasSignal ? getConfidence(absScore) : 'Insufficient';

    // Same ATR-based TP/SL formula as the free engine, for consistency
    const tpMult = absScore >= 12 ? 4.5 : absScore >= 8 ? 3.5 : absScore >= 5 ? 2.5 : 2.0;
    const slMult = 1.5;
    const realAtr = technical.realAtr || (technical.price * 0.02);

    let takeProfit = null, stopLoss = null, riskReward = null;
    if (direction !== 'NEUTRAL') {
      takeProfit = direction === 'BUY'
        ? +(technical.price + realAtr * tpMult).toFixed(2)
        : +(technical.price - realAtr * tpMult).toFixed(2);
      stopLoss = direction === 'BUY'
        ? +(technical.price - realAtr * slMult).toFixed(2)
        : +(technical.price + realAtr * slMult).toFixed(2);
      riskReward = +((Math.abs(takeProfit - technical.price) / Math.abs(stopLoss - technical.price)).toFixed(2));
    }

    res.json({
      symbol,
      name: technical.name,
      price: technical.price,
      regularSessionPrice: technical.regularSessionPrice || technical.price,
      changePct: technical.changePct,
      marketState: technical.marketState || 'Regular Session',

      // Combined result
      score: combinedScore,
      direction,
      confidence,
      takeProfit,
      stopLoss,
      riskReward,

      // Breakdown for transparency
      technicalScore: technical.score,
      technicalSignals: technical.signals,
      technicalBreakdown: technical.breakdown,
      newsScore: newsAnalysis.score,
      newsLabel: newsAnalysis.label,
      newsSummary: newsAnalysis.summary,
      newsReasoning: newsAnalysis.reasoning || '',
      catalysts: newsAnalysis.catalysts,
      risks: newsAnalysis.risks,
      analystSummary: newsAnalysis.analystSummary,
      articleCount: newsAnalysis.articleCount,
      holdingPeriod: newsAnalysis.holdingPeriod || '',
      upcomingEarnings: newsAnalysis.upcomingEarnings || [],
      newsFromCache: newsAnalysis.fromCache,
    });
  } catch (err) {
    console.log('Pro engine error:', err.message);
    res.status(500).json({ message: 'Pro engine analysis failed: ' + err.message });
  }
});

module.exports = router;
