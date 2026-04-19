const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTop5, getTop5Quick } = require('../services/stockScanner');

// GET /api/scanner/top5 — full 200 stock scan (cached 30min)
router.get('/top5', protect, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await getTop5Quick(forceRefresh); // use quick for speed
    res.json(result);
  } catch (err) {
    console.error('Scanner error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/scanner/top5/full — full 200 stock scan
router.get('/top5/full', protect, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await getTop5(forceRefresh);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
