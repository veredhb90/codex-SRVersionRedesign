const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 20, match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'] },
  fullName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:       { type: String, required: true, match: [/^\d{1,10}$/, 'Phone must be up to 10 digits'] },
  password:    { type: String },
  isVerified:  { type: Boolean, default: false },
  otpCode:     { type: String },
  otpExpires:  { type: Date },
  following:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  watchlist:   [{ type: String, uppercase: true, trim: true }],

  // ── Subscription & Usage ──────────────────────────────────────
  plan:            { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionId:  { type: String }, // Stripe subscription ID
  subscribedAt:    { type: Date },
  subscriptionEnd: { type: Date },

  // Free tier usage tracking
  engineUsed:  { type: Number, default: 0 }, // how many engine analyses used
  chatUsed:    { type: Number, default: 0 }, // how many AI chat messages used
  usageReset:  { type: Date, default: Date.now }, // reset monthly
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Check if user has active subscription
userSchema.methods.isPro = function() {
  if (this.plan === 'pro' && this.subscriptionEnd && this.subscriptionEnd > new Date()) return true;
  return false;
};

// Check engine limit
userSchema.methods.canUseEngine = function() {
  if (this.isPro()) return true;
  return this.engineUsed < 1; // 1 free analysis
};

// Check chat limit
userSchema.methods.canUseChat = function() {
  if (this.isPro()) return true;
  return this.chatUsed < 2; // 2 free chat messages
};

module.exports = mongoose.model('User', userSchema);
