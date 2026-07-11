const express = require('express');
const router  = express.Router();
const yf      = require('../services/yahooFinance');
const { protect } = require('../middleware/authMiddleware');

// GET /api/stocks/quote/:symbol
router.get('/quote/:symbol', async (req, res) => {
  try {
    const data = await yf.getQuote(decodeURIComponent(req.params.symbol));
    res.json(data);
  } catch (err) { res.status(404).json({ message: err.message }); }
});

// GET /api/stocks/engine/:symbol
router.get('/engine/:symbol', async (req, res) => {
  try {
    const User = require('../models/User');
    const jwt  = require('jsonwebtoken');

    // Check if user is logged in
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Please register or login to use the Signal Engine', requireAuth: true });
    }

    // Decode token
    let userId;
    try {
      const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
      userId = decoded.id;
    } catch(e) {
      return res.status(401).json({ message: 'Session expired. Please login again.', requireAuth: true });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'User not found', requireAuth: true });

    // Check engine limit for free users
    if (!user.isPro() && user.engineUsed >= 1) {
      return res.status(403).json({
        message: 'You have used your free analysis. Subscribe to SwingRush Pro for unlimited access!',
        requireSubscription: true,
        engineUsed: user.engineUsed,
        chatUsed: user.chatUsed,
      });
    }

    // Run engine
    const rec = await yf.getEngineRecommendation(decodeURIComponent(req.params.symbol));

    // Increment usage for free users
    if (!user.isPro()) {
      await User.findByIdAndUpdate(userId, { $inc: { engineUsed: 1 } });
    }

    res.json({ ...rec, engineUsed: user.engineUsed + 1, isPro: user.isPro() });
  } catch (err) { res.status(500).json({ message: 'Engine error: ' + err.message }); }
});

// POST /api/stocks/engine/share — saves to profile ONLY (not feed)
router.post('/engine/share', protect, async (req, res) => {
  try {
    const Recommendation = require('../models/Recommendation');
    const { symbol, entryPrice, takeProfit, stopLoss, direction, note } = req.body;

    if (!symbol||!entryPrice||!takeProfit||!direction)
      return res.status(400).json({ message:'Missing required fields' });
    if (direction==='BUY'  && takeProfit <= entryPrice)
      return res.status(400).json({ message:'Take profit must be above entry for BUY' });
    if (direction==='SELL' && takeProfit >= entryPrice)
      return res.status(400).json({ message:'Take profit must be below entry for SELL' });

    const rec = await Recommendation.create({
      user: req.user._id,
      symbol: symbol.toUpperCase(),
      companyName: symbol.toUpperCase(),
      entryPrice:  Number(entryPrice),
      takeProfit:  Number(takeProfit),
      stopLoss:    stopLoss ? Number(stopLoss) : null,
      direction, note,
      currentPrice: Number(entryPrice),
      source:      'engine',
      profileOnly: true,  // ← PROFILE ONLY — does NOT appear in main feed
    });
    await rec.populate('user','fullName email');
    res.status(201).json(rec);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
