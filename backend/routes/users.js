const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User           = require('../models/User');
const Recommendation = require('../models/Recommendation');

function computeStats(recs) {
  const myRecs = recs.filter(r => !r.source || r.source === 'manual');
  const closed  = myRecs.filter(r => r.outcome !== 'OPEN');
  const open    = myRecs.filter(r => r.isOpen);
  const wins    = closed.filter(r => r.outcome === 'WIN').length;
  const winRate = closed.length > 0 ? +((wins / closed.length) * 100).toFixed(1) : 0;
  const tradeReturn = r => {
    if (!r.isOpen) return Number(r.returnPct || 0);
    const entry = Number(r.entryPrice || 0);
    const current = Number(r.currentPrice || entry);
    if (!entry || !Number.isFinite(current)) return 0;
    return r.direction === 'SELL'
      ? ((entry - current) / entry) * 100
      : ((current - entry) / entry) * 100;
  };
  const openReturn = open.reduce((sum, r) => sum + tradeReturn(r), 0);
  const closedReturn = closed.reduce((sum, r) => sum + tradeReturn(r), 0);
  const totalRet = openReturn + closedReturn;
  return {
    total: myRecs.length, open: open.length,
    closed: closed.length, wins, losses: closed.length - wins,
    winRate, totalReturn: +totalRet.toFixed(2),
    openReturn: +openReturn.toFixed(2),
    closedReturn: +closedReturn.toFixed(2),
    avgReturn: myRecs.length > 0 ? +(totalRet / myRecs.length).toFixed(2) : 0,
  };
}

// GET /api/users/search?q=... — MUST be before /:id
router.get('/search', protect, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) return res.json([]);
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
    const conditions = words.map(w => ({
      $or: [
        { username: { $regex: esc(w), $options: 'i' } },
        { fullName: { $regex: esc(w), $options: 'i' } },
      ],
    }));
    const users = await User.find({
      $and: conditions,
      isVerified: true,
    })
    .select('fullName username avatar followers following')
    .limit(10);
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/users/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -otpCode')
      .populate('following', 'fullName username email avatar')
      .populate('followers', 'fullName username email avatar');
    const recs = await Recommendation.find({ user: req.user._id })
      .sort({ openedAt: -1, createdAt: -1 })
      .populate('comments.user', 'fullName username')
      .populate({ path: 'repostedFrom', populate: { path: 'user', select: 'fullName username' } })
      .lean();
    res.json({ user, stats: computeStats(recs), recommendations: recs });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/users/me/avatar  { image: 'data:image/jpeg;base64,...' }
// The client resizes/compresses to a small thumbnail before sending — this
// cap is just a safety net against someone bypassing that and posting a
// full-size image straight at the API.
const MAX_AVATAR_DATAURL_LENGTH = 600_000; // ~450KB decoded
router.post('/me/avatar', protect, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') return res.status(400).json({ message: 'image required' });
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) {
      return res.status(400).json({ message: 'Image must be a JPEG, PNG or WebP data URL' });
    }
    if (image.length > MAX_AVATAR_DATAURL_LENGTH) {
      return res.status(413).json({ message: 'Image too large — please use a smaller photo' });
    }
    req.user.avatar = image;
    await req.user.save();
    res.json({ avatar: req.user.avatar });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/users/me/avatar — revert to initials
router.delete('/me/avatar', protect, async (req, res) => {
  try {
    req.user.avatar = null;
    await req.user.save();
    res.json({ message: 'Profile photo removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/users/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -otpCode -phone')
      .populate('following', 'fullName username email avatar')
      .populate('followers', 'fullName username email avatar');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const recs = await Recommendation.find({
      user: req.params.id,
      $or: [{ source: 'manual' }, { source: 'repost' }, { source: { $exists: false } }]
    })
      .sort({ openedAt: -1, createdAt: -1 })
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
    if (!already) {
      try {
        const title = '👤 ' + (current.username || current.fullName) + ' started following you!';
        const io = req.app.get('io');
        io && io.notifyUser && io.notifyUser(String(target._id), 'notification', { type:'follow', title, body:'Visit their profile to follow back.', fromUser:String(current._id), time:new Date() });
        if (target.email) {
          const { sendNewFollowerAlert } = require('../services/emailService');
          sendNewFollowerAlert(target.email, current.fullName || current.username, current.username)
            .catch(e => console.log('New follower email failed:', e.message));
        }
      } catch (e) { console.log('Follow notif error:', e.message); }
    }
    res.json({ following: !already });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
