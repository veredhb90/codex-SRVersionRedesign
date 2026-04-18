const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');

// GET /api/notifications — get unread + recent
router.get('/', protect, async (req, res) => {
  try {
    const notifs = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    const unread = notifs.filter(n => !n.read).length;
    res.json({ notifications: notifs, unread });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/notifications/read — mark all as read
router.post('/read', protect, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/notifications — clear all
router.delete('/', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: 'Cleared' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
