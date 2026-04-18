const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:    { type: String, enum: ['new_rec','win','loss','like','comment','repost','instrument'], required: true },
  title:   { type: String, required: true },
  body:    { type: String, default: '' },
  recId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation' },
  read:    { type: Boolean, default: false },
}, { timestamps: true });

// Index for fast user lookups
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
