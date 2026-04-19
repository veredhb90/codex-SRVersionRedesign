const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTop5, runFullScan, UNIVERSE } = require('../services/stockScanner');

// GET /api/scanner/top5 — returns instantly from DB
router.get('/top5', protect, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await getTop5(forceRefresh);
    res.json(result);
  } catch (err) {
    console.error('Scanner error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/scanner/status — check if scan is running
router.get('/status', protect, async (req, res) => {
  try {
    const result = await getTop5(false);
    res.json({
      scanning:     result.scanning,
      scannedAt:    result.scannedAt,
      scannedCount: result.scannedCount,
      universeSize: UNIVERSE.length,
      stale:        result.stale,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
