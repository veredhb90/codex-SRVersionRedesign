// ═══════════════════════════════════════════════════════════════════
// requirePro — blocks non-Pro users with a clean upgrade message
// Must be used AFTER the existing `protect` middleware (needs req.user)
// ═══════════════════════════════════════════════════════════════════

const requirePro = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const isPro = typeof req.user.isPro === 'function' ? req.user.isPro() : false;

  if (!isPro) {
    return res.status(403).json({
      message: 'This feature is available for SwingRush Pro members only.',
      requiresPro: true,
      upgradeUrl: '/index.html#pricing',
    });
  }

  next();
};

module.exports = { requirePro };
