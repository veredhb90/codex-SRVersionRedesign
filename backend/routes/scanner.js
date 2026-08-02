const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTop5, SCAN_SIZE } = require('../services/stockScanner');

// GET /api/scanner/top5 — returns instantly from DB
router.get('/top5', async (req, res) => {
  try {
    // This endpoint is read-only for users. Scheduled server jobs own refreshes.
    const result = await getTop5();
    res.json(result);
  } catch (err) {
    console.error('Scanner error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/scanner/status — check if scan is running
router.get('/status', protect, async (req, res) => {
  try {
    const result = await getTop5();
    res.json({
      scanning:     result.scanning,
      scannedAt:    result.scannedAt,
      scannedCount: result.scannedCount,
      universeSize: SCAN_SIZE,
      stale:        result.stale,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
