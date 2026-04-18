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
  // Instrument subscriptions — persisted in DB
  watchlist:   [{ type: String, uppercase: true, trim: true }],
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
