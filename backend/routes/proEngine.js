// ═══════════════════════════════════════════════════════════════════
// PRO ENGINE ROUTE — GET /api/pro-engine/:symbol
// Combines standalone technical score + real OpenAI news analysis.
// Protected + Pro-only. Does not touch the existing Signal Engine
// or Scanner routes/services in any way.
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requirePro } = require('../middleware/requirePro');
const { generateProReport } = require('../services/proReportService');

// GET /api/pro-engine/:symbol
router.get('/:symbol', protect, requirePro, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();

    // This always runs the normal Pro flow. The saved report is an immutable
    // history snapshot; it is never used as a replacement for a requested run.
    const report = await generateProReport(symbol);
    res.status(200).json(report);
  } catch (err) {
    console.log('Pro engine error:', err.message);
    res.status(500).json({ message: 'Pro engine analysis failed: ' + err.message });
  }
});

module.exports = router;
