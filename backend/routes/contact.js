const express = require('express');
const router  = express.Router();
const { sendContactMessage } = require('../services/emailService');

// POST /api/contact
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name?.trim() || !email?.trim() || !message?.trim())
      return res.status(400).json({ message: 'All fields are required' });
    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: 'Invalid email format' });
    if (message.trim().length > 5000)
      return res.status(400).json({ message: 'Message is too long' });

    await sendContactMessage({ name: name.trim(), email: email.trim(), message: message.trim() });
    res.json({ message: 'Message sent! We will get back to you soon.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
