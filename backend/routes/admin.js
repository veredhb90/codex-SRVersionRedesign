const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');

// ── Admin-only guard ───────────────────────────────────────────────
// Reads the raw users collection so isAdmin works even if not in the Mongoose schema
const adminOnly = async (req, res, next) => {
  try {
    const raw = await mongoose.connection.db.collection('users')
      .findOne({ _id: new mongoose.Types.ObjectId(req.user._id) });
    if (!raw || raw.isAdmin !== true) {
      return res.status(403).json({ message: 'Admin access only' });
    }
    next();
  } catch (err) {
    res.status(403).json({ message: 'Admin access only' });
  }
};

// ── Auto-expiry: downgrade expired PRO users automatically ─────────
const expireCheck = async () => {
  try {
    if (!mongoose.connection.db) return;
    const r = await mongoose.connection.db.collection('users').updateMany(
      { plan: 'pro', subscriptionEnd: { $lt: new Date() } },
      { $set: { plan: 'free' } }
    );
    if (r.modifiedCount) console.log('⏰ Auto-downgraded ' + r.modifiedCount + ' expired PRO user(s)');
  } catch (e) {}
};
setTimeout(expireCheck, 30 * 1000);              // once shortly after startup
setInterval(expireCheck, 12 * 60 * 60 * 1000);   // then every 12 hours

// ── GET /api/admin/stats ───────────────────────────────────────────
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const col = mongoose.connection.db.collection('users');
    const total  = await col.countDocuments({});
    const pro    = await col.countDocuments({ plan: 'pro' });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newThisWeek = await col.countDocuments({ createdAt: { $gte: weekAgo } });
    const scan = await mongoose.connection.db.collection('scanresults').findOne(
      { key: 'latest' },
      { projection: { scannedAt: 1, scannedCount: 1, technicalResults: 1, newsEnrichedCount: 1, phase: 1, duration: 1, running: 1 } }
    );
    res.json({
      total, pro, free: total - pro, newThisWeek,
      scanner: scan ? {
        scannedAt: scan.scannedAt,
        scannedCount: scan.scannedCount || 0,
        technicalResults: scan.technicalResults || 0,
        newsEnrichedCount: scan.newsEnrichedCount || 0,
        phase: scan.phase || 'idle',
        duration: scan.duration || 0,
        running: Boolean(scan.running),
      } : null,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/admin/scanner/run — manually trigger a full scan ─────
// Fire-and-forget: runFullScan() already no-ops with a log if one is in
// progress (see stockScanner.js's isScanning guard), so this is safe to
// call any time without risking a duplicate/overlapping run.
router.post('/scanner/run', protect, adminOnly, async (req, res) => {
  const { runFullScan } = require('../services/stockScanner');
  runFullScan().catch(err => console.error('Manual scan trigger error:', err.message));
  res.json({ message: 'Scan started' });
});

// ── GET /api/admin/users?search= ───────────────────────────────────
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const query = search
      ? { $or: [
          { email:    { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
        ] }
      : {};
    const users = await mongoose.connection.db.collection('users')
      .find(query)
      .project({ fullName:1, username:1, email:1, plan:1, subscriptionEnd:1, createdAt:1, chatUsed:1, engineUsed:1, isAdmin:1 })
      .sort({ createdAt: -1 })
      .limit(300)
      .toArray();
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/admin/upgrade  { userId, months } ────────────────────
router.post('/upgrade', protect, adminOnly, async (req, res) => {
  try {
    const { userId, months } = req.body;
    const m = Math.max(1, Math.min(24, parseInt(months) || 1));
    const oid = new mongoose.Types.ObjectId(userId);
    const target = await mongoose.connection.db.collection('users').findOne(
      { _id: oid },
      { projection: { subscriptionEnd: 1 } }
    );
    if (!target) return res.status(404).json({ message: 'User not found' });
    const base = target.subscriptionEnd && new Date(target.subscriptionEnd) > new Date()
      ? new Date(target.subscriptionEnd)
      : new Date();
    const end = new Date(base.getTime() + m * 30 * 24 * 60 * 60 * 1000);
    const r = await mongoose.connection.db.collection('users').updateOne(
      { _id: oid },
      { $set: { plan: 'pro', subscriptionEnd: end } }
    );
    if (!r.matchedCount) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'PRO access extended', subscriptionEnd: end });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/admin/downgrade  { userId } ──────────────────────────
router.post('/downgrade', protect, adminOnly, async (req, res) => {
  try {
    const { userId } = req.body;
    const r = await mongoose.connection.db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { plan: 'free' } }
    );
    if (!r.matchedCount) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Downgraded to FREE' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/admin/delete  { userId } ─────────────────────────────
router.post('/delete', protect, adminOnly, async (req, res) => {
  try {
    const { userId } = req.body;
    const oid = new mongoose.Types.ObjectId(userId);
    const target = await mongoose.connection.db.collection('users').findOne({ _id: oid });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.isAdmin) return res.status(400).json({ message: 'Cannot delete an admin account' });
    await mongoose.connection.db.collection('users').deleteOne({ _id: oid });
    // Clean up the user's data so nothing is orphaned (best-effort)
    const cleanup = ['chatsessions', 'recommendations', 'notifications'];
    for (const c of cleanup) {
      try { await mongoose.connection.db.collection(c).deleteMany({ user: oid }); } catch (e) {}
    }
    res.json({ message: 'User deleted — the email and username are free to register again' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
