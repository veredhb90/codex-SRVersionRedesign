const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ['user', 'ai'], required: true },
  content: { type: String, required: true },
  time:    { type: Date, default: Date.now },
});

const chatSessionSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:    { type: String, default: 'New Chat' }, // auto-generated from first message
  messages: [messageSchema],
  active:   { type: Boolean, default: true },
}, { timestamps: true });

// Index for fast user lookups
chatSessionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
