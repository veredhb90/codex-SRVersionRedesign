const mongoose = require('mongoose');

// Pro Engine output is intentionally stored as one immutable snapshot. Keeping
// the exact structured result means chat, history, and the Pro UI can all refer
// to the same numbers instead of rebuilding or paraphrasing them differently.
const proReportSchema = new mongoose.Schema({
  symbol:      { type: String, required: true, uppercase: true, trim: true },
  report:      { type: mongoose.Schema.Types.Mixed, required: true },
  generatedAt: { type: Date, required: true, default: Date.now },
  freshUntil:  { type: Date, required: true },
  model:       { type: String },
  schemaVersion: { type: Number, default: 1 },
}, { timestamps: true });

proReportSchema.index({ symbol: 1, generatedAt: -1 });

module.exports = mongoose.model('ProReport', proReportSchema);
