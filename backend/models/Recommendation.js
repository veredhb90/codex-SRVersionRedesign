const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 500 },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

const recommendationSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol:       { type: String, required: true, uppercase: true, trim: true },
  companyName:  { type: String },
  entryPrice:   { type: Number, required: true },
  takeProfit:   { type: Number },
  stopLoss:     { type: Number },
  direction:    { type: String, enum: ['BUY', 'SELL'], required: true },
  note:         { type: String, maxlength: 280 },
  currentPrice: { type: Number },
  closePrice:   { type: Number },
  isOpen:       { type: Boolean, default: true },
  outcome:      { type: String, enum: ['WIN', 'LOSS', 'OPEN'], default: 'OPEN' },
  returnPct:    { type: Number, default: 0 },
  openedAt:     { type: Date },
  closedAt:     { type: Date },
  manualClose:  { type: Boolean, default: false },
  customEntryPrice: { type: Boolean, default: false },
  likes:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments:     [commentSchema],

  // Source tracking
  source:       { type: String, enum: ['manual', 'engine', 'repost'], default: 'manual' },
  repostedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation', default: null },
  repostedBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Profile-only flag — does NOT appear in main feed
  profileOnly:  { type: Boolean, default: false },
}, { timestamps: true });

// ── NO unique indexes — users CAN post multiple recs on same symbol ─
// Explicitly ensure no unique compound index exists
recommendationSchema.index({ user: 1, createdAt: -1 }); // for fast profile queries

const Recommendation = mongoose.model('Recommendation', recommendationSchema);

// Drop any legacy unique indexes on startup
Recommendation.collection.getIndexes().then(indexes => {
  Object.keys(indexes).forEach(name => {
    if (name !== '_id_' && indexes[name] && indexes[name].unique) {
      Recommendation.collection.dropIndex(name)
        .then(() => console.log('✅ Dropped unique index:', name))
        .catch(() => {});
    }
  });
}).catch(() => {});

module.exports = Recommendation;
