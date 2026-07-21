const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Recommendation = require('../models/Recommendation');
const yf   = require('../services/yahooFinance');
const { sendFollowAlert, sendInstrumentAlert, sendWinAlert, sendLossAlert, sendFollowerWinAlert } = require('../services/emailService');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Instrument subscriptions are stored in User.watchlist (persistent)

// ── Outcome checker ────────────────────────────────────────────────
const checkOutcome = async (rec, io) => {
  try {
    const q = await yf.getQuote(rec.symbol);
    const price = q.price;
    if (!price || !rec.isOpen) return rec;
    rec.currentPrice = price;
    const hitTP = rec.direction==='BUY' ? price>=rec.takeProfit : price<=rec.takeProfit;
    const hitSL = rec.stopLoss && (rec.direction==='BUY' ? price<=rec.stopLoss : price>=rec.stopLoss);

    if (hitTP) {
      rec.outcome='WIN'; rec.isOpen=false; rec.closedAt=new Date();
      rec.returnPct=+((Math.abs(rec.takeProfit-rec.entryPrice)/rec.entryPrice)*100).toFixed(2);
      await rec.save();
      io.emit('recommendation:win', { recId:rec._id, symbol:rec.symbol, returnPct:rec.returnPct });

      const author = await User.findById(rec.user).select('fullName username email');

      // ── Notify & email the REC OWNER ─────────────────────────────
      await Notification.create({
        user: rec.user, type:'win',
        title:`🏆 Your $${rec.symbol} call hit Take Profit!`,
        body:`+${rec.returnPct}% return · Great call!`,
        recId: rec._id,
      }).catch(()=>{});
      io.notifyUser && io.notifyUser(String(rec.user), 'notification', {
        type:'win', title:`🏆 Your $${rec.symbol} call hit Take Profit!`,
        body:`+${rec.returnPct}% return · Great call!`, recId:rec._id, time:new Date(),
      });
      if (author?.email) {
        sendWinAlert(author.email, author.username||author.fullName, rec.symbol, rec.returnPct)
          .catch(()=>{});
      }

      // ── Notify followers ──────────────────────────────────────────
      const followers = await User.find({ following:rec.user }).select('_id email');
      followers.forEach(f => {
        io.notifyUser && io.notifyUser(String(f._id), 'notification', {
          type:'win', title:`🏆 @${author?.username||author?.fullName}'s $${rec.symbol} hit Take Profit!`,
          body:`+${rec.returnPct}% return`, recId:rec._id, fromUser:String(rec.user), time:new Date(),
        });
        sendFollowerWinAlert(f.email, '@' + (author?.username || author?.fullName || 'trader'), rec.symbol, rec.returnPct)
          .catch(()=>{});
      });

      // ── Notify instrument watchers ────────────────────────────────
      const winWatchers = await User.find({ watchlist: rec.symbol }).select('_id');
      winWatchers.forEach(w => {
        const wid = String(w._id);
        if (wid !== String(rec.user)) {
          io.notifyUser && io.notifyUser(wid, 'notification', {
            type:'win', title:`🏆 $${rec.symbol} hit Take Profit!`,
            body:`+${rec.returnPct}% — @${author?.username||author?.fullName}`, recId:rec._id, fromUser:String(rec.user), time:new Date(),
          });
        }
      });

    } else if (hitSL) {
      rec.outcome='LOSS'; rec.isOpen=false; rec.closedAt=new Date();
      rec.returnPct=-((Math.abs(rec.stopLoss-rec.entryPrice)/rec.entryPrice)*100).toFixed(2);
      await rec.save();
      io.emit('recommendation:loss', { recId:rec._id, symbol:rec.symbol });

      const author = await User.findById(rec.user).select('fullName username email');

      // ── Notify & email the REC OWNER on LOSS ─────────────────────
      await Notification.create({
        user: rec.user, type:'loss',
        title:`💸 Your $${rec.symbol} call hit Stop Loss`,
        body:`${rec.returnPct}% · Review your analysis`,
        recId: rec._id,
      }).catch(()=>{});
      io.notifyUser && io.notifyUser(String(rec.user), 'notification', {
        type:'loss', title:`💸 Your $${rec.symbol} call hit Stop Loss`,
        body:`${rec.returnPct}% · Review your analysis`, recId:rec._id, time:new Date(),
      });
      if (author?.email) {
        sendLossAlert(author.email, author.username||author.fullName, rec.symbol, rec.returnPct)
          .catch(()=>{});
      }

      // ── Notify followers on LOSS ────────────────────────
      const followers = await User.find({ following:rec.user }).select('_id email');
      followers.forEach(f => {
        io.notifyUser && io.notifyUser(String(f._id), 'notification', {
          type:'loss', title:`💸 @${author?.username||author?.fullName}'s $${rec.symbol} hit Stop Loss`,
          body:`${rec.returnPct}%`, recId:rec._id, fromUser:String(rec.user), time:new Date(),
        });
        if (f.email) {
          sendFollowerLossAlert(f.email, '@' + (author?.username || author?.fullName || 'trader'), rec.symbol, rec.returnPct)
            .catch(()=>{});
        }
      });

    } else { await rec.save(); }
  } catch (e) { console.log('checkOutcome error:', e.message); }
  return rec;
};

