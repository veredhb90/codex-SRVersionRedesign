const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ['user', 'ai'], required: true },
  content: { type: String, required: true },
  time:    { type: Date, default: Date.now },
  // Exact Pro Engine snapshots displayed next to this answer. These are UI
  // evidence/history and are deliberately excluded from OpenAI message text.
  reports: { type: [mongoose.Schema.Types.Mixed], default: undefined },
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
