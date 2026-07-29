const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Recommendation = require('../models/Recommendation');
const User = require('../models/User');

router.get('/', protect, async (req, res) => {
  try {
    // Rank only original manual trades. Open trades use their latest stored market value.
    const trades = await Recommendation.find({ $or:[{ source:'manual' }, { source:{ $exists:false } }] })
      .select('user outcome returnPct entryPrice currentPrice direction isOpen')
      .lean();

    console.log('Leaderboard: found', trades.length, 'manual trades');

    if (!trades.length) {
      return res.json({ byWinRate: [], byTotalReturn: [] });
    }

    // Group by user manually
    const userStats = {};
    trades.forEach(r => {
      const uid = String(r.user);
      if (!userStats[uid]) {
        userStats[uid] = { total: 0, closed: 0, wins: 0, totalReturn: 0 };
      }
      userStats[uid].total++;
      if (!r.isOpen) {
        userStats[uid].closed++;
        if (r.outcome === 'WIN') userStats[uid].wins++;
      }
      const entry = Number(r.entryPrice || 0);
      const current = Number(r.currentPrice || entry);
      const liveReturn = entry && Number.isFinite(current)
        ? (r.direction === 'SELL' ? ((entry-current)/entry)*100 : ((current-entry)/entry)*100)
        : 0;
      userStats[uid].totalReturn += r.isOpen ? liveReturn : Number(r.returnPct || 0);
    });

    // Get user details
    const userIds = Object.keys(userStats);
    const users   = await User.find({ _id: { $in: userIds } })
      .select('fullName username followers').lean();

    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const enriched = userIds
      .filter(uid => userMap[uid])
      .map(uid => {
        const s = userStats[uid];
        const u = userMap[uid];
        return {
          userId:      uid,
          fullName:    u.fullName,
          username:    u.username,
          followers:   u.followers?.length || 0,
          total:       s.total,
          wins:        s.wins,
          losses:      s.closed - s.wins,
          winRate:     s.closed ? +(s.wins / s.closed * 100).toFixed(1) : 0,
          totalReturn: +s.totalReturn.toFixed(2),
          avgReturn:   +(s.totalReturn / s.total).toFixed(2),
        };
      });

    console.log('Leaderboard enriched:', enriched.length, 'traders');

    const byWinRate     = [...enriched].filter(t => t.wins + t.losses > 0).sort((a,b) => b.winRate - a.winRate || b.total - a.total).slice(0,10);
    const byTotalReturn = [...enriched].sort((a,b) => b.totalReturn - a.totalReturn).slice(0,10);

    res.json({ byWinRate, byTotalReturn });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
