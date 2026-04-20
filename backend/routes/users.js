const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User           = require('../models/User');
const Recommendation = require('../models/Recommendation');

function computeStats(recs) {
  const myRecs = recs.filter(r => !r.source || r.source === 'manual');
  const closed  = myRecs.filter(r => r.outcome !== 'OPEN');
  const wins    = closed.filter(r => r.outcome === 'WIN').length;
  const winRate = closed.length > 0 ? +((wins / closed.length) * 100).toFixed(1) : 0;
  const totalRet = myRecs.reduce((s, r) => s + (r.returnPct || 0), 0);
  return {
    total: myRecs.length, open: myRecs.filter(r => r.isOpen).length,
    closed: closed.length, wins, losses: closed.length - wins,
    winRate, totalReturn: +totalRet.toFixed(2),
    avgReturn: myRecs.length > 0 ? +(totalRet / myRecs.length).toFixed(2) : 0,
  };
}

// GET /api/users/search?q=... — MUST be before /:id
router.get('/search', protect, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) return res.json([]);
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } },
      ],
      isVerified: true,
    })
    .select('fullName username followers following')
    .limit(10);
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/users/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -otpCode')
      .populate('following', 'fullName username email')
      .populate('followers', 'fullName username email');
    const recs = await Recommendation.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('comments.user', 'fullName username')
      .populate({ path: 'repostedFrom', populate: { path: 'user', select: 'fullName username' } })
      .lean();
    res.json({ user, stats: computeStats(recs), recommendations: recs });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/users/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -otpCode -phone')
      .populate('following', 'fullName username email')
      .populate('followers', 'fullName username email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const recs = await Recommendation.find({
      user: req.params.id,
      $or: [{ source: 'manual' }, { source: 'repost' }, { source: { $exists: false } }]
    })
      .sort({ createdAt: -1 })
      .populate('comments.user', 'fullName username')
      .populate({ path: 'repostedFrom', populate: { path: 'user', select: 'fullName username' } })
      .lean();
    const isFollowing = req.user.following.map(String).includes(req.params.id);
    res.json({ user, stats: computeStats(recs), recommendations: recs, isFollowing });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/users/:id/follow
router.post('/:id/follow', protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: "Can't follow yourself" });
    const target  = await User.findById(req.params.id);
    const current = await User.findById(req.user._id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    const already = current.following.map(String).includes(req.params.id);
    if (already) {
      current.following.pull(req.params.id);
      target.followers.pull(req.user._id);
    } else {
      current.following.push(req.params.id);
      target.followers.push(req.user._id);
    }
    await Promise.all([current.save(), target.save()]);
    res.json({ following: !already });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