// GET /api/recommendations/feed
router.get('/feed', protect, async (req, res) => {
  try {
    const io   = req.app.get('io');
    const page = parseInt(req.query.page) || 1;
    const recs = await Recommendation.find({ profileOnly:{ $ne:true }, source:{ $ne:'repost' } })
      .sort({ createdAt:-1 }).skip((page-1)*20).limit(20)
      .populate('user','fullName username email')
      .populate('comments.user','fullName username')
      .populate({ path:'repostedFrom', populate:{ path:'user', select:'fullName username' } });
    recs.forEach(r => { if (r.isOpen) checkOutcome(r, io); });
    res.json(recs);
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// GET /api/recommendations/following
router.get('/following', protect, async (req, res) => {
  try {
    const freshUser = await User.findById(req.user._id).select('following username fullName');
    const followingIds = freshUser?.following || [];
    if (!followingIds.length) return res.json([]);
    const recs = await Recommendation.find({ user:{ $in:followingIds }, profileOnly:{ $ne:true }, source:{ $ne:'repost' } })
      .sort({ createdAt:-1 }).limit(50)
      .populate('user','fullName username email')
      .populate('comments.user','fullName username');
    res.json(recs);
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// GET /api/recommendations/popular
router.get('/popular', protect, async (req, res) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const popular = await Recommendation.aggregate([
      { $match:{ isOpen:true, profileOnly:{ $ne:true } } },
      { $group:{ _id:'$symbol', count:{$sum:1}, buys:{$sum:{$cond:[{$eq:['$direction','BUY']},1,0]}}, sells:{$sum:{$cond:[{$eq:['$direction','SELL']},1,0]}}, wins:{$sum:{$cond:[{$eq:['$outcome','WIN']},1,0]}} } },
      { $sort:{ count:-1 } }, { $limit:8 },
    ]);
    res.json(popular);
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// GET /api/recommendations/symbol/:symbol
router.get('/symbol/:symbol', protect, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const recs = await Recommendation.find({ symbol, profileOnly:{ $ne:true } })
      .sort({ createdAt:-1 }).limit(50)
      .populate('user','fullName username email')
      .populate('comments.user','fullName username');
    const total=recs.length, buys=recs.filter(r=>r.direction==='BUY').length;
    const wins=recs.filter(r=>r.outcome==='WIN').length, closed=recs.filter(r=>!r.isOpen).length;
    res.json({ symbol, stats:{ total, buys, sells:total-buys, wins, closed, avgReturn:0, winRate:closed>0?+((wins/closed)*100).toFixed(1):0 }, recommendations:recs });
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// POST /api/recommendations/subscribe/:symbol — toggle instrument follow
router.post('/subscribe/:symbol', protect, async (req, res) => {
  try {
    const sym  = req.params.symbol.toUpperCase();
    const user = await User.findById(req.user._id);
    const already = user.watchlist && user.watchlist.includes(sym);
    if (already) {
      await User.findByIdAndUpdate(req.user._id, { $pull: { watchlist: sym } });
    } else {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { watchlist: sym } });
    }
    res.json({ subscribed: !already, symbol: sym });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/recommendations — manual post
router.post('/', protect, async (req, res) => {
  try {
    const io = req.app.get('io');
    const { symbol,takeProfit,direction,note,stopLoss } = req.body;
    const sym = symbol?.trim().toUpperCase();
    if (!sym||!takeProfit||!direction) return res.status(400).json({ message:'Symbol, direction and take profit are required' });
    // Check: user cannot have 2 open recommendations on same symbol
    const existingOpen = await Recommendation.findOne({
      user: req.user._id,
      symbol: sym,
      isOpen: true,
      source: { $ne: 'repost' },
    });
    if (existingOpen) {
      return res.status(400).json({
        message: `You already have an open ${existingOpen.direction} on $${sym}. Close it before posting a new one.`
      });
    }

    const quote = await yf.getQuote(sym);
    if (!quote?.price) return res.status(400).json({ message:'Could not fetch live price' });
    const tp=Number(takeProfit), sl=stopLoss?Number(stopLoss):null;
    if (direction==='BUY'  && tp<=quote.price) return res.status(400).json({ message:'Take profit must be above current price for BUY' });
    if (direction==='SELL' && tp>=quote.price) return res.status(400).json({ message:'Take profit must be below current price for SELL' });
    if (sl&&direction==='BUY'  &&sl>=quote.price) return res.status(400).json({ message:'Stop loss must be below entry for BUY' });
    if (sl&&direction==='SELL' &&sl<=quote.price) return res.status(400).json({ message:'Stop loss must be above entry for SELL' });
    const rec = await Recommendation.create({
      user:req.user._id, symbol:sym, companyName:quote.shortName,
      entryPrice:quote.price, takeProfit:tp, stopLoss:sl,
      direction, note, currentPrice:quote.price, source:'manual', profileOnly:false,
    });
    await rec.populate('user','fullName username email');
    io.emit('recommendation:new', rec);

    // Notify followers + instrument subscribers
    const followers = await User.find({ following:req.user._id }).select('_id email fullName');
    const notified = new Set();

    followers.forEach(f => {
      const fid = String(f._id);
      notified.add(fid);
      io.notifyUser && io.notifyUser(fid, 'notification', {
        type:'new_rec', title:`📡 @${req.user.username||req.user.fullName} posted ${direction} on $${sym}`,
        body:`TP: $${tp} · Entry: $${quote.price.toFixed(2)}`, recId:rec._id, fromUser:String(req.user._id), time:new Date(),
      });
      sendFollowAlert(f.email, '@' + (req.user.username || req.user.fullName), sym, direction, tp).catch(()=>{});
    });

    // Notify instrument subscribers from DB watchlist
    const subscribers = await User.find({
      watchlist: sym,
      _id: { $ne: req.user._id }
    }).select('_id email');
    subscribers.forEach(sub => {
      const subId = String(sub._id);
      if (!notified.has(subId)) {
        // Socket notification
        io.notifyUser && io.notifyUser(subId, 'notification', {
          type:'instrument',
          title:`🔔 New ${direction} on $${sym}`,
          body:`By @${req.user.username||req.user.fullName} · TP: $${tp}`,
          recId: rec._id, fromUser: String(req.user._id), time: new Date(),
        });
        // Email notification
        sendInstrumentAlert(sub.email, sym, direction, '@' + (req.user.username || req.user.fullName), tp, rec._id).catch(()=>{});
      }
    });

    res.status(201).json(rec);
  } catch (err) { console.error(err); res.status(500).json({ message:err.message }); }
});

// POST /api/recommendations/engine-save
router.post('/engine-save', protect, async (req, res) => {
  try {
    const { symbol,entryPrice,takeProfit,stopLoss,direction,note } = req.body;
    const rec = await Recommendation.create({
      user:req.user._id, symbol:symbol.toUpperCase(), companyName:symbol.toUpperCase(),
      entryPrice:Number(entryPrice), takeProfit:Number(takeProfit),
      stopLoss:stopLoss?Number(stopLoss):null, direction, note,
      currentPrice:Number(entryPrice), source:'engine', profileOnly:true,
    });
    await rec.populate('user','fullName username email');
    res.status(201).json(rec);
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// POST /api/recommendations/:id/repost
router.post('/:id/repost', protect, async (req, res) => {
  try {
    const { comment } = req.body;
    const original = await Recommendation.findById(req.params.id).populate('user','fullName username');
    if (!original) return res.status(404).json({ message:'Not found' });
    if (original.user._id.toString()===req.user._id.toString()) return res.status(400).json({ message:"Can't repost your own recommendation" });
    const existing = await Recommendation.findOne({ user:req.user._id, repostedFrom:req.params.id, source:'repost' });
    if (existing) return res.status(400).json({ message:'Already reposted. Undo first.' });
    const repost = await Recommendation.create({
      user:req.user._id, symbol:original.symbol, companyName:original.companyName,
      entryPrice:original.entryPrice, takeProfit:original.takeProfit, stopLoss:original.stopLoss,
      direction:original.direction, note:comment?.trim()||'', currentPrice:original.currentPrice,
      source:'repost', repostedFrom:original._id, profileOnly:false,
    });
    if (!original.repostedBy.map(String).includes(String(req.user._id))) {
      original.repostedBy.push(req.user._id); await original.save();
    }
    // Notify original poster
    const io = req.app.get('io');
    io.notifyUser && io.notifyUser(String(original.user._id), 'notification', {
      type:'repost', title:`↩ @${req.user.username||req.user.fullName} reposted your $${original.symbol} call`,
      body:comment?.trim()||'', recId:original._id, time:new Date(),
    });
    await repost.populate('user','fullName username email');
    await repost.populate({ path:'repostedFrom', populate:{ path:'user', select:'fullName username' } });
    res.status(201).json(repost);
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// DELETE /api/recommendations/:id/repost
router.delete('/:id/repost', protect, async (req, res) => {
  try {
    const repost = await Recommendation.findOne({ user:req.user._id, repostedFrom:req.params.id, source:'repost' });
    if (!repost) return res.status(404).json({ message:'Repost not found' });
    await Recommendation.findByIdAndUpdate(req.params.id, { $pull:{ repostedBy:req.user._id } });
    await repost.deleteOne();
    res.json({ message:'Repost removed' });
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// POST /api/recommendations/:id/like
router.post('/:id/like', protect, async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id).populate('user','_id');
    if (!rec) return res.status(404).json({ message:'Not found' });
    const liked = rec.likes.some(id => String(id) === String(req.user._id));
    if (!liked) rec.likes.push(req.user._id);
    else rec.likes = rec.likes.filter(id => String(id) !== String(req.user._id));
    await rec.save();
    // Notify rec owner when liked (not when unliked)
    if (!liked && String(rec.user._id) !== String(req.user._id)) {
      const io = req.app.get('io');
      io.notifyUser && io.notifyUser(String(rec.user._id), 'notification', {
        type:'like', title:`❤️ @${req.user.username||req.user.fullName} liked your $${rec.symbol} call`,
        body:'', recId:rec._id, time:new Date(),
      });
    }
    res.json({ likes:rec.likes.length, liked: !liked });
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// GET /api/recommendations/:id/likes — who liked this call
router.get('/:id/likes', protect, async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id).select('likes');
    if (!rec) return res.status(404).json({ message:'Not found' });
    const users = await require('../models/User')
      .find({ _id: { $in: rec.likes || [] } })
      .select('username fullName');
    res.json(users);
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// POST /api/recommendations/:id/comment
router.post('/:id/comment', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message:'Comment cannot be empty' });
    const rec = await Recommendation.findById(req.params.id).populate('user','_id fullName');
    if (!rec) return res.status(404).json({ message:'Not found' });
    rec.comments.push({ user:req.user._id, text:text.trim() });
    await rec.save();
    await rec.populate('comments.user','fullName username');
    const newComment = rec.comments[rec.comments.length-1];
    const io = req.app.get('io');
    io.emit('recommendation:comment', { recId:rec._id, comment:newComment });
    // Notify rec owner
    if (String(rec.user._id) !== String(req.user._id)) {
      io.notifyUser && io.notifyUser(String(rec.user._id), 'notification', {
        type:'comment', title:`💬 @${req.user.username||req.user.fullName} commented on your $${rec.symbol} call`,
        body:text.trim().slice(0,60), recId:rec._id, time:new Date(),
      });
    }
    // Notify mentioned users (@username replies)
    try {
      const mentions = [...new Set((text.match(/@([a-zA-Z0-9_.-]+)/g) || []).map(m => m.slice(1)))].slice(0, 5);
      if (mentions.length) {
        const mentioned = await User.find({ username: { $in: mentions } }).select('_id');
        mentioned.forEach(mu => {
          if (String(mu._id) === String(req.user._id)) return;
          if (String(mu._id) === String(rec.user._id)) return;
          io.notifyUser && io.notifyUser(String(mu._id), 'notification', {
            type:'comment', title:`↩ @${req.user.username||req.user.fullName} replied to you on $${rec.symbol}`,
            body:text.trim().slice(0,60), recId:rec._id, fromUser:String(rec.user._id), time:new Date(),
          });
        });
      }
    } catch (e) {}
    res.status(201).json(newComment);
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// DELETE /api/recommendations/:id/comment/:commentId
router.delete('/:id/comment/:commentId', protect, async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id);
    if (!rec) return res.status(404).json({ message:'Not found' });
    const comment = rec.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message:'Comment not found' });
    if (comment.user.toString()!==req.user._id.toString()) return res.status(403).json({ message:'Not your comment' });
    comment.deleteOne(); await rec.save();
    res.json({ message:'Deleted' });
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// GET /api/recommendations/watchlist
router.get('/watchlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('watchlist');
    res.json({ watchlist: user.watchlist || [] });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/recommendations/:id/owner — whose call is this
router.get('/:id/owner', protect, async (req, res) => {
  try {
    const rec = await Recommendation.findById(req.params.id).select('user');
    if (!rec) return res.status(404).json({ message:'Not found' });
    res.json({ userId: String(rec.user) });
  } catch (err) { res.status(500).json({ message:err.message }); }
});

// GET /api/recommendations/activity — platform live activity
router.get('/activity', protect, async (req, res) => {
  try {
    const [recent, closed, cmts] = await Promise.all([
      Recommendation.find({ profileOnly: { $ne: true } }).sort({ createdAt: -1 }).limit(15)
        .populate('user', 'username fullName').select('symbol direction user createdAt'),
      Recommendation.find({ isOpen: false }).sort({ closedAt: -1 }).limit(15)
        .populate('user', 'username fullName').select('symbol direction outcome user closedAt returnPct'),
      Recommendation.aggregate([
        { $unwind: '$comments' },
        { $sort: { 'comments.createdAt': -1 } },
        { $limit: 15 },
        { $lookup: { from: 'users', localField: 'comments.user', foreignField: '_id', as: 'cu' } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'ou' } },
        { $project: { symbol:1, 'comments.text':1, 'comments.createdAt':1, cu: { $arrayElemAt: ['$cu', 0] }, ou: { $arrayElemAt: ['$ou', 0] } } },
      ]),
    ]);
    const acts = [];
    recent.forEach(r => acts.push({ kind:'new', at:r.createdAt, symbol:r.symbol, direction:r.direction, recId:String(r._id), userId:String(r.user?._id||''), username:r.user?.username||r.user?.fullName||'trader' }));
    closed.forEach(r => acts.push({ kind: r.outcome==='WIN'?'tp':'sl', at:r.closedAt, symbol:r.symbol, direction:r.direction, recId:String(r._id), userId:String(r.user?._id||''), username:r.user?.username||r.user?.fullName||'trader', returnPct:r.returnPct }));
    cmts.forEach(x => {
      const txt = String((x.comments && x.comments.text) || '');
      const isReply = /^@[a-zA-Z0-9_.\-]+\s/.test(txt);
      acts.push({ kind: isReply ? 'reply' : 'comment', at: x.comments && x.comments.createdAt, symbol: x.symbol, recId: String(x._id), userId: String((x.ou && x.ou._id) || ''), username: (x.cu && (x.cu.username || x.cu.fullName)) || 'trader', text: txt.slice(0, 50) });
    });
    acts.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    res.json(acts.slice(0, 25));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
