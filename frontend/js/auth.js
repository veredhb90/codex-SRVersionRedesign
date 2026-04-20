const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const User    = require('../models/User');
const { sendOTP, sendPassword, sendAdminNewUser } = require('../services/emailService');

const genOTP      = () => Math.floor(100000 + Math.random() * 900000).toString();
const genPassword = () => crypto.randomBytes(6).toString('base64url').slice(0, 10);
const signToken   = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { fullName, username, email, phone } = req.body;

    if (!fullName?.trim() || !email?.trim() || !phone?.trim() || !username?.trim())
      return res.status(400).json({ message: 'All fields are required' });
    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: 'Invalid email format' });
    if (!/^\d{1,10}$/.test(phone))
      return res.status(400).json({ message: 'Phone must be digits only, max 10' });
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
      return res.status(400).json({ message: 'Username: 3-20 chars, letters/numbers/underscore only' });

    // Check username uniqueness
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername)
      return res.status(400).json({ message: 'Username already taken. Choose another.' });

    let user = await User.findOne({ email });
    if (user && user.isVerified)
      return res.status(400).json({ message: 'Email already registered. Please log in.' });

    const otp = genOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    if (user) {
      Object.assign(user, { fullName, username: username.toLowerCase(), phone, otpCode: otp, otpExpires });
    } else {
      user = new User({ fullName, username: username.toLowerCase(), email, phone, otpCode: otp, otpExpires });
    }
    await user.save();
    await sendOTP(email, otp);
    res.json({ message: 'Verification code sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.otpCode !== String(code)) return res.status(400).json({ message: 'Invalid verification code' });
    if (user.otpExpires < new Date()) return res.status(400).json({ message: 'Code expired — please register again' });
    const password  = genPassword();
    user.password   = password;
    user.isVerified = true;
    user.otpCode    = undefined;
    user.otpExpires = undefined;
    await user.save();
    await sendPassword(email, password);
    // Notify admin of new registration
    sendAdminNewUser({ fullName: user.fullName, username: user.username, email: user.email, phone: user.phone }).catch(()=>{});
    res.json({ message: 'Account verified! Check your email for your login password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isVerified)
      return res.status(401).json({ message: 'Invalid credentials' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({
      token: signToken(user._id),
      user:  { id: String(user._id), fullName: user.fullName, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/check-username/:username
router.get('/check-username/:username', async (req, res) => {
  try {
    const exists = await User.findOne({ username: req.params.username.toLowerCase() });
    res.json({ available: !exists });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
